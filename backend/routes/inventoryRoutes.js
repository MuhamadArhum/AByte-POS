// =============================================================
// inventoryRoutes.js - Inventory/Stock Routes
// Defines the API endpoints for viewing and managing stock levels.
// All routes require authentication. Stock updates are restricted to Admin/Manager.
// Mounted at: /api/inventory (see server.js)
//
// Endpoints:
//   GET /api/inventory/low-stock  - Get products with low stock (1-9 units)
//   GET /api/inventory            - Get all inventory with stock levels
//   PUT /api/inventory/:id        - Update stock for a product (Admin/Manager)
// =============================================================

const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');

// All inventory routes require authentication
router.use(authenticate);

// NOTE: /low-stock must be defined BEFORE /:id to avoid Express treating "low-stock" as an :id parameter
router.get('/low-stock', inventoryController.getLowStock);                              // All roles can view
router.get('/', inventoryController.getAll);                                           // All roles can view
router.put('/:id', authorize('Admin', 'Manager'), inventoryController.updateStock);    // Admin/Manager only

module.exports = router;
