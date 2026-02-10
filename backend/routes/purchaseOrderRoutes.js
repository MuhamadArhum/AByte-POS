const express = require('express');
const router = express.Router();
const poController = require('../controllers/purchaseOrderController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', poController.getAll);
router.get('/stock-alerts', poController.getStockAlerts);
router.get('/:id', poController.getById);
router.post('/', authorize('Admin', 'Manager'), poController.create);
router.post('/:id/receive', authorize('Admin', 'Manager'), poController.receive);

module.exports = router;
