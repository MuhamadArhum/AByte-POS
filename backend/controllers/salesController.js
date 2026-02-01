const { getConnection, query } = require('../config/database');

exports.createSale = async (req, res) => {
  let conn;
  try {
    const { items, discount, customer_id } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    conn = await getConnection();
    await conn.beginTransaction();

    // Validate stock
    for (const item of items) {
      const rows = await conn.query(
        'SELECT available_stock FROM inventory WHERE product_id = ? FOR UPDATE',
        [item.product_id]
      );
      if (rows.length === 0 || rows[0].available_stock < item.quantity) {
        await conn.rollback();
        return res.status(400).json({
          message: `Insufficient stock for product ID ${item.product_id}`,
        });
      }
    }

    const total_amount = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const discountAmt = discount || 0;
    const net_amount = total_amount - discountAmt;

    if (discountAmt > total_amount) {
      await conn.rollback();
      return res.status(400).json({ message: 'Discount cannot exceed total amount' });
    }

    const saleResult = await conn.query(
      'INSERT INTO sales (total_amount, discount, net_amount, user_id, customer_id) VALUES (?, ?, ?, ?, ?)',
      [total_amount, discountAmt, net_amount, req.user.user_id, customer_id || 1]
    );

    const sale_id = Number(saleResult.insertId);

    for (const item of items) {
      await conn.query(
        'INSERT INTO sale_details (sale_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
        [sale_id, item.product_id, item.quantity, item.unit_price, item.unit_price * item.quantity]
      );

      await conn.query(
        'UPDATE inventory SET available_stock = available_stock - ? WHERE product_id = ?',
        [item.quantity, item.product_id]
      );
      await conn.query(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?',
        [item.quantity, item.product_id]
      );
    }

    await conn.commit();

    // Fetch the created sale with details
    const sale = await query(
      `SELECT s.*, c.customer_name, u.name as cashier_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.customer_id
       LEFT JOIN users u ON s.user_id = u.user_id
       WHERE s.sale_id = ?`,
      [sale_id]
    );

    const details = await query(
      `SELECT sd.*, p.product_name
       FROM sale_details sd
       JOIN products p ON sd.product_id = p.product_id
       WHERE sd.sale_id = ?`,
      [sale_id]
    );

    res.status(201).json({
      message: 'Sale completed',
      sale: { ...sale[0], items: details },
    });
  } catch (err) {
    if (conn) await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getAll = async (req, res) => {
  try {
    const rows = await query(
      `SELECT s.*, c.customer_name, u.name as cashier_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.customer_id
       LEFT JOIN users u ON s.user_id = u.user_id
       ORDER BY s.sale_date DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getById = async (req, res) => {
  try {
    const sale = await query(
      `SELECT s.*, c.customer_name, u.name as cashier_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.customer_id
       LEFT JOIN users u ON s.user_id = u.user_id
       WHERE s.sale_id = ?`,
      [req.params.id]
    );

    if (sale.length === 0) return res.status(404).json({ message: 'Sale not found' });

    const details = await query(
      `SELECT sd.*, p.product_name
       FROM sale_details sd
       JOIN products p ON sd.product_id = p.product_id
       WHERE sd.sale_id = ?`,
      [req.params.id]
    );

    res.json({ ...sale[0], items: details });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getToday = async (req, res) => {
  try {
    const rows = await query(
      `SELECT s.*, c.customer_name, u.name as cashier_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.customer_id
       LEFT JOIN users u ON s.user_id = u.user_id
       WHERE DATE(s.sale_date) = CURDATE()
       ORDER BY s.sale_date DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
