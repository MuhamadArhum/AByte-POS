const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', expenseController.getAll);
router.get('/categories', expenseController.getCategories);
router.get('/summary', expenseController.getSummary);
router.post('/', authorize('Admin', 'Manager'), expenseController.create);
router.put('/:id', authorize('Admin', 'Manager'), expenseController.update);
router.delete('/:id', authorize('Admin'), expenseController.delete);

module.exports = router;
