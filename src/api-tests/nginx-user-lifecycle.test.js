import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { parse as parseYaml } from 'yaml';
import { GenericContainer, Network } from 'testcontainers';
import { MOCK_SERVER_CODE, mergeNginxConf, makeRequest, startNginx } from './helpers/nginxTestHelpers.js';

const _require = createRequire(import.meta.url);
const { createApp } = _require('../app.js');

const app = createApp();
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const testSpecsDir = path.join(__dirname, 'test-specs');

// sla-testlifecycleuser: simple single-segment context id so that configNginxConfd
// (splitNginxConfig → extractUserKeyFromZone) and removeFromConfd both compute the
// same filename: sla-testlifecycleuser_basic.conf
const TARGET_SLA_PATH = path.join(testSpecsDir, 'slas', 'sla_testlifecycleuser.yaml');
const targetSla = parseYaml(fs.readFileSync(TARGET_SLA_PATH, 'utf8'));
const TARGET_APIKEY = targetSla.context.apikeys[0];
const TARGET_FIRST_PATH = Object.keys(targetSla.plan.rates)[0];
const TARGET_RATE_LIMIT = targetSla.plan.rates[TARGET_FIRST_PATH].post.requests[0].max;

describe.sequential('nginx user lifecycle: generate config, rate limit, remove user', () => {
    let tmpDir;
    let network;
    let mockBackend;
    let nginxContainer;
    let nginxPort;
    let backendAlias;

    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipm-lifecycle-'));

        // Generate nginx.conf + conf.d/ via API.
        // The target SLA uses context.id='sla-testlifecycleuser' (single segment, no underscores),
        // so both configNginxConfd (splitNginxConfig → extractUserKeyFromZone) and removeFromConfd
        // compute the same filename: sla-testlifecycleuser_basic.conf
        const configRes = await request(app).post('/nginx/config').send({
            outDir: tmpDir,
            oasPath: path.join(testSpecsDir, 'hpc-oas.yaml'),
            slasPath: path.join(testSpecsDir, 'slas'),
            authLocation: 'header',
        });
        expect(configRes.status).toBe(200);

        // Create Docker network for nginx ↔ mock backend communication
        network = await new Network().start();
        backendAlias = `mock-backend-${Math.random().toString(36).slice(2, 7)}`;

        // Start mock LLM backend on the network
        const mockContainer = new GenericContainer('node:22-alpine')
            .withCopyContentToContainer([{ target: '/app/server.js', content: MOCK_SERVER_CODE }])
            .withCommand(['node', '/app/server.js'])
            .withNetwork(network)
            .withNetworkAliases(backendAlias)
            .withExposedPorts(8080);
        mockBackend = await mockContainer.start();

        // Merge conf.d into a single nginx.conf, routing to the backend container alias
        const mergedConfPath = path.join(tmpDir, 'nginx.merged.conf');
        mergeNginxConf({ confDir: tmpDir, backendHost: backendAlias, backendPort: 8080, outputPath: mergedConfPath });

        // Start nginx container on the same network
        const nginx = await startNginx({ confPath: mergedConfPath, network });
        nginxContainer = nginx.container;
        nginxPort = nginx.port;
    }, 120000);

    afterAll(async () => {
        await nginxContainer?.stop({ remove: true }).catch(() => {});
        await mockBackend?.stop({ remove: true }).catch(() => {});
        await network?.stop().catch(() => {});
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it(`returns 200 for each request within the SLA rate limit (${TARGET_RATE_LIMIT}/min)`, async () => {
        for (let i = 0; i < TARGET_RATE_LIMIT; i++) {
            const res = await makeRequest({ port: nginxPort, apikey: TARGET_APIKEY, path: TARGET_FIRST_PATH });
            expect(res.statusCode).toBe(200);
        }
    });

    it('returns 429 when the SLA rate limit is exceeded', async () => {
        const res = await makeRequest({ port: nginxPort, apikey: TARGET_APIKEY, path: TARGET_FIRST_PATH });
        expect(res.statusCode).toBe(429);
    });

    it('returns 403 after deleting the user SLA and reloading nginx', async () => {
        // Remove the user's conf.d entry via API
        const deleteRes = await request(app).delete('/nginx/confd/users').send({
            outDir: tmpDir,
            slasPath: TARGET_SLA_PATH,
        });
        expect(deleteRes.status).toBe(200);

        // Re-merge conf.d (now without the deleted user) into a new merged conf
        const updatedConfPath = path.join(tmpDir, 'nginx.updated.conf');
        mergeNginxConf({ confDir: tmpDir, backendHost: backendAlias, backendPort: 8080, outputPath: updatedConfPath });

        // Restart nginx with the updated config
        await nginxContainer.stop({ remove: true }).catch(() => {});
        const nginx = await startNginx({ confPath: updatedConfPath, network });
        nginxContainer = nginx.container;
        nginxPort = nginx.port;

        // The deleted user's apikey is no longer in the map → api_client_name = "" → nginx returns 403
        const res = await makeRequest({ port: nginxPort, apikey: TARGET_APIKEY, path: TARGET_FIRST_PATH });
        expect(res.statusCode).toBe(403);
    });
});
