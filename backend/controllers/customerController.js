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
    const { customer_name, phone_number } = req.body;

    // Customer name is required
    if (!customer_name) return res.status(400).json({ message: 'Customer name is required' });

    // Insert the new customer (phone_number is null if not provided)
    const result = await query(
      'INSERT INTO customers (customer_name, phone_number) VALUES (?, ?)',
      [customer_name, phone_number || null]
    );

    res.status(201).json({ message: 'Customer created', customer_id: Number(result.insertId) });
  } catch (err) {
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
    const { customer_name, phone_number } = req.body;

    if (!customer_name) return res.status(400).json({ message: 'Customer name is required' });

    await query(
      'UPDATE customers SET customer_name = ?, phone_number = ? WHERE customer_id = ?',
      [customer_name, phone_number || null, id]
    );

    res.json({ message: 'Customer updated' });
  } catch (err) {
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
