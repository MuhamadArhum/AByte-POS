// Migration: Add product_type column to products table
// Run: node backend/scripts/add_product_type.js

const { query } = require('../config/database');

async function migrate() {
  try {
    // Add column if not exists
    await query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS product_type ENUM('finished_good', 'raw_material') NOT NULL DEFAULT 'finished_good'
    `);
    console.log('✓ product_type column added to products table');

    // Mark all existing products as finished_good (they were products for sale)
    await query(`UPDATE products SET product_type = 'finished_good' WHERE product_type IS NULL`);
    console.log('✓ Existing products marked as finished_good');

    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
