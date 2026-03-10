const { query } = require('../config/database');

async function migrate() {
  try {
    await query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS view_completed_orders_password VARCHAR(100) NULL DEFAULT NULL`);
    await query(`ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS refund_password VARCHAR(100) NULL DEFAULT NULL`);
    console.log('Migration complete: POS security password columns added');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
