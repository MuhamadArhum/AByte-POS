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
    // Check if index already exists
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

async function run() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log('Adding performance indexes...\n');

    // Sales table — most frequently queried
    await addIndexIfMissing(conn, 'sales', 'idx_sales_date', 'sale_date');
    await addIndexIfMissing(conn, 'sales', 'idx_sales_status', 'status');
    await addIndexIfMissing(conn, 'sales', 'idx_sales_customer', 'customer_id');
    await addIndexIfMissing(conn, 'sales', 'idx_sales_user', 'user_id');
    await addIndexIfMissing(conn, 'sales', 'idx_sales_date_status', 'sale_date, status');

    // Sale details — joined on every sale fetch
    await addIndexIfMissing(conn, 'sale_details', 'idx_saledetails_product', 'product_id');
    await addIndexIfMissing(conn, 'sale_details', 'idx_saledetails_variant', 'variant_id');

    // Inventory — joined on every product fetch
    await addIndexIfMissing(conn, 'inventory', 'idx_inventory_product', 'product_id');

    // Products — searched frequently
    await addIndexIfMissing(conn, 'products', 'idx_products_category', 'category_id');
    await addIndexIfMissing(conn, 'products', 'idx_products_barcode', 'barcode');

    // Audit logs — filtered by date/table frequently
    await addIndexIfMissing(conn, 'audit_logs', 'idx_auditlogs_date', 'created_at');
    await addIndexIfMissing(conn, 'audit_logs', 'idx_auditlogs_table', 'table_name');
    await addIndexIfMissing(conn, 'audit_logs', 'idx_auditlogs_user', 'user_id');

    // Attendance — queried by date and staff
    await addIndexIfMissing(conn, 'attendance', 'idx_attendance_date', 'attendance_date');
    await addIndexIfMissing(conn, 'attendance', 'idx_attendance_staff', 'staff_id');

    // Journal entries — filtered by date
    await addIndexIfMissing(conn, 'journal_entries', 'idx_je_date', 'entry_date');
    await addIndexIfMissing(conn, 'journal_entries', 'idx_je_status', 'status');

    // Journal entry lines — joined frequently
    await addIndexIfMissing(conn, 'journal_entry_lines', 'idx_jel_entry', 'entry_id');
    await addIndexIfMissing(conn, 'journal_entry_lines', 'idx_jel_account', 'account_id');

    // Customers — searched by name/phone
    await addIndexIfMissing(conn, 'customers', 'idx_customers_phone', 'phone_number');

    // Cash registers — status filter
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
