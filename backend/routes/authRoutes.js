// =============================================================
// authRoutes.js - Authentication Routes
// Defines the API endpoints for login and token verification.
// Mounted at: /api/auth (see server.js)
//
// Endpoints:
//   POST /api/auth/login   - Login with email and password (public, no auth needed)
//   GET  /api/auth/verify  - Check if the current token is valid (requires auth)
// =============================================================

const express = require('express');
const router = express.Router();  // Create a new router instance
const authController = require('../controllers/authController');  // Controller with the actual logic
const { authenticate } = require('../middleware/auth');            // JWT verification middleware

// POST /api/auth/login - No middleware needed (public endpoint)
router.post('/login', authController.login);

// GET /api/auth/verify - Requires valid JWT token (authenticate middleware checks it)
router.get('/verify', authenticate, authController.verify);

module.exports = router;
