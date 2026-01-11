import { describe, it, expect, beforeAll } from 'vitest';
import { createMakeRunner } from './utils.js';

describe('Makefile Caddy Tests', () => {
  let runMake;

  beforeAll(async () => {
    runMake = await createMakeRunner();
  });

  it('caddy_status should attempt to show status', async () => {
    // on Windows/CI without sudo/systemctl this might fail with an error code,
    // but the output should still contain the echo command from the Makefile
    const { stdout } = await runMake('caddy_status');
    expect(stdout).toContain('=== Caddy status ===');
  });

  it('caddy_current_config should attempt to show config', async () => {
    // similarly, this might fail to cat the file if it doesn't exist or permissions are wrong
    const { stdout } = await runMake('caddy_current_config');
    expect(stdout).toContain('=== Current Caddy Configuration ===');
  });
});
