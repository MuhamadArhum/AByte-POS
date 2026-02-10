const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const parsePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  return { page: Math.max(1, pageNum), limit: Math.max(1, limitNum), offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum) };
};

exports.getAll = async (req, res) => {
  try {
    const { status, supplier_id } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = 'SELECT po.*, s.supplier_name FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.supplier_id WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM purchase_orders WHERE 1=1';
    const params = [], countParams = [];

    if (status) {
      sql += ' AND po.status = ?';
      countSql += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (supplier_id) {
      sql += ' AND po.supplier_id = ?';
      countSql += ' AND supplier_id = ?';
      params.push(supplier_id);
      countParams.push(supplier_id);
    }

    sql += ' ORDER BY po.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [orders, [{total}]] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    res.json({ data: orders, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getById = async (req, res) => {
  try {
    const [po] = await query(
      'SELECT po.*, s.supplier_name, u.name as created_by_name FROM purchase_orders po JOIN suppliers s ON po.supplier_id = s.supplier_id LEFT JOIN users u ON po.created_by = u.user_id WHERE po.po_id = ?',
      [req.params.id]
    );
    if (!po) return res.status(404).json({ message: 'PO not found' });

    const items = await query(
      'SELECT poi.*, p.product_name FROM purchase_order_items poi JOIN products p ON poi.product_id = p.product_id WHERE poi.po_id = ?',
      [req.params.id]
    );

    res.json({ ...po, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  const conn = await getConnection();
  try {
    const { supplier_id, order_date, expected_date, notes, items } = req.body;
    if (!supplier_id || !order_date || !items || items.length === 0) return res.status(400).json({ message: 'Required fields missing' });

    await conn.beginTransaction();

    const total = items.reduce((sum, item) => sum + (item.quantity_ordered * item.unit_cost), 0);
    const po_number = `PO-${Date.now()}`;

    const poResult = await conn.query(
      'INSERT INTO purchase_orders (po_number, supplier_id, order_date, expected_date, total_amount, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [po_number, supplier_id, order_date, expected_date || null, total, notes || null, req.user.user_id]
    );

    for (const item of items) {
      await conn.query(
        'INSERT INTO purchase_order_items (po_id, product_id, quantity_ordered, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?)',
        [poResult.insertId, item.product_id, item.quantity_ordered, item.unit_cost, item.quantity_ordered * item.unit_cost]
      );
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'PO_CREATED', 'purchase_order', poResult.insertId, { po_number, supplier_id }, req.ip);
    res.status(201).json({ message: 'PO created', po_id: poResult.insertId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.receive = async (req, res) => {
  const conn = await getConnection();
  try {
    const { id } = req.params;
    const { items } = req.body;

    await conn.beginTransaction();

    await conn.query('UPDATE purchase_orders SET status = ?, received_date = CURRENT_DATE WHERE po_id = ?', ['received', id]);

    for (const item of items) {
      await conn.query('UPDATE purchase_order_items SET quantity_received = ? WHERE po_item_id = ?', [item.quantity_received, item.po_item_id]);
      await conn.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?', [item.quantity_received, item.product_id]);
      await conn.query('UPDATE inventory SET available_stock = available_stock + ? WHERE product_id = ?', [item.quantity_received, item.product_id]);
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'PO_RECEIVED', 'purchase_order', id, {}, req.ip);
    res.json({ message: 'PO received successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.getStockAlerts = async (req, res) => {
  try {
    const alerts = await query(`
      SELECT sa.*, p.product_name FROM stock_alerts sa
      JOIN products p ON sa.product_id = p.product_id
      WHERE sa.is_active = 1
      ORDER BY sa.created_at DESC
      LIMIT 100
    `);
    res.json({ data: alerts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
