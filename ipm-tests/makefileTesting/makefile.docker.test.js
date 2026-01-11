import { describe, it, expect, beforeAll } from 'vitest';
import { createMakeRunner } from './utils.js';

describe('Makefile Docker Tests', () => {
  let runMake;

  beforeAll(async () => {
    runMake = await createMakeRunner();
  });

  it('docker_status should attempt to show docker status', async () => {
    const { stdout } = await runMake('docker_status');
    expect(stdout).toContain('=== Active containers ===');
    expect(stdout).toContain('=== All containers ===');
    expect(stdout).toContain('=== Current downloaded images ===');
    expect(stdout).toContain('=== Current volumes ===');
    expect(stdout).toContain('=== Current networks ===');
  });
});
