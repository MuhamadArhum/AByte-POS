// Full Inventory Module Migration
// Run: node backend/scripts/migrate_inventory_full.js

const { query } = require('../config/database');

async function migrate() {
  console.log('Starting Inventory Full Migration...\n');
  try {

    // 1. Update product_type ENUM to include semi_finished
    await query(`ALTER TABLE products MODIFY COLUMN product_type ENUM('finished_good','raw_material','semi_finished') NOT NULL DEFAULT 'finished_good'`);
    console.log('✓ product_type ENUM updated (added semi_finished)');

    // 2. Sections table
    await query(`
      CREATE TABLE IF NOT EXISTS sections (
        section_id   INT PRIMARY KEY AUTO_INCREMENT,
        section_name VARCHAR(100) NOT NULL,
        description  TEXT,
        is_active    TINYINT DEFAULT 1,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ sections table created');

    // 3. Stock Issues
    await query(`
      CREATE TABLE IF NOT EXISTS stock_issues (
        issue_id     INT PRIMARY KEY AUTO_INCREMENT,
        issue_number VARCHAR(30) NOT NULL UNIQUE,
        section_id   INT NOT NULL,
        issue_date   DATE NOT NULL,
        notes        TEXT,
        status       ENUM('draft','issued') DEFAULT 'issued',
        created_by   INT NOT NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (section_id) REFERENCES sections(section_id),
        FOREIGN KEY (created_by) REFERENCES users(user_id)
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS stock_issue_items (
        item_id    INT PRIMARY KEY AUTO_INCREMENT,
        issue_id   INT NOT NULL,
        product_id INT NOT NULL,
        quantity   DECIMAL(10,3) NOT NULL,
        unit_cost  DECIMAL(10,2) DEFAULT 0,
        FOREIGN KEY (issue_id)   REFERENCES stock_issues(issue_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id)
      )
    `);
    console.log('✓ stock_issues + stock_issue_items tables created');

    // 4. Stock Issue Returns (from sections back to warehouse)
    await query(`
      CREATE TABLE IF NOT EXISTS stock_issue_returns (
        return_id     INT PRIMARY KEY AUTO_INCREMENT,
        return_number VARCHAR(30) NOT NULL UNIQUE,
        section_id    INT NOT NULL,
        return_date   DATE NOT NULL,
        notes         TEXT,
        created_by    INT NOT NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (section_id) REFERENCES sections(section_id),
        FOREIGN KEY (created_by) REFERENCES users(user_id)
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS stock_issue_return_items (
        item_id    INT PRIMARY KEY AUTO_INCREMENT,
        return_id  INT NOT NULL,
        product_id INT NOT NULL,
        quantity   DECIMAL(10,3) NOT NULL,
        FOREIGN KEY (return_id)  REFERENCES stock_issue_returns(return_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id)
      )
    `);
    console.log('✓ stock_issue_returns + stock_issue_return_items tables created');

    // 5. Raw Sales
    await query(`
      CREATE TABLE IF NOT EXISTS raw_sales (
        sale_id       INT PRIMARY KEY AUTO_INCREMENT,
        sale_number   VARCHAR(30) NOT NULL UNIQUE,
        section_id    INT,
        customer_name VARCHAR(100),
        sale_date     DATE NOT NULL,
        total_amount  DECIMAL(10,2) DEFAULT 0,
        notes         TEXT,
        created_by    INT NOT NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (section_id) REFERENCES sections(section_id),
        FOREIGN KEY (created_by) REFERENCES users(user_id)
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS raw_sale_items (
        item_id     INT PRIMARY KEY AUTO_INCREMENT,
        sale_id     INT NOT NULL,
        product_id  INT NOT NULL,
        quantity    DECIMAL(10,3) NOT NULL,
        unit_price  DECIMAL(10,2) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (sale_id)    REFERENCES raw_sales(sale_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id)
      )
    `);
    console.log('✓ raw_sales + raw_sale_items tables created');

    // 6. Purchase Vouchers (Inventory - for receiving goods)
    await query(`
      CREATE TABLE IF NOT EXISTS inv_purchase_vouchers (
        pv_id         INT PRIMARY KEY AUTO_INCREMENT,
        pv_number     VARCHAR(30) NOT NULL UNIQUE,
        po_id         INT,
        supplier_id   INT,
        voucher_date  DATE NOT NULL,
        total_amount  DECIMAL(10,2) DEFAULT 0,
        notes         TEXT,
        created_by    INT NOT NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (po_id)       REFERENCES purchase_orders(po_id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
        FOREIGN KEY (created_by)  REFERENCES users(user_id)
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS inv_purchase_voucher_items (
        item_id           INT PRIMARY KEY AUTO_INCREMENT,
        pv_id             INT NOT NULL,
        product_id        INT NOT NULL,
        quantity_received DECIMAL(10,3) NOT NULL,
        unit_price        DECIMAL(10,2) NOT NULL,
        total_price       DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (pv_id)       REFERENCES inv_purchase_vouchers(pv_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id)  REFERENCES products(product_id)
      )
    `);
    console.log('✓ inv_purchase_vouchers + inv_purchase_voucher_items tables created');

    // 7. Purchase Returns
    await query(`
      CREATE TABLE IF NOT EXISTS purchase_returns (
        pr_id         INT PRIMARY KEY AUTO_INCREMENT,
        pr_number     VARCHAR(30) NOT NULL UNIQUE,
        pv_id         INT,
        supplier_id   INT,
        return_date   DATE NOT NULL,
        total_amount  DECIMAL(10,2) DEFAULT 0,
        notes         TEXT,
        created_by    INT NOT NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pv_id)       REFERENCES inv_purchase_vouchers(pv_id),
        FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
        FOREIGN KEY (created_by)  REFERENCES users(user_id)
      )
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS purchase_return_items (
        item_id           INT PRIMARY KEY AUTO_INCREMENT,
        pr_id             INT NOT NULL,
        product_id        INT NOT NULL,
        quantity_returned DECIMAL(10,3) NOT NULL,
        unit_price        DECIMAL(10,2) NOT NULL,
        total_price       DECIMAL(10,2) NOT NULL,
        FOREIGN KEY (pr_id)      REFERENCES purchase_returns(pr_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id)
      )
    `);
    console.log('✓ purchase_returns + purchase_return_items tables created');

    console.log('\n✅ All migrations completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
