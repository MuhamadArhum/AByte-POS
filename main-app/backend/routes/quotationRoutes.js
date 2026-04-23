const express = require('express');
const router = express.Router();
const controller = require('../controllers/quotationController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', controller.getStats);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', requirePermission('sales.quotations'), controller.create);
router.put('/:id', requirePermission('sales.quotations'), controller.update);
router.put('/:id/status', requirePermission('sales.quotations'), controller.updateStatus);
router.post('/:id/convert', requirePermission('sales.quotations'), controller.convertToSale);
router.delete('/:id', requirePermission('sales.quotations'), controller.delete);

module.exports = router;
