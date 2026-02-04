// =============================================================
// customerRoutes.js - Customer Management Routes
// Defines the API endpoints for managing customers.
// All routes require authentication. Any authenticated user can manage customers.
// Mounted at: /api/customers (see server.js)
//
// Endpoints:
//   GET  /api/customers      - List all customers (supports ?search filter)
//   POST /api/customers      - Create a new customer
//   GET  /api/customers/:id  - Get customer details with purchase history
// =============================================================

const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate } = require('../middleware/auth');

// All customer routes require authentication
router.use(authenticate);

router.get('/', customerController.getAll);      // List/search customers
router.post('/', customerController.create);     // Add new customer
router.get('/:id', customerController.getById);  // Customer details + purchase history
router.put('/:id', customerController.update);   // Update customer
router.delete('/:id', customerController.remove);// Delete customer

module.exports = router;
