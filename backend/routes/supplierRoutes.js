const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authenticate, authorize } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticate);

// Supplier CRUD routes
router.get('/', supplierController.getAll);
router.get('/:id', supplierController.getById);
router.post('/', authorize('Admin', 'Manager'), supplierController.create);
router.put('/:id', authorize('Admin', 'Manager'), supplierController.update);
router.delete('/:id', authorize('Admin', 'Manager'), supplierController.delete);

// Payment routes
router.post('/:supplier_id/payments', authorize('Admin', 'Manager'), supplierController.addPayment);
router.get('/:supplier_id/payments', supplierController.getPayments);

module.exports = router;
