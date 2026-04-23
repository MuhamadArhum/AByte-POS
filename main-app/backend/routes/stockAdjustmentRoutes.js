const express = require('express');
const router = express.Router();
const controller = require('../controllers/stockAdjustmentController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

router.get('/types', controller.getAdjustmentTypes);
router.get('/stats', controller.getStats);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', requirePermission('inventory.adjustments'), controller.create);

module.exports = router;
