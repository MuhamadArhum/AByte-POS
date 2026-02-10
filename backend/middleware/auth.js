// =============================================================
// auth.js - Authentication & Authorization Middleware
// This file provides two middleware functions:
// 1. authenticate - Verifies the JWT token on protected routes
// 2. authorize    - Checks if the user's role has permission
// These are applied to routes to protect them from unauthorized access.
// =============================================================

const jwt = require('jsonwebtoken');         // Library to verify JSON Web Tokens
const { query } = require('../config/database');  // Database query helper

// --- authenticate Middleware ---
// Runs on every protected route to verify the user is logged in.
// Flow: Extract token from header -> Verify token -> Fetch user from DB -> Attach to req.user
// If any step fails, returns 401 Unauthorized.
const authenticate = async (req, res, next) => {
  try {
    // Step 1: Get the Authorization header (format: "Bearer <token>")
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Step 2: Extract the token part (everything after "Bearer ")
    const token = authHeader.split(' ')[1];

    // Step 3: Verify the token using the secret key from .env
    // jwt.verify() throws an error if the token is invalid or expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Step 4: Fetch the full user data from the database using the user_id stored in the token
    // Get username and role_name directly from users table (added via migration)
    const rows = await query(
      'SELECT u.user_id, u.username, u.name, u.email, u.role_name FROM users u WHERE u.user_id = ?',
      [decoded.user_id]
    );

    // Step 5: Check if the user still exists in the database
    if (rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Step 6: Attach user data to the request object
    // All subsequent middleware and route handlers can access req.user
    req.user = rows[0];
    next();  // Continue to the next middleware or route handler
  } catch (err) {
    // Handle specific JWT errors
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// --- authorize Middleware ---
// Checks if the authenticated user's role is in the allowed roles list.
// Must be used AFTER authenticate middleware (needs req.user to be set).
// Usage: authorize('Admin', 'Manager') -> only Admin and Manager can access
// Returns 403 Forbidden if the user's role is not allowed.
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role_name)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();  // Role is allowed, continue to the route handler
  };
};

module.exports = { authenticate, authorize };
