/**
 * Migration: Add sub_total column to sales table
 * Run: node backend/scripts/migrate_sales_subtotal.js
 */
const { query } = require('../config/database');

async function migrate() {
  try {
    console.log('Checking sales table for sub_total column...');

    const cols = await query(`SHOW COLUMNS FROM sales LIKE 'sub_total'`);
    if (cols.length > 0) {
      console.log('sub_total column already exists. Skipping.');
    } else {
      await query(`ALTER TABLE sales ADD COLUMN sub_total DECIMAL(10,2) DEFAULT 0.00 AFTER sale_id`);
      console.log('Added sub_total column to sales table.');

      // Backfill: calculate sub_total from sale_details for existing rows
      await query(`
        UPDATE sales s
        SET s.sub_total = (
          SELECT COALESCE(SUM(sd.total_price), 0)
          FROM sale_details sd
          WHERE sd.sale_id = s.sale_id
        )
        WHERE s.sub_total = 0
      `);
      console.log('Backfilled sub_total from existing sale_details.');
    }

    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
