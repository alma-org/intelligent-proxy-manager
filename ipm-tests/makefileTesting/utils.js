import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createMakeRunner() {
  const makefilePath = path.resolve(__dirname, '../../Makefile');
  const makeDir = path.dirname(makefilePath);
  
  if (process.platform === 'win32') {
    const gitBinPath = 'C:\\Program Files\\Git\\usr\\bin';
    const gitBinPath2 = 'C:\\Program Files\\Git\\bin';
    const strawberryBin = 'C:\\Strawberry\\c\\bin';
    const nodeBin = 'C:\\Program Files\\nodejs';

    const bins = [gitBinPath, gitBinPath2, strawberryBin, nodeBin].filter(fs.existsSync);
    process.env.PATH = bins.join(path.delimiter) + path.delimiter + process.env.PATH;
    
    process.env.SHELL = 'sh.exe';
  }

  const makeCommand = process.platform === 'win32' ? 'mingw32-make' : 'make';

  return (target) => {
    return new Promise((resolve) => {
      const parts = target.split(' ');
      let makeVars = '';
      let actualTarget = '';
      
      for (const part of parts) {
        if (part.includes('=')) {
          const [key, ...valParts] = part.split('=');
          const value = valParts.join('=');
          // Quote the value for the shell
          makeVars += ` "${key}=${value}"`;
        } else {
          actualTarget += (actualTarget ? ' ' : '') + part;
        }
      }
      
      const command = `${makeCommand} -f Makefile ${actualTarget} ${makeVars}`;

      exec(command, { 
        cwd: makeDir,
        env: { ...process.env },
        maxBuffer: 1024 * 1024 * 10
      }, (error, stdout, stderr) => {
        const execResult = `STDOUT:\n${stdout}\nSTDERR:\n${stderr}\nERROR:\n${error ? error.message : 'null'}\n\n`;
        resolve({ error, stdout, stderr });
      });
    });
  };
}
