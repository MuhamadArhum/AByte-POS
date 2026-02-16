const express = require('express');
const router = express.Router();
const controller = require('../controllers/quotationController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', controller.getStats);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', authorize('Admin', 'Manager'), controller.create);
router.put('/:id', authorize('Admin', 'Manager'), controller.update);
router.put('/:id/status', authorize('Admin', 'Manager'), controller.updateStatus);
router.post('/:id/convert', authorize('Admin', 'Manager'), controller.convertToSale);
router.delete('/:id', authorize('Admin', 'Manager'), controller.delete);

module.exports = router;
