// =============================================================
// auth.js - Authentication & Authorization Middleware
// This file provides two middleware functions:
// 1. authenticate - Verifies the JWT token on protected routes
// 2. authorize    - Checks if the user's role has permission
// These are applied to routes to protect them from unauthorized access.
// =============================================================

const jwt = require('jsonwebtoken');
const { queryDb, tenantStorage } = require('../config/database');

// --- authenticate Middleware ---
// Multi-tenant aware: reads tenant_db from JWT, routes request to correct DB.
// Flow: Verify JWT → get tenant_db → fetch user from tenant DB
//       → set tenantStorage → all subsequent queries use correct DB
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get tenant DB from JWT (set during login).
    // Falls back to default DB for backward compatibility with old tokens.
    const tenantDb = decoded.tenant_db || process.env.DB_NAME || 'abyte_pos';

    // Fetch user from the correct tenant's database
    const rows = await queryDb(
      tenantDb,
      'SELECT u.user_id, u.username, u.name, u.email, u.role_name FROM users u WHERE u.user_id = ?',
      [decoded.user_id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = rows[0];
    req.tenantDb = tenantDb;

    // CRITICAL: Run the rest of this request inside the tenant's DB context.
    // All query() and getConnection() calls in controllers will automatically
    // use this tenant's database without any code changes.
    tenantStorage.run(tenantDb, next);
  } catch (err) {
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
