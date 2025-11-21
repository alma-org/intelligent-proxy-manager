import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import http from "http";
import { startNginxFromFile } from "./helpers/startNginxFromFile.js";
import logger from "../logger.js"

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

describe("Nginx SLA limit tests (429)", () => {
  let instance;
  let port;

  beforeAll(async () => {
    instance = await startNginxFromFile({ nginxConfPath: confPath, nginxPort: process.env.NGINX_PORT });
    port = instance.httpPort;
  });

  afterAll(async () => {
    if (instance?.container) await instance.container.stop();
  });

  mapEntries.forEach(({ apikey, client }) => {
    const endpoint = `/${client}_v1chatcompletions_POST`;
    const maxRequests = limits[`${client}_v1chatcompletions_POST`];

    it(`should return 429 for apikey ${apikey} at endpoint ${endpoint} after exceeding SLA (${maxRequests} requests)`, async () => {
      const body = JSON.stringify({
        model: "Qwen/Qwen2.5-Coder-32B-Instruct",
        messages: [
          { role: "system", content: "Eres un asistente útil." },
          { role: "user", content: "Hola, prueba que estás funcionando." }
        ]
      });

      let lastResponse;

      for (let i = 0; i < maxRequests + 2; i++) {
        lastResponse = await new Promise(resolve => {
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
      }

      logger.debug(`Endpoint ${endpoint} exceeded SLA with apikey ${apikey}, got status ${lastResponse.statusCode} making ${maxRequests} requests`);
      expect(lastResponse.statusCode).toBe(429);
    });
  });
});
