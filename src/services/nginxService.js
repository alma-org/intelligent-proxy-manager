const slaWizard = require('sla-wizard');
const nginxConfd = require('sla-wizard-nginx-confd');
const nginxStrip = require('sla-wizard-plugin-nginx-strip');
const nginxRepository = require('../repositories/nginxRepository');

slaWizard.use(nginxConfd);
slaWizard.use(nginxStrip);

const DEFAULTS = {
    oasPath: '../specs/hpc-oas.yaml',
    slasPath: '../specs/slas',
    outDir: '../nginx-conf',
    authLocation: 'header',
    nginxContainer: 'sla-proxy'
};

async function generateConfig({ outDir, oasPath, slasPath, authLocation }) {
    const params = {
        outDir: outDir ?? DEFAULTS.outDir,
        oasPath: oasPath ?? DEFAULTS.oasPath,
        slasPath: slasPath ?? DEFAULTS.slasPath,
        authLocation: authLocation ?? DEFAULTS.authLocation
    };
    await slaWizard.configNginxStrip({ outDir: params.outDir, oas: params.oasPath, sla: params.slasPath, authLocation: params.authLocation, authName: 'apikey', proxyPort: 8080 });
    nginxRepository.applyPostProcessing(params.outDir);
}

async function generateAndReloadConfig({ outDir, oasPath, slasPath, authLocation, nginxContainer }) {
    const params = {
        outDir: outDir ?? DEFAULTS.outDir,
        oasPath: oasPath ?? DEFAULTS.oasPath,
        slasPath: slasPath ?? DEFAULTS.slasPath,
        authLocation: authLocation ?? DEFAULTS.authLocation,
        nginxContainer: nginxContainer ?? DEFAULTS.nginxContainer
    };
    await slaWizard.configNginxStrip({ outDir: params.outDir, oas: params.oasPath, sla: params.slasPath, authLocation: params.authLocation, authName: 'apikey', proxyPort: 8080 });
    nginxRepository.applyPostProcessing(params.outDir);
    nginxRepository.validateAndReload(params.nginxContainer);
}

async function addUserToConfd({ slaPath, outDir, oasPath }) {
    const oas = oasPath ?? DEFAULTS.oasPath;
    return slaWizard.addToStripConfd({ outDir, oas, sla: slaPath, authName: 'apikey', proxyPort: 8080 });
}

async function removeUserFromConfd({ outDir, slasPath }) {
    return slaWizard.removeFromConfd({ outDir, sla: slasPath });
}

module.exports = { generateConfig, generateAndReloadConfig, addUserToConfd, removeUserFromConfd };
