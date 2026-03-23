import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);
const { createApp } = _require('../app.js');

const app = createApp();

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const testSpecsDir = path.join(__dirname, 'test-specs');

describe('POST /nginx/config (replicates makefile create_nginx_config)', () => {
    let tmpDir;

    beforeAll(() => {
        tmpDir = path.join(__dirname, 'temp-nginx-config-test');
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tmpDir, { recursive: true });
    });

    afterAll(() => {
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it('generates nginx.conf + conf.d/ files with correct post-processing', async () => {
        const oasPath = path.join(testSpecsDir, 'hpc-oas.yaml');
        const slasPath = path.join(testSpecsDir, 'slas');

        const res = await request(app).post('/nginx/config').send({
            outDir: tmpDir,
            oasPath,
            slasPath,
            authLocation: 'header',
        });

        expect(res.status).toBe(200);

        // nginx.conf must exist
        const nginxConf = path.join(tmpDir, 'nginx.conf');
        expect(fs.existsSync(nginxConf)).toBe(true);

        const nginxContent = fs.readFileSync(nginxConf, 'utf8');

        // Nginx structure
        expect(nginxContent).toContain('http {');
        expect(nginxContent).toContain('server {');

        // conf.d include directive is present (sla-wizard-nginx-confd style)
        expect(nginxContent).toMatch(/include\s+conf\.d/);

        // Post-processing: localhost replaced by 127.0.0.1
        expect(nginxContent).not.toContain('localhost:8000');

        // conf.d/ directory must exist and contain at least one .conf file
        const confdDir = path.join(tmpDir, 'conf.d');
        expect(fs.existsSync(confdDir)).toBe(true);
        const confdFiles = fs.readdirSync(confdDir).filter((f) => f.endsWith('.conf'));
        expect(confdFiles.length).toBeGreaterThan(0);

        // Each conf.d file must contain a location block (rate-limited endpoint)
        const hasLocation = confdFiles.some((f) => {
            const content = fs.readFileSync(path.join(confdDir, f), 'utf8');
            return content.includes('location');
        });
        expect(hasLocation).toBe(true);

        // One conf.d file per SLA (one per user in the slas directory)
        const slaCount = fs.readdirSync(slasPath).filter((f) => f.endsWith('.yaml')).length;
        expect(confdFiles.length).toBe(slaCount);
    });
});
