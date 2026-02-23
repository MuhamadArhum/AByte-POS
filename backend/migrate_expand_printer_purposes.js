const { query } = require('./config/database');

async function migrate() {
  try {
    // Change purpose from ENUM to VARCHAR(50) to support more document types
    await query(`ALTER TABLE printers MODIFY COLUMN purpose VARCHAR(50) NOT NULL DEFAULT 'receipt'`);
    console.log('✅ printers.purpose column changed to VARCHAR(50)');
    console.log('✅ New supported purposes: receipt, invoice, quotation, return_receipt, credit_sale, layaway_receipt');
    console.log('✅ Migration complete!');
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      console.error('❌ printers table does not exist. Run migrate_printers_table.js first.');
    } else {
      console.error('❌ Migration error:', err.message);
    }
    process.exit(1);
  }
}

migrate();
