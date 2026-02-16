/**
 * Migration: Settings Module Overhaul
 * Adds new columns to store_settings for comprehensive configuration
 * Run: node backend/migrate_settings_overhaul.js
 */

const { getConnection } = require('./config/database');

async function migrate() {
  console.log('Starting Settings Overhaul migration...\n');

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // Add new columns to store_settings
    const columns = [
      { name: 'tax_rate', sql: "ADD COLUMN tax_rate DECIMAL(5,2) DEFAULT 0" },
      { name: 'currency_symbol', sql: "ADD COLUMN currency_symbol VARCHAR(10) DEFAULT 'Rs.'" },
      { name: 'receipt_logo', sql: "ADD COLUMN receipt_logo TEXT" },
      { name: 'low_stock_threshold', sql: "ADD COLUMN low_stock_threshold INT DEFAULT 10" },
      { name: 'default_payment_method', sql: "ADD COLUMN default_payment_method ENUM('cash','card','online') DEFAULT 'cash'" },
      { name: 'auto_print_receipt', sql: "ADD COLUMN auto_print_receipt TINYINT(1) DEFAULT 0" },
      { name: 'barcode_prefix', sql: "ADD COLUMN barcode_prefix VARCHAR(10) DEFAULT ''" },
      { name: 'invoice_prefix', sql: "ADD COLUMN invoice_prefix VARCHAR(20) DEFAULT 'INV-'" },
      { name: 'date_format', sql: "ADD COLUMN date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY'" },
      { name: 'timezone', sql: "ADD COLUMN timezone VARCHAR(50) DEFAULT 'Asia/Karachi'" },
      { name: 'business_hours_open', sql: "ADD COLUMN business_hours_open TIME DEFAULT '09:00:00'" },
      { name: 'business_hours_close', sql: "ADD COLUMN business_hours_close TIME DEFAULT '21:00:00'" },
      { name: 'allow_negative_stock', sql: "ADD COLUMN allow_negative_stock TINYINT(1) DEFAULT 0" },
      { name: 'discount_requires_approval', sql: "ADD COLUMN discount_requires_approval TINYINT(1) DEFAULT 0" },
      { name: 'max_cashier_discount', sql: "ADD COLUMN max_cashier_discount DECIMAL(5,2) DEFAULT 50.00" },
      { name: 'session_timeout_minutes', sql: "ADD COLUMN session_timeout_minutes INT DEFAULT 480" },
      { name: 'receipt_show_store_name', sql: "ADD COLUMN receipt_show_store_name TINYINT(1) DEFAULT 1" },
      { name: 'receipt_show_address', sql: "ADD COLUMN receipt_show_address TINYINT(1) DEFAULT 1" },
      { name: 'receipt_show_phone', sql: "ADD COLUMN receipt_show_phone TINYINT(1) DEFAULT 1" },
      { name: 'receipt_show_tax', sql: "ADD COLUMN receipt_show_tax TINYINT(1) DEFAULT 1" },
      { name: 'receipt_paper_width', sql: "ADD COLUMN receipt_paper_width ENUM('58mm','80mm') DEFAULT '80mm'" },
    ];

    for (const col of columns) {
      try {
        await conn.query(`ALTER TABLE store_settings ${col.sql}`);
        console.log(`  Added column: ${col.name}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          console.log(`  Column ${col.name} already exists, skipping`);
        } else {
          throw err;
        }
      }
    }

    await conn.commit();
    console.log('\nSettings Overhaul migration completed successfully!');
  } catch (error) {
    await conn.rollback();
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate().catch(() => process.exit(1));
