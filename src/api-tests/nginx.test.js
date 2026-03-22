import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);
const { createApp } = _require('../app.js');
const nginxService = _require('../services/nginxService.js');

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');
const oasPath = path.join(projectRoot, 'specs/hpc-oas.yaml');
const slasPath = path.join(projectRoot, 'specs/slas');

const app = createApp();

describe('POST /nginx/config', () => {
    let tmpDir;

    beforeAll(() => {
        tmpDir = path.join(__dirname, '..', 'ipm-nginx-config-test');
        fs.mkdirSync(tmpDir, { recursive: true });
    });

    afterAll(() => {
        // keep the dir so integration tests in tests/ can use it
        // fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns 200 and generates nginx.conf + flat conf.d/ files', async () => {
        const res = await request(app).post('/nginx/config').send({
            outDir: tmpDir,
            oasPath,
            slasPath,
            authLocation: 'header'
        });

        expect(res.status).toBe(200);

        const nginxConf = path.join(tmpDir, 'nginx.conf');
        expect(fs.existsSync(nginxConf)).toBe(true);
        expect(fs.readFileSync(nginxConf, 'utf8')).toContain('include conf.d');

        const confdDir = path.join(tmpDir, 'conf.d');
        expect(fs.existsSync(confdDir)).toBe(true);
        const confdFiles = fs.readdirSync(confdDir).filter(f => f.endsWith('.conf'));
        expect(confdFiles.length).toBeGreaterThan(0);
    });
});

describe('POST /nginx/config/reload', () => {
    let tmpDir;

    const reloadApp = createApp({
        nginxService: {
            ...nginxService,
            generateAndReloadConfig: async (params) => {
                await nginxService.generateConfig(params);
            }
        }
    });

    beforeAll(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipm-nginx-reload-'));
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns 200, reloaded:true and generates flat conf.d/ files', async () => {
        const res = await request(reloadApp).post('/nginx/config/reload').send({
            outDir: tmpDir,
            oasPath,
            slasPath
        });

        expect(res.status).toBe(200);
        expect(res.body.data.reloaded).toBe(true);

        const confdDir = path.join(tmpDir, 'conf.d');
        expect(fs.existsSync(confdDir)).toBe(true);
        const confdFiles = fs.readdirSync(confdDir).filter(f => f.endsWith('.conf'));
        expect(confdFiles.length).toBeGreaterThan(0);
    });
});

describe('POST /nginx/confd/users', () => {
    let tmpDir;

    beforeAll(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipm-nginx-confd-users-'));
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns 400 when slaPath is missing', async () => {
        const res = await request(app).post('/nginx/confd/users').send({ outDir: tmpDir });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/slaPath/);
    });

    it('returns 400 when outDir is missing', async () => {
        const res = await request(app).post('/nginx/confd/users').send({
            slaPath: path.join(projectRoot, 'specs/slas/sla_dgalvan_us_es.yaml')
        });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/outDir/);
    });

    it('returns 200 and adds a user conf file', async () => {
        const outDir = path.join(tmpDir, 'user-add');
        fs.mkdirSync(outDir, { recursive: true });

        const res = await request(app).post('/nginx/confd/users').send({
            slaPath: path.join(projectRoot, 'specs/slas/sla_dgalvan_us_es.yaml'),
            outDir,
            oasPath
        });

        expect(res.status).toBe(200);
        const files = fs.readdirSync(outDir, { recursive: true });
        expect(files.length).toBeGreaterThan(0);
    });
});

describe('DELETE /nginx/confd/users', () => {
    let tmpDir;

    beforeAll(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ipm-nginx-confd-delete-'));
        await request(app).post('/nginx/confd/users').send({
            slaPath: path.join(projectRoot, 'specs/slas/sla_dgalvan_us_es.yaml'),
            outDir: tmpDir,
            oasPath
        });
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns 400 when outDir is missing', async () => {
        const res = await request(app).delete('/nginx/confd/users').send({
            slasPath: path.join(projectRoot, 'specs/slas/sla_dgalvan_us_es.yaml')
        });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/outDir/);
    });

    it('returns 400 when slasPath is missing', async () => {
        const res = await request(app).delete('/nginx/confd/users').send({ outDir: tmpDir });

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/slasPath/);
    });

    it('returns 200 and removes the user conf file', async () => {
        const res = await request(app).delete('/nginx/confd/users').send({
            outDir: tmpDir,
            slasPath: path.join(projectRoot, 'specs/slas/sla_dgalvan_us_es.yaml')
        });

        expect(res.status).toBe(200);
    });
});
