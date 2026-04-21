// =============================================================
// salesController.js - Sales/Billing Controller
// Handles creating new sales (POS checkout) and viewing sale history.
// This is the core of the POS system - processes cart items into sales.
// Uses database TRANSACTIONS to ensure data consistency.
// Used by: /api/sales routes
// =============================================================

const { getConnection, query } = require('../config/database');  // DB helpers (getConnection for transactions)
const { logAction } = require('../services/auditService');

// Helper: Round to 2 decimal places for currency
const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// Helper: Validate and parse pagination params
const parsePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100 per page
  return {
    page: Math.max(1, pageNum),
    limit: Math.max(1, limitNum),
    offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum)
  };
};

// --- Create Sale (Checkout) ---
exports.createSale = async (req, res) => {
  let conn;  // Database connection for the transaction
  try {
    const {
      items,
      discount,
      customer_id,
      payment_method,
      amount_paid,
      status = 'completed', // 'completed' or 'pending'
      tax_percent = 0,
      additional_charges_percent = 0,
      note,
      applied_bundles = [], // Array of { bundle_id, bundle_name, discount_amount }
      is_credit,
      credit_due_date
    } = req.body;
    // items = array of { product_id, quantity, unit_price, variant_id, variant_name }

    // Validate that the cart has items
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Validate credit sale requires named customer
    if (is_credit && (!customer_id || customer_id === 1)) {
      return res.status(400).json({ message: 'Credit sales require a named customer' });
    }
    if (is_credit && !credit_due_date) {
      return res.status(400).json({ message: 'Credit sales require a due date' });
    }

    // Get a dedicated connection for the transaction (not from the shared query helper)
    conn = await getConnection();
    await conn.beginTransaction();  // START TRANSACTION

    // Step 1: Validate stock for each item in the cart
    for (const item of items) {
      let rows;

      if (item.variant_id) {
        rows = await conn.query(
          'SELECT available_stock FROM variant_inventory WHERE variant_id = ? FOR UPDATE',
          [item.variant_id]
        );
        if (rows.length === 0 || rows[0].available_stock < item.quantity) {
          await conn.rollback();
          return res.status(400).json({
            message: `Insufficient stock for variant ID ${item.variant_id}`,
          });
        }
      } else {
        rows = await conn.query(
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
    }

    // Step 2: Calculate sale totals
    const subtotal = round2(items.reduce((sum, item) => sum + round2(item.unit_price * item.quantity), 0));
    const discountAmt = round2(discount || 0);
    const bundleDiscountAmt = round2(applied_bundles.reduce((sum, bundle) => sum + (bundle.discount_amount || 0), 0));
    const taxAmt = round2(subtotal * (parseFloat(tax_percent) / 100));
    const additionalAmt = round2(subtotal * (parseFloat(additional_charges_percent) / 100));

    // Total Amount = Subtotal + Tax + Additional - Discount - Bundle
    const total_amount = round2(Math.max(0, subtotal + taxAmt + additionalAmt - discountAmt - bundleDiscountAmt));

    // Validate discount
    const maxAllowedTotal = subtotal + taxAmt + additionalAmt;
    if (discountAmt > maxAllowedTotal) {
      await conn.rollback();
      return res.status(400).json({ message: 'Discount cannot exceed total amount' });
    }

    const maxDiscountPercent = req.user.role_name === 'Cashier' ? 50 : 100;
    const discountPercent = subtotal > 0 ? (discountAmt / subtotal) * 100 : 0;
    if (discountPercent > maxDiscountPercent) {
      await conn.rollback();
      return res.status(400).json({ message: `Discount cannot exceed ${maxDiscountPercent}% of subtotal for your role` });
    }

    // Step 3: Always generate invoice_no; also generate token_no for pending orders
    let token_no = null;
    const invResult = await conn.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_no, 5) AS UNSIGNED)), 0) + 1 as next_inv
       FROM sales WHERE invoice_no IS NOT NULL`
    );
    const invoice_no = `INV-${String(invResult[0].next_inv).padStart(5, '0')}`;

    if (status === 'pending') {
      // Walk-in token: WI-01, WI-02 … resets per shift
      const shiftRows = await conn.query(
        `SELECT opened_at FROM cash_registers WHERE status = 'open' ORDER BY register_id DESC LIMIT 1`
      );
      const shiftStart = shiftRows.length > 0 ? shiftRows[0].opened_at : new Date().toISOString().slice(0, 10);
      const tokenResult = await conn.query(
        `SELECT COALESCE(MAX(CAST(REPLACE(token_no, 'WI-', '') AS UNSIGNED)), 0) + 1 as next_token
         FROM sales WHERE token_no LIKE 'WI-%' AND sale_date >= ?`,
        [shiftStart]
      );
      token_no = `WI-${String(tokenResult[0].next_token).padStart(2, '0')}`;
    }

    // Step 4: Insert the sale header record
    const finalAmountPaid = is_credit ? 0 : (status === 'completed' ? (amount_paid || total_amount) : 0);

    const saleResult = await conn.query(
      `INSERT INTO sales (
        sub_total, total_amount, discount, bundle_discount, bundle_count, net_amount, user_id, customer_id,
        payment_method, amount_paid, status,
        tax_percent, tax_amount, additional_charges_percent, additional_charges_amount, note,
        token_no, invoice_no
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subtotal,
        total_amount,
        discountAmt,
        bundleDiscountAmt,
        applied_bundles.length,
        total_amount,
        req.user.user_id,
        customer_id || 1,
        payment_method || 'cash',
        finalAmountPaid,
        status,
        tax_percent,
        taxAmt,
        additional_charges_percent,
        additionalAmt,
        note || null,
        token_no,
        invoice_no
      ]
    );

    const sale_id = Number(saleResult.insertId);

    // Step 5: Insert each cart item as a sale detail record and deduct stock
    for (const item of items) {
      await conn.query(
        'INSERT INTO sale_details (sale_id, product_id, variant_id, variant_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [sale_id, item.product_id, item.variant_id || null, item.variant_name || null, item.quantity, item.unit_price, round2(item.unit_price * item.quantity)]
      );

      if (item.variant_id) {
        await conn.query(
          'UPDATE variant_inventory SET available_stock = available_stock - ? WHERE variant_id = ?',
          [item.quantity, item.variant_id]
        );
        await conn.query(
          'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE variant_id = ?',
          [item.quantity, item.variant_id]
        );
      } else {
        await conn.query(
          'UPDATE inventory SET available_stock = available_stock - ? WHERE product_id = ?',
          [item.quantity, item.product_id]
        );
        await conn.query(
          'UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?',
          [item.quantity, item.product_id]
        );
      }
    }

    // Step 5: Insert bundle records if any bundles were applied
    if (applied_bundles && applied_bundles.length > 0) {
      for (const bundle of applied_bundles) {
        await conn.query(
          'INSERT INTO sale_bundles (sale_id, bundle_id, bundle_name, discount_amount) VALUES (?, ?, ?, ?)',
          [sale_id, bundle.bundle_id, bundle.bundle_name, round2(bundle.discount_amount)]
        );
      }
    }

    // Step 6: Create credit sale record if credit payment
    if (is_credit) {
      await conn.query(
        `INSERT INTO credit_sales (sale_id, customer_id, total_amount, paid_amount, remaining_amount, due_date, status)
         VALUES (?, ?, ?, 0, ?, ?, 'active')`,
        [sale_id, customer_id, total_amount, total_amount, credit_due_date]
      );
    }

    await conn.commit();  // COMMIT TRANSACTION

    // Fetch the complete sale to return
    const newSale = await query('SELECT * FROM sales WHERE sale_id = ?', [sale_id]);
    const saleDetails = await query(
      `SELECT sd.*, p.product_name
       FROM sale_details sd
       JOIN products p ON sd.product_id = p.product_id
       WHERE sd.sale_id = ?`,
      [sale_id]
    );

    // Update cash register if cash sale
    if (status === 'completed' && !is_credit && (payment_method || 'cash') === 'cash') {
      const openRegister = await query("SELECT register_id FROM cash_registers WHERE status = 'open' LIMIT 1");
      if (openRegister.length > 0) {
        await query('UPDATE cash_registers SET cash_sales_total = cash_sales_total + ? WHERE register_id = ?', [total_amount, openRegister[0].register_id]);
      }
    } else if (status === 'completed' && !is_credit && payment_method === 'card') {
      const openRegister = await query("SELECT register_id FROM cash_registers WHERE status = 'open' LIMIT 1");
      if (openRegister.length > 0) {
        await query('UPDATE cash_registers SET card_sales_total = card_sales_total + ? WHERE register_id = ?', [total_amount, openRegister[0].register_id]);
      }
    }

    await logAction(req.user.user_id, req.user.name, 'SALE_CREATED', 'sale', sale_id, {
      total_amount, status, items_count: items.length,
      is_credit: is_credit || false
    }, req.ip);

    res.status(201).json({ ...newSale[0], items: saleDetails });

  } catch (error) {
    if (conn) await conn.rollback();  // Rollback on error
    console.error('Create sale error:', error);
    res.status(500).json({ message: 'Failed to create sale' });
  } finally {
    if (conn) conn.release();  // Release connection back to pool
  }
};

