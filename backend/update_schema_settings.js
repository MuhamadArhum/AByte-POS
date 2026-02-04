const { pool } = require('./config/database');

async function updateSchema() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log('Connected to database...');

    // Create store_settings table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS store_settings (
        setting_id INT PRIMARY KEY AUTO_INCREMENT,
        store_name VARCHAR(255) DEFAULT 'AByte POS Store',
        address TEXT,
        phone VARCHAR(50),
        email VARCHAR(100),
        website VARCHAR(100),
        receipt_header TEXT,
        receipt_footer TEXT DEFAULT 'Thank you for shopping with us!',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Insert default row if not exists
    await conn.query(`
      INSERT IGNORE INTO store_settings (setting_id, store_name, address, phone, receipt_footer) 
      VALUES (1, 'AByte POS Store', '123 Main St, City', '123-456-7890', 'Thank you for shopping with us!')
    `);

    console.log('Schema updated successfully: store_settings table created.');

  } catch (err) {
    console.error('Schema update failed:', err);
  } finally {
    if (conn) conn.release();
    process.exit();
  }
}

updateSchema();
