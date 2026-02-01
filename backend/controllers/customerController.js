const { query } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM customers';
    const params = [];

    if (search) {
      sql += ' WHERE customer_name LIKE ? OR phone_number LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY customer_name';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { customer_name, phone_number } = req.body;
    if (!customer_name) return res.status(400).json({ message: 'Customer name is required' });

    const result = await query(
      'INSERT INTO customers (customer_name, phone_number) VALUES (?, ?)',
      [customer_name, phone_number || null]
    );

    res.status(201).json({ message: 'Customer created', customer_id: Number(result.insertId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getById = async (req, res) => {
  try {
    const rows = await query('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Customer not found' });

    const purchases = await query(
      `SELECT s.sale_id, s.sale_date, s.net_amount, u.name as cashier_name
       FROM sales s LEFT JOIN users u ON s.user_id = u.user_id
       WHERE s.customer_id = ? ORDER BY s.sale_date DESC`,
      [req.params.id]
    );

    res.json({ ...rows[0], purchases });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
