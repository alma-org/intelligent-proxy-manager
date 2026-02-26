import { describe, it, beforeAll, afterAll, expect } from "vitest";
import fs from "fs";
import { startCaddy } from "./helpers/startCaddyContainer.js";
import { waitForHttps } from "./helpers/waitForHttps.js";
import { waitForHttp } from "./helpers/waitForHttp.js";

describe.sequential("Caddy HTTPS", () => {
  let container;
  let httpsPort;
  let httpPort;
  let tempCaddyfile;

  beforeAll(async () => {
    const backendPort = process.env.TEST_CADDY_MOCK_BACKEND_PORT;

    const started = await startCaddy({ backendPort });
    container = started.container;
    httpsPort = started.httpsPort;
    httpPort = started.httpPort
    tempCaddyfile = started.caddyfilePath;

    await waitForHttps({ port: httpsPort, timeout: process.env.TEST_TIMEOUT });
  });

  afterAll(async () => {
    if (container) await container.stop({ remove: true });
    if (tempCaddyfile && fs.existsSync(tempCaddyfile)) {
      fs.unlinkSync(tempCaddyfile);
    }
  });

  it("should serve HTTPS correctly", async () => {
    const res = await waitForHttps({ port: httpsPort});
    // We expect a 404 because there is no index.html and it only redirects to nginx
    expect(res.statusCode).toBe(404);
  });

  it("should redirect HTTP to HTTPS", async () => {
    const res = await waitForHttp({ port: httpPort });

    // Caddy usually redirects with these codes
    // when forcing HTTPS
    expect([301, 308]).toContain(res.statusCode);

    const location = res.headers["location"];
    expect(location).toMatch(/^https:\/\//);
  });

});




