const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const rows = await query(
      'SELECT u.user_id, u.name, u.email, r.role_name, u.created_at FROM users u JOIN roles r ON u.role_id = r.role_id ORDER BY u.created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, email, password, role_id } = req.body;

    if (!name || !email || !password || !role_id) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const existing = await query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await query(
      'INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)',
      [name, email, password_hash, role_id]
    );

    res.status(201).json({ message: 'User created', user_id: Number(result.insertId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role_id } = req.body;

    const existing = await query('SELECT user_id FROM users WHERE user_id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    let updateQuery = 'UPDATE users SET name = ?, email = ?, role_id = ?';
    let params = [name, email, role_id];

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
      }
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(password, salt);
      updateQuery += ', password_hash = ?';
      params.push(password_hash);
    }

    updateQuery += ' WHERE user_id = ?';
    params.push(id);

    await query(updateQuery, params);
    res.json({ message: 'User updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    const sales = await query('SELECT sale_id FROM sales WHERE user_id = ? LIMIT 1', [id]);
    if (sales.length > 0) {
      return res.status(400).json({ message: 'Cannot delete user with sales history' });
    }

    await query('DELETE FROM users WHERE user_id = ?', [id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getRoles = async (req, res) => {
  try {
    const rows = await query('SELECT * FROM roles');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
