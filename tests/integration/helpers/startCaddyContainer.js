import { GenericContainer } from "testcontainers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function startCaddy({ 
  backendPort = process.env.TEST_CADDY_MOCK_BACKEND_PORT, 
  caddyRedirectionHost = process.env.CADDY_REDIRECTION_HOST, 
  network,
  configDir = path.join(__dirname, "../config")
}) {
  const caddyfilePath = path.join(configDir, "Caddyfile");

  const original = fs.readFileSync(caddyfilePath, "utf8");
  const finalCaddyfile = original
              .replace(/{{BACKEND_HOST}}/g, caddyRedirectionHost)
              .replace(/{{BACKEND_PORT}}/g, backendPort);
  

  const uniqueSuffix = Math.random().toString(36).substring(2, 9);
  const tmpFile = path.join(configDir, `Caddyfile.final.${uniqueSuffix}`);
  fs.writeFileSync(tmpFile, finalCaddyfile);

  const container = new GenericContainer("caddy:latest")
    .withCopyFilesToContainer([
      { source: tmpFile, target: "/etc/caddy/Caddyfile" },
      { source: path.join(configDir, "test-cert.pem"), target: "/etc/caddy/test-cert.pem" },
      { source: path.join(configDir, "test-key.pem"), target: "/etc/caddy/test-key.pem" },
    ])
    .withExposedPorts(80, 443)

    if (network) {
      container.withNetwork(network)
               .withNetworkAliases("caddy");
    } else {
      container.withName(`caddy-test-${Date.now()}`);
    }

    const startedContainer = await container.start();

  return {
    container: startedContainer,
    httpPort: startedContainer.getMappedPort(80),
    httpsPort: startedContainer.getMappedPort(443),
    caddyfilePath: tmpFile
  };
}
