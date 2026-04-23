const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

router.get('/', supplierController.getAll);
router.get('/:id', supplierController.getById);
router.post('/', requirePermission('inventory.suppliers'), supplierController.create);
router.put('/:id', requirePermission('inventory.suppliers'), supplierController.update);
router.delete('/:id', requirePermission('inventory.suppliers'), supplierController.delete);

router.post('/:supplier_id/payments', requirePermission('inventory.suppliers'), supplierController.addPayment);
router.get('/:supplier_id/payments', supplierController.getPayments);

module.exports = router;
