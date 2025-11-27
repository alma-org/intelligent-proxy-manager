import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import http from "http";
import { startNginxFromFile } from "./helpers/startNginxFromFile.js";
import logger from "../logger.js"

const confPath = process.env.NGINX_FILE_TO_TEST;
const nginxContainerName = `nginx-test-404-${Date.now()}`

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

describe("Nginx endpoints not found", () => {
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
    const endpoint = `/${client}_nonExistingEndpoint`;
    it(`should return 404 for apikey ${apikey} at endpoint ${endpoint} because no endpoint found in nginx.conf`, async () => {
      logger.debug(`Testing ${endpoint} with apikey: ${apikey}`)
      const res = await new Promise(resolve => {
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port,
            path: endpoint,
            method: "GET",
            headers: {
              "apikey": apikey
            }
          },
          resolve
        );

        req.end();
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
