const { ok, badRequest, serverError } = require('../utils/response');

async function createConfig(req, res) {
    const { outDir, oasPath, slasPath, authLocation } = req.body;
    const nginxService = req.app.get('nginxService');
    try {
        await nginxService.generateConfig({ outDir, oasPath, slasPath, authLocation });
        return ok(res, { outDir });
    } catch (err) {
        return serverError(res, err);
    }
}

async function replaceConfig(req, res) {
    const { outDir, oasPath, slasPath, authLocation, nginxContainer } = req.body;
    const nginxService = req.app.get('nginxService');
    try {
        await nginxService.generateAndReloadConfig({ outDir, oasPath, slasPath, authLocation, nginxContainer });
        return ok(res, { reloaded: true });
    } catch (err) {
        return serverError(res, err);
    }
}

async function addUserToConfd(req, res) {
    const { slaPath, outDir, oasPath } = req.body;
    if (!slaPath) return badRequest(res, 'slaPath is required');
    if (!outDir) return badRequest(res, 'outDir is required');
    const nginxService = req.app.get('nginxService');
    try {
        await nginxService.addUserToConfd({ slaPath, outDir, oasPath });
        return ok(res, { slaPath, outDir });
    } catch (err) {
        return serverError(res, err);
    }
}

async function removeUserFromConfd(req, res) {
    const { outDir, slasPath } = req.body;
    if (!outDir) return badRequest(res, 'outDir is required');
    if (!slasPath) return badRequest(res, 'slasPath is required');
    const nginxService = req.app.get('nginxService');
    try {
        await nginxService.removeUserFromConfd({ outDir, slasPath });
        return ok(res, { outDir, slasPath });
    } catch (err) {
        return serverError(res, err);
    }
}

module.exports = { createConfig, replaceConfig, addUserToConfd, removeUserFromConfd };
