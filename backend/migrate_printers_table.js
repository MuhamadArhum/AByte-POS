const { query } = require('./config/database');

async function migrate() {
  try {
    // Create printers table
    await query(`
      CREATE TABLE IF NOT EXISTS printers (
        printer_id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        type ENUM('network', 'usb') NOT NULL,
        ip_address VARCHAR(100) DEFAULT NULL,
        port INT DEFAULT 9100,
        printer_share_name VARCHAR(255) DEFAULT NULL,
        paper_width INT DEFAULT 80,
        purpose ENUM('receipt', 'invoice', 'quotation') NOT NULL DEFAULT 'receipt',
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ printers table created');

    // Migrate existing single printer from store_settings to printers table
    const rows = await query('SELECT printer_type, printer_ip, printer_port, printer_name, printer_paper_width FROM store_settings WHERE setting_id = 1');
    const s = rows[0];
    if (s && s.printer_type && s.printer_type !== 'none') {
      const existing = await query('SELECT COUNT(*) as cnt FROM printers WHERE purpose = "receipt"');
      if (existing[0].cnt === 0) {
        await query(
          'INSERT INTO printers (name, type, ip_address, port, printer_share_name, paper_width, purpose, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
          ['Receipt Printer', s.printer_type, s.printer_ip || null, s.printer_port || 9100, s.printer_name || null, s.printer_paper_width || 80, 'receipt']
        );
        console.log('✅ Migrated existing printer settings to printers table');
      } else {
        console.log('ℹ️  Receipt printer already exists in printers table, skipping migration');
      }
    }

    console.log('✅ Migration complete!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  }
}

migrate();
