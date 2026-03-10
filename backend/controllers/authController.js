// =============================================================
// authController.js - Simple Single-Client Authentication
// =============================================================

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { queryDb, tenantStorage } = require('../config/database');
const { logAction }              = require('../services/auditService');

const DB_NAME = process.env.DB_NAME || 'abyte_pos';

// --- Login ---
// POST /api/auth/login
// Body: { email, password }
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user in the single app database
    const rows = await queryDb(DB_NAME, 'SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user    = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, role_name: user.role_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Fetch role permissions (null = Admin full access)
    let permissions = null;
    if (user.role_name !== 'Admin') {
      const permRows = await queryDb(
        DB_NAME,
        'SELECT module_key FROM role_permissions WHERE role_name = ? AND is_allowed = 1',
        [user.role_name]
      );
      permissions = permRows.map(r => r.module_key);
    }

    // Audit log
    try {
      tenantStorage.run(DB_NAME, async () => {
        await logAction(
          user.user_id, user.username, 'USER_LOGIN', 'user', user.user_id,
          { email }, req.ip
        );
      });
    } catch { /* audit failure must not block login */ }

    res.json({
      token,
      user: {
        user_id:   user.user_id,
        username:  user.username,
        name:      user.name,
        email:     user.email,
        role_name: user.role_name,
      },
      permissions,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Verify Token ---
// GET /api/auth/verify
exports.verify = async (req, res) => {
  try {
    const { query } = require('../config/database');
    let permissions = null;
    if (req.user.role_name !== 'Admin') {
      const permRows = await query(
        'SELECT module_key FROM role_permissions WHERE role_name = ? AND is_allowed = 1',
        [req.user.role_name]
      );
      permissions = permRows.map(r => r.module_key);
    }

    res.json({
      user: {
        user_id:   req.user.user_id,
        username:  req.user.username,
        name:      req.user.name,
        email:     req.user.email,
        role_name: req.user.role_name,
      },
      permissions,
    });
  } catch (err) {
    console.error('Verify error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
