import { GenericContainer } from "testcontainers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function startCaddy({ backendPort = process.env.TEST_BACKEND_PORT }) {
  const baseDir = path.join(__dirname, "../config");
  const caddyfilePath = path.join(baseDir, "Caddyfile");

  const original = fs.readFileSync(caddyfilePath, "utf8");
  const finalCaddyfile = original.replace(/{{BACKEND_PORT}}/g, backendPort);

  const tmpFile = path.join(baseDir, "Caddyfile.final");
  fs.writeFileSync(tmpFile, finalCaddyfile);

  const container = await new GenericContainer("caddy:latest")
    .withName(`caddy-test-${Date.now()}`)
    .withBindMounts([
      { source: tmpFile, target: "/etc/caddy/Caddyfile" },
      { source: path.join(baseDir, "test-cert.pem"), target: "/etc/caddy/test-cert.pem" },
      { source: path.join(baseDir, "test-key.pem"), target: "/etc/caddy/test-key.pem" },
    ])
    .withExposedPorts(80, 443)
    .start();

  return {
    container,
    httpPort: container.getMappedPort(80),
    httpsPort: container.getMappedPort(443),
  };
}
