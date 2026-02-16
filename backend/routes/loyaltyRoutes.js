const express = require('express');
const router = express.Router();
const controller = require('../controllers/loyaltyController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/config', controller.getConfig);
router.put('/config', authorize('Admin'), controller.updateConfig);
router.get('/stats', controller.getStats);
router.get('/leaderboard', controller.getLeaderboard);
router.get('/customer/:id', controller.getCustomerPoints);
router.post('/adjust', authorize('Admin'), controller.adjustPoints);

module.exports = router;
