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
      // New: Coupon, Loyalty, Credit
      coupon_code,
      coupon_discount: frontendCouponDiscount,
      loyalty_redeem_points,
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

    // Step 2b: Validate and apply coupon
    let couponId = null;
    let couponDiscountAmt = 0;
    if (coupon_code) {
      const coupons = await conn.query(
        `SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND valid_from <= CURDATE() AND valid_until >= CURDATE()`,
        [coupon_code]
      );
      if (coupons.length === 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'Invalid or expired coupon code' });
      }
      const coupon = coupons[0];
      // Check usage limit
      if (coupon.max_uses) {
        const usageCount = await conn.query('SELECT COUNT(*) as cnt FROM coupon_redemptions WHERE coupon_id = ?', [coupon.coupon_id]);
        if (Number(usageCount[0].cnt) >= coupon.max_uses) {
          await conn.rollback();
          return res.status(400).json({ message: 'Coupon usage limit reached' });
        }
      }
      // Check min purchase
      if (coupon.min_purchase && subtotal < parseFloat(coupon.min_purchase)) {
        await conn.rollback();
        return res.status(400).json({ message: `Minimum purchase of $${coupon.min_purchase} required for this coupon` });
      }
      // Calculate discount
      if (coupon.discount_type === 'percentage') {
        couponDiscountAmt = round2(subtotal * (parseFloat(coupon.discount_value) / 100));
      } else {
        couponDiscountAmt = round2(Math.min(parseFloat(coupon.discount_value), subtotal));
      }
      couponId = coupon.coupon_id;
    }

    // Step 2c: Validate loyalty points redemption
    let loyaltyRedeemAmt = 0;
    let actualPointsRedeemed = 0;
    if (loyalty_redeem_points && loyalty_redeem_points > 0 && customer_id && customer_id !== 1) {
      const custRows = await conn.query('SELECT loyalty_points FROM customers WHERE customer_id = ? FOR UPDATE', [customer_id]);
      if (custRows.length > 0) {
        const availablePoints = parseInt(custRows[0].loyalty_points) || 0;
        // Load loyalty config
        const configRows = await conn.query('SELECT * FROM loyalty_config WHERE config_id = 1');
        if (configRows.length > 0 && configRows[0].is_active) {
          const config = configRows[0];
          actualPointsRedeemed = Math.min(parseInt(loyalty_redeem_points), availablePoints);
          if (actualPointsRedeemed >= (parseInt(config.min_redeem_points) || 0)) {
            loyaltyRedeemAmt = round2(actualPointsRedeemed * parseFloat(config.amount_per_point));
          } else {
            actualPointsRedeemed = 0;
          }
        }
      }
    }

    // Total Amount = Subtotal + Tax + Additional - Discount - Bundle - Coupon - Loyalty
    const total_amount = round2(Math.max(0, subtotal + taxAmt + additionalAmt - discountAmt - bundleDiscountAmt - couponDiscountAmt - loyaltyRedeemAmt));

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

    // Step 3: Insert the sale header record
    const finalAmountPaid = is_credit ? 0 : (status === 'completed' ? (amount_paid || total_amount) : 0);

    const saleResult = await conn.query(
      `INSERT INTO sales (
        total_amount, discount, bundle_discount, bundle_count, net_amount, user_id, customer_id,
        payment_method, amount_paid, status,
        tax_percent, tax_amount, additional_charges_percent, additional_charges_amount, note,
        coupon_id, coupon_discount, loyalty_points_redeemed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
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
        couponId,
        couponDiscountAmt > 0 ? couponDiscountAmt : null,
        actualPointsRedeemed > 0 ? actualPointsRedeemed : null
      ]
    );

    const sale_id = Number(saleResult.insertId);

    // Step 4: Insert each cart item as a sale detail record and deduct stock
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

    // Step 6: Record coupon redemption
    if (couponId) {
      await conn.query(
        'INSERT INTO coupon_redemptions (coupon_id, sale_id, customer_id, discount_amount) VALUES (?, ?, ?, ?)',
        [couponId, sale_id, customer_id || 1, couponDiscountAmt]
      );
    }

    // Step 7: Handle loyalty points - deduct redeemed points
    if (actualPointsRedeemed > 0) {
      await conn.query(
        'UPDATE customers SET loyalty_points = loyalty_points - ? WHERE customer_id = ?',
        [actualPointsRedeemed, customer_id]
      );
      await conn.query(
        `INSERT INTO loyalty_transactions (customer_id, points, transaction_type, reference_type, reference_id, description)
         VALUES (?, ?, 'redeemed', 'sale', ?, ?)`,
        [customer_id, actualPointsRedeemed, sale_id, `Redeemed ${actualPointsRedeemed} points on sale #${sale_id}`]
      );
    }

    // Step 7b: Earn loyalty points (for non-walk-in customers, on completed sales)
    let loyaltyPointsEarned = 0;
    if (status === 'completed' && customer_id && customer_id !== 1) {
      const configRows = await conn.query('SELECT * FROM loyalty_config WHERE config_id = 1');
      if (configRows.length > 0 && configRows[0].is_active) {
        const config = configRows[0];
        const pointsPerAmount = parseFloat(config.points_per_amount) || 0;
        if (pointsPerAmount > 0) {
          loyaltyPointsEarned = Math.floor(total_amount / pointsPerAmount);
          if (loyaltyPointsEarned > 0) {
            await conn.query(
              'UPDATE customers SET loyalty_points = loyalty_points + ? WHERE customer_id = ?',
              [loyaltyPointsEarned, customer_id]
            );
            await conn.query(
              `INSERT INTO loyalty_transactions (customer_id, points, transaction_type, reference_type, reference_id, description)
               VALUES (?, ?, 'earned', 'sale', ?, ?)`,
              [customer_id, loyaltyPointsEarned, sale_id, `Earned ${loyaltyPointsEarned} points on sale #${sale_id}`]
            );
            await conn.query(
              'UPDATE sales SET loyalty_points_earned = ? WHERE sale_id = ?',
              [loyaltyPointsEarned, sale_id]
            );
          }
        }
      }
    }

    // Step 8: Create credit sale record if credit payment
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
      coupon_code: coupon_code || null,
      is_credit: is_credit || false,
      loyalty_points_earned: loyaltyPointsEarned,
      loyalty_points_redeemed: actualPointsRedeemed
    }, req.ip);

    res.status(201).json({ ...newSale[0], items: saleDetails, loyalty_points_earned: loyaltyPointsEarned });

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
