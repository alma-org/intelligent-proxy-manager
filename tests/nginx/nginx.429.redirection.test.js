import http from "http";
import fs from "fs";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { Network } from "testcontainers";
import { startNginxFromFile } from "./helpers/startNginxFromFile.js";
import { startMockLLMBackend } from "./helpers/startMockLLMBackend.js";
import { generateTestNginxConf } from "./helpers/generateTestNginxConf.js";
import logger from "../logger.js";

const confPath = process.env.NGINX_FILE_TO_TEST;
if (!confPath || !fs.existsSync(confPath)) {
  throw new Error("NGINX_FILE_TO_TEST is undefined or does not exist");
}

const conf = fs.readFileSync(confPath, "utf-8");
const apikeyRegex = /~\(\s*([a-f0-9]+)\s*\)/g;
const clientRegex = /"\s*([a-zA-Z0-9_\-]+)\s*"/g;
const limitReqRegex = /zone=([a-zA-Z0-9_\-]+):[0-9a-z]+ rate=(\d+)r\/m/g;
const uriRegex = /if\s*\(\s*\$uri\s*=\s*(\/[^\s)]+)\s*\)/;

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

const firstUri = uriRegex.exec(conf)?.[1] ?? null;

if (apikeys.length !== clients.length) {
  throw new Error("Apikeys and client numbers are not the same. Check your nginx.conf");
}
if (!firstUri) {
  throw new Error("Could not parse a URI path from NGINX_FILE_TO_TEST. Check your nginx.conf");
}

const mapEntries = apikeys.map((k, i) => ({ apikey: k, client: clients[i] }));

describe.sequential("Nginx reverse proxy 429 with mock backend (validate 200 before limit)", () => {
  const backendContainerName = "backend-llm-mock-for-redirection-429";
  const backendContainerPort = 8008;
  const nginxContainerName = `nginx-test-429-with-backend-${Date.now()}`
  let nginx;
  let backend;
  let port;
  let network;
  let tempConf;

  beforeAll(async () => {
    network = await new Network().start();

    backend = await startMockLLMBackend({
      containerName: backendContainerName,
      containerPort: backendContainerPort,
      network
    });

    const uniqueSuffix = Math.random().toString(36).substring(2, 9);
    const testConf = generateTestNginxConf({
      originalConfPath: process.env.NGINX_FILE_TO_TEST,
      backendHost: backend.containerName,
      backendPort: backendContainerPort,
      uniqueSuffix
    });
    tempConf = testConf;

    nginx = await startNginxFromFile({
      nginxConfPath: testConf,
      nginxPort: 8080,
      network,
      containerName: nginxContainerName
    });

    port = nginx.httpPort;
  });

  afterAll(async () => {
    if (nginx?.container) await nginx.container.stop({ remove: true });
    if (backend?.container) await backend.container.stop({ remove: true });
    if (network) await network.stop({ remove: true });
    if (tempConf && fs.existsSync(tempConf)) {
      fs.unlinkSync(tempConf);
    }
  });

  mapEntries.forEach(({ apikey, client }) => {
    const endpoint = firstUri;
    const zone = Object.keys(limits).find(z => z.startsWith(`${client}_`));
    const maxRequests = zone ? limits[zone] : null;

    it(`should return 200 for the first ${maxRequests} requests and 429 afterwards at ${endpoint}`, async () => {
      const body = JSON.stringify({
        model: "Qwen/Qwen2.5-Coder-32B-Instruct",
        messages: [
          { role: "system", content: "Eres un asistente útil." },
          { role: "user", content: "Hola, prueba que estás funcionando." }
        ]
      });

      let response;

      for (let i = 0; i < maxRequests + 1; i++) {
        response = await new Promise(resolve => {
          const req = http.request(
            {
              hostname: "127.0.0.1",
              port,
              path: endpoint,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
                "apikey": apikey
              }
            },
            resolve
          );
          req.write(body);
          req.end();
        });

        const expectingLimitExceeded = i >= maxRequests;

        logger.debug(`[${client}] req ${i + 1}/${maxRequests} → status ${response.statusCode}`);

        if (!expectingLimitExceeded) {
          expect(response.statusCode).toBe(200);

          let data = await new Promise(res => {
            let chunks = "";
            response.on("data", chunk => (chunks += chunk));
            response.on("end", () => res(chunks));
          });

          const json = JSON.parse(data);

          expect(json).toHaveProperty("id");
          expect(json).toHaveProperty("object", "chat.completion");
          expect(json).toHaveProperty("created");
          expect(json).toHaveProperty("model", "Qwen/Qwen2.5-Coder-32B-Instruct");
          expect(json).toHaveProperty("choices");
          expect(Array.isArray(json.choices)).toBe(true);
          expect(json.choices[0]).toHaveProperty("index", 0);
          expect(json.choices[0]).toHaveProperty("message");
          expect(json.choices[0].message).toHaveProperty("role", "assistant");
          expect(json.choices[0].message).toHaveProperty("content");
          expect(json).toHaveProperty("usage");
          expect(json.usage).toHaveProperty("prompt_tokens");
          expect(json.usage).toHaveProperty("total_tokens");
          expect(json.usage).toHaveProperty("completion_tokens");

        } else {
          expect(response.statusCode).toBe(429);
        }

        // await sleep(1000);
      }



    });
  });
});
