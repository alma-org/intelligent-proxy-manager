// utils/waitForHttps.js
import https from "node:https";

export async function waitForHttps(host, port, retries = 10, delay = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = https.get({ hostname: host, port, rejectUnauthorized: false }, (res) => {
          res.destroy();
          resolve();
        });
        req.on("error", reject);
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error(`HTTPS did not answer in ${host}:${port}`);
}
