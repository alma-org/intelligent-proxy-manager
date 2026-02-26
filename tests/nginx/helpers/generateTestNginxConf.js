import fs from "fs";
import path from "path";

export function generateTestNginxConf({ originalConfPath, backendHost, backendPort, uniqueSuffix }) {
  if (!originalConfPath || !fs.existsSync(originalConfPath)) {
    throw new Error("Original nginx file does not exist");
  }

  let conf = fs.readFileSync(originalConfPath, "utf-8");

  conf = conf.replace(/127\.0\.0\.1:\d+/g, `${backendHost}:${backendPort}`);

  const configDir = path.join(process.cwd(), "nginx", "config");

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const filename = uniqueSuffix ? `nginx.test.mockllm.conf.${uniqueSuffix}` : "nginx.test.mockllm.conf";
  const testConfPath = path.join(configDir, filename);

  fs.writeFileSync(testConfPath, conf, "utf-8");

  return testConfPath;
}
