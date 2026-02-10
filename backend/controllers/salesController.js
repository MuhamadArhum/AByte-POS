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
      applied_bundles = [] // Array of { bundle_id, bundle_name, discount_amount }
    } = req.body;
    // items = array of { product_id, quantity, unit_price, variant_id, variant_name }

    // Validate that the cart has items
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Get a dedicated connection for the transaction (not from the shared query helper)
    conn = await getConnection();
    await conn.beginTransaction();  // START TRANSACTION

    // Step 1: Validate stock for each item in the cart
    // FOR UPDATE locks the inventory rows to prevent other transactions from
    // changing the stock while we're processing this sale (prevents overselling)
    for (const item of items) {
      let rows;

      // Check if item has a variant - if so, validate variant stock
      if (item.variant_id) {
        rows = await conn.query(
          'SELECT available_stock FROM variant_inventory WHERE variant_id = ? FOR UPDATE',
          [item.variant_id]
        );
        // Check if variant exists and has enough stock
        if (rows.length === 0 || rows[0].available_stock < item.quantity) {
          await conn.rollback();  // Cancel the transaction
          return res.status(400).json({
            message: `Insufficient stock for variant ID ${item.variant_id}`,
          });
        }
      } else {
        // Regular product stock validation
        rows = await conn.query(
          'SELECT available_stock FROM inventory WHERE product_id = ? FOR UPDATE',
          [item.product_id]
        );
        // Check if product exists and has enough stock
        if (rows.length === 0 || rows[0].available_stock < item.quantity) {
          await conn.rollback();  // Cancel the transaction
          return res.status(400).json({
            message: `Insufficient stock for product ID ${item.product_id}`,
          });
        }
      }
    }

    // Step 2: Calculate sale totals (all rounded to 2 decimal places for currency precision)
    // subtotal = sum of (unit_price * quantity) for all items
    const subtotal = round2(items.reduce((sum, item) => sum + round2(item.unit_price * item.quantity), 0));
    const discountAmt = round2(discount || 0);

    // Calculate bundle discount
    const bundleDiscountAmt = round2(applied_bundles.reduce((sum, bundle) => sum + (bundle.discount_amount || 0), 0));

    // Calculate Tax and Additional Charges
    const taxAmt = round2(subtotal * (parseFloat(tax_percent) / 100));
    const additionalAmt = round2(subtotal * (parseFloat(additional_charges_percent) / 100));

    // Total Amount = Subtotal + Tax + Additional - Discount - Bundle Discount
    const total_amount = round2(subtotal + taxAmt + additionalAmt - discountAmt - bundleDiscountAmt);
    
    // Net amount is usually the same as total_amount in this logic, but if we want to store pre-discount
    // Let's stick to total_amount being the final payable.
    
    // Validate discount: cannot exceed total, and max 50% for non-admin users
    const maxAllowedTotal = subtotal + taxAmt + additionalAmt;
    if (discountAmt > maxAllowedTotal) {
      await conn.rollback();
      return res.status(400).json({ message: 'Discount cannot exceed total amount' });
    }

    // Max 50% discount for Cashier role (Admin/Manager can give higher)
    const maxDiscountPercent = req.user.role_name === 'Cashier' ? 50 : 100;
    const discountPercent = subtotal > 0 ? (discountAmt / subtotal) * 100 : 0;
    if (discountPercent > maxDiscountPercent) {
      await conn.rollback();
      return res.status(400).json({ message: `Discount cannot exceed ${maxDiscountPercent}% of subtotal for your role` });
    }

    // Step 3: Insert the sale header record
    // customer_id defaults to 1 (Walk-in Customer) if not specified
    // req.user.user_id is the logged-in cashier's ID (set by auth middleware)
    
    const finalAmountPaid = status === 'completed' ? (amount_paid || total_amount) : 0;
    
    const saleResult = await conn.query(
      `INSERT INTO sales (
        total_amount, discount, bundle_discount, bundle_count, net_amount, user_id, customer_id,
        payment_method, amount_paid, status,
        tax_percent, tax_amount, additional_charges_percent, additional_charges_amount, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        total_amount,
        discountAmt,
        bundleDiscountAmt,
        applied_bundles.length,
        total_amount, // keeping net_amount same as total for now, or could be subtotal. Let's use total.
        req.user.user_id,
        customer_id || 1,
        payment_method || 'cash',
        finalAmountPaid,
        status,
        tax_percent,
        taxAmt,
        additional_charges_percent,
        additionalAmt,
        note || null
      ]
    );

    const sale_id = Number(saleResult.insertId);  // Get the auto-generated sale ID

    // Step 4: Insert each cart item as a sale detail record and deduct stock
    for (const item of items) {
      // Insert line item into sale_details table (with variant info if applicable)
      await conn.query(
        'INSERT INTO sale_details (sale_id, product_id, variant_id, variant_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [sale_id, item.product_id, item.variant_id || null, item.variant_name || null, item.quantity, item.unit_price, round2(item.unit_price * item.quantity)]
      );

      // Deduct stock - check if variant or regular product
      if (item.variant_id) {
        // Deduct from variant inventory
        await conn.query(
          'UPDATE variant_inventory SET available_stock = available_stock - ? WHERE variant_id = ?',
          [item.quantity, item.variant_id]
        );
        // Also deduct from product_variants table (kept in sync)
        await conn.query(
          'UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE variant_id = ?',
          [item.quantity, item.variant_id]
        );
      } else {
        // Deduct from regular inventory
        await conn.query(
          'UPDATE inventory SET available_stock = available_stock - ? WHERE product_id = ?',
          [item.quantity, item.product_id]
        );
        // Also deduct stock from the products table (kept in sync)
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
    if (status === 'completed' && (payment_method || 'cash') === 'cash') {
      const openRegister = await query("SELECT register_id FROM cash_registers WHERE status = 'open' LIMIT 1");
      if (openRegister.length > 0) {
        await query('UPDATE cash_registers SET cash_sales_total = cash_sales_total + ? WHERE register_id = ?', [total_amount, openRegister[0].register_id]);
      }
    } else if (status === 'completed' && payment_method === 'card') {
      const openRegister = await query("SELECT register_id FROM cash_registers WHERE status = 'open' LIMIT 1");
      if (openRegister.length > 0) {
        await query('UPDATE cash_registers SET card_sales_total = card_sales_total + ? WHERE register_id = ?', [total_amount, openRegister[0].register_id]);
      }
    }

    await logAction(req.user.user_id, req.user.name, 'SALE_CREATED', 'sale', sale_id, { total_amount, status, items_count: items.length }, req.ip);

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

    let sql = `
      SELECT s.*, c.customer_name, u.name as cashier_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.customer_id
      LEFT JOIN users u ON s.user_id = u.user_id
      WHERE s.status = 'pending'
    `;
    const params = [];

    if (page && limit) {
      const pg = parsePagination(page, limit);

      const countResult = await query("SELECT COUNT(*) as total FROM sales WHERE status = 'pending'");
      const total = Number(countResult[0].total);

      sql += ' ORDER BY s.sale_date DESC LIMIT ? OFFSET ?';
      params.push(pg.limit, pg.offset);

      const rows = await query(sql, params);
      return res.json({
        data: rows,
        pagination: { total, page: pg.page, limit: pg.limit, totalPages: Math.ceil(total / pg.limit) }
      });
    }

    sql += ' ORDER BY s.sale_date DESC';
    const sales = await query(sql, params);
    res.json(sales);
  } catch (error) {
    console.error('Get pending sales error:', error);
    res.status(500).json({ message: 'Failed to fetch pending sales' });
  }
};

// --- Complete a Pending Sale ---
exports.completeSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_method, amount_paid } = req.body;

    // Check if sale exists and is pending
    const sale = await query('SELECT * FROM sales WHERE sale_id = ? AND status = "pending"', [id]);
    if (sale.length === 0) {
      return res.status(404).json({ message: 'Pending sale not found' });
    }

    // Update sale status to completed
    await query(
      'UPDATE sales SET status = "completed", payment_method = ?, amount_paid = ? WHERE sale_id = ?',
      [payment_method || 'cash', amount_paid || sale[0].total_amount, id]
    );

    await logAction(req.user.user_id, req.user.name, 'SALE_COMPLETED', 'sale', id, { payment_method: payment_method || 'cash' }, req.ip);

    res.json({ message: 'Sale completed successfully', sale_id: id });
  } catch (error) {
    console.error('Complete sale error:', error);
    res.status(500).json({ message: 'Failed to complete sale' });
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
      WHERE DATE(s.sale_date) = ? AND (s.status = 'completed' OR s.status = 'refunded')
      ORDER BY s.sale_date DESC
    `, [today]);
    res.json(sales);
  } catch (error) {
    console.error('Get today sales error:', error);
    res.status(500).json({ message: 'Failed to fetch today sales' });
  }
};

// --- Get All Sales ---
exports.getAll = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;
    let sql = `
      SELECT s.*, c.customer_name, u.name as cashier_name 
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.customer_id
      LEFT JOIN users u ON s.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

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

    if (search) {
      sql += ' AND (s.sale_id LIKE ? OR c.customer_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (page && limit) {
      const pg = parsePagination(page, limit);

      // Count query for pagination
      let countSql = `
        SELECT COUNT(*) as total
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.customer_id
        WHERE 1=1
      `;
      const countParams = [];

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

      if (search) {
        countSql += ' AND (s.sale_id LIKE ? OR c.customer_name LIKE ?)';
        countParams.push(`%${search}%`, `%${search}%`);
      }

      const countResult = await query(countSql, countParams);
      const total = Number(countResult[0].total);

      sql += ' ORDER BY s.sale_date DESC LIMIT ? OFFSET ?';
      params.push(pg.limit, pg.offset);

      const rows = await query(sql, params);
      return res.json({
        data: rows,
        pagination: { total, page: pg.page, limit: pg.limit, totalPages: Math.ceil(total / pg.limit) }
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
