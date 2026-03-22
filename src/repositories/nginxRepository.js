const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function applyPostProcessing(outDir) {
    const nginxConf = path.join(outDir, 'nginx.conf');
    const confdDir = path.join(outDir, 'conf.d');
    if (!fs.existsSync(nginxConf) || !fs.existsSync(confdDir)) return;
    let nginxContent = fs.readFileSync(nginxConf, 'utf8');
    nginxContent = nginxContent.replace(/localhost:8000/g, '127.0.0.1:8000');
    fs.writeFileSync(nginxConf, nginxContent);
}

function validateAndReload(nginxContainer) {
    execSync(`docker exec ${nginxContainer} nginx -t`, { stdio: 'inherit' });
    execSync(`docker exec ${nginxContainer} nginx -s reload`, { stdio: 'inherit' });
}

module.exports = { applyPostProcessing, validateAndReload };
