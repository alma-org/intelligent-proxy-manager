const { Router } = require('express');
const nginxController = require('../controllers/nginxController');

const router = Router();

router.post('/config', nginxController.createConfig);
router.post('/config/reload', nginxController.replaceConfig);
router.post('/confd/users', nginxController.addUserToConfd);
router.delete('/confd/users', nginxController.removeUserFromConfd);

module.exports = router;
