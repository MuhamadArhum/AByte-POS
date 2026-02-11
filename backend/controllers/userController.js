// =============================================================
// userController.js - User Management Controller
// Handles CRUD operations for system users (Admin, Manager, Cashier).
// Only Admin users can access these endpoints.
// Used by: /api/users routes
// =============================================================

const bcrypt = require('bcryptjs');          // Library to hash passwords before storing
const { query } = require('../config/database');  // Database query helper
const { logAction } = require('../services/auditService');

// --- Get All Users ---
// Returns a list of all users with their roles, ordered by newest first.
// Used on the User Management page to display the users table.
exports.getAll = async (req, res) => {
  try {
    const rows = await query(
      'SELECT u.user_id, u.name, u.email, u.role_id, r.role_name as role, u.created_at FROM users u JOIN roles r ON u.role_id = r.role_id ORDER BY u.created_at DESC'
    );
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Create New User ---
// Creates a new user account with a hashed password.
// Only Admin can create users (enforced by route middleware).
// Validates: all fields required, password min 8 chars, email must be unique.
exports.create = async (req, res) => {
  try {
    const { name, email, password, role_id } = req.body;

    // Validate all required fields are present
    if (!name || !email || !password || !role_id) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Enforce minimum password length
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    // Check if the email is already taken by another user
    const existing = await query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Look up role_name for the denormalized column
    const roleRow = await query('SELECT role_name FROM roles WHERE role_id = ?', [role_id]);
    const role_name = roleRow.length > 0 ? roleRow[0].role_name : 'Cashier';

    const result = await query(
      'INSERT INTO users (name, email, password_hash, role_id, role_name) VALUES (?, ?, ?, ?, ?)',
      [name, email, password_hash, role_id, role_name]
    );

    const newUserId = Number(result.insertId);
    await logAction(req.user.user_id, req.user.name, 'USER_CREATED', 'user', newUserId, { name, email, role_id }, req.ip);

    // Return success with the new user's ID
    res.status(201).json({ message: 'User created', user_id: newUserId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Update Existing User ---
// Updates user details (name, email, role). Password is optional.
// If password is provided, it gets hashed before saving.
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role_id } = req.body;

    const existing = await query('SELECT user_id FROM users WHERE user_id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Build update dynamically - only update provided fields
    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (role_id !== undefined) {
      updates.push('role_id = ?');
      params.push(role_id);
      // Also update the denormalized role_name
      const roleRow = await query('SELECT role_name FROM roles WHERE role_id = ?', [role_id]);
      if (roleRow.length > 0) {
        updates.push('role_name = ?');
        params.push(roleRow[0].role_name);
      }
    }

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
      }
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      updates.push('password_hash = ?');
      params.push(password_hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    params.push(id);
    await query(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`, params);

    await logAction(req.user.user_id, req.user.name, 'USER_UPDATED', 'user', parseInt(id), { name, email }, req.ip);

    res.json({ message: 'User updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Delete User ---
// Deletes a user from the system.
// SAFETY CHECK: Cannot delete a user who has processed sales (to preserve sale history).
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if this user has any sales records
    // LIMIT 1 for efficiency - we only need to know if at least one exists
    const sales = await query('SELECT sale_id FROM sales WHERE user_id = ? LIMIT 1', [id]);
    if (sales.length > 0) {
      return res.status(400).json({ message: 'Cannot delete user with sales history' });
    }

    // Safe to delete - no sales history
    await query('DELETE FROM users WHERE user_id = ?', [id]);

    await logAction(req.user.user_id, req.user.name, 'USER_DELETED', 'user', parseInt(id), {}, req.ip);

    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Get All Roles ---
// Returns the list of available roles (Admin, Manager, Cashier).
// Used in the user creation form to populate the role dropdown.
exports.getRoles = async (req, res) => {
  try {
    const rows = await query('SELECT * FROM roles');
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
