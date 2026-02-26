import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { startCaddy } from "./helpers/startCaddyContainer.js";
import { waitForHttps } from "./helpers/waitForHttps.js";
import { startNginxFromFile } from "./helpers/startNginxFromFile.js";
import { startMockLLMBackend } from "./helpers/startMockLLMBackend.js";
import { generateTestNginxConf } from "../nginx/helpers/generateTestNginxConf.js";
import { generateDevCertificates } from "../caddy/helpers/generateCerts.js";
import { Network } from "testcontainers";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import https from "https";
import logger from "../logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- SLA Parsing Logic (Inspired by nginx.429.redirection.test.js) ---
const confPath = process.env.NGINX_FILE_TO_TEST;
if (!confPath || !fs.existsSync(confPath)) {
  throw new Error("NGINX_FILE_TO_TEST is undefined or does not exist");
}

const conf = fs.readFileSync(confPath, "utf-8");
const apikeyRegex = /~\(\s*([a-f0-9]+)\s*\)/g;
const clientRegex = /"\s*([a-zA-Z0-9_\-]+)\s*"/g;
const limitReqRegex = /zone=([a-zA-Z0-9_\-]+):[0-9a-z]+ rate=(\d+)r\/m/g;

const apikeys = [];
const clients = [];
const limits = {};

let match;
while ((match = apikeyRegex.exec(conf)) !== null) apikeys.push(match[1].trim());
while ((match = clientRegex.exec(conf)) !== null) {
  if (!match[1].match(/^[a-f0-9]+$/)) clients.push(match[1].trim());
}
while ((match = limitReqRegex.exec(conf)) !== null) {
  const zone = match[1].trim();
  const rate = parseInt(match[2]);
  limits[zone] = rate;
}

if (apikeys.length !== clients.length) {
  throw new Error("Apikeys and client numbers are not the same. Check your nginx.conf");
}

const mapEntries = apikeys.map((k, i) => ({ apikey: k, client: clients[i] }));
// ---------------------------------------------------------------------

describe.sequential("Caddy + Nginx 429 Integration Tests (SLAs)", () => {
  let network;
  let caddy;
  let nginx;
  let mockBackend;
  let caddyHttpsPort;
  let tempFiles = [];

  beforeAll(async () => {
    try {
      const uniqueSuffix = Math.random().toString(36).substring(2, 9);
      network = await new Network().start();

      const configDir = path.join(__dirname, "config");
      
      logger.info("Generating certificates...");
      generateDevCertificates({
        dir: configDir,
        domain: "alma.test"
      });
      tempFiles.push(path.join(configDir, "openssl.cnf"));
      tempFiles.push(path.join(configDir, "test-cert.pem"));
      tempFiles.push(path.join(configDir, "test-key.pem"));

      const mockBackendName = `mock-backend-429-${uniqueSuffix}`;
      const nginxName = `nginx-proxy-429-${uniqueSuffix}`;

      logger.info("Starting Mock Backend...");
      mockBackend = await startMockLLMBackend({
        containerName: mockBackendName,
        containerPort: 8080,
        network,
      });

      logger.info("Generating Nginx config...");
      const finalNginxConfPath = generateTestNginxConf({
        originalConfPath: confPath,
        backendHost: mockBackendName,
        backendPort: 8080,
        uniqueSuffix
      });
      tempFiles.push(finalNginxConfPath);

      logger.info("Starting Nginx...");
      nginx = await startNginxFromFile({
        nginxConfPath: finalNginxConfPath,
        nginxPort: 8080,
        network,
        containerName: nginxName,
      });

      logger.info("Starting Caddy...");
      caddy = await startCaddy({
        backendPort: 8080,
        caddyRedirectionHost: nginxName,
        network,
        configDir: configDir
      });
      if (caddy.caddyfilePath) tempFiles.push(caddy.caddyfilePath);
      
      caddyHttpsPort = caddy.httpsPort;

      logger.info("Waiting for HTTPS stack to be ready...");
      await waitForHttps({
        port: caddyHttpsPort,
        timeout: 60000,
      });
    } catch (error) {
      logger.error(`Error in beforeAll: ${error.message}`);
      throw error;
    }
  }, 120000);

  afterAll(async () => {
    logger.info("Cleaning up 429 integration environment...");
    try {
      if (caddy?.container) await caddy.container.stop({ remove: true }).catch(err => logger.warn(`Error stopping caddy: ${err.message}`));
      if (nginx?.container) await nginx.container.stop({ remove: true }).catch(err => logger.warn(`Error stopping nginx: ${err.message}`));
      if (mockBackend?.container) await mockBackend.container.stop({ remove: true }).catch(err => logger.warn(`Error stopping mockBackend: ${err.message}`));
      if (network) await network.stop({ remove: true }).catch(err => logger.warn(`Error stopping network: ${err.message}`));
      
      for (const file of tempFiles) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          logger.info(`Deleted: ${file}`);
        }
      }
    } catch (e) {
      logger.error(`Final cleanup error: ${e.message}`);
    }
  });

  mapEntries.forEach(({ apikey, client }) => {
    const endpoint = `/engine/v1/chat/completions`;
    const rateLimit = limits[`${client}_v1chatcompletions_POST`];

    if (rateLimit !== undefined) {
      it(`should enforce ${rateLimit} r/m for client ${client} through Caddy`, async () => {
        const body = JSON.stringify({
          model: "Qwen/Qwen2.5-Coder-32B-Instruct",
          messages: [{ role: "user", content: "hi" }]
        });

        const agent = new https.Agent({ rejectUnauthorized: false });

        for (let i = 0; i < rateLimit + 1; i++) {
          const res = await new Promise((resolve, reject) => {
            const req = https.request({
              hostname: "localhost",
              port: caddyHttpsPort,
              method: "POST",
              agent,
              servername: "alma.test",
              headers: { 
                Host: "alma.test",
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
                apikey: apikey 
              },
              path: endpoint,
            }, resolve);
            req.on("error", reject);
            req.write(body);
            req.end();
          });

          const isExpected429 = i >= rateLimit;
          logger.debug(`[${client}] Request ${i + 1}/${rateLimit} -> Status ${res.statusCode}`);

          if (!isExpected429) {
            expect(res.statusCode).toBe(200);
            // Consume data to avoid memory leaks
            for await (const _ of res);
          } else {
            expect(res.statusCode).toBe(429);
          }
        }
      }, 30000);
    }
  });
});
