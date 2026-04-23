const express = require('express');
const router  = express.Router();
const { authenticate }      = require('../middleware/auth');
const settingsController    = require('../controllers/settingsController');

router.use(authenticate);
router.get('/prices', settingsController.getPrices);
router.put('/prices', settingsController.updatePrices);

module.exports = router;
