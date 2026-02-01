const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/categories', productController.getCategories);
router.post('/categories', authorize('Admin', 'Manager'), productController.createCategory);
router.get('/', productController.getAll);
router.get('/:id', productController.getById);
router.post('/', authorize('Admin', 'Manager'), productController.create);
router.put('/:id', authorize('Admin', 'Manager'), productController.update);
router.delete('/:id', authorize('Admin', 'Manager'), productController.remove);

module.exports = router;
