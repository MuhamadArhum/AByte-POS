/**
 * Migration: Add default_delivery_charges column to store_settings
 * Run once: node backend/scripts/migrate_delivery_charges_setting.js
 */
const { query } = require('../config/database');

async function migrate() {
  console.log('Adding default_delivery_charges to store_settings...');
  try {
    await query(`
      ALTER TABLE store_settings
      ADD COLUMN IF NOT EXISTS default_delivery_charges DECIMAL(10,2) NOT NULL DEFAULT 0
    `);
    console.log('✓ Column added successfully');
  } catch (err) {
    if (err.message && err.message.includes('Duplicate column')) {
      console.log('✓ Column already exists, skipping');
    } else {
      console.error('Migration failed:', err.message);
      process.exit(1);
    }
  }
  process.exit(0);
}

migrate();
