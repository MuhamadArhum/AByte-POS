// Migration script for POS module improvements
// Run: node migrate_pos_improvements.js

require('dotenv').config();
const { query } = require('./config/database');

async function migrate() {
  console.log('Running POS improvements migration...\n');

  try {
    // 1. Normalize empty phone_number strings to NULL before adding UNIQUE constraint
    await query(`UPDATE customers SET phone_number = NULL WHERE phone_number = '' OR phone_number = 'N/A'`);
    console.log('+ Normalized empty phone numbers to NULL');

    // 2. Check for duplicate phone numbers and nullify duplicates
    const duplicates = await query(`
      SELECT phone_number, COUNT(*) as cnt FROM customers
      WHERE phone_number IS NOT NULL
      GROUP BY phone_number HAVING cnt > 1
    `);
    if (duplicates.length > 0) {
      console.log(`  Warning: Found ${duplicates.length} duplicate phone numbers. Nullifying extras...`);
      for (const dup of duplicates) {
        const rows = await query(
          'SELECT customer_id FROM customers WHERE phone_number = ? ORDER BY customer_id ASC',
          [dup.phone_number]
        );
        // Keep the first one, nullify the rest
        for (let i = 1; i < rows.length; i++) {
          await query('UPDATE customers SET phone_number = NULL WHERE customer_id = ?', [rows[i].customer_id]);
        }
      }
      console.log('  Duplicates resolved');
    }

    // 3. Add UNIQUE index on phone_number (allow multiple NULLs)
    try {
      await query(`ALTER TABLE customers ADD UNIQUE INDEX idx_customer_phone (phone_number)`);
      console.log('+ UNIQUE constraint added on customers.phone_number');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME' || err.message?.includes('Duplicate key name')) {
        console.log('  UNIQUE index already exists, skipping');
      } else {
        throw err;
      }
    }

    // 4. Create customer_addresses table
    await query(`CREATE TABLE IF NOT EXISTS customer_addresses (
      address_id INT PRIMARY KEY AUTO_INCREMENT,
      customer_id INT NOT NULL,
      address_text TEXT NOT NULL,
      label VARCHAR(50) DEFAULT 'Default',
      is_default TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
      INDEX idx_address_customer (customer_id)
    )`);
    console.log('+ customer_addresses table created');

    console.log('\nPOS improvements migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
