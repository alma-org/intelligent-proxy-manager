import { beforeAll, afterAll } from "vitest";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "node:url";
import { generateDevCertificates } from "./caddy/helpers/generateCerts.js";
import { generateMergedNginxConf } from "./nginx/helpers/generateTestNginxConf.js";
import logger from "./logger.js";

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CERT_DIR = path.join(__dirname, "caddy/config");

const sourceConfPath = process.env.NGINX_FILE_TO_TEST
  ? path.resolve(__dirname, process.env.NGINX_FILE_TO_TEST)
  : null;

if (sourceConfPath) {
  try {
    const mergedPath = path.join(__dirname, "nginx", "config", "nginx.merged.conf");
    generateMergedNginxConf({ sourceConfPath, outputPath: mergedPath });
    process.env.NGINX_FILE_TO_TEST = mergedPath;
  } catch (err) {
    logger.warn(`Could not generate merged nginx conf: ${err.message}`);
  }
}

beforeAll(() => {
  // logger.info("🔧 Global test setup…");

  generateDevCertificates({
    dir: CERT_DIR,
    domain: process.env.TEST_DOMAIN,
  });

});

afterAll(() => {
  // logger.info("🏁 Global teardown…");
});
