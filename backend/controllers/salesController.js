// =============================================================
// salesController.js - Sales/Billing Controller
// Handles creating new sales (POS checkout) and viewing sale history.
// This is the core of the POS system - processes cart items into sales.
// Uses database TRANSACTIONS to ensure data consistency.
// Used by: /api/sales routes
// =============================================================

const { getConnection, query } = require('../config/database');  // DB helpers (getConnection for transactions)

// --- Create Sale (Checkout) ---
// This is the most critical function in the POS system.
// Called when the cashier clicks "Checkout" on the POS page.
// Uses a DATABASE TRANSACTION to ensure all-or-nothing:
//   - Either the entire sale succeeds (sale created + stock deducted)
//   - Or the entire sale fails (nothing changes in the database)
//
// Steps:
// 1. Validate cart is not empty
// 2. BEGIN transaction
// 3. Lock and validate stock for each item (FOR UPDATE prevents race conditions)
// 4. Calculate totals and validate discount
// 5. Insert sale record into 'sales' table
// 6. Insert each item into 'sale_details' table
// 7. Deduct stock from 'inventory' and 'products' tables
// 8. COMMIT transaction
// 9. Fetch and return the complete sale data for the invoice
exports.createSale = async (req, res) => {
  let conn;  // Database connection for the transaction
  try {
    const { items, discount, customer_id } = req.body;
    // items = array of { product_id, quantity, unit_price }

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
      const rows = await conn.query(
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

    // Step 2: Calculate sale totals
    // total_amount = sum of (unit_price * quantity) for all items
    const total_amount = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const discountAmt = discount || 0;                // Default discount is 0
    const net_amount = total_amount - discountAmt;     // Net = total minus discount

    // Validate discount doesn't exceed total
    if (discountAmt > total_amount) {
      await conn.rollback();
      return res.status(400).json({ message: 'Discount cannot exceed total amount' });
    }

    // Step 3: Insert the sale header record
    // customer_id defaults to 1 (Walk-in Customer) if not specified
    // req.user.user_id is the logged-in cashier's ID (set by auth middleware)
    const saleResult = await conn.query(
      'INSERT INTO sales (total_amount, discount, net_amount, user_id, customer_id) VALUES (?, ?, ?, ?, ?)',
      [total_amount, discountAmt, net_amount, req.user.user_id, customer_id || 1]
    );

    const sale_id = Number(saleResult.insertId);  // Get the auto-generated sale ID

    // Step 4: Insert each cart item as a sale detail record and deduct stock
    for (const item of items) {
      // Insert line item into sale_details table
      await conn.query(
        'INSERT INTO sale_details (sale_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
        [sale_id, item.product_id, item.quantity, item.unit_price, item.unit_price * item.quantity]
      );

      // Deduct stock from the inventory table
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

    // Step 5: All operations succeeded - commit the transaction
    await conn.commit();  // COMMIT - all changes are now permanent

    // Step 6: Fetch the complete sale data for the invoice/receipt
    // This includes customer name and cashier name from joined tables
    const sale = await query(
      `SELECT s.*, c.customer_name, u.name as cashier_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.customer_id
       LEFT JOIN users u ON s.user_id = u.user_id
       WHERE s.sale_id = ?`,
      [sale_id]
    );

    // Fetch all line items for the sale (with product names)
    const details = await query(
      `SELECT sd.*, p.product_name
       FROM sale_details sd
       JOIN products p ON sd.product_id = p.product_id
       WHERE sd.sale_id = ?`,
      [sale_id]
    );

    // Return the complete sale with items for the invoice modal
    res.status(201).json({
      message: 'Sale completed',
      sale: { ...sale[0], items: details },
    });
  } catch (err) {
    // If anything went wrong, rollback all changes
    if (conn) await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    // Always release the connection back to the pool
    if (conn) conn.release();
  }
};

// --- Get All Sales ---
// Returns all sales with customer and cashier names, newest first.
// Used on the Sales History page.
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

// --- Get Sale By ID ---
// Returns a single sale with its line items (products sold).
// Used when viewing a specific sale's invoice/receipt.
exports.getById = async (req, res) => {
  try {
    // Fetch the sale header (total, discount, customer, cashier)
    const sale = await query(
      `SELECT s.*, c.customer_name, u.name as cashier_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.customer_id
       LEFT JOIN users u ON s.user_id = u.user_id
       WHERE s.sale_id = ?`,
      [req.params.id]
    );

    if (sale.length === 0) return res.status(404).json({ message: 'Sale not found' });

    // Fetch the line items (individual products in this sale)
    const details = await query(
      `SELECT sd.*, p.product_name
       FROM sale_details sd
       JOIN products p ON sd.product_id = p.product_id
       WHERE sd.sale_id = ?`,
      [req.params.id]
    );

    // Combine sale header with items array
    res.json({ ...sale[0], items: details });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Get Today's Sales ---
// Returns all sales made today (filtered by CURDATE()).
// Used on the Dashboard and POS page for today's transactions overview.
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
