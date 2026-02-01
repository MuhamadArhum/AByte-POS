const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', customerController.getAll);
router.post('/', customerController.create);
router.get('/:id', customerController.getById);

module.exports = router;
