// tests/Caddy/caddy.test.js
import { describe, it, beforeAll, afterAll, expect } from "vitest";
import https from "node:https";
import { startCaddy } from "./helpers/startCaddyContainer.js";
import { generateDevCertificates } from "./helpers/generateCerts.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { waitForHttps } from "./helpers/waitForHTTPS.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Caddy HTTPS", () => {
  let container;
  let httpsPort;

  beforeAll(async () => {
    const baseDir = path.join(__dirname, "./config");

    generateDevCertificates({
    dir: baseDir,
    domain: "alma.test",
    });
    // Supongamos backend fijo o lanzado dinámicamente:
    const backendPort = 5000; // o el que quieras, no toca el 8080 real

    const started = await startCaddy({ backendPort });
    container = started.container;
    httpsPort = started.httpsPort;
    await waitForHttps("localhost", httpsPort);
  });

  afterAll(async () => {
    if (container) await container.stop();
  });

  it("sirve HTTPS correctamente", async () => {
    const res = await new Promise((resolve, reject) => {
      https.get(
        {
          hostname: "localhost",
          port: httpsPort,
          rejectUnauthorized: false,
        },
        resolve
      ).on("error", reject);
    });

    expect(res.statusCode).toBe(200);
  });
});
