import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "net";
import { startNginxFromFile } from "./helpers/startNginxFromFile.js";

describe("Nginx runs with provided config", () => {
  let instance;
  let port;

  beforeAll(async () => {
    instance = await startNginxFromFile({nginxConfPath: process.env.NGINX_FILE_TO_TEST, nginxPort: process.env.NGINX_PORT});
    port = instance.httpPort;
  });

  afterAll(async () => {
    if (instance?.container) await instance.container.stop();
  });

  it("should start the container without crashing", async () => {
    expect(instance.container).toBeDefined();
  });

  it("should be listening on 8080 (mapped)", async () => {
    const isListening = await new Promise(resolve => {
      const socket = net.createConnection({ host: "127.0.0.1", port }, () => {
        socket.end();
        resolve(true);
      });

      socket.on("error", () => resolve(false));
    });

    expect(isListening).toBe(true);
  });


});
