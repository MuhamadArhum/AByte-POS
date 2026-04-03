// =============================================================
// auth.js - Simple Authentication & Authorization Middleware
// =============================================================

const jwt = require('jsonwebtoken');
const { queryDb, tenantStorage } = require('../config/database');
const { isBlacklisted } = require('../services/tokenBlacklist');

const DB_NAME = process.env.DB_NAME || 'abyte_pos';

// --- authenticate ---
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    // Reject revoked tokens (logged-out sessions)
    if (isBlacklisted(token)) {
      return res.status(401).json({ message: 'Token has been revoked. Please login again.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const rows = await queryDb(
      DB_NAME,
      'SELECT user_id, username, name, email, role_name FROM users WHERE user_id = ?',
      [decoded.user_id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user     = rows[0];
    req.tenantDb = DB_NAME;

    // Run inside tenant storage context so query() works in all controllers
    tenantStorage.run(DB_NAME, next);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// --- authorize ---
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role_name)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
