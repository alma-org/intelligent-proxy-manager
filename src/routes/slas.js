const { Router } = require('express');
const slasController = require('../controllers/slasController');

const router = Router();

router.get('/', slasController.listSlas);
router.post('/', slasController.createSlas);

module.exports = router;
