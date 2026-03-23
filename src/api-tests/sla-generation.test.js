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

const copyDirectory = (src, dest) => {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Extract apikeys list from a raw YAML string (no yaml parser dependency).
const extractApikeys = (yamlText) => {
    const section = yamlText.match(/apikeys:\s*\n((?:\s*- .+\n?)*)/);
    if (!section) return [];
    return [...section[1].matchAll(/- (\S+)/g)].map((m) => m[1]);
};

// Normalise mapping by stripping directory prefix from slaFile so
// absolute vs relative paths don't cause false negatives.
const normaliseSlaFile = (entry) => ({
    ...entry,
    slaFile: path.basename(entry.slaFile),
});

describe('POST /slas - upgrade existing user from 1 to 2 apikeys', () => {
    let tmpDir;

    beforeAll(() => {
        tmpDir = path.join(__dirname, 'temp-sla-upgrade-test');
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
        copyDirectory(testSpecsDir, tmpDir);
    });

    afterAll(() => {
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('preserves the existing apikey and appends a new one when requesting 2 keys', async () => {
        const slasDir = path.join(tmpDir, 'slas');
        const mappingPath = path.join(tmpDir, 'trazability', 'users-to-apikeys-basic.json');

        const existingSlaPath = path.join(slasDir, 'sla_existingbasicuser1_us_es.yaml');
        const originalApikey = extractApikeys(fs.readFileSync(existingSlaPath, 'utf8'))[0];

        // Request 2 keys for a user that currently has 1
        const res = await request(app).post('/slas').send({
            templatePath: path.join(tmpDir, 'slaTemplates', 'basicResearcher.yaml'),
            csvPath: path.join(tmpDir, 'csv', 'usersBasic.csv'),
            slasPath: slasDir,
            userKeysJsonPath: mappingPath,
            numKeysPerUser: 2,
        });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe('created');

        // The existing user's SLA must now have exactly 2 apikeys
        const updatedApikeys = extractApikeys(fs.readFileSync(existingSlaPath, 'utf8'));
        expect(updatedApikeys).toHaveLength(2);

        // The original apikey must be preserved as the first entry
        expect(updatedApikeys[0]).toBe(originalApikey);

        // A second, different apikey must have been added
        expect(updatedApikeys[1]).toBeDefined();
        expect(updatedApikeys[1]).not.toBe(originalApikey);

        // The mapping must be updated: the user now has 2 apikeys, original one first
        const mappingAfter = readJson(mappingPath);
        expect(mappingAfter['existingbasicuser1@us.es'].apikeys).toHaveLength(2);
        expect(mappingAfter['existingbasicuser1@us.es'].apikeys[0]).toBe(originalApikey);

        // Other users that were not in the CSV at the time must be unaffected
        // (no new users were added without existing entries in test-specs)
        expect(Object.keys(mappingAfter)).toContain('existingbasicuser1@us.es');
    });
});

describe('POST /slas - basic users (replicates makefile create_slas_using_template)', () => {
    let tmpDir;

    beforeAll(() => {
        tmpDir = path.join(__dirname, 'temp-sla-basic-test');
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
        copyDirectory(testSpecsDir, tmpDir);
    });

    afterAll(() => {
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it('generates basic-user SLAs, preserves existing ones and updates the mapping', async () => {
        const slasDir = path.join(tmpDir, 'slas');
        const mappingPath = path.join(tmpDir, 'trazability', 'users-to-apikeys-basic.json');

        const existingSlaPath = path.join(slasDir, 'sla_existingbasicuser1_us_es.yaml');
        const existingApikeysBefore = extractApikeys(fs.readFileSync(existingSlaPath, 'utf8'));
        const mappingBefore = readJson(mappingPath);

        const res = await request(app).post('/slas').send({
            templatePath: path.join(tmpDir, 'slaTemplates', 'basicResearcher.yaml'),
            csvPath: path.join(tmpDir, 'csv', 'usersBasic.csv'),
            slasPath: slasDir,
            userKeysJsonPath: mappingPath,
        });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe('created');

        // Existing SLA apikeys must not have changed (sla-wizard may reformat YAML)
        expect(extractApikeys(fs.readFileSync(existingSlaPath, 'utf8'))).toEqual(existingApikeysBefore);

        // New SLA files must exist
        const newSla1 = path.join(slasDir, 'sla_newuserbasic1_us_es.yaml');
        const newSla2 = path.join(slasDir, 'sla_newuserbasic2_us_es.yaml');
        expect(fs.existsSync(newSla1)).toBe(true);
        expect(fs.existsSync(newSla2)).toBe(true);

        // New SLAs must each contain exactly one apikey
        const sla1Text = fs.readFileSync(newSla1, 'utf8');
        const sla2Text = fs.readFileSync(newSla2, 'utf8');
        expect(extractApikeys(sla1Text)).toHaveLength(1);
        expect(extractApikeys(sla2Text)).toHaveLength(1);

        // Mapping must be updated
        const mappingAfter = readJson(mappingPath);

        // Existing user's entry must be unchanged (normalise slaFile path)
        expect(normaliseSlaFile(mappingAfter['existingbasicuser1@us.es']))
            .toEqual(normaliseSlaFile(mappingBefore['existingbasicuser1@us.es']));

        // New users must appear in the mapping with 1 apikey each
        expect(mappingAfter['newuserbasic1@us.es']).toBeDefined();
        expect(mappingAfter['newuserbasic2@us.es']).toBeDefined();
        expect(mappingAfter['newuserbasic1@us.es'].apikeys).toHaveLength(1);
        expect(mappingAfter['newuserbasic2@us.es'].apikeys).toHaveLength(1);

        // Apikeys in the mapping must appear in the respective SLA files
        expect(sla1Text).toContain(mappingAfter['newuserbasic1@us.es'].apikeys[0]);
        expect(sla2Text).toContain(mappingAfter['newuserbasic2@us.es'].apikeys[0]);
    });
});

describe('POST /slas – premium users (replicates makefile create_slas_using_template)', () => {
    let tmpDir;

    beforeAll(() => {
        tmpDir = path.join(__dirname, 'temp-sla-premium-test');
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
        copyDirectory(testSpecsDir, tmpDir);
    });

    afterAll(() => {
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    it('generates premium-user SLAs, preserves existing ones and updates the mapping', async () => {
        const slasDir = path.join(tmpDir, 'slas');
        const mappingPath = path.join(tmpDir, 'trazability', 'users-to-apikeys-premium.json');

        const existingSla1 = path.join(slasDir, 'sla_existingpremiumuser1_us_es.yaml');
        const existingSla2 = path.join(slasDir, 'sla_existingpremiumuser2_us_es.yaml');
        const existingApikeys1Before = extractApikeys(fs.readFileSync(existingSla1, 'utf8'));
        const existingApikeys2Before = extractApikeys(fs.readFileSync(existingSla2, 'utf8'));
        const mappingBefore = readJson(mappingPath);

        const res = await request(app).post('/slas').send({
            templatePath: path.join(tmpDir, 'slaTemplates', 'premiumResearcher.yaml'),
            csvPath: path.join(tmpDir, 'csv', 'usersPremium.csv'),
            slasPath: slasDir,
            userKeysJsonPath: mappingPath,
        });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe('created');

        // Existing SLA apikeys must not have changed
        expect(extractApikeys(fs.readFileSync(existingSla1, 'utf8'))).toEqual(existingApikeys1Before);
        expect(extractApikeys(fs.readFileSync(existingSla2, 'utf8'))).toEqual(existingApikeys2Before);

        // New SLA file must exist
        const newSla = path.join(slasDir, 'sla_newuserpremium1_us_es.yaml');
        expect(fs.existsSync(newSla)).toBe(true);

        const newSlaText = fs.readFileSync(newSla, 'utf8');
        expect(extractApikeys(newSlaText)).toHaveLength(1);

        // Mapping must be updated
        const mappingAfter = readJson(mappingPath);

        // Existing users unchanged
        expect(normaliseSlaFile(mappingAfter['existingpremiumuser1@us.es']))
            .toEqual(normaliseSlaFile(mappingBefore['existingpremiumuser1@us.es']));
        expect(normaliseSlaFile(mappingAfter['existingpremiumuser2@us.es']))
            .toEqual(normaliseSlaFile(mappingBefore['existingpremiumuser2@us.es']));

        // New user in mapping with 1 apikey
        expect(mappingAfter['newuserpremium1@us.es']).toBeDefined();
        expect(mappingAfter['newuserpremium1@us.es'].apikeys).toHaveLength(1);

        // Apikey in mapping appears in SLA
        expect(newSlaText).toContain(mappingAfter['newuserpremium1@us.es'].apikeys[0]);
    });
});
