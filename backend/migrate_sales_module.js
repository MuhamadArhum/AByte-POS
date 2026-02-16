const { getConnection } = require('./config/database');

async function migrate() {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // 1. Coupons
    await conn.query(`
      CREATE TABLE IF NOT EXISTS coupons (
        coupon_id INT PRIMARY KEY AUTO_INCREMENT,
        code VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(255),
        discount_type ENUM('percentage', 'fixed') NOT NULL,
        discount_value DECIMAL(10,2) NOT NULL,
        min_purchase DECIMAL(10,2) DEFAULT 0,
        max_discount DECIMAL(10,2) NULL,
        usage_limit INT DEFAULT NULL,
        used_count INT DEFAULT 0,
        valid_from DATE NOT NULL,
        valid_until DATE NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(user_id),
        INDEX idx_coupon_code (code),
        INDEX idx_coupon_active (is_active)
      )
    `);
    console.log('Created coupons table');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS coupon_redemptions (
        redemption_id INT PRIMARY KEY AUTO_INCREMENT,
        coupon_id INT NOT NULL,
        sale_id INT NOT NULL,
        discount_applied DECIMAL(10,2) NOT NULL,
        redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (coupon_id) REFERENCES coupons(coupon_id),
        FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
        INDEX idx_redemption_coupon (coupon_id)
      )
    `);
    console.log('Created coupon_redemptions table');

    // 2. Quotations
    await conn.query(`
      CREATE TABLE IF NOT EXISTS quotations (
        quotation_id INT PRIMARY KEY AUTO_INCREMENT,
        quotation_number VARCHAR(50) NOT NULL UNIQUE,
        customer_id INT NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        discount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        status ENUM('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted') DEFAULT 'draft',
        valid_until DATE,
        notes TEXT,
        converted_sale_id INT NULL,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
        FOREIGN KEY (created_by) REFERENCES users(user_id),
        INDEX idx_quotation_status (status),
        INDEX idx_quotation_customer (customer_id)
      )
    `);
    console.log('Created quotations table');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS quotation_items (
        item_id INT PRIMARY KEY AUTO_INCREMENT,
        quotation_id INT NOT NULL,
        product_id INT NOT NULL,
        variant_id INT NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (quotation_id) REFERENCES quotations(quotation_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id)
      )
    `);
    console.log('Created quotation_items table');

    // 3. Credit Sales
    await conn.query(`
      CREATE TABLE IF NOT EXISTS credit_sales (
        credit_sale_id INT PRIMARY KEY AUTO_INCREMENT,
        sale_id INT NOT NULL,
        customer_id INT NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        paid_amount DECIMAL(10,2) DEFAULT 0,
        balance_due DECIMAL(10,2) NOT NULL,
        due_date DATE NOT NULL,
        status ENUM('pending', 'partial', 'paid', 'overdue') DEFAULT 'pending',
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
        FOREIGN KEY (created_by) REFERENCES users(user_id),
        INDEX idx_credit_status (status),
        INDEX idx_credit_customer (customer_id)
      )
    `);
    console.log('Created credit_sales table');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS credit_payments (
        payment_id INT PRIMARY KEY AUTO_INCREMENT,
        credit_sale_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
        received_by INT,
        notes TEXT,
        payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (credit_sale_id) REFERENCES credit_sales(credit_sale_id),
        FOREIGN KEY (received_by) REFERENCES users(user_id)
      )
    `);
    console.log('Created credit_payments table');

    // 4. Layaway
    await conn.query(`
      CREATE TABLE IF NOT EXISTS layaway_orders (
        layaway_id INT PRIMARY KEY AUTO_INCREMENT,
        layaway_number VARCHAR(50) NOT NULL UNIQUE,
        customer_id INT NOT NULL,
        subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
        tax_amount DECIMAL(10,2) DEFAULT 0,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        deposit_amount DECIMAL(10,2) DEFAULT 0,
        paid_amount DECIMAL(10,2) DEFAULT 0,
        balance_due DECIMAL(10,2) NOT NULL DEFAULT 0,
        expiry_date DATE,
        converted_sale_id INT NULL,
        status ENUM('active', 'completed', 'cancelled', 'expired') DEFAULT 'active',
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
        FOREIGN KEY (created_by) REFERENCES users(user_id),
        INDEX idx_layaway_status (status),
        INDEX idx_layaway_customer (customer_id)
      )
    `);
    console.log('Created layaway_orders table');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS layaway_items (
        item_id INT PRIMARY KEY AUTO_INCREMENT,
        layaway_id INT NOT NULL,
        product_id INT NOT NULL,
        variant_id INT NULL,
        quantity INT NOT NULL DEFAULT 1,
        unit_price DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (layaway_id) REFERENCES layaway_orders(layaway_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id)
      )
    `);
    console.log('Created layaway_items table');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS layaway_payments (
        payment_id INT PRIMARY KEY AUTO_INCREMENT,
        layaway_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
        received_by INT,
        notes TEXT,
        payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (layaway_id) REFERENCES layaway_orders(layaway_id),
        FOREIGN KEY (received_by) REFERENCES users(user_id)
      )
    `);
    console.log('Created layaway_payments table');

    // 5. Loyalty
    await conn.query(`
      CREATE TABLE IF NOT EXISTS loyalty_config (
        config_id INT PRIMARY KEY AUTO_INCREMENT,
        points_per_amount DECIMAL(10,2) DEFAULT 1,
        amount_per_point DECIMAL(10,2) DEFAULT 100,
        min_redeem_points INT DEFAULT 100,
        is_active TINYINT(1) DEFAULT 0
      )
    `);
    console.log('Created loyalty_config table');

    // Insert default config if empty
    const [existing] = await conn.query('SELECT COUNT(*) as cnt FROM loyalty_config');
    if (existing.cnt === 0) {
      await conn.query('INSERT INTO loyalty_config (points_per_amount, amount_per_point, min_redeem_points, is_active) VALUES (1, 100, 100, 0)');
      console.log('Inserted default loyalty config');
    }

    await conn.query(`
      CREATE TABLE IF NOT EXISTS loyalty_transactions (
        transaction_id INT PRIMARY KEY AUTO_INCREMENT,
        customer_id INT NOT NULL,
        sale_id INT NULL,
        points INT NOT NULL,
        balance_after INT NOT NULL DEFAULT 0,
        type ENUM('earn', 'redeem', 'adjust', 'expire') NOT NULL,
        description VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
        INDEX idx_loyalty_customer (customer_id),
        INDEX idx_loyalty_type (type)
      )
    `);
    console.log('Created loyalty_transactions table');

    // 6. ALTER existing tables (idempotent)
    const addColumnIfNotExists = async (table, column, definition) => {
      const cols = await conn.query(`SHOW COLUMNS FROM ${table} LIKE '${column}'`);
      if (cols.length === 0) {
        await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`Added ${column} to ${table}`);
      }
    };

    await addColumnIfNotExists('customers', 'loyalty_points', 'INT DEFAULT 0');
    await addColumnIfNotExists('sales', 'coupon_id', 'INT NULL');
    await addColumnIfNotExists('sales', 'coupon_discount', 'DECIMAL(10,2) DEFAULT 0');
    await addColumnIfNotExists('sales', 'loyalty_points_earned', 'INT DEFAULT 0');
    await addColumnIfNotExists('sales', 'loyalty_points_redeemed', 'INT DEFAULT 0');

    await conn.commit();
    console.log('\nSales module migration completed successfully!');
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed:', err);
  } finally {
    conn.release();
    process.exit();
  }
}

migrate();
