const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const parsePagination = (page, limit) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(Math.max(1, parseInt(limit) || 20), 100);
  return { page: p, limit: l, offset: (p - 1) * l };
};

const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// GET /api/invoices
exports.getAll = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);
    const { status, customer_id, search } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (status) { where += ' AND i.status = ?'; params.push(status); }
    if (customer_id) { where += ' AND i.customer_id = ?'; params.push(customer_id); }
    if (search) {
      where += ' AND (i.invoice_number LIKE ? OR c.customer_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.customer_id ${where}`, params
    );

    const rows = await query(
      `SELECT i.*, c.customer_name, c.phone_number AS customer_phone, u.name AS created_by_name
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.customer_id
       LEFT JOIN users u ON i.created_by = u.user_id
       ${where}
       ORDER BY i.created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      pagination: { total: countResult.total, page, limit, totalPages: Math.ceil(countResult.total / limit) }
    });
  } catch (err) {
    console.error('Get invoices error:', err);
    res.status(500).json({ message: 'Failed to fetch invoices' });
  }
};

// GET /api/invoices/stats
exports.getStats = async (req, res) => {
  try {
    const [stats] = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('sent', 'partial') THEN total_amount ELSE 0 END), 0) AS outstanding,
         COUNT(CASE WHEN status = 'overdue' OR (due_date < CURDATE() AND status IN ('sent', 'partial')) THEN 1 END) AS overdue_count,
         COUNT(CASE WHEN status = 'draft' THEN 1 END) AS draft_count,
         COUNT(*) AS total_invoices
       FROM invoices`
    );

    const [paid] = await query(
      `SELECT COALESCE(SUM(total_amount), 0) AS paid_this_month
       FROM invoices
       WHERE status = 'paid' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())`
    );

    res.json({ ...stats, paid_this_month: paid.paid_this_month });
  } catch (err) {
    console.error('Get invoice stats error:', err);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
};

// GET /api/invoices/:id
exports.getById = async (req, res) => {
  try {
    const invoices = await query(
      `SELECT i.*, c.customer_name, c.phone_number AS customer_phone, c.email AS customer_email,
              u.name AS created_by_name
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.customer_id
       LEFT JOIN users u ON i.created_by = u.user_id
       WHERE i.invoice_id = ?`,
      [req.params.id]
    );

    if (invoices.length === 0) return res.status(404).json({ message: 'Invoice not found' });

    const items = await query(
      `SELECT ii.*, p.product_name, p.barcode
       FROM invoice_items ii
       LEFT JOIN products p ON ii.product_id = p.product_id
       WHERE ii.invoice_id = ?`,
      [req.params.id]
    );

    res.json({ ...invoices[0], items });
  } catch (err) {
    console.error('Get invoice error:', err);
    res.status(500).json({ message: 'Failed to fetch invoice' });
  }
};

// POST /api/invoices
exports.create = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const { customer_id, items, discount, tax_amount, due_date, payment_terms, notes } = req.body;

    if (!customer_id || !items || items.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Customer and at least one item are required' });
    }

    const invoice_number = `INV-${Date.now()}`;
    const subtotal = round2(items.reduce((sum, item) => sum + round2(item.unit_price * item.quantity), 0));
    const discountAmt = round2(discount || 0);
    const taxAmt = round2(tax_amount || 0);
    const total = round2(subtotal + taxAmt - discountAmt);

    const result = await conn.query(
      `INSERT INTO invoices (invoice_number, customer_id, subtotal, tax_amount, discount, total_amount,
        due_date, payment_terms, notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [invoice_number, customer_id, subtotal, taxAmt, discountAmt, total,
       due_date || null, payment_terms || 'Due on Receipt', notes || null, req.user.user_id]
    );

    const invoice_id = Number(result.insertId);

    for (const item of items) {
      await conn.query(
        `INSERT INTO invoice_items (invoice_id, product_id, variant_id, description, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [invoice_id, item.product_id, item.variant_id || null, item.description || null,
         item.quantity, item.unit_price, round2(item.unit_price * item.quantity)]
      );
    }

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'INVOICE_CREATED', 'invoice', invoice_id,
      { invoice_number, customer_id, total }, req.ip);

    res.status(201).json({ message: 'Invoice created', invoice_id, invoice_number });
  } catch (err) {
    await conn.rollback();
    console.error('Create invoice error:', err);
    res.status(500).json({ message: 'Failed to create invoice' });
  } finally {
    conn.release();
  }
};

