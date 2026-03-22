import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);
const { createApp } = _require('../app.js');

const app = createApp();

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const slasDir = path.join(projectRoot, 'specs/slas');

describe('GET /slas', () => {
    it('returns 200 with the SLAs from the given directory', async () => {
        const res = await request(app).get('/slas').query({ slasPath: slasDir });

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(Array.isArray(res.body.data.slas)).toBe(true);
        expect(res.body.data.slas.length).toBeGreaterThan(0);
        expect(res.body.data.slas[0]).toHaveProperty('context');
        expect(res.body.data.slas[0]).toHaveProperty('plan');
    });

    it('returns 200 with empty array for a non-existent directory', async () => {
        const res = await request(app).get('/slas').query({ slasPath: '/nonexistent/path' });

        expect(res.status).toBe(200);
        expect(res.body.data.slas).toEqual([]);
    });
});

describe('POST /slas', () => {
    let tmpDir;

    beforeAll(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipm-slas-test-'));
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns 400 when templatePath is missing', async () => {
        const res = await request(app).post('/slas').send({
            csvPath: path.join(projectRoot, 'specs/csv/usersBasic.csv'),
            userKeysJsonPath: path.join(tmpDir, 'mapping.json')
        });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/templatePath/);
    });

    it('returns 400 when csvPath is missing', async () => {
        const res = await request(app).post('/slas').send({
            templatePath: path.join(projectRoot, 'specs/slaTemplates/basicResearcher.yaml'),
            userKeysJsonPath: path.join(tmpDir, 'mapping.json')
        });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/csvPath/);
    });

    it('returns 400 when userKeysJsonPath is missing', async () => {
        const res = await request(app).post('/slas').send({
            templatePath: path.join(projectRoot, 'specs/slaTemplates/basicResearcher.yaml'),
            csvPath: path.join(projectRoot, 'specs/csv/usersBasic.csv')
        });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/userKeysJsonPath/);
    });

    it('returns 201, generates SLA files and writes the mapping', async () => {
        const outDir = path.join(tmpDir, 'generated-slas');
        const mappingPath = path.join(tmpDir, 'mapping.json');
        fs.mkdirSync(outDir, { recursive: true });

        const res = await request(app).post('/slas').send({
            templatePath: path.join(projectRoot, 'specs/slaTemplates/basicResearcher.yaml'),
            csvPath: path.join(projectRoot, 'specs/csv/usersBasic.csv'),
            slasPath: outDir,
            userKeysJsonPath: mappingPath
        });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe('created');

        const generatedFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.yaml'));
        expect(generatedFiles.length).toBeGreaterThan(0);

        const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        const users = Object.keys(mapping);
        expect(users.length).toBeGreaterThan(0);
        expect(mapping[users[0]]).toHaveProperty('apikeys');
    });
});
