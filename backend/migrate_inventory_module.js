const { query } = require('./config/database');

async function migrate() {
  console.log('Starting Inventory Module migration...\n');

  // 1. Create stock_adjustments table
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS stock_adjustments (
        adjustment_id INT PRIMARY KEY AUTO_INCREMENT,
        product_id INT NOT NULL,
        variant_id INT NULL,
        store_id INT DEFAULT 1,
        adjustment_type ENUM('addition','subtraction','correction','damage','theft','return','opening_stock','expired') NOT NULL,
        quantity_before INT NOT NULL,
        quantity_adjusted INT NOT NULL,
        quantity_after INT NOT NULL,
        reason TEXT,
        reference_number VARCHAR(100),
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(product_id),
        FOREIGN KEY (created_by) REFERENCES users(user_id),
        INDEX idx_adj_product (product_id),
        INDEX idx_adj_type (adjustment_type),
        INDEX idx_adj_date (created_at)
      )
    `);
    console.log('Created stock_adjustments table');
  } catch (err) {
    if (err.code === 'ER_TABLE_EXISTS_ERROR') {
      console.log('stock_adjustments table already exists');
    } else {
      console.error('Error creating stock_adjustments:', err.message);
    }
  }

  // 2. Add columns to categories table
  const categoryColumns = [
    { name: 'description', sql: 'ALTER TABLE categories ADD COLUMN description TEXT' },
    { name: 'is_active', sql: 'ALTER TABLE categories ADD COLUMN is_active TINYINT(1) DEFAULT 1' },
    { name: 'created_at', sql: 'ALTER TABLE categories ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
  ];

  for (const col of categoryColumns) {
    try {
      await query(col.sql);
      console.log(`Added categories.${col.name}`);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log(`categories.${col.name} already exists`);
      } else {
        console.error(`Error adding categories.${col.name}:`, err.message);
      }
    }
  }

  console.log('\nInventory Module migration completed!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
