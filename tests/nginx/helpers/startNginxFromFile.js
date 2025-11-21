import { GenericContainer } from "testcontainers";
import fs from "fs";

export async function startNginxFromFile({ nginxConfPath = process.env.NGINX_FILE_TO_TEST, nginxPort = process.env.NGINX_PORT, network }) {

  if (!nginxConfPath) {
    throw new Error("NGINX_FILE_TO_TEST env var is not set");
  }

  if (!fs.existsSync(nginxConfPath)) {
    throw new Error(`NGINX_FILE_TO_TEST does not exist: ${nginxConfPath}`);
  }

  const container = new GenericContainer("nginx:latest")
    .withName(`nginx-test-${Date.now()}`)
    .withCopyFilesToContainer([
      {
        source: nginxConfPath,
        target: "/etc/nginx/nginx.conf"
      }
    ])
    .withExposedPorts(nginxPort);

    if (network) {
        container.withNetworkMode(network.getName());
    }

  const startedContainer = await container.start();

  return {
    container: startedContainer,
    httpPort: startedContainer.getMappedPort(nginxPort),
  };
}
