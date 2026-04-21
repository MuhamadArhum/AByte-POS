const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', storeController.getAll);
router.post('/', authorize('Admin'), storeController.create);
router.post('/transfer', authorize('Admin', 'Manager'), storeController.transferStock);
router.get('/:id', storeController.getById);
router.put('/:id', authorize('Admin'), storeController.update);
router.delete('/:id', authorize('Admin'), storeController.deleteStore);

module.exports = router;
