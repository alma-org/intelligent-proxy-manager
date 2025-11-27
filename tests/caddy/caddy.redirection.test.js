import https from "https";
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { Network } from "testcontainers";
import { startBackendMock } from "./helpers/startBackendMock.js";
import { startCaddy } from "./helpers/startCaddyContainer.js";
import { waitForHttps } from "./helpers/waitForHttps.js";

describe("Caddy reverse proxy /engine/*", () => {
  const backendContainerName = "backend-mock-for-redirection" 
  const backendContainerPort = 5001
  let backend;
  let caddy;
  let httpsPort;

  beforeAll(async () => {
    const network = await new Network().start();
    backend = await startBackendMock({containerName: backendContainerName, containerPort: backendContainerPort, network});

    caddy = await startCaddy({
      backendPort: backendContainerPort,
      caddyRedirectionHost: backendContainerName,
      network
    });

    httpsPort = caddy.httpsPort;
    await waitForHttps({ port: httpsPort, timeout: process.env.TEST_TIMEOUT });
  });

  afterAll(async () => {
    if (backend?.container) await backend.container.stop({ remove: true });
    if (caddy?.container) await caddy.container.stop({ remove: true });
  });

  it("should strip /engine and forward request with correct headers", async () => {
    const agent = new https.Agent({ rejectUnauthorized: false });

    const res = await new Promise((resolve) => {
      https.get(
        {
          hostname: "localhost",
          port: httpsPort,
          path: "/engine/test123",
          agent,
          headers: { Host: "alma.test" }
        },
        resolve
      );
    });

    expect(res.statusCode).toBe(200);

    const body = await new Promise((resolve) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => resolve(data));
    });

    const json = JSON.parse(body);

    expect(json.url).toBe("/test123");
    expect(json.headers.apikey).toBe("test-api-key");
  });
});
