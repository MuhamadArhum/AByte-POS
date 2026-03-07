// =============================================================
// authController.js - Authentication Controller
// Handles user login and token verification.
// Used by: POST /api/auth/login and GET /api/auth/verify
// =============================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queryDb } = require('../config/database');
const { masterQuery } = require('../config/masterDatabase');
const { logAction } = require('../services/auditService');

// --- Login Handler ---
// Called when user submits email and password on the login page.
// Steps: Validate input -> Find user by email -> Compare password -> Generate JWT token
// Returns: { token, user: { user_id, name, email, role } }
exports.login = async (req, res) => {
  try {
    const { email, password, tenant_code } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Step 1: Resolve tenant DB
    // If tenant_code provided → look up in master DB
    // If not provided → use default DB (backward compatibility)
    let tenantDb = process.env.DB_NAME || 'abyte_pos';
    let tenantName = 'Default';

    if (tenant_code) {
      let tenants;
      try {
        tenants = await masterQuery(
          'SELECT db_name, tenant_name FROM tenants WHERE tenant_code = ? AND is_active = 1',
          [tenant_code]
        );
      } catch (masterErr) {
        // Master DB not set up yet — fall back to default
        tenants = [];
      }

      if (tenants.length === 0) {
        return res.status(404).json({ message: 'Company code not found or inactive' });
      }
      tenantDb = tenants[0].db_name;
      tenantName = tenants[0].tenant_name;
    }

    // Step 2: Find user in tenant's database
    const rows = await queryDb(tenantDb, 'SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Step 3: Generate JWT — includes tenant_db so auth middleware
    // knows which database to use on every subsequent request
    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, role_name: user.role_name, tenant_db: tenantDb },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    await logAction(user.user_id, user.username, 'USER_LOGIN', 'user', user.user_id, { email, tenant_db: tenantDb }, req.ip);

    // Step 4: Fetch permissions from tenant DB
    let permissions = null;
    if (user.role_name !== 'Admin') {
      const permRows = await queryDb(
        tenantDb,
        'SELECT module_key FROM role_permissions WHERE role_name = ? AND is_allowed = 1',
        [user.role_name]
      );
      permissions = permRows.map(r => r.module_key);
    }

    res.json({
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        name: user.name,
        email: user.email,
        role_name: user.role_name,
        tenant_db: tenantDb,
        tenant_name: tenantName,
      },
      permissions,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Verify Token Handler ---
// Called when the frontend app loads to check if the stored token is still valid.
// The authenticate middleware (auth.js) has already verified the token and set req.user.
// This just returns the user data back to the frontend.
exports.verify = async (req, res) => {
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
      user_id: req.user.user_id,
      username: req.user.username,
      name: req.user.name,
      email: req.user.email,
      role_name: req.user.role_name,
    },
    permissions,
  });
};