// --- Get Pending Sales ---
exports.getPending = async (req, res) => {
  try {
    const { page, limit } = req.query;

    // Always compute summary — exclude delivery orders
    const summaryResult = await query(
      `SELECT COUNT(*) as order_count, COALESCE(SUM(total_amount), 0) as total_amount
       FROM sales WHERE status = 'pending'
       AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.sale_id = sales.sale_id)`
    );
    const summary = {
      order_count: Number(summaryResult[0].order_count),
      total_amount: parseFloat(summaryResult[0].total_amount)
    };

    let sql = `
      SELECT s.*, c.customer_name, u.name as cashier_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.customer_id
      LEFT JOIN users u ON s.user_id = u.user_id
      WHERE s.status = 'pending'
      AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.sale_id = s.sale_id)
    `;
    const params = [];

    if (page && limit) {
      const pg = parsePagination(page, limit);
      const total = summary.order_count;

      sql += ' ORDER BY s.sale_date DESC LIMIT ? OFFSET ?';
      params.push(pg.limit, pg.offset);

      const rows = await query(sql, params);
      return res.json({
        data: rows,
        pagination: { total, page: pg.page, limit: pg.limit, totalPages: Math.ceil(total / pg.limit) },
        summary
      });
    }

    sql += ' ORDER BY s.sale_date DESC';
    const sales = await query(sql, params);
    res.json({ data: sales, summary });
  } catch (error) {
    console.error('Get pending sales error:', error);
    res.status(500).json({ message: 'Failed to fetch pending sales' });
  }
};

