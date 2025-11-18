import https from "https";

export function waitForHttps({ host = "localhost", port, domain = "alma.test", timeout = 10000 }) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    const agent = new https.Agent({
      rejectUnauthorized: false,
    });

    function tryConnect() {
      const req = https.get(
        {
          hostname: host,
          port,
          agent,
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