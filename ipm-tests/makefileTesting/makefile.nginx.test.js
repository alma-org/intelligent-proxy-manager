import { describe, it, expect, beforeAll } from 'vitest';
import { createMakeRunner } from './utils.js';

describe('Makefile Nginx Tests', () => {
  let runMake;

  beforeAll(async () => {
    runMake = await createMakeRunner();
  });

  it('nginx_status should attempt to show status', async () => {
    const { stdout } = await runMake('nginx_status');
    expect(stdout).toContain('=== Nginx status (container: sla-proxy) ===');
  });

  it('nginx_current_config should attempt to show config', async () => {
    const { stdout } = await runMake('nginx_current_config');
    expect(stdout).toContain('=== Current nginx config ===');
  });

  it('nginx_reload_config should attempt to reload config', async () => {
    const { stdout } = await runMake('nginx_reload_config');
    // This target doesn't have an @echo, so make echoes the command itself.
    // We check if the command is printed to stdout.
    expect(stdout).toContain('docker exec sla-proxy nginx -s reload');
  });

  it('nginx_check_config should attempt to verify config', async () => {
    const { stdout } = await runMake('nginx_check_config');
    expect(stdout).toContain('Verifying nginx.conf syntax');
  });

  it('nginx_show_initial_html should attempt to show initial html', async () => {
    const { stdout } = await runMake('nginx_show_initial_html');
    expect(stdout).toContain('=== Initial HTML served by Nginx ===');
  });

  it('nginx_logs should attempt to show logs', async () => {
    const { stdout } = await runMake('nginx_logs');
    expect(stdout).toContain('=== showing Nginx logs ===');
  });
});