// --- Complete a Pending Sale ---
exports.completeSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method, amount_paid, discount, total_amount, note, tax_percent, additional_charges_percent } = req.body;

    // Check if sale exists and is pending
    const sale = await query('SELECT * FROM sales WHERE sale_id = ? AND status = "pending"', [id]);
    if (sale.length === 0) {
      return res.status(404).json({ message: 'Pending sale not found' });
    }

    // invoice_no was already assigned when the order was created — no need to regenerate
    const invoice_no = sale[0].invoice_no;

    // Recalculate tax/charges amounts if rates were changed at checkout
    const subTotal = parseFloat(sale[0].sub_total) || 0;
    const finalTaxPercent = tax_percent !== undefined && tax_percent !== null ? parseFloat(tax_percent) : parseFloat(sale[0].tax_percent);
    const finalAdditionalPercent = additional_charges_percent !== undefined && additional_charges_percent !== null ? parseFloat(additional_charges_percent) : parseFloat(sale[0].additional_charges_percent);
    const finalTaxAmount = round2(subTotal * finalTaxPercent / 100);
    const finalAdditionalAmount = round2(subTotal * finalAdditionalPercent / 100);

    // Update sale: status, payment info, AND corrected tax/charges
    await query(
      `UPDATE sales SET
        status = "completed",
        payment_method = ?,
        amount_paid = ?,
        discount = ?,
        total_amount = ?,
        note = ?,
        tax_percent = ?,
        tax_amount = ?,
        additional_charges_percent = ?,
        additional_charges_amount = ?
       WHERE sale_id = ?`,
      [
        payment_method || 'cash',
        amount_paid || sale[0].total_amount,
        discount !== undefined && discount !== null ? discount : sale[0].discount,
        total_amount !== undefined && total_amount !== null ? total_amount : sale[0].total_amount,
        note !== undefined && note !== null ? note : (sale[0].note || null),
        finalTaxPercent,
        finalTaxAmount,
        finalAdditionalPercent,
        finalAdditionalAmount,
        id
      ]
    );

    await logAction(req.user.user_id, req.user.name, 'SALE_COMPLETED', 'sale', id, { payment_method: payment_method || 'cash', invoice_no }, req.ip);

    res.json({ message: 'Sale completed successfully', sale_id: id, invoice_no });
  } catch (error) {
    console.error('Complete sale error:', error);
    res.status(500).json({ message: 'Failed to complete sale' });
  }
};

