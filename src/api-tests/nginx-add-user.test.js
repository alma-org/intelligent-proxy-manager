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

// New user to be added during the test. Not present in test-specs/slas — it will be
// created from scratch via POST /slas and then wired into nginx via POST /nginx/confd/users.
const NEW_USER_EMAIL = 'adduser@new.test';
const NEW_USER_CSV_PATH = path.join(testSpecsDir, 'csv', 'usersForAddition.csv');

// Read rate limit and request path from the template — no hardcoding needed.
const NEW_USER_TEMPLATE_PATH = path.join(testSpecsDir, 'slaTemplates', 'basicResearcher.yaml');
const newUserTemplate = parseYaml(fs.readFileSync(NEW_USER_TEMPLATE_PATH, 'utf8'));
const NEW_USER_FIRST_PATH = Object.keys(newUserTemplate.plan.rates)[0];
const NEW_USER_RATE_LIMIT = newUserTemplate.plan.rates[NEW_USER_FIRST_PATH].post.requests[0].max;

describe.sequential('nginx add new user: generate SLA via API and verify rate limiting', () => {
    let tmpDir;
    let network;
    let mockBackend;
    let nginxContainer;
    let nginxPort;
    let newUserApikey;
    let backendAlias;

    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipm-adduser-'));

        // Step 1: Generate base nginx.conf + conf.d/ for the existing test users
        const configRes = await request(app).post('/nginx/config').send({
            outDir: tmpDir,
            oasPath: path.join(testSpecsDir, 'hpc-oas.yaml'),
            slasPath: path.join(testSpecsDir, 'slas'),
            authLocation: 'header',
        });
        expect(configRes.status).toBe(200);

        // Step 2: Generate the new user's SLA file via POST /slas using the fixture CSV
        const newUserSlasDir = path.join(tmpDir, 'new-user-slas');
        const mappingPath = path.join(tmpDir, 'new-user-mapping.json');
        fs.mkdirSync(newUserSlasDir, { recursive: true });

        const slaRes = await request(app).post('/slas').send({
            templatePath: path.join(testSpecsDir, 'slaTemplates', 'basicResearcher.yaml'),
            csvPath: NEW_USER_CSV_PATH,
            slasPath: newUserSlasDir,
            userKeysJsonPath: mappingPath,
        });
        expect(slaRes.status).toBe(201);

        // Step 3: Read the generated apikey and SLA file path from the mapping
        const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        expect(mapping[NEW_USER_EMAIL]).toBeDefined();
        newUserApikey = mapping[NEW_USER_EMAIL].apikeys[0];
        const newUserSlaPath = mapping[NEW_USER_EMAIL].slaFile;
        expect(fs.existsSync(newUserSlaPath)).toBe(true);

        // Step 4: Add the new user to nginx conf.d via POST /nginx/confd/users
        const addRes = await request(app).post('/nginx/confd/users').send({
            slaPath: newUserSlaPath,
            outDir: tmpDir,
            oasPath: path.join(testSpecsDir, 'hpc-oas.yaml'),
        });
        expect(addRes.status).toBe(200);

        // Step 5: Start containers — mock backend and nginx with merged config
        network = await new Network().start();
        backendAlias = `mock-backend-${Math.random().toString(36).slice(2, 7)}`;

        const mockContainer = new GenericContainer('node:22-alpine')
            .withCopyContentToContainer([{ target: '/app/server.js', content: MOCK_SERVER_CODE }])
            .withCommand(['node', '/app/server.js'])
            .withNetwork(network)
            .withNetworkAliases(backendAlias)
            .withExposedPorts(8080);
        mockBackend = await mockContainer.start();

        // Merge all conf.d files (existing users + new user) into a single nginx.conf
        const mergedConfPath = path.join(tmpDir, 'nginx.merged.conf');
        mergeNginxConf({ confDir: tmpDir, backendHost: backendAlias, backendPort: 8080, outputPath: mergedConfPath });

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

    it('generates a single SLA with one apikey for the new user', async () => {
        const mappingPath = path.join(tmpDir, 'new-user-mapping.json');
        const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

        expect(mapping[NEW_USER_EMAIL]).toBeDefined();
        expect(mapping[NEW_USER_EMAIL].apikeys).toHaveLength(1);
        expect(typeof mapping[NEW_USER_EMAIL].apikeys[0]).toBe('string');
        expect(mapping[NEW_USER_EMAIL].apikeys[0]).toHaveLength(32); // hex md5 apikey
    });

    it(`returns 200 for each request within the new user SLA rate limit (${NEW_USER_RATE_LIMIT}/min)`, async () => {
        for (let i = 0; i < NEW_USER_RATE_LIMIT; i++) {
            const res = await makeRequest({ port: nginxPort, apikey: newUserApikey, path: NEW_USER_FIRST_PATH });
            expect(res.statusCode).toBe(200);
        }
    });

    it('returns 429 when the new user SLA rate limit is exceeded', async () => {
        const res = await makeRequest({ port: nginxPort, apikey: newUserApikey, path: NEW_USER_FIRST_PATH });
        expect(res.statusCode).toBe(429);
    });
});
