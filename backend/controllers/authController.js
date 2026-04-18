// =============================================================
// authController.js - Simple Single-Client Authentication
// =============================================================

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { queryDb, tenantStorage } = require('../config/database');
const { logAction }              = require('../services/auditService');
const { blacklistToken }         = require('../services/tokenBlacklist');
const logger                     = require('../config/logger');

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
    logger.error('Login error', { error: err.message });
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
    logger.error('Verify error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Update Own Profile ---
// PUT /api/auth/profile
// Body: { name?, email?, current_password?, new_password? }
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { name, email, current_password, new_password } = req.body;

    const rows = await queryDb(DB_NAME, 'SELECT * FROM users WHERE user_id = ?', [userId]);
    if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
    const user = rows[0];

    const updates = [];
    const params  = [];

    if (name && name.trim()) {
      updates.push('name = ?');
      params.push(name.trim());
    }

    if (email && email.trim()) {
      const conflict = await queryDb(
        DB_NAME,
        'SELECT user_id FROM users WHERE email = ? AND user_id != ?',
        [email.trim(), userId]
      );
      if (conflict.length > 0) return res.status(400).json({ message: 'Email already in use by another account' });
      updates.push('email = ?');
      params.push(email.trim());
    }

    if (new_password) {
      if (!current_password) return res.status(400).json({ message: 'Current password is required to set a new password' });
      const isMatch = await bcrypt.compare(current_password, user.password_hash);
      if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });
      if (new_password.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters' });
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(new_password, salt);
      updates.push('password_hash = ?');
      params.push(hash);
    }

    if (updates.length === 0) return res.status(400).json({ message: 'No changes provided' });

    params.push(userId);
    await queryDb(DB_NAME, `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`, params);

    const [updated] = await queryDb(
      DB_NAME,
      'SELECT user_id, username, name, email, role_name FROM users WHERE user_id = ?',
      [userId]
    );

    try {
      tenantStorage.run(DB_NAME, async () => {
        await logAction(userId, user.username, 'PROFILE_UPDATED', 'user', userId, { name, email }, req.ip);
      });
    } catch { /* audit failure must not block update */ }

    res.json({ message: 'Profile updated successfully', user: updated });
  } catch (err) {
    logger.error('Profile update error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Logout ---
// POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      blacklistToken(token);

      try {
        tenantStorage.run(DB_NAME, async () => {
          await logAction(
            req.user.user_id, req.user.username, 'USER_LOGOUT', 'user', req.user.user_id,
            {}, req.ip
          );
        });
      } catch { /* audit failure must not block logout */ }
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    logger.error('Logout error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};
