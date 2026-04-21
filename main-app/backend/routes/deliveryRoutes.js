const express    = require('express');
const router     = express.Router();
const ctrl       = require('../controllers/deliveryController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats',        ctrl.getStats);
router.get('/',             ctrl.getAll);
router.get('/:id',          ctrl.getById);
router.post('/',            authorize('Admin', 'Manager', 'Cashier'), ctrl.create);
router.put('/:id',          authorize('Admin', 'Manager'), ctrl.update);
router.patch('/:id/status', authorize('Admin', 'Manager', 'Cashier'), ctrl.updateStatus);
router.delete('/:id',       authorize('Admin', 'Manager'), ctrl.remove);

module.exports = router;
