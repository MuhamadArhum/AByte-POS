// =============================================================
// productController.js - Product & Category Management Controller
// Handles CRUD operations for products and categories.
// Products are the items sold through the POS system.
// Used by: /api/products routes
// =============================================================

const { query } = require('../config/database');  // Database query helper
const { logAction } = require('../services/auditService');

// --- Get All Products ---
// Returns all products with their category names and stock levels.
// Supports optional filters via query parameters:
//   ?search=keyword  - Search by product name or barcode
//   ?category=id     - Filter by category
//   ?stock=low       - Show only low stock (1-9 units)
//   ?stock=out       - Show only out of stock (0 units)
exports.getAll = async (req, res) => {
  try {
    const { search, category, stock } = req.query;  // Get filter parameters from URL

    // Base query: JOIN products with categories and inventory tables
    // LEFT JOIN because a product might not have a category or inventory record
    // WHERE 1=1 is a trick that makes it easy to append AND conditions dynamically
    let sql = `SELECT p.*, c.category_name, i.available_stock
               FROM products p
               LEFT JOIN categories c ON p.category_id = c.category_id
               LEFT JOIN inventory i ON p.product_id = i.product_id
               WHERE 1=1`;
    const params = [];

    // If search keyword provided, filter by product name or barcode (partial match)
    if (search) {
      sql += ' AND (p.product_name LIKE ? OR p.barcode LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);  // % = wildcard for partial matching
    }
    // If category filter provided, filter by exact category ID
    if (category) {
      sql += ' AND p.category_id = ?';
      params.push(category);
    }
    // Stock level filters
    if (stock === 'low') {
      sql += ' AND i.available_stock > 0 AND i.available_stock < 10';  // Low: 1-9 units
    } else if (stock === 'out') {
      sql += ' AND (i.available_stock = 0 OR i.available_stock IS NULL)';  // Out of stock
    }

    // Pagination
    const { page, limit } = req.query;
    if (page && limit) {
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;

      // Count total records for pagination
      const countSql = `SELECT COUNT(*) as total 
                        FROM products p 
                        LEFT JOIN categories c ON p.category_id = c.category_id
                        LEFT JOIN inventory i ON p.product_id = i.product_id
                        WHERE 1=1 ` + 
                        (search ? ' AND (p.product_name LIKE ? OR p.barcode LIKE ?)' : '') +
                        (category ? ' AND p.category_id = ?' : '') +
                        (stock === 'low' ? ' AND i.available_stock > 0 AND i.available_stock < 10' : '') +
                        (stock === 'out' ? ' AND (i.available_stock = 0 OR i.available_stock IS NULL)' : '');
      
      // params for count query (same as main query up to this point)
      const countParams = [...params]; 
      const countResult = await query(countSql, countParams);
      const total = Number(countResult[0].total);

      sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
      params.push(limitNum, offset);

      const rows = await query(sql, params);
      
      return res.json({
        data: rows,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    }

    sql += ' ORDER BY p.created_at DESC';  // Newest products first
    const rows = await query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Get Product By ID ---
// Returns a single product with its category name and stock level.
// Used when viewing or editing a specific product.
exports.getById = async (req, res) => {
  try {
    const rows = await query(
      `SELECT p.*, c.category_name, i.available_stock
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.category_id
       LEFT JOIN inventory i ON p.product_id = i.product_id
       WHERE p.product_id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Product not found' });

    const product = rows[0];

    // If product has variants, fetch them
    if (product.has_variants) {
      const variants = await query(
        `SELECT pv.*, vi.available_stock
         FROM product_variants pv
         LEFT JOIN variant_inventory vi ON pv.variant_id = vi.variant_id
         WHERE pv.product_id = ? AND pv.is_active = 1
         ORDER BY pv.variant_name`,
        [product.product_id]
      );

      // Get combinations for each variant
      for (let variant of variants) {
        const combinations = await query(
          `SELECT vc.*, vv.value_name, vt.variant_name as type_name
           FROM variant_combinations vc
           JOIN variant_values vv ON vc.variant_value_id = vv.variant_value_id
           JOIN variant_types vt ON vv.variant_type_id = vt.variant_type_id
           WHERE vc.variant_id = ?`,
          [variant.variant_id]
        );
        variant.combinations = combinations;
      }

      product.variants = variants;
    }

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Create New Product ---
// Adds a new product to the system and creates its inventory record.
// Two tables are updated: products (product info) and inventory (stock tracking).
// Only Admin and Manager can create products.
exports.create = async (req, res) => {
  try {
    const { product_name, category_id, price, stock_quantity, barcode } = req.body;

    // Validate required fields
    if (!product_name || !price) {
      return res.status(400).json({ message: 'Product name and price are required' });
    }

    // Insert the product into the products table
    const result = await query(
      'INSERT INTO products (product_name, category_id, price, stock_quantity, barcode) VALUES (?, ?, ?, ?, ?)',
      [product_name, category_id || null, price, stock_quantity || 0, barcode || null]
    );

    // Also create a corresponding inventory record to track stock separately
    const productId = Number(result.insertId);
    await query(
      'INSERT INTO inventory (product_id, available_stock) VALUES (?, ?)',
      [productId, stock_quantity || 0]
    );

    await logAction(req.user.user_id, req.user.name, 'PRODUCT_CREATED', 'product', productId, { product_name, price }, req.ip);

    res.status(201).json({ message: 'Product created', product_id: productId });
  } catch (err) {
    // Handle duplicate barcode error from the UNIQUE constraint
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Barcode already exists' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Update Product ---
// Updates product details and syncs the inventory stock level.
// Both products and inventory tables are updated to keep stock in sync.
exports.update = async (req, res) => {
  try {
    const { id } = req.params;  // Product ID from URL
    const { product_name, category_id, price, stock_quantity, barcode } = req.body;

    // Update the product record
    await query(
      'UPDATE products SET product_name = ?, category_id = ?, price = ?, stock_quantity = ?, barcode = ? WHERE product_id = ?',
      [product_name, category_id || null, price, stock_quantity, barcode || null, id]
    );

    // Sync the inventory table with the new stock quantity
    await query(
      'UPDATE inventory SET available_stock = ? WHERE product_id = ?',
      [stock_quantity, id]
    );

    await logAction(req.user.user_id, req.user.name, 'PRODUCT_UPDATED', 'product', parseInt(id), { product_name, price }, req.ip);

    res.json({ message: 'Product updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Barcode already exists' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Delete Product ---
// Removes a product from the system.
// SAFETY CHECK: Cannot delete a product that has been sold (to preserve sale history).
// Deletes from inventory first (child), then products (parent) to respect foreign keys.
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if this product appears in any sale records
    const sales = await query('SELECT sale_detail_id FROM sale_details WHERE product_id = ? LIMIT 1', [id]);
    if (sales.length > 0) {
      return res.status(400).json({ message: 'Cannot delete product with sales history' });
    }

    // Get product name before deleting for audit log
    const product = await query('SELECT product_name FROM products WHERE product_id = ?', [id]);
    const productName = product.length > 0 ? product[0].product_name : 'Unknown';

    // Delete inventory record first (foreign key constraint), then the product
    await query('DELETE FROM inventory WHERE product_id = ?', [id]);
    await query('DELETE FROM products WHERE product_id = ?', [id]);

    await logAction(req.user.user_id, req.user.name, 'PRODUCT_DELETED', 'product', parseInt(id), { product_name: productName }, req.ip);

    res.json({ message: 'Product deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Get All Categories ---
// Returns all product categories sorted alphabetically.
// Used in product forms and filter dropdowns.
exports.getCategories = async (req, res) => {
  try {
    const rows = await query('SELECT * FROM categories ORDER BY category_name');
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Create New Category ---
// Adds a new product category (e.g., "Beverages", "Snacks").
// Category names must be unique (enforced by DB constraint).
exports.createCategory = async (req, res) => {
  try {
    const { category_name } = req.body;
    if (!category_name) return res.status(400).json({ message: 'Category name is required' });

    const result = await query('INSERT INTO categories (category_name) VALUES (?)', [category_name]);
    res.status(201).json({ message: 'Category created', category_id: Number(result.insertId) });
  } catch (err) {
    // Handle duplicate category name
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Category already exists' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Generate Barcode for Product ---
exports.generateBarcode = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await query('SELECT product_id, barcode FROM products WHERE product_id = ?', [id]);
    if (product.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (product[0].barcode) {
      return res.json({ barcode: product[0].barcode, message: 'Product already has a barcode' });
    }

    // Generate unique barcode: ABP + product_id padded + random digits
    const paddedId = String(id).padStart(5, '0');
    const random = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    const barcode = `ABP${paddedId}${random}`;

    await query('UPDATE products SET barcode = ? WHERE product_id = ?', [barcode, id]);

    await logAction(req.user.user_id, req.user.name, 'BARCODE_GENERATED', 'product', parseInt(id), { barcode }, req.ip);

    res.json({ barcode, message: 'Barcode generated successfully' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Barcode collision. Please try again.' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
