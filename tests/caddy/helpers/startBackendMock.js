import { GenericContainer } from "testcontainers";

export async function startBackendMock({containerName, containerPort = 3000, network}) {
  const container = await new GenericContainer("node:22")
    .withName(containerName)
    .withCopyContentToContainer([
        {
            target: "/app/server.js",
            content: `
            const http = require("http");

            const server = http.createServer((req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
                url: req.url,
                headers: req.headers
            }));
            });

            server.listen(${containerPort});
            `
        }
    ])
    .withCommand(["node", "/app/server.js"]) 
    .withExposedPorts(containerPort)

    if (network) {
        container.withNetworkMode(network.getName());
    }

    const startedContainer = await container.start();

  return {
    container: startedContainer,
    port: startedContainer.getMappedPort(containerPort),
    host: startedContainer.getHost(),
    containerName: startedContainer.getName().replace("/", "")
  };
}
