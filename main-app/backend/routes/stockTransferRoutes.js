const express = require('express');
const router = express.Router();
const controller = require('../controllers/stockTransferController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', controller.getStats);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', authorize('Admin', 'Manager'), controller.create);
router.put('/:id/approve', authorize('Admin', 'Manager'), controller.approve);
router.put('/:id/cancel', authorize('Admin', 'Manager'), controller.cancel);

module.exports = router;
