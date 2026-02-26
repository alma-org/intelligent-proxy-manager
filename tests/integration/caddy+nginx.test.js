import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { startCaddy } from "./helpers/startCaddyContainer.js";
import { waitForHttps } from "./helpers/waitForHttps.js";
import { waitForHttp } from "./helpers/waitForHttp.js";
import net from "net";
import http from "http";
import https from "https";
import { startNginxFromFile } from "./helpers/startNginxFromFile.js";
import { startMockLLMBackend } from "./helpers/startMockLLMBackend.js";
import { Network } from "testcontainers";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { generateDevCertificates } from "../caddy/helpers/generateCerts.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe.sequential("Caddy HTTPS + Nginx integration test", () => {
  let network;
  let caddy;
  let nginx;
  let mockBackend;
  let caddyHttpsPort;
  let caddyHttpPort;

  let tempFiles = [];

  beforeAll(async () => {
    try {
      const uniqueSuffix = Math.random().toString(36).substring(2, 9);
      network = await new Network().start();
      console.error("Network started:", network.getName());

      const configDir = path.join(__dirname, "config");
      
      console.error("Generating certificates...");
      generateDevCertificates({
        dir: configDir,
        domain: "alma.test"
      });
      tempFiles.push(path.join(configDir, "openssl.cnf"));
      tempFiles.push(path.join(configDir, "test-cert.pem"));
      tempFiles.push(path.join(configDir, "test-key.pem"));

      const mockBackendName = `mock-backend-${uniqueSuffix}`;
      const nginxName = `nginx-proxy-${uniqueSuffix}`;

      console.error("Starting Mock Backend...");
      mockBackend = await startMockLLMBackend({
        containerName: mockBackendName,
        containerPort: 8080,
        network,
      });
      console.error("Mock Backend started");

      const nginxConfPath = process.env.NGINX_FILE_TO_TEST || path.join(__dirname, "config", "nginx.conf");
      if (!fs.existsSync(nginxConfPath)) {
        throw new Error(`Nginx config file not found: ${nginxConfPath}`);
      }
      let nginxConf = fs.readFileSync(nginxConfPath, "utf8");
      
      // Replace any 127.0.0.1:PORT or mock-backend:8080 with the actual container name
      nginxConf = nginxConf.replace(/(127\.0\.0\.1|mock-backend):\d+/g, `${mockBackendName}:8080`);
      
      const finalNginxConfPath = path.join(__dirname, "config", `nginx.conf.${uniqueSuffix}`);
      fs.writeFileSync(finalNginxConfPath, nginxConf);
      tempFiles.push(finalNginxConfPath);

      console.error("Starting Nginx...");
      nginx = await startNginxFromFile({
        nginxConfPath: finalNginxConfPath,
        nginxPort: 8080,
        network,
        containerName: nginxName,
      });
      console.error("Nginx started");

      console.error("Starting Caddy...");
      caddy = await startCaddy({
        backendPort: 8080,
        caddyRedirectionHost: nginxName,
        network,
        configDir: path.join(__dirname, "config")
      });
      if (caddy.caddyfilePath) tempFiles.push(caddy.caddyfilePath);
      
      caddyHttpsPort = caddy.httpsPort;
      caddyHttpPort = caddy.httpPort;
      console.error("Caddy started, mapped ports:", { caddyHttpsPort, caddyHttpPort });

      console.error("Waiting for HTTPS...");
      await waitForHttps({
        port: caddyHttpsPort,
        timeout: 60000,
      });
      console.error("HTTPS is ready");
    } catch (error) {
      console.error("Error in beforeAll:", error);
      throw error;
    }
  }, 120000);

  afterAll(async () => {
    console.log("Cleaning up containers...");
    try {
      if (caddy?.container) await caddy.container.stop({ remove: true }).catch(err => console.warn("Error stopping caddy:", err.message));
      if (nginx?.container) await nginx.container.stop({ remove: true }).catch(err => console.warn("Error stopping nginx:", err.message));
      if (mockBackend?.container) await mockBackend.container.stop({ remove: true }).catch(err => console.warn("Error stopping mockBackend:", err.message));
      if (network) await network.stop({ remove: true }).catch(err => console.warn("Error stopping network:", err.message));
      
      console.log("Cleaning up temporary config files...");
      for (const file of tempFiles) {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
          console.log(`Deleted: ${file}`);
        }
      }
    } catch (e) {
      console.error("Final cleanup error:", e);
    }
  });

  it("should respond with 404 on the root (Caddy default)", async () => {
    const res = await waitForHttps({ port: caddyHttpsPort });
    expect(res.statusCode).toBe(404);
  });

  it("should redirect HTTP to HTTPS", async () => {
    const res = await waitForHttp({ port: caddyHttpPort });
    expect([301, 308]).toContain(res.statusCode);
    expect(res.headers["location"]).toMatch(/^https:\/\//);
  });

  it("should forward requests through Caddy -> Nginx -> Mock Backend", async () => {
    const res = await new Promise((resolve, reject) => {
      const agent = new https.Agent({ rejectUnauthorized: false });
      const req = https.request({
        hostname: "localhost",
        port: caddyHttpsPort,
        method: "POST",
        agent,
        servername: "alma.test",
        headers: { 
          Host: "alma.test",
          apikey: "1b0e1bfa203530d43a0bd8461aa018b7" // Test API key from nginx.conf
        },
        path: "/engine/v1/chat/completions",
      }, resolve);
      req.on("error", reject);
      req.end();
    });

    expect(res.statusCode).toBe(200);
    
    let data = "";
    for await (const chunk of res) {
      data += chunk;
    }
    const json = JSON.parse(data);
    expect(json.object).toBe("chat.completion");
  });

  it("Nginx should return 401 if no API key is provided", async () => {
    const res = await new Promise((resolve, reject) => {
      const agent = new https.Agent({ rejectUnauthorized: false });
      const req = https.request({
        hostname: "localhost",
        port: caddyHttpsPort,
        method: "POST",
        agent,
        servername: "alma.test",
        headers: { Host: "alma.test" },
        path: "/engine/v1/chat/completions",
      }, resolve);
      req.on("error", reject);
      req.end();
    });

    expect(res.statusCode).toBe(401);
  });

  it("Nginx should return 403 if an invalid API key is provided", async () => {
    const res = await new Promise((resolve, reject) => {
      const agent = new https.Agent({ rejectUnauthorized: false });
      const req = https.request({
        hostname: "localhost",
        port: caddyHttpsPort,
        method: "POST",
        agent,
        servername: "alma.test",
        headers: { 
          Host: "alma.test",
          apikey: "invalid-key"
        },
        path: "/engine/v1/chat/completions",
      }, resolve);
      req.on("error", reject);
      req.end();
    });

    expect(res.statusCode).toBe(403);
  });
});
