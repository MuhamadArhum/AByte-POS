const { query } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const rows = await query(
      `SELECT i.*, p.product_name, p.price, c.category_name
       FROM inventory i
       JOIN products p ON i.product_id = p.product_id
       LEFT JOIN categories c ON p.category_id = c.category_id
       ORDER BY p.product_name`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { available_stock } = req.body;

    if (available_stock === undefined || available_stock < 0) {
      return res.status(400).json({ message: 'Valid stock quantity is required' });
    }

    await query('UPDATE inventory SET available_stock = ? WHERE product_id = ?', [available_stock, id]);
    await query('UPDATE products SET stock_quantity = ? WHERE product_id = ?', [available_stock, id]);
    res.json({ message: 'Stock updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getLowStock = async (req, res) => {
  try {
    const rows = await query(
      `SELECT i.*, p.product_name, p.price, c.category_name
       FROM inventory i
       JOIN products p ON i.product_id = p.product_id
       LEFT JOIN categories c ON p.category_id = c.category_id
       WHERE i.available_stock > 0 AND i.available_stock < 10
       ORDER BY i.available_stock ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
