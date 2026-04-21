const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { query } = require('../config/database');
const logger    = require('../config/logger');

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const rows = await query(
      'SELECT * FROM super_admins WHERE email = ? AND is_active = 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const admin = rows[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { admin_id: admin.admin_id, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
    );

    res.json({
      token,
      admin: {
        admin_id: admin.admin_id,
        name:     admin.name,
        email:    admin.email,
      },
    });
  } catch (err) {
    logger.error('Admin login error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  res.json({ admin: req.admin });
};

// POST /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const hash = await bcrypt.hash(new_password, 10);
    await query('UPDATE super_admins SET password_hash = ? WHERE admin_id = ?', [hash, req.admin.admin_id]);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    logger.error('Change password error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};
