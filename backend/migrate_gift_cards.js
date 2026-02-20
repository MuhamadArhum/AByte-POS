const { getConnection } = require('./config/database');

async function migrate() {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`
      CREATE TABLE IF NOT EXISTS gift_cards (
        card_id INT PRIMARY KEY AUTO_INCREMENT,
        card_number VARCHAR(50) NOT NULL UNIQUE,
        initial_balance DECIMAL(10,2) NOT NULL,
        current_balance DECIMAL(10,2) NOT NULL,
        status ENUM('active', 'depleted', 'expired', 'disabled') DEFAULT 'active',
        customer_id INT NULL,
        expiry_date DATE NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
        FOREIGN KEY (created_by) REFERENCES users(user_id),
        INDEX idx_gc_number (card_number),
        INDEX idx_gc_status (status)
      )
    `);
    console.log('Created gift_cards table');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS gift_card_transactions (
        transaction_id INT PRIMARY KEY AUTO_INCREMENT,
        card_id INT NOT NULL,
        sale_id INT NULL,
        amount DECIMAL(10,2) NOT NULL,
        balance_after DECIMAL(10,2) NOT NULL,
        type ENUM('load', 'redeem', 'refund', 'adjust') NOT NULL,
        description VARCHAR(255),
        processed_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (card_id) REFERENCES gift_cards(card_id),
        FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
        FOREIGN KEY (processed_by) REFERENCES users(user_id),
        INDEX idx_gct_card (card_id),
        INDEX idx_gct_type (type)
      )
    `);
    console.log('Created gift_card_transactions table');

    // Add gift card column to sales
    const addColumnIfNotExists = async (table, column, definition) => {
      const cols = await conn.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
      if (cols.length === 0) {
        await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`Added ${column} to ${table}`);
      }
    };

    await addColumnIfNotExists('sales', 'gift_card_amount', 'DECIMAL(10,2) DEFAULT 0');

    await conn.commit();
    console.log('\nGift cards migration completed successfully!');
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed:', err);
  } finally {
    conn.release();
    process.exit();
  }
}

migrate();
