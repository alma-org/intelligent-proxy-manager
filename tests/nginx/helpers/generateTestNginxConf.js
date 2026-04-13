import fs from "fs";
import path from "path";

/**
 * Extracts top-level blocks (e.g. location { ... }) from nginx config text.
 * Returns an array of the full block strings.
 */
function extractTopLevelBlocks(text, keyword) {
  const blocks = [];
  // Use word boundary so "location" doesn't match inside "locations" etc.
  const regex = new RegExp(`\\b${keyword}\\b[^{]*\\{`, "g");
  let match;
  while ((match = regex.exec(text)) !== null) {
    let start = match.index;
    let depth = 0;
    let i = match.index + match[0].length - 1;
    for (; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) {
          blocks.push(text.slice(start, i + 1).trimStart());
          break;
        }
      }
    }
  }
  return blocks;
}

export function generateTestNginxConf({ originalConfPath, backendHost, backendPort, uniqueSuffix }) {
  if (!originalConfPath || !fs.existsSync(originalConfPath)) {
    throw new Error(`Original nginx file does not exist: ${originalConfPath}`);
  }

  let conf = fs.readFileSync(originalConfPath, "utf-8");

  // conf.d files now contain only location blocks (server context).
  // limit_req_zone and map directives are already in nginx.conf at the http level.
  const confdDir = path.join(path.dirname(originalConfPath), "conf.d");
  if (fs.existsSync(confdDir)) {
    const confdFiles = fs.readdirSync(confdDir)
      .filter(f => f.endsWith(".conf"))
      .map(f => path.join(confdDir, f));

    const locations = [];

    for (const file of confdFiles) {
      const content = fs.readFileSync(file, "utf-8");
      // Collect location blocks (server-level)
      const locs = extractTopLevelBlocks(content, "location");
      locations.push(...locs);
    }

    // Replace backend references in location blocks before joining
    const backendPattern = /(127\.0\.0\.1|localhost):\d+/g;
    const mergedLocations = locations
      .map(l => l.replace(backendPattern, `${backendHost}:${backendPort}`))
      .join("\n\n        ");

    // Replace include conf.d/*.conf; with the merged location blocks
    conf = conf.replace(/include\s+conf\.d\/\*\.conf;/, mergedLocations);
  }

  // Replace any remaining backend host references
  conf = conf.replace(/(127\.0\.0\.1|localhost):\d+/g, `${backendHost}:${backendPort}`);

  const configDir = path.join(process.cwd(), "nginx", "config");
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const filename = uniqueSuffix
    ? `nginx.test.mockllm.conf.${uniqueSuffix}`
    : "nginx.test.mockllm.conf";
  const testConfPath = path.join(configDir, filename);
  fs.writeFileSync(testConfPath, conf, "utf-8");

  return testConfPath;
}

export function generateMergedNginxConf({ sourceConfPath, outputPath }) {
  if (!sourceConfPath || !fs.existsSync(sourceConfPath)) {
    throw new Error(`Source nginx conf does not exist: ${sourceConfPath}`);
  }

  let conf = fs.readFileSync(sourceConfPath, "utf-8");

  // conf.d files now contain only location blocks (server context).
  // limit_req_zone and map directives are already in nginx.conf at the http level.
  const confdDir = path.join(path.dirname(sourceConfPath), "conf.d");
  if (fs.existsSync(confdDir)) {
    const confdFiles = fs.readdirSync(confdDir)
      .filter(f => f.endsWith(".conf"))
      .map(f => path.join(confdDir, f));

    const locations = [];

    for (const file of confdFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const locs = extractTopLevelBlocks(content, "location");
      locations.push(...locs);
    }

    const mergedLocations = locations.join("\n\n        ");
    conf = conf.replace(/include\s+conf\.d\/\*\.conf;/, mergedLocations);
  }

  conf = conf.replace(/localhost:(\d+)/g, "127.0.0.1:$1");

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(outputPath, conf, "utf-8");

  return outputPath;
}
