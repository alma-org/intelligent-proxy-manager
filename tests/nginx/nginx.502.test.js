import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import http from "http";
import { startNginxFromFile } from "./helpers/startNginxFromFile.js";
import logger from "../logger.js"

const confPath = process.env.NGINX_FILE_TO_TEST;
const nginxContainerName = `nginx-test-502-${Date.now()}`

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

describe.sequential("Nginx endpoints following happy path (one req per path and apikey) without backend", () => {
  let instance;
  let port;

  beforeAll(async () => {
    instance = await startNginxFromFile({ nginxConfPath: confPath, nginxPort: process.env.NGINX_PORT, containerName: nginxContainerName });
    port = instance.httpPort;
  });

  afterAll(async () => {
    if (instance?.container) await instance.container.stop({ remove: true });
  });

  mapEntries.forEach(({ apikey, client }) => {
    const endpoint = `/${client}_v1chatcompletions_POST`;
    it(`should return 502 for apikey ${apikey} at endpoint ${endpoint} because backend is not running`, async () => {
      logger.debug(`Testing ${endpoint} with apikey: ${apikey}`)
      const body = JSON.stringify({
        model: "Qwen/Qwen2.5-Coder-32B-Instruct",
        messages: [
          { role: "system", content: "Eres un asistente útil." },
          { role: "user", content: "Hola, prueba que estás funcionando." }
        ]
      });

      const res = await new Promise(resolve => {
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

      expect(res.statusCode).toBe(502);
    });
  });
});
