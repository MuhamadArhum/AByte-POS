const express = require('express');
const router = express.Router();
const registerController = require('../controllers/registerController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/current', registerController.getCurrentRegister);
router.post('/open', registerController.openRegister);
router.post('/close', authorize('Admin', 'Manager'), registerController.closeRegister);
router.post('/cash-movement', registerController.addCashMovement);
router.get('/history', authorize('Admin', 'Manager'), registerController.getHistory);
router.get('/:id', authorize('Admin', 'Manager'), registerController.getById);

module.exports = router;
