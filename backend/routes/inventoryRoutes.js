const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/low-stock', inventoryController.getLowStock);
router.get('/', inventoryController.getAll);
router.put('/:id', authorize('Admin', 'Manager'), inventoryController.updateStock);

module.exports = router;
