
const { query, pool } = require('./config/database');

async function migrate() {
  try {
    console.log('Starting migration...');

    // 1. Add columns to sales table
    const columns = [
      "ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed'",
      "ADD COLUMN IF NOT EXISTS tax_percent DECIMAL(5,2) DEFAULT 0",
      "ADD COLUMN IF NOT EXISTS additional_charges_percent DECIMAL(5,2) DEFAULT 0",
      "ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0",
      "ADD COLUMN IF NOT EXISTS additional_charges_amount DECIMAL(10,2) DEFAULT 0",
      "ADD COLUMN IF NOT EXISTS note TEXT"
    ];

    for (const col of columns) {
      try {
        await query(`ALTER TABLE sales ${col}`);
        console.log(`Executed: ${col}`);
      } catch (err) {
        // Ignore if column exists (though IF NOT EXISTS handles it in MariaDB 10.2+)
        console.log(`Error or skipped: ${err.message}`);
      }
    }

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    pool.end();
  }
}

migrate();
