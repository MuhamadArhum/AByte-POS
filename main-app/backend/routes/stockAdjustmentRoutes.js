const express = require('express');
const router = express.Router();
const controller = require('../controllers/stockAdjustmentController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/types', controller.getAdjustmentTypes);
router.get('/stats', controller.getStats);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', authorize('Admin', 'Manager'), controller.create);

module.exports = router;
