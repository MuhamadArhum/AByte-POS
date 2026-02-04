const mariadb = require('mariadb');
require('dotenv').config();

async function updateSchema() {
  const pool = mariadb.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'abyte_pos',
    multipleStatements: true,
  });

  let conn;
  try {
    conn = await pool.getConnection();
    console.log('Connected to database...');

    // Add payment_method and amount_paid to sales table if they don't exist
    // Using simple ALTER TABLE. If they exist, it might error, but we can wrap in try-catch or check information_schema.
    // However, simplest way for now is to just try adding them.
    
    try {
        await conn.query(`
            ALTER TABLE sales 
            ADD COLUMN payment_method VARCHAR(50) DEFAULT 'cash',
            ADD COLUMN amount_paid DECIMAL(10, 2) DEFAULT 0
        `);
        console.log('Columns added successfully.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('Columns already exist.');
        } else {
            throw e;
        }
    }

  } catch (err) {
    console.error('Schema update failed:', err);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

updateSchema();
