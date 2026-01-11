import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import path from 'path';

import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Makefile Tests', () => {
  const makefilePath = path.resolve(__dirname, '../../Makefile');
  const makeDir = path.dirname(makefilePath);
  let makeCommand = 'make';
  let env = { ...process.env };

  if (process.platform === 'win32') {
    makeCommand = 'mingw32-make';
    // Attempt to find git-bash / usr / bin to add to path for grep, awk, etc.
    const commonPaths = [
      'C:\\Program Files\\Git\\usr\\bin',
      'C:\\Program Files\\Git\\bin',
      'C:\\Users\\pc\\AppData\\Local\\Programs\\Git\\usr\\bin',
      'C:\\Users\\pc\\AppData\\Local\\Programs\\Git\\bin',
    ];
    
    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        env.PATH = p + path.delimiter + env.PATH;
        break; 
      }
    }
  }

  const runMake = (target) => {
    return new Promise((resolve, reject) => {
      exec(`${makeCommand} -f Makefile ${target}`, { cwd: makeDir, env }, (error, stdout, stderr) => {
        if (error) {
          reject({ error, stderr });
        } else {
          resolve(stdout);
        }
      });
    });
  };

  it('make help should run successfully and show available targets', async () => {
    const stdout = await runMake('help');
    expect(stdout).toContain('Available Makefile targets:');
    expect(stdout).toContain('help');
    expect(stdout).toContain('list');
  });

  it('make list should run successfully and list targets', async () => {
    const stdout = await runMake('list');
    // Check for some known targets
    expect(stdout).toContain('help');
    expect(stdout).toContain('list');
    // We expect it NOT to crash or error
  });
});
