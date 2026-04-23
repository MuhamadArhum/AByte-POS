const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/deliveryController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', ctrl.getStats);
router.get('/',      ctrl.getAll);
router.get('/:id',   ctrl.getById);
router.post('/',            requirePermission('sales'), ctrl.create);
router.put('/:id',          requirePermission('sales'), ctrl.update);
router.patch('/:id/status', requirePermission('sales'), ctrl.updateStatus);
router.delete('/:id',       requirePermission('sales'), ctrl.remove);

module.exports = router;
