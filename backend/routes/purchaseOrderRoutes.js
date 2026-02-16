const express = require('express');
const router = express.Router();
const poController = require('../controllers/purchaseOrderController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/stock-alerts/stats', poController.getAlertStats);
router.get('/stock-alerts', poController.getStockAlerts);
router.put('/stock-alerts/:id/resolve', authorize('Admin', 'Manager'), poController.resolveAlert);
router.get('/', poController.getAll);
router.get('/:id', poController.getById);
router.post('/', authorize('Admin', 'Manager'), poController.create);
router.post('/:id/receive', authorize('Admin', 'Manager'), poController.receive);
router.put('/:id/cancel', authorize('Admin', 'Manager'), poController.cancel);

module.exports = router;
