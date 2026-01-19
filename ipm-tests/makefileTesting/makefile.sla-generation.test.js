import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMakeRunner } from './utils.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Makefile SLA Generation Tests', () => {
  let runMake;
  let testSpecsDir;
  let tempTestDir;

  beforeAll(async () => {
    runMake = await createMakeRunner();
    testSpecsDir = path.resolve(__dirname, 'test-specs');
    tempTestDir = path.resolve(__dirname, 'temp-test-specs');
    
    // Create temp directory for testing
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempTestDir, { recursive: true });
  });

  afterAll(() => {
    // Clean up temp directory
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
  });

  const copyDirectory = (src, dest) => {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  };

  const readYamlFile = (filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    return yaml.load(content);
  };

  const readJsonFile = (filePath) => {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  };

  const normalizeData = (data) => JSON.parse(JSON.stringify(data));

  const normalizeMapping = (map) => {
    const normalized = {};
    for (const user in map) {
      // Handle both forward and backward slashes for cross-platform compatibility
      const slaFile = map[user].slaFile;
      const baseName = slaFile.split(/[/\\]/).pop();
      normalized[user] = {
        ...map[user],
        slaFile: baseName
      };
    }
    return normalized;
  };

  it('should generate SLAs for basic users while preserving existing ones', async () => {
    // Copy test-specs to temp directory
    copyDirectory(testSpecsDir, tempTestDir);

    const slasDir = path.join(tempTestDir, 'slas');
    const trazabilityDir = path.join(tempTestDir, 'trazability');
    const csvPath = path.join(tempTestDir, 'csv', 'usersBasic.csv');
    const templatePath = path.join(tempTestDir, 'slaTemplates', 'basicResearcher.yaml');
    const mappingPath = path.join(trazabilityDir, 'users-to-apikeys-basic.json');

    // Read existing SLA before running command
    const existingSlaPath = path.join(slasDir, 'sla_existingbasicuser1_us_es.yaml');
    const existingSlaDataBefore = readYamlFile(existingSlaPath);

    // Read existing mapping before running command
    const mappingDataBefore = readJsonFile(mappingPath);

    // Run the make command with environment variables (using forward slashes for Windows compatibility)
    const slaWizardPath = path.resolve(__dirname, '../../../sla-wizard').replace(/\\/g, '/');
    const templatePathFS = templatePath.replace(/\\/g, '/');
    const csvPathFS = csvPath.replace(/\\/g, '/');
    const slasDirFS = slasDir.replace(/\\/g, '/');
    const mappingPathFS = mappingPath.replace(/\\/g, '/');
    
    const { stdout, stderr, error } = await runMake(
      `SLA_WIZARD_PATH=${slaWizardPath} TEMPLATE_PATH=${templatePathFS} USERS_CSV_PATH=${csvPathFS} SLAS_PATH=${slasDirFS} USER_KEYS_JSON_PATH=${mappingPathFS} NUM_KEYS_PER_USER=1 create_slas_using_template`
    );

    if (error || stderr) {
      console.log('STDOUT:', stdout);
      console.log('STDERR:', stderr);
      console.log('ERROR:', error);
    }

    // Verify command ran successfully
    expect(stdout).toContain('# Creating/updating SLAs with sla-wizard');

    // 1. Verify existing SLA was NOT modified (if it still exists)
    if (fs.existsSync(existingSlaPath)) {
      const existingSlaDataAfter = readYamlFile(existingSlaPath);
      expect(normalizeData(existingSlaDataAfter)).toEqual(normalizeData(existingSlaDataBefore));
    }

    // 2. Verify new SLAs were created
    const newSla1Path = path.join(slasDir, 'sla_newuserbasic1_us_es.yaml');
    const newSla2Path = path.join(slasDir, 'sla_newuserbasic2_us_es.yaml');
    
    expect(fs.existsSync(newSla1Path)).toBe(true);
    expect(fs.existsSync(newSla2Path)).toBe(true);

    const newSla1Data = readYamlFile(newSla1Path);
    const newSla2Data = readYamlFile(newSla2Path);

    // Verify new SLAs have exactly 1 API key
    expect(newSla1Data.context.apikeys).toHaveLength(1);
    expect(newSla2Data.context.apikeys).toHaveLength(1);

    // 3. Verify mapping file was updated correctly
    const mappingDataAfter = readJsonFile(mappingPath);

    // Existing user should have same mapping (ignoring absolute vs relative path diffs)
    expect(normalizeMapping({ user: mappingDataAfter['existingbasicuser1@us.es'] }))
      .toEqual(normalizeMapping({ user: mappingDataBefore['existingbasicuser1@us.es'] }));

    // New users should be in mapping
    expect(mappingDataAfter['newuserbasic1@us.es']).toBeDefined();
    expect(mappingDataAfter['newuserbasic2@us.es']).toBeDefined();
    expect(mappingDataAfter['newuserbasic1@us.es'].apikeys).toHaveLength(1);
    expect(mappingDataAfter['newuserbasic2@us.es'].apikeys).toHaveLength(1);

    // Verify API keys in mapping match those in SLAs
    expect(mappingDataAfter['newuserbasic1@us.es'].apikeys[0]).toBe(newSla1Data.context.apikeys[0]);
    expect(mappingDataAfter['newuserbasic2@us.es'].apikeys[0]).toBe(newSla2Data.context.apikeys[0]);
  }, 30000);

  it('should generate SLAs for premium users while preserving existing ones', async () => {
    // Copy test-specs to temp directory
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
    copyDirectory(testSpecsDir, tempTestDir);

    const slasDir = path.join(tempTestDir, 'slas');
    const trazabilityDir = path.join(tempTestDir, 'trazability');
    const csvPath = path.join(tempTestDir, 'csv', 'usersPremium.csv');
    const templatePath = path.join(tempTestDir, 'slaTemplates', 'premiumResearcher.yaml');
    const mappingPath = path.join(trazabilityDir, 'users-to-apikeys-premium.json');

    // Read existing SLAs before running command
    const existingSla1Path = path.join(slasDir, 'sla_existingpremiumuser1_us_es.yaml');
    const existingSla2Path = path.join(slasDir, 'sla_existingpremiumuser2_us_es.yaml');
    
    const existingSla1DataBefore = readYamlFile(existingSla1Path);
    const existingSla2DataBefore = readYamlFile(existingSla2Path);

    // Read existing mapping before running command
    const mappingDataBefore = readJsonFile(mappingPath);

    // Run the make command with environment variables (using forward slashes for Windows compatibility)
    const slaWizardPath = path.resolve(__dirname, '../../../sla-wizard').replace(/\\/g, '/');
    const templatePathFS = templatePath.replace(/\\/g, '/');
    const csvPathFS = csvPath.replace(/\\/g, '/');
    const slasDirFS = slasDir.replace(/\\/g, '/');
    const mappingPathFS = mappingPath.replace(/\\/g, '/');
    
    const { stdout } = await runMake(
      `SLA_WIZARD_PATH=${slaWizardPath} TEMPLATE_PATH=${templatePathFS} USERS_CSV_PATH=${csvPathFS} SLAS_PATH=${slasDirFS} USER_KEYS_JSON_PATH=${mappingPathFS} NUM_KEYS_PER_USER=1 create_slas_using_template`
    );

    // Verify command ran successfully
    expect(stdout).toContain('# Creating/updating SLAs with sla-wizard');
    expect(stdout).toContain('# SLAs created/updated');

    // 1. Verify existing SLAs were NOT modified
    const existingSla1DataAfter = readYamlFile(existingSla1Path);
    const existingSla2DataAfter = readYamlFile(existingSla2Path);
    
    expect(normalizeData(existingSla1DataAfter)).toEqual(normalizeData(existingSla1DataBefore));
    expect(normalizeData(existingSla2DataAfter)).toEqual(normalizeData(existingSla2DataBefore));

    // 2. Verify new SLA was created
    const newSlaPath = path.join(slasDir, 'sla_newuserpremium1_us_es.yaml');
    
    expect(fs.existsSync(newSlaPath)).toBe(true);

    const newSlaData = readYamlFile(newSlaPath);

    // Verify new SLA has exactly 1 API key
    expect(newSlaData.context.apikeys).toHaveLength(1);

    // 3. Verify mapping file was updated correctly
    const mappingDataAfter = readJsonFile(mappingPath);

    // Existing users should have same mapping (ignoring absolute vs relative path diffs)
    const normalizedBefore = normalizeMapping(mappingDataBefore);
    const normalizedAfter = normalizeMapping(mappingDataAfter);

    expect(normalizedAfter['existingpremiumuser1@us.es']).toEqual(normalizedBefore['existingpremiumuser1@us.es']);
    expect(normalizedAfter['existingpremiumuser2@us.es']).toEqual(normalizedBefore['existingpremiumuser2@us.es']);

    // New user should be in mapping
    expect(mappingDataAfter['newuserpremium1@us.es']).toBeDefined();
    expect(mappingDataAfter['newuserpremium1@us.es'].apikeys).toHaveLength(1);

    // Verify API key in mapping matches that in SLA
    expect(mappingDataAfter['newuserpremium1@us.es'].apikeys[0]).toBe(newSlaData.context.apikeys[0]);
  }, 30000);
});
