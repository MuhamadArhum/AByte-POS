const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/restaurantController');

router.use(authenticate);

router.get('/', ctrl.getTables);
router.post('/', ctrl.createTable);
router.put('/:id', ctrl.updateTable);
router.delete('/:id', ctrl.deleteTable);

module.exports = router;
