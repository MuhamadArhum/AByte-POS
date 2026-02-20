// =============================================================
// layawayController.js - Layaway Orders Controller
// Handles creating layaway orders, making payments, completing,
// and cancelling layaway plans. Stock is reserved at creation
// and only restored if cancelled.
// Used by: /api/layaway routes
// =============================================================

const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

// Helper: Round to 2 decimal places for currency
const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// Helper: Validate and parse pagination params
const parsePagination = (page, limit) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(Math.max(1, parseInt(limit) || 20), 100);
  return { page: p, limit: l, offset: (p - 1) * l };
};

// --- Get All Layaways (Paginated) ---
// Filters: status, customer_id, search (layaway_number or customer name)
exports.getAll = async (req, res) => {
  try {
    const { status, customer_id, search } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let whereClauses = ['1=1'];
    const params = [];

    if (status) {
      whereClauses.push('lo.status = ?');
      params.push(status);
    }
    if (customer_id) {
      whereClauses.push('lo.customer_id = ?');
      params.push(customer_id);
    }
    if (search) {
      whereClauses.push('(lo.layaway_number LIKE ? OR c.customer_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereSQL = whereClauses.join(' AND ');

    // Count total
    const countResult = await query(
      `SELECT COUNT(*) as total
       FROM layaway_orders lo
       LEFT JOIN customers c ON lo.customer_id = c.customer_id
       WHERE ${whereSQL}`,
      params
    );
    const total = countResult[0].total;

    // Fetch page
    const rows = await query(
      `SELECT lo.*, c.customer_name, c.phone_number AS customer_phone,
              u.name AS created_by_name
       FROM layaway_orders lo
       LEFT JOIN customers c ON lo.customer_id = c.customer_id
       LEFT JOIN users u ON lo.created_by = u.user_id
       WHERE ${whereSQL}
       ORDER BY lo.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get layaways error:', error);
    res.status(500).json({ message: 'Failed to fetch layaway orders' });
  }
};

// --- Get Layaway By ID ---
// Returns layaway header + items (with product info) + payments (with user info)
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get layaway header
    const layaways = await query(
      `SELECT lo.*, c.customer_name, c.phone_number AS customer_phone,
              u.name AS created_by_name
       FROM layaway_orders lo
       LEFT JOIN customers c ON lo.customer_id = c.customer_id
       LEFT JOIN users u ON lo.created_by = u.user_id
       WHERE lo.layaway_id = ?`,
      [id]
    );

    if (layaways.length === 0) {
      return res.status(404).json({ message: 'Layaway order not found' });
    }

    const layaway = layaways[0];

    // Get items with product details
    const items = await query(
      `SELECT li.*, p.product_name, p.barcode
       FROM layaway_items li
       LEFT JOIN products p ON li.product_id = p.product_id
       WHERE li.layaway_id = ?`,
      [id]
    );

    // Get payments with user info
    const payments = await query(
      `SELECT lp.*, u.name AS received_by_name
       FROM layaway_payments lp
       LEFT JOIN users u ON lp.received_by = u.user_id
       WHERE lp.layaway_id = ?
       ORDER BY lp.payment_date ASC`,
      [id]
    );

    res.json({
      ...layaway,
      items,
      payments
    });
  } catch (error) {
    console.error('Get layaway by ID error:', error);
    res.status(500).json({ message: 'Failed to fetch layaway details' });
  }
};

// --- Create Layaway ---
// Reserves stock at creation, inserts layaway order + items + optional deposit payment
exports.create = async (req, res) => {
  let conn;
  try {
    const { customer_id, items, tax_amount, deposit_amount, expiry_date, notes } = req.body;

    // Validate inputs
    if (!customer_id || customer_id === 1) {
      return res.status(400).json({ message: 'A valid customer is required for layaway (Walk-in not allowed)' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }
    if (!expiry_date) {
      return res.status(400).json({ message: 'Expiry date is required' });
    }

    conn = await getConnection();
    await conn.beginTransaction();

    // Auto-generate layaway number
    const layaway_number = `LY-${Date.now()}`;

    // Calculate subtotal from items
    const subtotal = round2(items.reduce((sum, item) => sum + round2(item.unit_price * item.quantity), 0));
    const taxAmt = round2(parseFloat(tax_amount) || 0);
    const total = round2(subtotal + taxAmt);
    const deposit = round2(parseFloat(deposit_amount) || 0);
    const balance_due = round2(total - deposit);

    if (deposit > total) {
      await conn.rollback();
      return res.status(400).json({ message: 'Deposit amount cannot exceed total' });
    }

    // Validate stock and reserve for each item
    for (const item of items) {
      if (item.variant_id) {
        const rows = await conn.query(
          'SELECT available_stock FROM variant_inventory WHERE variant_id = ? FOR UPDATE',
          [item.variant_id]
        );
        if (rows.length === 0 || rows[0].available_stock < item.quantity) {
          await conn.rollback();
          return res.status(400).json({ message: `Insufficient stock for variant ID ${item.variant_id}` });
        }
        // Reserve stock - deduct from variant inventory
        await conn.query(
          'UPDATE variant_inventory SET available_stock = available_stock - ? WHERE variant_id = ?',
          [item.quantity, item.variant_id]
        );
        await conn.query(
          'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE variant_id = ?',
          [item.quantity, item.variant_id]
        );
      } else {
        const rows = await conn.query(
          'SELECT stock_quantity FROM products WHERE product_id = ? FOR UPDATE',
          [item.product_id]
        );
        if (rows.length === 0 || rows[0].stock_quantity < item.quantity) {
          await conn.rollback();
          return res.status(400).json({ message: `Insufficient stock for product ID ${item.product_id}` });
        }
        // Reserve stock - deduct from products and inventory
        await conn.query(
          'UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?',
          [item.quantity, item.product_id]
        );
        await conn.query(
          'UPDATE inventory SET available_stock = available_stock - ? WHERE product_id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    // Insert layaway order
    const result = await conn.query(
      `INSERT INTO layaway_orders
        (layaway_number, customer_id, subtotal, tax_amount, total_amount,
         deposit_amount, paid_amount, balance_due, expiry_date, notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [layaway_number, customer_id, subtotal, taxAmt, total,
       deposit, deposit, balance_due, expiry_date, notes || null, req.user.user_id]
    );

    const layaway_id = Number(result.insertId);

    // Insert layaway items
    for (const item of items) {
      await conn.query(
        `INSERT INTO layaway_items
          (layaway_id, product_id, variant_id, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [layaway_id, item.product_id, item.variant_id || null,
         item.quantity, item.unit_price, round2(item.unit_price * item.quantity)]
      );
    }

    // Insert deposit payment if any
    if (deposit > 0) {
      await conn.query(
        `INSERT INTO layaway_payments
          (layaway_id, amount, payment_method, notes, received_by)
         VALUES (?, ?, 'cash', 'Initial deposit', ?)`,
        [layaway_id, deposit, req.user.user_id]
      );
    }

    await conn.commit();

    // Audit log
    await logAction(
      req.user.user_id, req.user.name, 'CREATE_LAYAWAY', 'layaway', layaway_id,
      { layaway_number, customer_id, total, deposit },
      req.ip
    );

    res.status(201).json({
      message: 'Layaway order created successfully',
      layaway_id,
      layaway_number,
      total,
      balance_due
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Create layaway error:', error);
    res.status(500).json({ message: 'Failed to create layaway order' });
  } finally {
    if (conn) conn.release();
  }
};

// --- Make Payment on Layaway ---
// Adds a payment, updates balance. Auto-completes if fully paid.
exports.makePayment = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { amount, payment_method, notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Payment amount must be greater than zero' });
    }

    conn = await getConnection();
    await conn.beginTransaction();

    // Get layaway with lock
    const layaways = await conn.query(
      'SELECT * FROM layaway_orders WHERE layaway_id = ? FOR UPDATE',
      [id]
    );

    if (layaways.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Layaway order not found' });
    }

    const layaway = layaways[0];

    if (layaway.status !== 'active') {
      await conn.rollback();
      return res.status(400).json({ message: `Cannot make payment on a ${layaway.status} layaway` });
    }

    const paymentAmt = round2(parseFloat(amount));
    if (paymentAmt > round2(layaway.balance_due)) {
      await conn.rollback();
      return res.status(400).json({ message: `Payment amount (${paymentAmt}) exceeds balance due (${layaway.balance_due})` });
    }

    // Insert payment record
    await conn.query(
      `INSERT INTO layaway_payments
        (layaway_id, amount, payment_method, notes, received_by)
       VALUES (?, ?, ?, ?, ?)`,
      [id, paymentAmt, payment_method || 'cash', notes || null, req.user.user_id]
    );

    // Update layaway totals
    const newPaid = round2(parseFloat(layaway.paid_amount) + paymentAmt);
    const newBalance = round2(parseFloat(layaway.total_amount) - newPaid);

    await conn.query(
      'UPDATE layaway_orders SET paid_amount = ?, balance_due = ? WHERE layaway_id = ?',
      [newPaid, newBalance, id]
    );

    // Auto-complete if fully paid
    if (newBalance <= 0) {
      await completeLayaway(conn, layaway, req.user.user_id);
    }

    await conn.commit();

    // Audit log
    await logAction(
      req.user.user_id, req.user.name, 'LAYAWAY_PAYMENT', 'layaway', parseInt(id),
      { layaway_number: layaway.layaway_number, amount: paymentAmt, new_balance: newBalance },
      req.ip
    );

    res.json({
      message: newBalance <= 0 ? 'Payment received. Layaway completed and converted to sale.' : 'Payment recorded successfully',
      paid_amount: newPaid,
      balance_due: newBalance,
      status: newBalance <= 0 ? 'completed' : 'active'
    });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Layaway payment error:', error);
    res.status(500).json({ message: 'Failed to process layaway payment' });
  } finally {
    if (conn) conn.release();
  }
};

// --- Internal: Complete Layaway (convert to sale) ---
// Called within an existing transaction - does NOT commit/rollback
async function completeLayaway(conn, layaway, userId) {
  // Get layaway items
  const items = await conn.query(
    'SELECT * FROM layaway_items WHERE layaway_id = ?',
    [layaway.layaway_id]
  );

  // Create sale record
  const saleResult = await conn.query(
    `INSERT INTO sales
      (total_amount, discount, net_amount, user_id, customer_id,
       payment_method, amount_paid, status, tax_amount, note)
     VALUES (?, 0, ?, ?, ?, 'Layaway', ?, 'completed', ?, ?)`,
    [
      layaway.total_amount, layaway.total_amount, userId,
      layaway.customer_id, layaway.total_amount,
      layaway.tax_amount,
      `Converted from layaway ${layaway.layaway_number}`
    ]
  );

  const sale_id = Number(saleResult.insertId);

  // Create sale detail records
  for (const item of items) {
    await conn.query(
      `INSERT INTO sale_details
        (sale_id, product_id, variant_id, quantity, unit_price, total_price)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sale_id, item.product_id, item.variant_id, item.quantity,
       item.unit_price, item.total_price]
    );
  }

  // NOTE: Do NOT deduct stock again - it was already reserved at creation

  // Update layaway status
  await conn.query(
    `UPDATE layaway_orders SET status = 'completed', converted_sale_id = ? WHERE layaway_id = ?`,
    [sale_id, layaway.layaway_id]
  );
}

// --- Complete Layaway (endpoint) ---
// Manually complete a fully paid layaway
exports.complete = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;

    conn = await getConnection();
    await conn.beginTransaction();

    const layaways = await conn.query(
      'SELECT * FROM layaway_orders WHERE layaway_id = ? FOR UPDATE',
      [id]
    );

    if (layaways.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Layaway order not found' });
    }

    const layaway = layaways[0];

    if (layaway.status !== 'active') {
      await conn.rollback();
      return res.status(400).json({ message: `Cannot complete a ${layaway.status} layaway` });
    }

    if (round2(layaway.balance_due) > 0) {
      await conn.rollback();
      return res.status(400).json({ message: `Layaway still has a balance due of ${layaway.balance_due}` });
    }

    await completeLayaway(conn, layaway, req.user.user_id);
    await conn.commit();

    // Audit log
    await logAction(
      req.user.user_id, req.user.name, 'COMPLETE_LAYAWAY', 'layaway', parseInt(id),
      { layaway_number: layaway.layaway_number },
      req.ip
    );

    res.json({ message: 'Layaway completed and converted to sale successfully' });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Complete layaway error:', error);
    res.status(500).json({ message: 'Failed to complete layaway' });
  } finally {
    if (conn) conn.release();
  }
};

// --- Cancel Layaway ---
// Restores reserved stock, marks as cancelled. Payments kept as records.
exports.cancel = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;

    conn = await getConnection();
    await conn.beginTransaction();

    const layaways = await conn.query(
      'SELECT * FROM layaway_orders WHERE layaway_id = ? FOR UPDATE',
      [id]
    );

    if (layaways.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Layaway order not found' });
    }

    const layaway = layaways[0];

    if (layaway.status !== 'active') {
      await conn.rollback();
      return res.status(400).json({ message: `Cannot cancel a ${layaway.status} layaway` });
    }

    // Get items to restore stock
    const items = await conn.query(
      'SELECT * FROM layaway_items WHERE layaway_id = ?',
      [id]
    );

    // Restore stock for each item
    for (const item of items) {
      if (item.variant_id) {
        await conn.query(
          'UPDATE variant_inventory SET available_stock = available_stock + ? WHERE variant_id = ?',
          [item.quantity, item.variant_id]
        );
        await conn.query(
          'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE variant_id = ?',
          [item.quantity, item.variant_id]
        );
      } else {
        await conn.query(
          'UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?',
          [item.quantity, item.product_id]
        );
        await conn.query(
          'UPDATE inventory SET available_stock = available_stock + ? WHERE product_id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    // Update status to cancelled
    await conn.query(
      "UPDATE layaway_orders SET status = 'cancelled' WHERE layaway_id = ?",
      [id]
    );

    await conn.commit();

    // Audit log
    await logAction(
      req.user.user_id, req.user.name, 'CANCEL_LAYAWAY', 'layaway', parseInt(id),
      { layaway_number: layaway.layaway_number, refund_amount: layaway.paid_amount },
      req.ip
    );

    res.json({ message: 'Layaway cancelled and stock restored. Any payments should be refunded externally.' });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Cancel layaway error:', error);
    res.status(500).json({ message: 'Failed to cancel layaway' });
  } finally {
    if (conn) conn.release();
  }
};

// --- Get Layaway Stats ---
// Dashboard stats: active count, reserved value, expiring soon, completed count
exports.getStats = async (req, res) => {
  try {
    const stats = await query(
      `SELECT
        COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_count,
        COALESCE(SUM(CASE WHEN status = 'active' THEN total_amount ELSE 0 END), 0) AS total_reserved_value,
        COUNT(CASE WHEN status = 'active' AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 END) AS expiring_soon,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed_count
       FROM layaway_orders`
    );

    res.json(stats[0]);
  } catch (error) {
    console.error('Get layaway stats error:', error);
    res.status(500).json({ message: 'Failed to fetch layaway stats' });
  }
};
