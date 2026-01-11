import { describe, it, expect, beforeAll } from 'vitest';
import { createMakeRunner } from './utils.js';

describe('Makefile Documentation Tests', () => {
  let runMake;

  beforeAll(async () => {
    runMake = await createMakeRunner();
  });

  it('make help should run successfully and show available targets', async () => {
    const { stdout, error } = await runMake('help');
    expect(error).toBeNull();
    expect(stdout).toContain('Available Makefile targets:');
    expect(stdout).toContain('help');
    expect(stdout).toContain('list');
  });

  it('make list should run successfully and list targets', async () => {
    const { stdout, error } = await runMake('list');
    expect(error).toBeNull();
    expect(stdout).toContain('help');
    expect(stdout).toContain('list');
  });
});
