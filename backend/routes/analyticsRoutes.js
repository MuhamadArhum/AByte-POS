const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/dashboard', analyticsController.getDashboardStats);
router.get('/sales-trend', analyticsController.getSalesTrend);
router.get('/category-breakdown', analyticsController.getCategoryBreakdown);

module.exports = router;