// --- Update Items of a Pending Sale (Edit mode) ---
exports.updateSaleItems = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { items, total_amount, tax_percent, additional_charges_percent, customer_id } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    conn = await getConnection();
    await conn.beginTransaction();

    // Must be a pending sale
    const sale = await conn.query('SELECT * FROM sales WHERE sale_id = ? AND status = "pending"', [id]);
    if (sale.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Pending sale not found' });
    }

    // 1. Restore old stock from existing items
    const oldItems = await conn.query('SELECT product_id, variant_id, quantity FROM sale_details WHERE sale_id = ?', [id]);
    for (const item of oldItems) {
      if (item.variant_id) {
        await conn.query('UPDATE variant_inventory SET available_stock = available_stock + ? WHERE variant_id = ?', [item.quantity, item.variant_id]);
        await conn.query('UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE variant_id = ?', [item.quantity, item.variant_id]);
      } else {
        await conn.query('UPDATE inventory SET available_stock = available_stock + ? WHERE product_id = ?', [item.quantity, item.product_id]);
        await conn.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?', [item.quantity, item.product_id]);
      }
    }

    // 2. Delete old sale_details
    await conn.query('DELETE FROM sale_details WHERE sale_id = ?', [id]);

    // 3. Insert new items and deduct stock
    for (const item of items) {
      const unitPrice = round2(parseFloat(item.unit_price));
      const totalPrice = round2(unitPrice * item.quantity);
      await conn.query(
        'INSERT INTO sale_details (sale_id, product_id, variant_id, variant_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, item.product_id, item.variant_id || null, item.variant_name || null, item.quantity, unitPrice, totalPrice]
      );
      if (item.variant_id) {
        await conn.query('UPDATE variant_inventory SET available_stock = available_stock - ? WHERE variant_id = ?', [item.quantity, item.variant_id]);
        await conn.query('UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE variant_id = ?', [item.quantity, item.variant_id]);
      } else {
        await conn.query('UPDATE inventory SET available_stock = available_stock - ? WHERE product_id = ?', [item.quantity, item.product_id]);
        await conn.query('UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?', [item.quantity, item.product_id]);
      }
    }

    // 4. Update sale header
    const newSubTotal = round2(items.reduce((sum, item) => sum + round2(parseFloat(item.unit_price) * item.quantity), 0));
    const updates = ['total_amount = ?', 'sub_total = ?'];
    const values = [round2(parseFloat(total_amount)), newSubTotal];
    if (tax_percent !== undefined) { updates.push('tax_percent = ?'); values.push(tax_percent); }
    if (additional_charges_percent !== undefined) { updates.push('additional_charges_percent = ?'); values.push(additional_charges_percent); }
    if (customer_id !== undefined) { updates.push('customer_id = ?'); values.push(customer_id); }
    values.push(id);

    await conn.query(`UPDATE sales SET ${updates.join(', ')} WHERE sale_id = ?`, values);

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'SALE_UPDATED', 'sale', id, { item_count: items.length, total_amount }, req.ip);

    const updated = await query('SELECT * FROM sales WHERE sale_id = ?', [id]);
    res.json({ message: 'Sale updated successfully', sale: updated[0] });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Update sale items error:', error);
    res.status(500).json({ message: 'Failed to update sale' });
  } finally {
    if (conn) conn.release();
  }
};

