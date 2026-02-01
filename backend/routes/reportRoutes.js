const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('Admin', 'Manager'));

router.get('/daily', reportController.dailyReport);
router.get('/date-range', reportController.dateRangeReport);
router.get('/product', reportController.productReport);
router.get('/inventory', reportController.inventoryReport);

module.exports = router;
