import http from "http";

export function waitForHttp({ host = "localhost", port, domain = process.env.TEST_DOMAIN, timeout = process.env.TEST_TIMEOUT, }) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function tryConnect() {
      const req = http.get(
        {
          hostname: host,
          port,
          servername: domain,
          headers: { Host: domain },
        },
        (res) => resolve(res)
      );

      req.on("error", (err) => {
        if (Date.now() - start > timeout) return reject(err);
        setTimeout(tryConnect, 100);
      });
    }

    tryConnect();
  });
}
