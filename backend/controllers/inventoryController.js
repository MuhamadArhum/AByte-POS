// =============================================================
// inventoryController.js - Inventory/Stock Management Controller
// Handles viewing and updating product stock levels.
// Stock is tracked in the inventory table (separate from products table).
// Used by: /api/inventory routes
// =============================================================

const { query } = require('../config/database');  // Database query helper

// --- Get All Inventory ---
// Returns all products with their current stock levels, prices, and categories.
// JOINs inventory with products and categories for a complete view.
// Used on the Inventory page to display the stock table.
exports.getAll = async (req, res) => {
  try {
    const rows = await query(
      `SELECT i.*, p.product_name, p.price, c.category_name
       FROM inventory i
       JOIN products p ON i.product_id = p.product_id
       LEFT JOIN categories c ON p.category_id = c.category_id
       ORDER BY p.product_name`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Update Stock Level ---
// Sets a new stock quantity for a specific product.
// Updates BOTH the inventory table AND the products table to keep them in sync.
// Only Admin and Manager can update stock (enforced by route middleware).
exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;              // Product ID from URL
    const { available_stock } = req.body;    // New stock quantity from request body

    // Validate the stock value is a valid non-negative number
    if (available_stock === undefined || available_stock < 0) {
      return res.status(400).json({ message: 'Valid stock quantity is required' });
    }

    // Update both tables to keep stock values consistent
    await query('UPDATE inventory SET available_stock = ? WHERE product_id = ?', [available_stock, id]);
    await query('UPDATE products SET stock_quantity = ? WHERE product_id = ?', [available_stock, id]);
    res.json({ message: 'Stock updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Get Low Stock Products ---
// Returns products that have stock between 1 and 9 units (running low).
// Used on the Dashboard for low stock alerts and in inventory reports.
// Products with 0 stock are NOT included (those are "out of stock").
exports.getLowStock = async (req, res) => {
  try {
    const rows = await query(
      `SELECT i.*, p.product_name, p.price, c.category_name
       FROM inventory i
       JOIN products p ON i.product_id = p.product_id
       LEFT JOIN categories c ON p.category_id = c.category_id
       WHERE i.available_stock > 0 AND i.available_stock < 10
       ORDER BY i.available_stock ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
