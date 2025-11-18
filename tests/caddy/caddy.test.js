import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { startCaddy } from "./helpers/startCaddyContainer.js";
import { waitForHttps } from "./helpers/waitForHttps.js";

describe("Caddy HTTPS", () => {
  let container;
  let httpsPort;

  beforeAll(async () => {
    const backendPort = process.env.TEST_BACKEND_PORT;

    const started = await startCaddy({ backendPort });
    container = started.container;
    httpsPort = started.httpsPort;

    await waitForHttps({ port: httpsPort, timeout: 15000 });
  });

  afterAll(async () => {
    if (container) await container.stop();
  });

  it("sirve HTTPS correctamente", async () => {
    const res = await waitForHttps({
      port: httpsPort,
      domain: "alma.test"
      });
    expect(res.statusCode).toBe(404);
  });

  
});
