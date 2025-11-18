import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export function generateDevCertificates({ dir, domain = "test.local" }) {
  const keyPath = path.join(dir, "test-key.pem");
  const certPath = path.join(dir, "test-cert.pem");
  const confPath = path.join(dir, "openssl.cnf");

  fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(keyPath) && fs.lstatSync(keyPath).isDirectory()) {
    fs.rmSync(keyPath, { recursive: true, force: true });
  }
  if (fs.existsSync(certPath) && fs.lstatSync(certPath).isDirectory()) {
    fs.rmSync(certPath, { recursive: true, force: true });
  }

  if (!fs.existsSync(confPath)) {
    fs.writeFileSync(
      confPath,
      `
      [req]
      distinguished_name=req_distinguished_name
      x509_extensions = v3_req
      prompt = no

      [req_distinguished_name]
      CN=${domain}

      [v3_req]
      subjectAltName=DNS:${domain}
      `
    );
  }

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return { keyPath, certPath };
  }

  const cmd = [
    `openssl req`,
    `-config "${confPath}"`,
    `-x509 -newkey rsa:2048`,
    `-nodes`,
    `-keyout "${keyPath}"`,
    `-out "${certPath}"`,
    `-days 365`,
    `-subj "/CN=${domain}"`,
  ].join(" ");

  execSync(cmd, { stdio: "inherit" });

  return { keyPath, certPath };
}
