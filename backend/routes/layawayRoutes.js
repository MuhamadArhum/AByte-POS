const express = require('express');
const router = express.Router();
const controller = require('../controllers/layawayController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', controller.getStats);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', authorize('Admin', 'Manager'), controller.create);
router.post('/:id/payment', authorize('Admin', 'Manager'), controller.makePayment);
router.post('/:id/complete', authorize('Admin', 'Manager'), controller.complete);
router.put('/:id/cancel', authorize('Admin', 'Manager'), controller.cancel);

module.exports = router;
