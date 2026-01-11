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

  it('caddy_reload_config should attempt to reload config', async () => {
    const { stdout } = await runMake('caddy_reload_config');
    expect(stdout).toContain('=== Reloading caddy config ===');
  });

  it('caddy_replace_config should attempt to replace config', async () => {
    const { stdout } = await runMake('caddy_replace_config');
    expect(stdout).toContain('=== Replacing caddy configuration');
  });

  it('caddy_show_initial_html should attempt to show initial html', async () => {
    const { stdout } = await runMake('caddy_show_initial_html');
    expect(stdout).toContain('=== Initial html served by Caddy ===');
  });

  it('caddy_logs should attempt to show logs', async () => {
    const { stdout } = await runMake('caddy_logs');
    expect(stdout).toContain('=== Caddy Logs ===');
  });
});

