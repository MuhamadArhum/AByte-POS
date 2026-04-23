const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sectionsController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', requirePermission('inventory.stock'), ctrl.create);
router.put('/:id', requirePermission('inventory.stock'), ctrl.update);
router.delete('/:id', requirePermission('inventory.stock'), ctrl.remove);

module.exports = router;
