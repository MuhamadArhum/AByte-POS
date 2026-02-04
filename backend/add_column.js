
const { query, pool } = require('./config/database');

async function addAmountPaidColumn() {
  try {
    console.log('Adding amount_paid column to sales table...');
    await query("ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0");
    console.log('Column amount_paid added successfully.');
  } catch (err) {
    console.error('Failed to add column:', err);
  } finally {
    pool.end();
  }
}

addAmountPaidColumn();
