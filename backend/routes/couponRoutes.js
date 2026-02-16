const express = require('express');
const router = express.Router();
const couponController = require('../controllers/couponController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', couponController.getStats);
router.post('/validate', couponController.validate);
router.get('/', couponController.getAll);
router.get('/:id', couponController.getById);
router.post('/', authorize('Admin', 'Manager'), couponController.create);
router.put('/:id', authorize('Admin', 'Manager'), couponController.update);
router.delete('/:id', authorize('Admin', 'Manager'), couponController.delete);

module.exports = router;
