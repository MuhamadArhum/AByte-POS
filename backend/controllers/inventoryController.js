// =============================================================
// inventoryController.js - Inventory/Stock Management Controller
// Handles viewing and updating product stock levels.
// Stock is tracked in the inventory table (separate from products table).
// Used by: /api/inventory routes
// =============================================================

const { query } = require('../config/database');  // Database query helper
const { logAction } = require('../services/auditService');

// --- Get All Inventory ---
// Returns all products with their current stock levels, prices, and categories.
// JOINs inventory with products and categories for a complete view.
// Used on the Inventory page to display the stock table.
exports.getAll = async (req, res) => {
  try {
    const { page, limit } = req.query;
    let sql = `
       SELECT i.*, p.product_name, p.price, c.category_name
       FROM inventory i
       JOIN products p ON i.product_id = p.product_id
       LEFT JOIN categories c ON p.category_id = c.category_id
    `;
    const params = [];

    if (page && limit) {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      const countResult = await query('SELECT COUNT(*) as total FROM inventory i JOIN products p ON i.product_id = p.product_id');
      const total = countResult[0].total;

      sql += ' ORDER BY p.product_name LIMIT ? OFFSET ?';
      params.push(limitNum, offset);

      const rows = await query(sql, params);
      return res.json({
        data: rows,
        pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) }
      });
    }

    sql += ' ORDER BY p.product_name';
    const rows = await query(sql, params);
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
    // Get old stock for audit
    const oldStock = await query('SELECT available_stock FROM inventory WHERE product_id = ?', [id]);
    const oldValue = oldStock.length > 0 ? oldStock[0].available_stock : null;

    await query('UPDATE inventory SET available_stock = ? WHERE product_id = ?', [available_stock, id]);
    await query('UPDATE products SET stock_quantity = ? WHERE product_id = ?', [available_stock, id]);

    await logAction(req.user.user_id, req.user.name, 'STOCK_UPDATED', 'inventory', parseInt(id), { old_stock: oldValue, new_stock: available_stock }, req.ip);

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
