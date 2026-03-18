const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/purchaseReturnController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/',         ctrl.getAll);
router.get('/:id',      ctrl.getById);
router.post('/',        authorize('Admin', 'Manager'), ctrl.create);
router.delete('/:id',   authorize('Admin'), ctrl.remove);

module.exports = router;
