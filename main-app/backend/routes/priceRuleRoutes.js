const express = require('express');
const router = express.Router();
const controller = require('../controllers/priceRuleController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', controller.getStats);
router.post('/evaluate', controller.evaluate);
router.get('/:id', controller.getById);
router.get('/', controller.getAll);
router.post('/', requirePermission('inventory.products'), controller.create);
router.put('/:id', requirePermission('inventory.products'), controller.update);
router.delete('/:id', requirePermission('inventory.products'), controller.delete);

module.exports = router;
