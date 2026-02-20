const { getConnection } = require('./config/database');

async function migrate() {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`
      CREATE TABLE IF NOT EXISTS price_rules (
        rule_id INT PRIMARY KEY AUTO_INCREMENT,
        rule_name VARCHAR(200) NOT NULL,
        rule_type ENUM('buy_x_get_y', 'quantity_discount', 'time_based', 'category_discount') NOT NULL,
        description TEXT,
        is_active TINYINT(1) DEFAULT 1,
        priority INT DEFAULT 0,
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        min_quantity INT DEFAULT 1,
        buy_quantity INT NULL,
        get_quantity INT NULL,
        discount_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
        discount_value DECIMAL(10,2) NOT NULL,
        max_uses INT NULL,
        used_count INT DEFAULT 0,
        applies_to ENUM('all', 'product', 'category') DEFAULT 'all',
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(user_id),
        INDEX idx_pr_active (is_active),
        INDEX idx_pr_dates (start_date, end_date),
        INDEX idx_pr_type (rule_type)
      )
    `);
    console.log('Created price_rules table');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS price_rule_products (
        id INT PRIMARY KEY AUTO_INCREMENT,
        rule_id INT NOT NULL,
        product_id INT NULL,
        category_id INT NULL,
        FOREIGN KEY (rule_id) REFERENCES price_rules(rule_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id),
        FOREIGN KEY (category_id) REFERENCES categories(category_id)
      )
    `);
    console.log('Created price_rule_products table');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS price_rule_usage (
        usage_id INT PRIMARY KEY AUTO_INCREMENT,
        rule_id INT NOT NULL,
        sale_id INT NOT NULL,
        discount_applied DECIMAL(10,2) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rule_id) REFERENCES price_rules(rule_id),
        FOREIGN KEY (sale_id) REFERENCES sales(sale_id)
      )
    `);
    console.log('Created price_rule_usage table');

    await conn.commit();
    console.log('\nPrice rules migration completed successfully!');
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed:', err);
  } finally {
    conn.release();
    process.exit();
  }
}

migrate();
