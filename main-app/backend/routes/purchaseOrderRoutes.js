const express = require('express');
const router = express.Router();
const poController = require('../controllers/purchaseOrderController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

router.get('/stock-alerts/stats', poController.getAlertStats);
router.get('/stock-alerts', poController.getStockAlerts);
router.put('/stock-alerts/:id/resolve', requirePermission('inventory.purchase_orders'), poController.resolveAlert);
router.get('/', poController.getAll);
router.get('/:id', poController.getById);
router.post('/', requirePermission('inventory.purchase_orders'), poController.create);
router.put('/:id', requirePermission('inventory.purchase_orders'), poController.update);
router.delete('/:id', requirePermission('inventory.purchase_orders'), poController.remove);
router.post('/:id/receive', requirePermission('inventory.purchase_orders'), poController.receive);
router.put('/:id/cancel', requirePermission('inventory.purchase_orders'), poController.cancel);

module.exports = router;
