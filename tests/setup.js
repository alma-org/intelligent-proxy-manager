import { beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "node:url";
import { generateDevCertificates } from "./Caddy/helpers/generateCerts.js";

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CERT_DIR = path.join(__dirname, "caddy/config");

beforeAll(() => {
  console.log("🔧 Global test setup…");

  generateDevCertificates({
    dir: CERT_DIR,
    domain: process.env.TEST_DOMAIN,
  });

});

afterAll(() => {
  console.log("🏁 Global teardown…");
});