// PUT /api/invoices/:id
exports.update = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { customer_id, items, discount, tax_amount, due_date, payment_terms, notes } = req.body;

    const existing = await conn.query('SELECT * FROM invoices WHERE invoice_id = ?', [id]);
    if (existing.length === 0) { await conn.rollback(); return res.status(404).json({ message: 'Invoice not found' }); }
    if (existing[0].status !== 'draft') { await conn.rollback(); return res.status(400).json({ message: 'Only draft invoices can be edited' }); }

    const subtotal = round2(items.reduce((sum, item) => sum + round2(item.unit_price * item.quantity), 0));
    const discountAmt = round2(discount || 0);
    const taxAmt = round2(tax_amount || 0);
    const total = round2(subtotal + taxAmt - discountAmt);

    await conn.query(
      `UPDATE invoices SET customer_id = ?, subtotal = ?, tax_amount = ?, discount = ?,
        total_amount = ?, due_date = ?, payment_terms = ?, notes = ? WHERE invoice_id = ?`,
      [customer_id, subtotal, taxAmt, discountAmt, total, due_date || null,
       payment_terms || 'Due on Receipt', notes || null, id]
    );

    await conn.query('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
    for (const item of items) {
      await conn.query(
        `INSERT INTO invoice_items (invoice_id, product_id, variant_id, description, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, item.product_id, item.variant_id || null, item.description || null,
         item.quantity, item.unit_price, round2(item.unit_price * item.quantity)]
      );
    }

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'INVOICE_UPDATED', 'invoice', parseInt(id),
      { total }, req.ip);

    res.json({ message: 'Invoice updated' });
  } catch (err) {
    await conn.rollback();
    console.error('Update invoice error:', err);
    res.status(500).json({ message: 'Failed to update invoice' });
  } finally {
    conn.release();
  }
};

// PUT /api/invoices/:id/status
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be: ${validStatuses.join(', ')}` });
    }

    const existing = await query('SELECT * FROM invoices WHERE invoice_id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Invoice not found' });

    await query('UPDATE invoices SET status = ? WHERE invoice_id = ?', [status, id]);

    await logAction(req.user.user_id, req.user.name, 'INVOICE_STATUS_CHANGED', 'invoice', parseInt(id),
      { from: existing[0].status, to: status }, req.ip);

    res.json({ message: `Invoice status updated to '${status}'` });
  } catch (err) {
    console.error('Update invoice status error:', err);
    res.status(500).json({ message: 'Failed to update status' });
  }
};

// POST /api/invoices/from-sale/:saleId
exports.createFromSale = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const { saleId } = req.params;

    const sales = await conn.query(
      `SELECT s.*, c.customer_name FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.customer_id
       WHERE s.sale_id = ?`,
      [saleId]
    );
    if (sales.length === 0) { await conn.rollback(); return res.status(404).json({ message: 'Sale not found' }); }

    const sale = sales[0];
    const saleItems = await conn.query('SELECT * FROM sale_details WHERE sale_id = ?', [saleId]);

    const invoice_number = `INV-${Date.now()}`;

    const result = await conn.query(
      `INSERT INTO invoices (invoice_number, sale_id, customer_id, subtotal, tax_amount, discount,
        total_amount, status, payment_terms, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', 'Paid', ?, ?)`,
      [invoice_number, saleId, sale.customer_id, sale.total_amount, sale.tax_amount || 0,
       sale.discount || 0, sale.net_amount || sale.total_amount,
       `Auto-generated from Sale #${saleId}`, req.user.user_id]
    );

    const invoice_id = Number(result.insertId);

    for (const item of saleItems) {
      await conn.query(
        `INSERT INTO invoice_items (invoice_id, product_id, variant_id, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [invoice_id, item.product_id, item.variant_id, item.quantity, item.unit_price, item.total_price]
      );
    }

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'INVOICE_FROM_SALE', 'invoice', invoice_id,
      { invoice_number, sale_id: saleId }, req.ip);

    res.status(201).json({ message: 'Invoice created from sale', invoice_id, invoice_number });
  } catch (err) {
    await conn.rollback();
    console.error('Create invoice from sale error:', err);
    res.status(500).json({ message: 'Failed to create invoice from sale' });
  } finally {
    conn.release();
  }
};

// DELETE /api/invoices/:id
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM invoices WHERE invoice_id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Invoice not found' });
    if (existing[0].status !== 'draft') return res.status(400).json({ message: 'Only draft invoices can be deleted' });

    await query('DELETE FROM invoice_items WHERE invoice_id = ?', [id]);
    await query('DELETE FROM invoices WHERE invoice_id = ?', [id]);

    await logAction(req.user.user_id, req.user.name, 'INVOICE_DELETED', 'invoice', parseInt(id),
      { invoice_number: existing[0].invoice_number }, req.ip);

    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    console.error('Delete invoice error:', err);
    res.status(500).json({ message: 'Failed to delete invoice' });
  }
};

// GET /api/invoices/:id/print
exports.getPrintData = async (req, res) => {
  try {
    const invoices = await query(
      `SELECT i.*, c.customer_name, c.phone_number AS customer_phone, c.email AS customer_email,
              u.name AS created_by_name
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.customer_id
       LEFT JOIN users u ON i.created_by = u.user_id
       WHERE i.invoice_id = ?`,
      [req.params.id]
    );

    if (invoices.length === 0) return res.status(404).json({ message: 'Invoice not found' });

    const items = await query(
      `SELECT ii.*, p.product_name, p.barcode
       FROM invoice_items ii
       LEFT JOIN products p ON ii.product_id = p.product_id
       WHERE ii.invoice_id = ?`,
      [req.params.id]
    );

    // Get store settings for invoice header
    const settings = await query('SELECT * FROM store_settings LIMIT 1');

    res.json({
      invoice: { ...invoices[0], items },
      store: settings[0] || {}
    });
  } catch (err) {
    console.error('Get print data error:', err);
    res.status(500).json({ message: 'Failed to fetch print data' });
  }
};
