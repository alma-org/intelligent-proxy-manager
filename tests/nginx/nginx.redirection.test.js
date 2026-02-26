import http from "http";
import fs from "fs";
import path from "path";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { Network } from "testcontainers";
import { startNginxFromFile } from "./helpers/startNginxFromFile.js";
import { startMockLLMBackend } from "./helpers/startMockLLMBackend.js";
import { generateTestNginxConf } from "./helpers/generateTestNginxConf.js";
import logger from "../logger.js"

const confPath = process.env.NGINX_FILE_TO_TEST;
const nginxContainerName = `nginx-test-redirection-${Date.now()}`

if (!confPath || !fs.existsSync(confPath)) {
  throw new Error("NGINX_FILE_TO_TEST is undefined or does not exist");
}

const conf = fs.readFileSync(confPath, "utf-8");
const apikeyRegex = /~\(\s*([a-f0-9]+)\s*\)/g;
const clientRegex = /"\s*([a-zA-Z0-9_\-]+)\s*"/g;

const apikeys = [];
const clients = [];
let match;
while ((match = apikeyRegex.exec(conf)) !== null) apikeys.push(match[1].trim());
while ((match = clientRegex.exec(conf)) !== null) {
  if (!match[1].match(/^[a-f0-9]+$/)) clients.push(match[1].trim());
}

if (apikeys.length !== clients.length) {
  throw new Error("Apikeys and client numbers are not the same. Check your nginx.conf");
}

const mapEntries = apikeys.map((k, i) => ({ apikey: k, client: clients[i] }));

describe.sequential("Nginx endpoints following happy path (one req per path and apikey) with mock backend", () => {
  const backendContainerName = "backend-llm-mock-for-redirection";
  const backendContainerPort = 8008;
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
    const endpoint = `/v1/chat/completions`;

    it(`should redirect POST ${endpoint} to the mock backend with apikey ${apikey} and return 200`, async () => {
      logger.debug(`testing ${endpoint} with api key ${apikey}`)
      const body = JSON.stringify({
        model: "Qwen/Qwen2.5-Coder-32B-Instruct",
        messages: [
          { role: "system", content: "Eres un asistente útil." },
          { role: "user", content: "Hola, prueba que estás funcionando." }
        ]
      });

      const res = await new Promise((resolve) => {
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

      expect(res.statusCode).toBe(200);

      const data = await new Promise((resolve) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => resolve(raw));
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
    });
  });
});
