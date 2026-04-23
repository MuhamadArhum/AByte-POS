const express = require('express');
const router = express.Router();
const returnController = require('../controllers/returnController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

router.get('/sale/:saleId', returnController.getSaleForReturn);
router.post('/', requirePermission('sales.returns'), returnController.createReturn);
router.get('/', returnController.getReturns);
router.get('/:id', returnController.getReturnById);

module.exports = router;
