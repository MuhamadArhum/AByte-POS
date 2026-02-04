const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get Settings: Accessible by everyone (POS needs it for receipts)
router.get('/', settingsController.getSettings);

// Update Settings: Accessible only by Admin
router.put('/', authorize('Admin'), settingsController.updateSettings);

module.exports = router;
