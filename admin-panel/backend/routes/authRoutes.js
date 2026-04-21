const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const authController  = require('../controllers/authController');

router.post('/login',           authController.login);
router.get('/me',               authenticate, authController.me);
router.post('/change-password', authenticate, authController.changePassword);

module.exports = router;
