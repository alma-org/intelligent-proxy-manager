import http from 'http';
import fs from 'fs';
import path from 'path';
import { GenericContainer } from 'testcontainers';

export const MOCK_SERVER_CODE = `
const http = require('http');
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ object: 'chat.completion' }));
  } else {
    res.writeHead(404);
    res.end();
  }
});
server.listen(8080);
`;

/**
 * Merges conf.d/*.conf files into nginx.conf and replaces the backend host.
 * conf.d files now contain only location blocks (server context).
 * limit_req_zone and map directives are already in nginx.conf at the http level.
 */
export function mergeNginxConf({ confDir, backendHost, backendPort, outputPath }) {
    const nginxConfPath = path.join(confDir, 'nginx.conf');
    const confdDir = path.join(confDir, 'conf.d');
    let conf = fs.readFileSync(nginxConfPath, 'utf8');

    if (fs.existsSync(confdDir)) {
        const confdFiles = fs.readdirSync(confdDir)
            .filter(f => f.endsWith('.conf'))
            .map(f => path.join(confdDir, f));

        const locations = [];

        for (const file of confdFiles) {
            const content = fs.readFileSync(file, 'utf8');

            const locRegex = /\blocation\b[^{]*\{/g;
            let m;
            while ((m = locRegex.exec(content)) !== null) {
                let depth = 0;
                let i = m.index + m[0].length - 1;
                for (; i < content.length; i++) {
                    if (content[i] === '{') depth++;
                    else if (content[i] === '}' && --depth === 0) {
                        locations.push(content.slice(m.index, i + 1).trimStart());
                        break;
                    }
                }
            }
        }

        const backendPattern = /(127\.0\.0\.1|localhost):\d+/g;
        const mergedLocations = locations
            .map(l => l.replace(backendPattern, `${backendHost}:${backendPort}`))
            .join('\n\n        ');

        conf = conf.replace(/include\s+conf\.d\/\*\.conf;/, mergedLocations);
    }

    conf = conf.replace(/(127\.0\.0\.1|localhost):\d+/g, `${backendHost}:${backendPort}`);
    fs.writeFileSync(outputPath, conf, 'utf8');
}

export function makeRequest({ port, apikey, path }) {
    return new Promise((resolve, reject) => {
        const req = http.request(
            {
                hostname: 'localhost',
                port,
                path,
                method: 'POST',
                headers: { apikey },
            },
            resolve
        );
        req.on('error', reject);
        req.end();
    });
}

export async function startNginx({ confPath, network }) {
    const container = new GenericContainer('nginx:latest')
        .withCopyFilesToContainer([{ source: confPath, target: '/etc/nginx/nginx.conf' }])
        .withExposedPorts(8080);
    if (network) container.withNetwork(network);
    const started = await container.start();
    return { container: started, port: started.getMappedPort(8080) };
}
