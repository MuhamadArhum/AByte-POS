const express = require('express');
const router = express.Router();
const bundleController = require('../controllers/bundleController');
const { authenticate, authorize } = require('../middleware/auth');

// ==================== Bundle Routes ====================

// Get all bundles
router.get('/', authenticate, bundleController.getAllBundles);

// Create bundle (admin/manager only)
router.post('/', authenticate, authorize('Admin', 'Manager'), bundleController.createBundle);

// Detect applicable bundles for cart items (all authenticated users)
// IMPORTANT: Must be before /:bundle_id to avoid "detect" being treated as a bundle_id
router.post('/detect', authenticate, bundleController.detectBundles);

// Get single bundle by ID
router.get('/:bundle_id', authenticate, bundleController.getBundleById);

// Update bundle (admin/manager only)
router.put('/:bundle_id', authenticate, authorize('Admin', 'Manager'), bundleController.updateBundle);

// Delete bundle (admin/manager only)
router.delete('/:bundle_id', authenticate, authorize('Admin', 'Manager'), bundleController.deleteBundle);

module.exports = router;
