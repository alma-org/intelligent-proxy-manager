import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createMakeRunner() {
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

  return (target) => {
    return new Promise((resolve) => {
      exec(`${makeCommand} -f Makefile ${target}`, { cwd: makeDir, env }, (error, stdout, stderr) => {
        // Resolve with all details, don't reject, so tests can assert on errors if expected
        resolve({ error, stdout, stderr });
      });
    });
  };
}
