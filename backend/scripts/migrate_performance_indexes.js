// =============================================================
// migrate_performance_indexes.js
// Adds missing indexes to high-traffic tables for query performance.
// Run once: node backend/scripts/migrate_performance_indexes.js
// =============================================================

require('dotenv').config();
const mariadb = require('mariadb');

const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'abyte_pos',
  connectionLimit: 3,
});

async function addIndexIfMissing(conn, table, indexName, columns) {
  try {
    const rows = await conn.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [table, indexName]
    );
    if (rows.length > 0) {
      console.log(`  [SKIP] ${table}.${indexName} already exists`);
      return;
    }
    await conn.query(`CREATE INDEX ${indexName} ON ${table} (${columns})`);
    console.log(`  [OK]   Created index ${indexName} on ${table}(${columns})`);
  } catch (err) {
    console.error(`  [ERR]  ${table}.${indexName}: ${err.message}`);
  }
}

async function addFulltextIfMissing(conn, table, indexName, columns) {
  try {
    const rows = await conn.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
      [table, indexName]
    );
    if (rows.length > 0) {
      console.log(`  [SKIP] ${table}.${indexName} (FULLTEXT) already exists`);
      return;
    }
    await conn.query(`CREATE FULLTEXT INDEX ${indexName} ON ${table} (${columns})`);
    console.log(`  [OK]   Created FULLTEXT index ${indexName} on ${table}(${columns})`);
  } catch (err) {
    console.error(`  [ERR]  ${table}.${indexName} (FULLTEXT): ${err.message}`);
  }
}

async function run() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log('Adding performance indexes...\n');

    // ── Sales (most critical table) ───────────────────────────
    await addIndexIfMissing(conn, 'sales', 'idx_sales_date',         'sale_date');
    await addIndexIfMissing(conn, 'sales', 'idx_sales_status',       'status');
    await addIndexIfMissing(conn, 'sales', 'idx_sales_customer',     'customer_id');
    await addIndexIfMissing(conn, 'sales', 'idx_sales_user',         'user_id');
    await addIndexIfMissing(conn, 'sales', 'idx_sales_date_status',  'sale_date, status');
    await addIndexIfMissing(conn, 'sales', 'idx_sales_payment',      'payment_method');

    // ── Sale details (joined on every sale) ──────────────────
    await addIndexIfMissing(conn, 'sale_details', 'idx_saledetails_sale',    'sale_id');
    await addIndexIfMissing(conn, 'sale_details', 'idx_saledetails_product', 'product_id');
    await addIndexIfMissing(conn, 'sale_details', 'idx_saledetails_variant', 'variant_id');

    // ── Products (POS search + category filter) ───────────────
    await addIndexIfMissing(conn, 'products', 'idx_products_category', 'category_id');
    await addIndexIfMissing(conn, 'products', 'idx_products_barcode',  'barcode');
    await addIndexIfMissing(conn, 'products', 'idx_products_name',     'product_name');
    await addFulltextIfMissing(conn, 'products', 'idx_products_ft_search', 'product_name');

    // ── Customers (search by name) ────────────────────────────
    await addIndexIfMissing(conn,    'customers', 'idx_customers_phone', 'phone_number');
    await addIndexIfMissing(conn,    'customers', 'idx_customers_name',  'customer_name');
    await addFulltextIfMissing(conn, 'customers', 'idx_customers_ft_search', 'customer_name');

    // ── Expenses (date + category reports) ───────────────────
    await addIndexIfMissing(conn, 'expenses', 'idx_expenses_date',     'expense_date');
    await addIndexIfMissing(conn, 'expenses', 'idx_expenses_category', 'category');

    // ── Returns ───────────────────────────────────────────────
    await addIndexIfMissing(conn, 'returns', 'idx_returns_sale', 'sale_id');
    await addIndexIfMissing(conn, 'returns', 'idx_returns_date', 'return_date');

    // ── Inventory (joined on every product fetch) ─────────────
    await addIndexIfMissing(conn, 'inventory', 'idx_inventory_product', 'product_id');

    // ── Audit logs ────────────────────────────────────────────
    await addIndexIfMissing(conn, 'audit_logs', 'idx_auditlogs_date',   'created_at');
    await addIndexIfMissing(conn, 'audit_logs', 'idx_auditlogs_entity', 'entity_type');
    await addIndexIfMissing(conn, 'audit_logs', 'idx_auditlogs_user',   'user_id');

    // ── Attendance ────────────────────────────────────────────
    await addIndexIfMissing(conn, 'attendance', 'idx_attendance_date',  'attendance_date');
    await addIndexIfMissing(conn, 'attendance', 'idx_attendance_staff', 'staff_id');

    // ── Accounting ────────────────────────────────────────────
    await addIndexIfMissing(conn, 'journal_entries',     'idx_je_date',    'entry_date');
    await addIndexIfMissing(conn, 'journal_entries',     'idx_je_status',  'status');
    await addIndexIfMissing(conn, 'journal_entry_lines', 'idx_jel_entry',  'entry_id');
    await addIndexIfMissing(conn, 'journal_entry_lines', 'idx_jel_account','account_id');

    // ── Cash registers ────────────────────────────────────────
    await addIndexIfMissing(conn, 'cash_registers', 'idx_registers_status', 'status');

    console.log('\nDone! All indexes applied.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

run();
