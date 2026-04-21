const express = require('express');
const router = express.Router();
const controller = require('../controllers/priceRuleController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', controller.getStats);
router.post('/evaluate', controller.evaluate);
router.get('/:id', controller.getById);
router.get('/', controller.getAll);
router.post('/', authorize('Admin', 'Manager'), controller.create);
router.put('/:id', authorize('Admin', 'Manager'), controller.update);
router.delete('/:id', authorize('Admin', 'Manager'), controller.delete);

module.exports = router;
