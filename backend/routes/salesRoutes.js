// =============================================================
// salesRoutes.js - Sales/Billing Routes
// Defines the API endpoints for creating and viewing sales.
// All routes require authentication. Any authenticated user (including Cashier) can make sales.
// Mounted at: /api/sales (see server.js)
//
// Endpoints:
//   POST /api/sales        - Create a new sale (checkout from POS)
//   GET  /api/sales/today  - Get all sales made today
//   GET  /api/sales        - Get all sales (history)
//   GET  /api/sales/:id    - Get a specific sale with line items
// =============================================================

const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { authenticate } = require('../middleware/auth');

// All sales routes require authentication (no role restriction - all roles can sell)
router.use(authenticate);

router.post('/', salesController.createSale);    // Create new sale (POS checkout)
router.get('/pending', salesController.getPending); // Get pending sales
router.put('/:id/complete', salesController.completeSale); // Complete a pending sale
router.post('/:id/refund', salesController.refundSale); // Refund a sale
router.delete('/:id', salesController.deleteSale); // Delete/Void a sale
router.get('/today', salesController.getToday);  // Today's sales (must be before /:id)
router.get('/', salesController.getAll);         // All sales history
router.get('/:id', salesController.getById);     // Single sale with details

module.exports = router;
