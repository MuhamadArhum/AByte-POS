const express = require('express');
const router  = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

router.get('/low-stock', inventoryController.getLowStock);
router.get('/stats',     inventoryController.getStats);
router.get('/',          inventoryController.getAll);
router.put('/:id', requirePermission('inventory.stock'), inventoryController.updateStock);

module.exports = router;
