const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { verifyToken } = require('../middleware/auth'); // Assuming auth middleware exists

// Protect AI route if needed, or leave public for dev
// router.post('/chat', verifyToken, aiController.chat);
router.post('/chat', aiController.chat);

module.exports = router;
