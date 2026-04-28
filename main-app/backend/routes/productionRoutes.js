const express = require('express');
const router = express.Router();
const productionController = require('../controllers/productionController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

router.get('/', productionController.getAll);
router.get('/:id', productionController.getById);
router.post('/', requirePermission('inventory.products'), productionController.create);

module.exports = router;
