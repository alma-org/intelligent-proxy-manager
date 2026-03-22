const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

function listSlas(slasDir) {
    if (!fs.existsSync(slasDir)) return [];
    return fs.readdirSync(slasDir)
        .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
        .map(f => path.join(slasDir, f));
}

function getSla(slaPath) {
    const content = fs.readFileSync(slaPath, 'utf8');
    return yaml.load(content);
}

module.exports = { listSlas, getSla };
