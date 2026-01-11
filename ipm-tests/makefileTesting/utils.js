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
    const gitBinPath = 'C:\\Program Files\\Git\\usr\\bin';
    const gitBinPath2 = 'C:\\Program Files\\Git\\bin';
    if (fs.existsSync(gitBinPath)) {
      env.PATH = gitBinPath + path.delimiter + gitBinPath2 + path.delimiter + env.PATH;
      env.SHELL = 'sh.exe';
    }
  }

  const nodeDir = path.dirname(process.execPath);
  if (!env.PATH.includes(nodeDir)) {
    env.PATH = nodeDir + path.delimiter + env.PATH;
  }

  return (target) => {
    return new Promise((resolve) => {
      const parts = target.split(' ');
      const targetEnv = { ...env };
      let actualTarget = '';
      
      for (const part of parts) {
        if (part.includes('=') && !actualTarget) {
          const [key, ...valueParts] = part.split('=');
          let value = valueParts.join('=');
          value = value.replace(/^["']|["']$/g, '');
          targetEnv[key] = value;
          
        } else {
          actualTarget += (actualTarget ? ' ' : '') + part;
        }
      }
      
      let command;
      if (process.platform === 'win32') {
        makeCommand = 'mingw32-make';
        command = `${makeCommand} -f Makefile ${actualTarget} SHELL=sh.exe`;
      } else {
        command = `make -f Makefile ${actualTarget}`;
      }
      
      exec(command, { cwd: makeDir, env: targetEnv }, (error, stdout, stderr) => {
        const actualError = stdout && stdout.trim().length > 0 ? null : error;
        resolve({ error: actualError, stdout, stderr });
      });
    });
  };
}
