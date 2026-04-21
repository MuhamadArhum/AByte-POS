const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/openingStockController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('Admin', 'Manager'));

router.get('/',        ctrl.getAll);
router.post('/',       ctrl.save);
router.get('/history', ctrl.getHistory);

module.exports = router;
