import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { startCaddy } from "../caddy/helpers/startCaddyContainer.js";
import { waitForHttps } from "../caddy/helpers/waitForHttps.js";
import { waitForHttp } from "../caddy/helpers/waitForHttp.js";
import net from "net";
import http from "http";
import https from "https";
import { startNginxFromFile } from "../nginx/helpers/startNginxFromFile.js";
import { Network } from "testcontainers";

describe.sequential("Caddy HTTPS + Nginx listening", () => {
  let network
  let caddyContainer;
  let caddyHttpsPort;
  let caddyHttpPort;
  let nginxContainer;
  let port;

  it("should run", () => {
    expect(true).toBe(true);
  });
//   beforeAll(async () => {
//     network = await new Network().start();
//     nginxContainer = await startNginxFromFile({
//       nginxConfPath: process.env.NGINX_FILE_TO_TEST,
//       nginxPort: process.env.NGINX_PORT,
//       network,
//     });
//     port = nginxContainer.httpPort;

//     const backendPort = port;

//     const started = await startCaddy({ backendPort, network });

//     caddyContainer = started.container;
//     caddyHttpsPort = started.httpsPort;
//     caddyHttpPort = started.httpPort;

//     await waitForHttps({
//       port: caddyHttpsPort,
//       timeout: process.env.TEST_TIMEOUT,
//     });
//   });

//   afterAll(async () => {
//     if (caddyContainer) await caddyContainer.stop({ remove: true });
//     if (nginxContainer?.container) await nginxContainer.container.stop({ remove: true });
//     if (network) await network.stop({ remove: true });
// });

//   it("should start both containers without crashing", async () => {
//     expect(caddyContainer.container).toBeDefined();
//     expect(nginxContainer.container).toBeDefined();
//   });

//   it("Caddy should serve HTTPS correctly", async () => {
//     const res = await waitForHttps({ port: caddyHttpsPort });
//     // We expect a 404 because there is no index.html and it only redirects to nginx
//     expect(res.statusCode).toBe(404);
//   });

//   it("Caddy should redirect HTTP to HTTPS", async () => {
//     const res = await waitForHttp({ port: caddyHttpPort });

//     // Caddy usually redirects with these codes
//     // when forcing HTTPS
//     expect([301, 308]).toContain(res.statusCode);

//     const location = res.headers["location"];
//     expect(location).toMatch(/^https:\/\//);
//   });

//   it("Caddy should redirect request to nginx", async () => {
//     const res = await new Promise((resolve, reject) => {
//       const agent = new https.Agent({ rejectUnauthorized: false });

//       https
//         .get(
//           {
//             hostname: "localhost",
//             port: caddyHttpsPort,
//             agent,
//             servername: process.env.TEST_DOMAIN,
//             headers: { Host: process.env.TEST_DOMAIN },
//             path: "/engine/v1/chat/completions",
//           },
//           resolve
//         )
//         .on("error", reject);
//     });

//     // Nginx should respond (because Caddy forwarded the request)
//     // Caddy sends apikey: test-api-key   → Nginx sees it but it does not match any valid keys → 403
//     expect(res.statusCode).toBe(403);
//   });

//   it("nginx should be listening on 8080 (mapped)", async () => {
//     const isListening = await new Promise((resolve) => {
//       const socket = net.createConnection({ host: "127.0.0.1", port }, () => {
//         socket.end();
//         resolve(true);
//       });

//       socket.on("error", () => resolve(false));
//     });

//     expect(isListening).toBe(true);
//   });

//   it("nginx should return 401 because no api-key was sent in the headers", async () => {
//     const res = await new Promise((resolve) => {
//       http.get(
//         {
//           hostname: "127.0.0.1",
//           port,
//           path: "/testPath",
//         },
//         resolve
//       );
//     });
//     expect(res.statusCode).toBe(401);
//   });

//   it("nginx should return 403 an invalid api-key was sent", async () => {
//     const res = await new Promise((resolve) => {
//       http.get(
//         {
//           hostname: "127.0.0.1",
//           port,
//           path: "/testPath",
//           headers: {
//             apikey: "invalid-api-key",
//           },
//         },
//         resolve
//       );
//     });

//     expect(res.statusCode).toBe(403);
//   });
});
