const express = require('express');
const router = express.Router();
const bundleController = require('../controllers/bundleController');
const { authenticate, authorize } = require('../middleware/auth');

// ==================== Bundle CRUD Routes ====================

// Get all bundles
router.get('/', authenticate, bundleController.getAllBundles);

// Get single bundle by ID
router.get('/:bundle_id', authenticate, bundleController.getBundleById);

// Create bundle (admin/manager only)
router.post('/', authenticate, authorize('Admin', 'Manager'), bundleController.createBundle);

// Update bundle (admin/manager only)
router.put('/:bundle_id', authenticate, authorize('Admin', 'Manager'), bundleController.updateBundle);

// Delete bundle (admin/manager only)
router.delete('/:bundle_id', authenticate, authorize('Admin', 'Manager'), bundleController.deleteBundle);

// ==================== Bundle Detection Route ====================

// Detect applicable bundles for cart items (all authenticated users)
router.post('/detect', authenticate, bundleController.detectBundles);

module.exports = router;
