// =============================================================
// productRoutes.js - Product & Category Routes
// Defines the API endpoints for product and category management.
// All routes require authentication. Write operations (create, update, delete)
// are restricted to Admin and Manager roles. Read operations are available to all.
// Mounted at: /api/products (see server.js)
//
// Endpoints:
//   GET    /api/products/categories     - Get all categories
//   POST   /api/products/categories     - Create category (Admin/Manager)
//   GET    /api/products                - List products (supports ?search, ?category, ?stock filters)
//   GET    /api/products/:id            - Get single product
//   POST   /api/products                - Create product (Admin/Manager)
//   PUT    /api/products/:id            - Update product (Admin/Manager)
//   DELETE /api/products/:id            - Delete product (Admin/Manager)
// =============================================================

const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');

// All product routes require authentication (must be logged in)
router.use(authenticate);

// Category endpoints (placed before /:id to avoid route conflicts)
router.get('/categories', productController.getCategories);                             // All roles can view
router.post('/categories', authorize('Admin', 'Manager'), productController.createCategory);  // Admin/Manager only

// Product CRUD endpoints
router.get('/', productController.getAll);                                              // All roles can view
router.get('/:id', productController.getById);                                         // All roles can view
router.post('/', authorize('Admin', 'Manager'), productController.create);              // Admin/Manager only
router.post('/:id/generate-barcode', authorize('Admin', 'Manager'), productController.generateBarcode);
router.put('/:id', authorize('Admin', 'Manager'), productController.update);            // Admin/Manager only
router.delete('/:id', authorize('Admin', 'Manager'), productController.remove);         // Admin/Manager only

module.exports = router;
