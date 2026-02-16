const express = require('express');
const router = express.Router();
const controller = require('../controllers/inventoryReportController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('Admin', 'Manager'));

router.get('/summary', controller.getStockSummary);
router.get('/top-products', controller.getTopProducts);
router.get('/category-breakdown', controller.getCategoryBreakdown);
router.get('/slow-movers', controller.getSlowMovers);

module.exports = router;
