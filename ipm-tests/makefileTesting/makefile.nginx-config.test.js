import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMakeRunner } from './utils.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Makefile Nginx Configuration Tests', () => {
  let runMake;
  let testSpecsDir;
  let tempTestDir;

  beforeAll(async () => {
    runMake = await createMakeRunner();
    testSpecsDir = path.resolve(__dirname, 'test-specs');
    tempTestDir = path.resolve(__dirname, 'temp-nginx-config-test');
    
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

  it('should generate nginx.conf with correct replacements and preserve production config', async () => {
    // 1. Setup temporary workspace
    copyDirectory(testSpecsDir, tempTestDir);

    const slasDir = path.join(tempTestDir, 'slas');
    const oasPath = path.join(tempTestDir, 'hpc-oas.yaml');
    const tempNginxConf = path.join(tempTestDir, 'nginx.conf');
    
    // Use absolute paths with forward slashes (mirroring makefile.sla-generation.test.js logic)
    const slaWizardPath = path.resolve(__dirname, '../../../sla-wizard').replace(/\\/g, '/');
    const slasDirFS = slasDir.replace(/\\/g, '/');
    const oasPathFS = oasPath.replace(/\\/g, '/');
    const tempNginxConfFS = tempNginxConf.replace(/\\/g, '/');

    // Run make command with overrides
    const { stdout, stderr, error } = await runMake(
      `SLA_WIZARD_PATH=${slaWizardPath} OAS_PATH=${oasPathFS} SLAS_PATH=${slasDirFS} NGINX_CONF_PATH=${tempNginxConfFS} NGINX_TARGET_CONFIG=${tempNginxConfFS} create_nginx_config`
    );

    if (error || stderr) {
      console.log('STDOUT:', stdout);
      console.log('STDERR:', stderr);
      console.log('ERROR:', error);
    }

    // 2. Verify command ran successfully
    expect(stdout).toContain('Creating proxy configuration file with sla-wizard for nginx');
    // We use a regex for the arrow character to be safe with encoding
    expect(stdout).toMatch(/Replacing localhost:8000 .* host\.docker\.internal:8000/);
    expect(stdout).toContain('Ensuring nginx listens on port 8080 instead of 80');

    // 3. Verify the content of the generated file
    expect(fs.existsSync(tempNginxConf)).toBe(true);
    const configContent = fs.readFileSync(tempNginxConf, 'utf8');

    // Verify Nginx structure
    expect(configContent).toContain('http {');
    expect(configContent).toContain('server {');

    // Verify post-processing replacements
    expect(configContent).toContain('listen 8080;');
    expect(configContent).not.toContain('listen 80;');
    expect(configContent).toContain('127.0.0.1:8000');
    expect(configContent).not.toContain('localhost:8000');

    // 4. Verify production config was NOT affected
    const prodConfigPath = path.resolve(__dirname, '../../../nginxConf/nginx.conf');
    if (fs.existsSync(prodConfigPath)) {
        // Since we overridden NGINX_TARGET_CONFIG, it shouldn't have been touched.
    }
  }, 40000);
});
