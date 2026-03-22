const { ok, created, badRequest, serverError } = require('../utils/response');

async function createSlas(req, res) {
    const { templatePath, csvPath, slasPath, numKeysPerUser, userKeysJsonPath } = req.body;
    if (!templatePath) return badRequest(res, 'templatePath is required');
    if (!csvPath) return badRequest(res, 'csvPath is required');
    if (!userKeysJsonPath) return badRequest(res, 'userKeysJsonPath is required');
    const slasService = req.app.get('slasService');
    try {
        const mapping = await slasService.generateSlas({ templatePath, csvPath, slasPath, numKeysPerUser, userKeysJsonPath });
        return created(res, { mapping });
    } catch (err) {
        return serverError(res, err);
    }
}

async function listSlas(req, res) {
    const slasPath = req.query.slasPath;
    const slasService = req.app.get('slasService');
    try {
        const slas = slasService.listAllSlas(slasPath);
        return ok(res, { slas });
    } catch (err) {
        return serverError(res, err);
    }
}

module.exports = { createSlas, listSlas };
