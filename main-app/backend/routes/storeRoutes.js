const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

router.get('/', storeController.getAll);
router.post('/', requirePermission('system.stores'), storeController.create);
router.post('/transfer', requirePermission('system.stores'), storeController.transferStock);
router.get('/:id', storeController.getById);
router.put('/:id', requirePermission('system.stores'), storeController.update);
router.delete('/:id', requirePermission('system.stores'), storeController.deleteStore);

module.exports = router;
