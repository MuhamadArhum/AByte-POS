const { query } = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { search, category, stock } = req.query;
    let sql = `SELECT p.*, c.category_name, i.available_stock
               FROM products p
               LEFT JOIN categories c ON p.category_id = c.category_id
               LEFT JOIN inventory i ON p.product_id = i.product_id
               WHERE 1=1`;
    const params = [];

    if (search) {
      sql += ' AND (p.product_name LIKE ? OR p.barcode LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      sql += ' AND p.category_id = ?';
      params.push(category);
    }
    if (stock === 'low') {
      sql += ' AND i.available_stock > 0 AND i.available_stock < 10';
    } else if (stock === 'out') {
      sql += ' AND (i.available_stock = 0 OR i.available_stock IS NULL)';
    }

    sql += ' ORDER BY p.created_at DESC';
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getById = async (req, res) => {
  try {
    const rows = await query(
      `SELECT p.*, c.category_name, i.available_stock
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.category_id
       LEFT JOIN inventory i ON p.product_id = i.product_id
       WHERE p.product_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { product_name, category_id, price, stock_quantity, barcode } = req.body;

    if (!product_name || !price) {
      return res.status(400).json({ message: 'Product name and price are required' });
    }

    const result = await query(
      'INSERT INTO products (product_name, category_id, price, stock_quantity, barcode) VALUES (?, ?, ?, ?, ?)',
      [product_name, category_id || null, price, stock_quantity || 0, barcode || null]
    );

    const productId = Number(result.insertId);
    await query(
      'INSERT INTO inventory (product_id, available_stock) VALUES (?, ?)',
      [productId, stock_quantity || 0]
    );

    res.status(201).json({ message: 'Product created', product_id: productId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Barcode already exists' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { product_name, category_id, price, stock_quantity, barcode } = req.body;

    await query(
      'UPDATE products SET product_name = ?, category_id = ?, price = ?, stock_quantity = ?, barcode = ? WHERE product_id = ?',
      [product_name, category_id || null, price, stock_quantity, barcode || null, id]
    );

    await query(
      'UPDATE inventory SET available_stock = ? WHERE product_id = ?',
      [stock_quantity, id]
    );

    res.json({ message: 'Product updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Barcode already exists' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    const sales = await query('SELECT sale_detail_id FROM sale_details WHERE product_id = ? LIMIT 1', [id]);
    if (sales.length > 0) {
      return res.status(400).json({ message: 'Cannot delete product with sales history' });
    }

    await query('DELETE FROM inventory WHERE product_id = ?', [id]);
    await query('DELETE FROM products WHERE product_id = ?', [id]);
    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const rows = await query('SELECT * FROM categories ORDER BY category_name');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { category_name } = req.body;
    if (!category_name) return res.status(400).json({ message: 'Category name is required' });

    const result = await query('INSERT INTO categories (category_name) VALUES (?)', [category_name]);
    res.status(201).json({ message: 'Category created', category_id: Number(result.insertId) });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Category already exists' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
