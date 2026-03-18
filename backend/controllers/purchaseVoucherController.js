const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const pad = (n) => String(n).padStart(6, '0');

async function nextPVNumber() {
  const [last] = await query('SELECT pv_number FROM inv_purchase_vouchers ORDER BY pv_id DESC LIMIT 1');
  if (last?.pv_number) {
    const m = last.pv_number.match(/\d+$/);
    if (m) return `PV${pad(parseInt(m[0]) + 1)}`;
  }
  return `PV${pad(1)}`;
}

// GET all purchase vouchers
exports.getAll = async (req, res) => {
  try {
    const { supplier_id, from_date, to_date, po_id } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    if (supplier_id) { where += ' AND pv.supplier_id = ?';    params.push(supplier_id); }
    if (po_id)       { where += ' AND pv.po_id = ?';          params.push(po_id); }
    if (from_date)   { where += ' AND pv.voucher_date >= ?';  params.push(from_date); }
    if (to_date)     { where += ' AND pv.voucher_date <= ?';  params.push(to_date); }

    const sql = `SELECT pv.*, s.supplier_name, u.name as created_by_name,
                   po.po_number,
                   COUNT(pvi.item_id) as item_count
                 FROM inv_purchase_vouchers pv
                 LEFT JOIN suppliers s ON pv.supplier_id = s.supplier_id
                 LEFT JOIN purchase_orders po ON pv.po_id = po.po_id
                 JOIN users u ON pv.created_by = u.user_id
                 LEFT JOIN inv_purchase_voucher_items pvi ON pv.pv_id = pvi.pv_id
                 ${where} GROUP BY pv.pv_id ORDER BY pv.voucher_date DESC, pv.created_at DESC
                 LIMIT ? OFFSET ?`;
    const countSql = `SELECT COUNT(*) as total FROM inv_purchase_vouchers pv ${where}`;

    const [rows, [{total}]] = await Promise.all([
      query(sql, [...params, limit, offset]),
      query(countSql, params)
    ]);
    res.json({ data: rows, pagination: { total: Number(total), page, limit, totalPages: Math.ceil(Number(total) / limit) } });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

// GET purchase voucher by ID
exports.getById = async (req, res) => {
  try {
    const [pv] = await query(
      `SELECT pv.*, s.supplier_name, u.name as created_by_name, po.po_number
       FROM inv_purchase_vouchers pv
       LEFT JOIN suppliers s ON pv.supplier_id = s.supplier_id
       LEFT JOIN purchase_orders po ON pv.po_id = po.po_id
       JOIN users u ON pv.created_by = u.user_id
       WHERE pv.pv_id = ?`, [req.params.id]
    );
    if (!pv) return res.status(404).json({ message: 'Purchase voucher not found' });
    const items = await query(
      `SELECT pvi.*, p.product_name, p.barcode
       FROM inv_purchase_voucher_items pvi
       JOIN products p ON pvi.product_id = p.product_id
       WHERE pvi.pv_id = ?`, [req.params.id]
    );
    res.json({ ...pv, items });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

// GET PO items for receiving (pre-fill purchase voucher from PO)
exports.getPOItems = async (req, res) => {
  try {
    const { po_id } = req.params;
    const items = await query(
      `SELECT poi.*, p.product_name, p.barcode, p.cost_price,
              poi.quantity_ordered - COALESCE(poi.quantity_received, 0) as pending_qty
       FROM purchase_order_items poi
       JOIN products p ON poi.product_id = p.product_id
       WHERE poi.po_id = ?`, [po_id]
    );
    res.json({ data: items });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

// CREATE purchase voucher (receives goods, updates stock)
exports.create = async (req, res) => {
  const conn = await getConnection();
  try {
    const { po_id, supplier_id, voucher_date, notes, items } = req.body;
    if (!voucher_date || !items?.length) {
      return res.status(400).json({ message: 'voucher_date and items are required' });
    }

    await conn.beginTransaction();
    const pv_number = await nextPVNumber();
    const total = items.reduce((s, i) => s + Number(i.quantity_received) * Number(i.unit_price), 0);

    const result = await conn.query(
      'INSERT INTO inv_purchase_vouchers (pv_number, po_id, supplier_id, voucher_date, total_amount, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [pv_number, po_id || null, supplier_id || null, voucher_date, total, notes || null, req.user.user_id]
    );
    const pvId = Number(result.insertId);

    for (const item of items) {
      const newQty  = Number(item.quantity_received);
      const newCost = Number(item.unit_price);
      const totalPrice = newQty * newCost;
      await conn.query(
        'INSERT INTO inv_purchase_voucher_items (pv_id, product_id, quantity_received, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
        [pvId, item.product_id, newQty, newCost, totalPrice]
      );

      // Weighted Average cost calculation
      const [inv] = await conn.query('SELECT available_stock, avg_cost FROM inventory WHERE product_id = ?', [item.product_id]);
      const curQty = Number((inv || {}).available_stock || 0);
      const curAvg = Number((inv || {}).avg_cost || 0);
      const newAvg = (curQty + newQty) > 0
        ? (curQty * curAvg + newQty * newCost) / (curQty + newQty)
        : newCost;

      // Update inventory + avg_cost
      await conn.query('UPDATE inventory SET available_stock = available_stock + ?, avg_cost = ? WHERE product_id = ?', [newQty, newAvg, item.product_id]);
      await conn.query('UPDATE products SET stock_quantity = stock_quantity + ?, cost_price = ? WHERE product_id = ?', [newQty, newAvg, item.product_id]);

      // Add stock layer (FIFO tracking)
      await conn.query(
        'INSERT INTO stock_layers (product_id, pv_id, source_type, ref_date, qty_original, qty_remaining, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.product_id, pvId, 'purchase', voucher_date, newQty, newQty, newCost]
      );

      // If from a PO, update quantity_received on PO items
      if (po_id) {
        await conn.query(
          'UPDATE purchase_order_items SET quantity_received = COALESCE(quantity_received, 0) + ? WHERE po_id = ? AND product_id = ?',
          [item.quantity_received, po_id, item.product_id]
        );
      }
    }

    // If from PO, update PO status to 'received'
    if (po_id) {
      await conn.query("UPDATE purchase_orders SET status = 'received' WHERE po_id = ?", [po_id]);
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'PURCHASE_VOUCHER_CREATED', 'inv_purchase_vouchers', pvId, { pv_number, total }, req.ip);
    res.status(201).json({ message: 'Purchase voucher created', pv_id: pvId, pv_number });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally { conn.release(); }
};

// DELETE purchase voucher (reverse stock)
exports.remove = async (req, res) => {
  const conn = await getConnection();
  try {
    const [pv] = await query('SELECT * FROM inv_purchase_vouchers WHERE pv_id = ?', [req.params.id]);
    if (!pv) return res.status(404).json({ message: 'Not found' });
    const items = await query('SELECT * FROM inv_purchase_voucher_items WHERE pv_id = ?', [req.params.id]);

    await conn.beginTransaction();
    for (const item of items) {
      await conn.query('UPDATE inventory SET available_stock = available_stock - ? WHERE product_id = ?', [item.quantity_received, item.product_id]);
      await conn.query('UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?', [item.quantity_received, item.product_id]);
      // Remove this PV's layers and recalculate weighted avg from remaining layers
      await conn.query('DELETE FROM stock_layers WHERE pv_id = ? AND product_id = ?', [req.params.id, item.product_id]);
      const layers = await conn.query('SELECT qty_remaining, unit_cost FROM stock_layers WHERE product_id = ? AND qty_remaining > 0', [item.product_id]);
      const totalQty  = layers.reduce((s, l) => s + Number(l.qty_remaining), 0);
      const totalCost = layers.reduce((s, l) => s + Number(l.qty_remaining) * Number(l.unit_cost), 0);
      const newAvg = totalQty > 0 ? totalCost / totalQty : 0;
      await conn.query('UPDATE inventory SET avg_cost = ? WHERE product_id = ?', [newAvg, item.product_id]);
      await conn.query('UPDATE products SET cost_price = ? WHERE product_id = ?', [newAvg, item.product_id]);
    }
    await conn.query('DELETE FROM inv_purchase_vouchers WHERE pv_id = ?', [req.params.id]);
    await conn.commit();
    res.json({ message: 'Purchase voucher deleted and stock reversed' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally { conn.release(); }
};
