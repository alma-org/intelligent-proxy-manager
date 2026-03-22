import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mergedConfPath = path.join(__dirname, "nginx", "config", "nginx.merged.conf");

export function setup() {}

export function teardown() {
  if (fs.existsSync(mergedConfPath)) {
    fs.unlinkSync(mergedConfPath);
  }
}
