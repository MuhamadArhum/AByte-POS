const { query } = require('../config/database');

async function migrate() {
  console.log('Running stock valuation migration...');

  await query('ALTER TABLE inventory ADD COLUMN IF NOT EXISTS avg_cost DECIMAL(15,4) NOT NULL DEFAULT 0');
  console.log('+ avg_cost added to inventory');

  await query(`CREATE TABLE IF NOT EXISTS stock_layers (
    layer_id   INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    pv_id      INT NULL,
    source_type ENUM('purchase','opening','adjustment') NOT NULL DEFAULT 'purchase',
    ref_date   DATE NOT NULL,
    qty_original  DECIMAL(15,3) NOT NULL,
    qty_remaining DECIMAL(15,3) NOT NULL,
    unit_cost     DECIMAL(15,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_product (product_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('+ stock_layers table created');

  await query(`CREATE TABLE IF NOT EXISTS opening_stock_entries (
    entry_id   INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    quantity   DECIMAL(15,3) NOT NULL,
    unit_cost  DECIMAL(15,4) NOT NULL DEFAULT 0,
    entry_date DATE NOT NULL,
    notes      VARCHAR(255),
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('+ opening_stock_entries table created');

  // Init avg_cost from cost_price for existing products
  await query(`UPDATE inventory i
    JOIN products p ON i.product_id = p.product_id
    SET i.avg_cost = COALESCE(p.cost_price, 0)
    WHERE i.avg_cost = 0 AND p.cost_price > 0`);
  console.log('+ avg_cost initialized from cost_price');

  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
