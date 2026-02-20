const express = require('express');
const router = express.Router();
const controller = require('../controllers/giftCardController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', controller.getStats);
router.post('/check-balance', controller.checkBalance);
router.get('/:id', controller.getById);
router.get('/', controller.getAll);
router.post('/', authorize('Admin', 'Manager'), controller.create);
router.post('/:id/load', authorize('Admin', 'Manager'), controller.loadFunds);
router.post('/:id/redeem', controller.redeem);
router.put('/:id/disable', authorize('Admin', 'Manager'), controller.disable);

module.exports = router;
