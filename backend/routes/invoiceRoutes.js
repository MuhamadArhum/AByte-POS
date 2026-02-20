const express = require('express');
const router = express.Router();
const controller = require('../controllers/invoiceController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', controller.getStats);
router.post('/from-sale/:saleId', authorize('Admin', 'Manager'), controller.createFromSale);
router.get('/:id/print', controller.getPrintData);
router.get('/:id', controller.getById);
router.get('/', controller.getAll);
router.post('/', authorize('Admin', 'Manager'), controller.create);
router.put('/:id/status', authorize('Admin', 'Manager'), controller.updateStatus);
router.put('/:id', authorize('Admin', 'Manager'), controller.update);
router.delete('/:id', authorize('Admin', 'Manager'), controller.delete);

module.exports = router;
