const { generateSLAsFromCSV } = require('sla-wizard-plugin-sla-generator');
const slaRepository = require('../repositories/slaRepository');

const DEFAULTS = {
    slasPath: '../specs/slas',
    numKeysPerUser: 1
};

async function generateSlas({ templatePath, csvPath, slasPath, numKeysPerUser, userKeysJsonPath }) {
    const params = {
        slasPath: slasPath ?? DEFAULTS.slasPath,
        numKeysPerUser: numKeysPerUser ?? DEFAULTS.numKeysPerUser
    };
    return generateSLAsFromCSV({
        template: templatePath,
        csv: csvPath,
        outDir: params.slasPath,
        keys: params.numKeysPerUser,
        mapping: userKeysJsonPath,
        existing: params.slasPath
    });
}

function listAllSlas(slasPath) {
    const dir = slasPath || DEFAULTS.slasPath;
    return slaRepository.listSlas(dir).map(filePath => slaRepository.getSla(filePath));
}

module.exports = { generateSlas, listAllSlas };
