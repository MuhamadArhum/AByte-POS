// =============================================================
// customerController.js - Customer Management Controller
// Handles viewing, creating, and looking up customers.
// Customers can be linked to sales for tracking purchase history.
// Customer ID 1 is "Walk-in Customer" (default for anonymous sales).
// Used by: /api/customers routes
// =============================================================

const { query } = require('../config/database');  // Database query helper

// --- Get All Customers ---
// Returns all customers, optionally filtered by search keyword.
// Search matches against customer name or phone number.
// Used on the Customers page and in the POS customer dropdown.
exports.getAll = async (req, res) => {
  try {
    const { search } = req.query;  // Optional search keyword from URL ?search=...
    let sql = 'SELECT * FROM customers';
    const params = [];

    // If a search keyword is provided, filter by name or phone (partial match)
    if (search) {
      sql += ' WHERE customer_name LIKE ? OR phone_number LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }

    // Pagination
    const { page, limit } = req.query;
    if (page && limit) {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      const countSql = 'SELECT COUNT(*) as total FROM customers' + (search ? ' WHERE customer_name LIKE ? OR phone_number LIKE ?' : '');
      const countParams = [...params];
      const countResult = await query(countSql, countParams);
      const total = countResult[0].total;

      sql += ' ORDER BY customer_name LIMIT ? OFFSET ?';
      params.push(limitNum, offset);
      
      const rows = await query(sql, params);
      return res.json({
          data: rows,
          pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
      });
    }

    sql += ' ORDER BY customer_name';  // Alphabetical order
    const rows = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Create New Customer ---
// Adds a new customer record. Name is required, phone is optional.
// The new customer can then be selected when making a sale.
exports.create = async (req, res) => {
  try {
    const { customer_name, phone_number, address } = req.body;

    if (!customer_name) return res.status(400).json({ message: 'Customer name is required' });

    // Normalize empty phone to null for UNIQUE constraint
    const phone = phone_number && phone_number.trim() ? phone_number.trim() : null;

    const result = await query(
      'INSERT INTO customers (customer_name, phone_number) VALUES (?, ?)',
      [customer_name, phone]
    );

    const customerId = Number(result.insertId);

    // Save address if provided
    if (address && address.trim()) {
      await query(
        'INSERT INTO customer_addresses (customer_id, address_text, is_default) VALUES (?, ?, 1)',
        [customerId, address.trim()]
      );
    }

    // Return full customer object for auto-selection in POS
    const newCustomer = await query('SELECT * FROM customers WHERE customer_id = ?', [customerId]);
    res.status(201).json({ message: 'Customer created', customer_id: customerId, customer: newCustomer[0] });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Phone number already exists for another customer' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Get Customer By ID (with Purchase History) ---
// Returns a single customer's details along with their purchase history.
// Purchase history shows all sales linked to this customer (date, amount, cashier).
// Used when clicking on a customer to view their details.
exports.getById = async (req, res) => {
  try {
    // Fetch the customer record
    const rows = await query('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Customer not found' });

    // Pagination for purchases
    const { page, limit } = req.query;
    
    if (page && limit) {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      // Count total purchases
      const countResult = await query(
        'SELECT COUNT(*) as total FROM sales WHERE customer_id = ?', 
        [req.params.id]
      );
      const total = Number(countResult[0].total);

      // Fetch paginated purchases
      const purchases = await query(
        `SELECT s.sale_id, s.sale_date, s.net_amount, u.name as cashier_name
         FROM sales s LEFT JOIN users u ON s.user_id = u.user_id
         WHERE s.customer_id = ? ORDER BY s.sale_date DESC LIMIT ? OFFSET ?`,
        [req.params.id, limitNum, offset]
      );

      return res.json({ 
        ...rows[0], 
        purchases,
        pagination: { 
          total, 
          page: pageNum, 
          limit: limitNum, 
          totalPages: Math.ceil(total / limitNum) 
        } 
      });
    }

    // Fetch all sales made to this customer (with cashier name)
    const purchases = await query(
      `SELECT s.sale_id, s.sale_date, s.net_amount, u.name as cashier_name
       FROM sales s LEFT JOIN users u ON s.user_id = u.user_id
       WHERE s.customer_id = ? ORDER BY s.sale_date DESC`,
      [req.params.id]
    );

    // Return customer data with purchases array attached
    res.json({ ...rows[0], purchases });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Update Customer ---
// Updates an existing customer's details.
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, phone_number, address } = req.body;

    if (!customer_name) return res.status(400).json({ message: 'Customer name is required' });

    const phone = phone_number && phone_number.trim() ? phone_number.trim() : null;

    await query(
      'UPDATE customers SET customer_name = ?, phone_number = ? WHERE customer_id = ?',
      [customer_name, phone, id]
    );

    // Upsert default address if provided
    if (address && address.trim()) {
      const existing = await query(
        'SELECT address_id FROM customer_addresses WHERE customer_id = ? AND is_default = 1',
        [id]
      );
      if (existing.length > 0) {
        await query('UPDATE customer_addresses SET address_text = ? WHERE address_id = ?', [address.trim(), existing[0].address_id]);
      } else {
        await query('INSERT INTO customer_addresses (customer_id, address_text, is_default) VALUES (?, ?, 1)', [id, address.trim()]);
      }
    }

    res.json({ message: 'Customer updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Phone number already exists for another customer' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Delete Customer ---
// Deletes a customer.
// SAFETY CHECK: Cannot delete "Walk-in Customer" (ID 1) or customers with sales history.
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    if (id == 1) {
      return res.status(400).json({ message: 'Cannot delete default Walk-in Customer' });
    }

    // Check for sales history
    const sales = await query('SELECT sale_id FROM sales WHERE customer_id = ? LIMIT 1', [id]);
    if (sales.length > 0) {
      return res.status(400).json({ message: 'Cannot delete customer with purchase history' });
    }

    await query('DELETE FROM customers WHERE customer_id = ?', [id]);
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Get Customer Addresses ---
exports.getAddresses = async (req, res) => {
  try {
    const rows = await query(
      'SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Add Customer Address ---
exports.addAddress = async (req, res) => {
  try {
    const { address_text, label } = req.body;
    if (!address_text || !address_text.trim()) return res.status(400).json({ message: 'Address is required' });

    const result = await query(
      'INSERT INTO customer_addresses (customer_id, address_text, label) VALUES (?, ?, ?)',
      [req.params.id, address_text.trim(), label || 'Default']
    );
    res.status(201).json({ address_id: Number(result.insertId), message: 'Address added' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
