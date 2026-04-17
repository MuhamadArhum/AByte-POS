const express = require('express');
const router  = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// NOTE: named routes must come before /:id to avoid param collision
router.get('/low-stock', inventoryController.getLowStock);   // all roles
router.get('/stats',     inventoryController.getStats);      // all roles
router.get('/',          inventoryController.getAll);        // all roles — supports ?search, ?category_id, ?product_type, ?stock_status
router.put('/:id', authorize('Admin', 'Manager'), inventoryController.updateStock);

module.exports = router;
