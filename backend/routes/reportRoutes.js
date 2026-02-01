// =============================================================
// reportRoutes.js - Report Routes
// Defines the API endpoints for generating business reports.
// All routes require authentication AND Admin or Manager role.
// Cashiers cannot access reports.
// Mounted at: /api/reports (see server.js)
//
// Endpoints:
//   GET /api/reports/daily       - Today's sales summary
//   GET /api/reports/date-range  - Sales summary for a date range (?start_date, ?end_date)
//   GET /api/reports/product     - Product-wise sales breakdown (optional date range)
//   GET /api/reports/inventory   - Current inventory snapshot with stock analysis
// =============================================================

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

// Apply middleware to ALL report routes:
// 1. authenticate - must be logged in
// 2. authorize('Admin', 'Manager') - only Admin and Manager can view reports
router.use(authenticate);
router.use(authorize('Admin', 'Manager'));

router.get('/daily', reportController.dailyReport);           // Today's sales summary
router.get('/date-range', reportController.dateRangeReport);  // Date range sales report
router.get('/product', reportController.productReport);       // Product performance report
router.get('/inventory', reportController.inventoryReport);   // Inventory status report

module.exports = router;