// --- Delete/Void Sale ---
exports.deleteSale = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    
    conn = await getConnection();
    await conn.beginTransaction();

    // Check sale status
    const sale = await conn.query('SELECT status FROM sales WHERE sale_id = ?', [id]);
    if (sale.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Sale not found' });
    }

    // Restore stock
    const items = await conn.query('SELECT product_id, variant_id, quantity FROM sale_details WHERE sale_id = ?', [id]);
    for (const item of items) {
      if (item.variant_id) {
        // Restore variant stock
        await conn.query('UPDATE variant_inventory SET available_stock = available_stock + ? WHERE variant_id = ?', [item.quantity, item.variant_id]);
        await conn.query('UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE variant_id = ?', [item.quantity, item.variant_id]);
      } else {
        // Restore regular product stock
        await conn.query('UPDATE inventory SET available_stock = available_stock + ? WHERE product_id = ?', [item.quantity, item.product_id]);
        await conn.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?', [item.quantity, item.product_id]);
      }
    }

    // Delete records
    await conn.query('DELETE FROM sale_details WHERE sale_id = ?', [id]);
    await conn.query('DELETE FROM sales WHERE sale_id = ?', [id]);

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'SALE_DELETED', 'sale', id, { previous_status: sale[0].status }, req.ip);

    res.json({ message: 'Sale deleted and stock restored' });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Delete sale error:', error);
    res.status(500).json({ message: 'Failed to delete sale' });
  } finally {
    if (conn) conn.release();
  }
};

// --- Get Today's Sales ---
exports.getToday = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const sales = await query(`
      SELECT s.*, c.customer_name, u.name as cashier_name 
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.customer_id
      LEFT JOIN users u ON s.user_id = u.user_id
      WHERE s.sale_date >= ? AND s.sale_date < DATE_ADD(?, INTERVAL 1 DAY) AND (s.status = 'completed' OR s.status = 'refunded')
      ORDER BY s.sale_date DESC
    `, [today, today]);
    res.json(sales);
  } catch (error) {
    console.error('Get today sales error:', error);
    res.status(500).json({ message: 'Failed to fetch today sales' });
  }
};

