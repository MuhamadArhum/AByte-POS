const express = require('express');
const router = express.Router();
const returnController = require('../controllers/returnController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/sale/:saleId', returnController.getSaleForReturn);
router.post('/', authorize('Admin', 'Manager'), returnController.createReturn);
router.get('/', returnController.getReturns);
router.get('/:id', returnController.getReturnById);

module.exports = router;
