const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.post('/', salesController.createSale);
router.get('/today', salesController.getToday);
router.get('/', salesController.getAll);
router.get('/:id', salesController.getById);

module.exports = router;
