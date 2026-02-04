// Migration script to add new tables for Priority 1 features
// Run: node migrate_new_tables.js

require('dotenv').config();
const { query } = require('./config/database');

async function migrate() {
  console.log('Creating new tables...\n');

  try {
    await query(`CREATE TABLE IF NOT EXISTS audit_logs (
      log_id INT PRIMARY KEY AUTO_INCREMENT,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50),
      entity_id INT,
      user_id INT,
      user_name VARCHAR(100),
      details TEXT,
      ip_address VARCHAR(45),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      INDEX idx_audit_action (action),
      INDEX idx_audit_entity (entity_type, entity_id),
      INDEX idx_audit_created (created_at)
    )`);
    console.log('+ audit_logs table created');

    await query(`CREATE TABLE IF NOT EXISTS cash_registers (
      register_id INT PRIMARY KEY AUTO_INCREMENT,
      opened_by INT NOT NULL,
      closed_by INT,
      opening_balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
      closing_balance DECIMAL(10, 2),
      expected_balance DECIMAL(10, 2),
      cash_sales_total DECIMAL(10, 2) DEFAULT 0,
      card_sales_total DECIMAL(10, 2) DEFAULT 0,
      total_cash_in DECIMAL(10, 2) DEFAULT 0,
      total_cash_out DECIMAL(10, 2) DEFAULT 0,
      difference DECIMAL(10, 2),
      status ENUM('open', 'closed') DEFAULT 'open',
      opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      closed_at TIMESTAMP NULL,
      close_note TEXT,
      FOREIGN KEY (opened_by) REFERENCES users(user_id),
      INDEX idx_register_status (status)
    )`);
    console.log('+ cash_registers table created');

    await query(`CREATE TABLE IF NOT EXISTS cash_movements (
      movement_id INT PRIMARY KEY AUTO_INCREMENT,
      register_id INT NOT NULL,
      type ENUM('cash_in', 'cash_out') NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      reason VARCHAR(255) NOT NULL,
      user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (register_id) REFERENCES cash_registers(register_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id)
    )`);
    console.log('+ cash_movements table created');

    await query(`CREATE TABLE IF NOT EXISTS returns (
      return_id INT PRIMARY KEY AUTO_INCREMENT,
      sale_id INT NOT NULL,
      user_id INT NOT NULL,
      return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      return_type ENUM('return', 'exchange') NOT NULL DEFAULT 'return',
      reason ENUM('defective', 'wrong_item', 'customer_change', 'expired', 'other') NOT NULL,
      reason_note TEXT,
      refund_method ENUM('cash', 'card', 'store_credit', 'original') NOT NULL DEFAULT 'original',
      total_refund_amount DECIMAL(10, 2) NOT NULL,
      exchange_sale_id INT,
      status ENUM('completed', 'pending') DEFAULT 'completed',
      FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      INDEX idx_return_sale (sale_id)
    )`);
    console.log('+ returns table created');

    await query(`CREATE TABLE IF NOT EXISTS return_details (
      return_detail_id INT PRIMARY KEY AUTO_INCREMENT,
      return_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity_returned INT NOT NULL,
      unit_price DECIMAL(10, 2) NOT NULL,
      refund_amount DECIMAL(10, 2) NOT NULL,
      FOREIGN KEY (return_id) REFERENCES returns(return_id),
      FOREIGN KEY (product_id) REFERENCES products(product_id)
    )`);
    console.log('+ return_details table created');

    await query(`CREATE TABLE IF NOT EXISTS backups (
      backup_id INT PRIMARY KEY AUTO_INCREMENT,
      filename VARCHAR(255) NOT NULL,
      file_size BIGINT,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      type ENUM('manual', 'scheduled') DEFAULT 'manual',
      status ENUM('completed', 'failed') DEFAULT 'completed',
      FOREIGN KEY (created_by) REFERENCES users(user_id)
    )`);
    console.log('+ backups table created');

    console.log('\nAll tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
