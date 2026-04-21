const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

exports.getAll = async (req, res) => {
  try {
    const stores = await query('SELECT s.*, u.name as manager_name FROM stores s LEFT JOIN users u ON s.manager_id = u.user_id ORDER BY s.store_name');
    res.json({ data: stores });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { store_name, store_code, address, phone, email, manager_id } = req.body;
    if (!store_name || !store_code) return res.status(400).json({ message: 'Name and code required' });

    const result = await query(
      'INSERT INTO stores (store_name, store_code, address, phone, email, manager_id) VALUES (?, ?, ?, ?, ?, ?)',
      [store_name, store_code, address || null, phone || null, email || null, manager_id || null]
    );

    await logAction(req.user.user_id, req.user.name, 'STORE_CREATED', 'store', result.insertId, { store_name }, req.ip);
    res.status(201).json({ message: 'Store created', store_id: result.insertId });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Store code already exists' });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getById = async (req, res) => {
  try {
    const [store] = await query(
      'SELECT s.*, u.name as manager_name FROM stores s LEFT JOIN users u ON s.manager_id = u.user_id WHERE s.store_id = ?',
      [req.params.id]
    );
    if (!store) return res.status(404).json({ message: 'Store not found' });
    res.json(store);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { store_name, store_code, address, phone, email, manager_id, is_active } = req.body;
    if (!store_name || !store_code) return res.status(400).json({ message: 'Name and code are required' });

    const [existing] = await query('SELECT store_id FROM stores WHERE store_id = ?', [id]);
    if (!existing) return res.status(404).json({ message: 'Store not found' });

    await query(
      'UPDATE stores SET store_name=?, store_code=?, address=?, phone=?, email=?, manager_id=?, is_active=? WHERE store_id=?',
      [store_name, store_code, address || null, phone || null, email || null, manager_id || null, is_active !== undefined ? is_active : 1, id]
    );

    await logAction(req.user.user_id, req.user.name, 'STORE_UPDATED', 'store', id, { store_name }, req.ip);
    res.json({ message: 'Store updated successfully' });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Store code already exists' });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteStore = async (req, res) => {
  try {
    const { id } = req.params;
    const [store] = await query('SELECT store_name FROM stores WHERE store_id = ?', [id]);
    if (!store) return res.status(404).json({ message: 'Store not found' });

    // Check if store has inventory
    const [inv] = await query('SELECT COUNT(*) as cnt FROM store_inventory WHERE store_id = ?', [id]);
    if (inv.cnt > 0) {
      return res.status(400).json({ message: 'Cannot delete store with inventory. Transfer stock first.' });
    }

    await query('DELETE FROM stores WHERE store_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'STORE_DELETED', 'store', id, { store_name: store.store_name }, req.ip);
    res.json({ message: 'Store deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.transferStock = async (req, res) => {
  const conn = await getConnection();
  try {
    const { from_store_id, to_store_id, product_id, quantity, notes } = req.body;
    if (!from_store_id || !to_store_id || !product_id || !quantity) return res.status(400).json({ message: 'All fields required' });

    await conn.beginTransaction();

    const [fromStock] = await conn.query('SELECT available_stock FROM store_inventory WHERE store_id = ? AND product_id = ? FOR UPDATE', [from_store_id, product_id]);
    if (!fromStock || fromStock.available_stock < quantity) {
      await conn.rollback();
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    await conn.query('UPDATE store_inventory SET available_stock = available_stock - ? WHERE store_id = ? AND product_id = ?', [quantity, from_store_id, product_id]);
    await conn.query('INSERT INTO store_inventory (store_id, product_id, available_stock) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE available_stock = available_stock + ?', [to_store_id, product_id, quantity, quantity]);
    await conn.query('INSERT INTO stock_transfers (from_store_id, to_store_id, product_id, quantity, status, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [from_store_id, to_store_id, product_id, quantity, 'completed', notes || null, req.user.user_id]);

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'STOCK_TRANSFERRED', 'stock_transfer', product_id, { from_store_id, to_store_id, quantity }, req.ip);
    res.json({ message: 'Stock transferred' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};