// --- Get All Sales ---
exports.getAll = async (req, res) => {
  try {
    const { page, limit, search, status, date_from, date_to, order_type, shift_start, shift_end } = req.query;
    let sql = `
      SELECT s.*, c.customer_name, u.name as cashier_name,
             COALESCE(d.delivery_charges, 0) AS delivery_charges
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.customer_id
      LEFT JOIN users u ON s.user_id = u.user_id
      LEFT JOIN deliveries d ON d.sale_id = s.sale_id
      WHERE 1=1
    `;
    const params = [];

    // Filter by order type: walkin = no linked delivery, delivery = has linked delivery
    if (order_type === 'delivery') {
      sql += ' AND EXISTS (SELECT 1 FROM deliveries d WHERE d.sale_id = s.sale_id)';
    } else if (order_type === 'walkin') {
      sql += ' AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.sale_id = s.sale_id)';
    }

    if (status) {
      if (status.includes(',')) {
        const statuses = status.split(',');
        sql += ` AND s.status IN (${statuses.map(() => '?').join(',')})`;
        params.push(...statuses);
      } else {
        sql += ' AND s.status = ?';
        params.push(status);
      }
    }

    // shift_start/shift_end = exact datetime filter (for shift-wise view)
    // takes priority over date_from/date_to when provided
    if (shift_start) { sql += ' AND s.sale_date >= ?'; params.push(shift_start); }
    else if (date_from) { sql += ' AND s.sale_date >= ?'; params.push(date_from); }
    if (shift_end)   { sql += ' AND s.sale_date <= ?'; params.push(shift_end); }
    else if (date_to) { sql += ' AND s.sale_date < DATE_ADD(?, INTERVAL 1 DAY)'; params.push(date_to); }

    if (search) {
      sql += ' AND (s.sale_id LIKE ? OR c.customer_name LIKE ? OR s.invoice_no LIKE ? OR s.token_no LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (page && limit) {
      const pg = parsePagination(page, limit);

      // Count + summary query for pagination
      let countSql = `
        SELECT COUNT(*) as total, COALESCE(SUM(s.total_amount), 0) as total_amount
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.customer_id
        WHERE 1=1
      `;
      const countParams = [];

      if (order_type === 'delivery') {
        countSql += ' AND EXISTS (SELECT 1 FROM deliveries d WHERE d.sale_id = s.sale_id)';
      } else if (order_type === 'walkin') {
        countSql += ' AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.sale_id = s.sale_id)';
      }

      if (status) {
        if (status.includes(',')) {
          const statuses = status.split(',');
          countSql += ` AND s.status IN (${statuses.map(() => '?').join(',')})`;
          countParams.push(...statuses);
        } else {
          countSql += ' AND s.status = ?';
          countParams.push(status);
        }
      }

      if (shift_start) { countSql += ' AND s.sale_date >= ?'; countParams.push(shift_start); }
      else if (date_from) { countSql += ' AND s.sale_date >= ?'; countParams.push(date_from); }
      if (shift_end)   { countSql += ' AND s.sale_date <= ?'; countParams.push(shift_end); }
      else if (date_to) { countSql += ' AND s.sale_date < DATE_ADD(?, INTERVAL 1 DAY)'; countParams.push(date_to); }

      if (search) {
        countSql += ' AND (s.sale_id LIKE ? OR c.customer_name LIKE ? OR s.invoice_no LIKE ? OR s.token_no LIKE ?)';
        countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      const countResult = await query(countSql, countParams);
      const total = Number(countResult[0].total);
      const summary = {
        order_count: total,
        total_amount: parseFloat(countResult[0].total_amount)
      };

      sql += ' ORDER BY s.sale_date DESC LIMIT ? OFFSET ?';
      params.push(pg.limit, pg.offset);

      const rows = await query(sql, params);
      return res.json({
        data: rows,
        pagination: { total, page: pg.page, limit: pg.limit, totalPages: Math.ceil(total / pg.limit) },
        summary
      });
    }

    sql += ' ORDER BY s.sale_date DESC';
    const sales = await query(sql, params);
    res.json(sales);
  } catch (error) {
    console.error('Get all sales error:', error);
    res.status(500).json({ message: 'Failed to fetch sales' });
  }
};

// --- Get Sale by ID ---
exports.getById = async (req, res) => {
  try {
    const sale = await query(`
      SELECT s.*, c.customer_name, u.name as cashier_name 
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.customer_id
      LEFT JOIN users u ON s.user_id = u.user_id
      WHERE s.sale_id = ?
    `, [req.params.id]);

    if (sale.length === 0) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const items = await query(`
      SELECT sd.*, p.product_name, p.barcode 
      FROM sale_details sd
      JOIN products p ON sd.product_id = p.product_id
      WHERE sd.sale_id = ?
    `, [req.params.id]);

    res.json({ ...sale[0], items });
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({ message: 'Failed to fetch sale details' });
  }
};

// --- Refund Sale ---
exports.refundSale = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    
    conn = await getConnection();
    await conn.beginTransaction();

    // Check sale status
    const sale = await conn.query('SELECT status FROM sales WHERE sale_id = ? FOR UPDATE', [id]);
    if (sale.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    if (sale[0].status === 'refunded') {
      await conn.rollback();
      return res.status(400).json({ message: 'Sale is already refunded' });
    }

    // Restore stock
    const items = await conn.query('SELECT product_id, variant_id, quantity FROM sale_details WHERE sale_id = ?', [id]);
    for (const item of items) {
      if (item.variant_id) {
        // Restore variant stock
        await conn.query('UPDATE variant_inventory SET available_stock = available_stock + ? WHERE variant_id = ?', [item.quantity, item.variant_id]);
        await conn.query('UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE variant_id = ?', [item.quantity, item.variant_id]);
      } else {
        // Restore regular product stock
        await conn.query('UPDATE inventory SET available_stock = available_stock + ? WHERE product_id = ?', [item.quantity, item.product_id]);
        await conn.query('UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?', [item.quantity, item.product_id]);
      }
    }

    // Update status
    await conn.query('UPDATE sales SET status = "refunded" WHERE sale_id = ?', [id]);

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'SALE_REFUNDED', 'sale', id, {}, req.ip);

    res.json({ message: 'Sale refunded and stock restored' });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Refund sale error:', error);
    res.status(500).json({ message: 'Failed to refund sale' });
  } finally {
    if (conn) conn.release();
  }
};
