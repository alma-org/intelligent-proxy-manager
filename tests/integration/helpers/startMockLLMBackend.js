import { GenericContainer } from "testcontainers";

export async function startMockLLMBackend({ containerName, containerPort = 8080, network }) {
  const container = new GenericContainer("node:22")
    .withCopyContentToContainer([
      {
        target: "/app/server.js",
        content: `
          const http = require("http");

          const server = http.createServer((req, res) => {
            console.log(\`Mock Backend received: \${req.method} \${req.url}\`);
            res.setHeader("Content-Type", "application/json");

            // Simula el endpoint de chat completions
            if (req.method === "POST" && req.url === "/v1/chat/completions") {
              let body = "";
              req.on("data", chunk => body += chunk);
              req.on("end", () => {
                res.writeHead(200);
                res.end(JSON.stringify({
                  id: "chatcmpl-27d6052fe8524745a551960124863f05",
                  object: "chat.completion",
                  created: 1761755239,
                  model: "Qwen/Qwen2.5-Coder-32B-Instruct",
                  choices: [{
                    index: 0,
                    message: {
                      role: "assistant",
                      reasoning_content: null,
                      content: "Hello! I'm just a computer program, so I don't have feelings, but thanks for asking. How can I assist you today?",
                      tool_calls: []
                    },
                    logprobs: null,
                    finish_reason: "stop",
                    stop_reason: null
                  }],
                  usage: {
                    prompt_tokens: 35,
                    total_tokens: 64,
                    completion_tokens: 29,
                    prompt_tokens_details: null
                  },
                  prompt_logprobs: null
                }));
              });
            } else {
              // Otros endpoints: devuelve 404
              res.writeHead(404);
              res.end();
            }
          });

          server.listen(${containerPort});
        `
      }
    ])
    .withCommand(["node", "/app/server.js"])
    .withExposedPorts(containerPort);

  if (network) {
    container.withNetwork(network)
             .withNetworkAliases(containerName);
  } else {
    container.withName(containerName);
  }

  const startedContainer = await container.start();

  return {
    container: startedContainer,
    port: startedContainer.getMappedPort(containerPort),
    host: startedContainer.getHost(),
    containerName: startedContainer.getName().replace("/", "")
  };
}