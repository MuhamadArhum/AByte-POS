const { query } = require('./config/database');

async function migrate() {
  console.log('Adding printer settings columns to store_settings...');

  const columns = [
    { name: 'printer_type', sql: "ALTER TABLE store_settings ADD COLUMN printer_type ENUM('none','network','usb') DEFAULT 'none'" },
    { name: 'printer_ip', sql: "ALTER TABLE store_settings ADD COLUMN printer_ip VARCHAR(100) DEFAULT NULL" },
    { name: 'printer_port', sql: "ALTER TABLE store_settings ADD COLUMN printer_port INT DEFAULT 9100" },
    { name: 'printer_name', sql: "ALTER TABLE store_settings ADD COLUMN printer_name VARCHAR(255) DEFAULT NULL" },
    { name: 'printer_paper_width', sql: "ALTER TABLE store_settings ADD COLUMN printer_paper_width INT DEFAULT 80" },
  ];

  for (const col of columns) {
    try {
      await query(col.sql);
      console.log(`  Added column: ${col.name}`);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log(`  Column ${col.name} already exists, skipping`);
      } else {
        console.error(`  Error adding ${col.name}:`, err.message);
      }
    }
  }

  console.log('Printer settings migration complete!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
