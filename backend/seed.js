const bcrypt = require('bcryptjs');
const mariadb = require('mariadb');
require('dotenv').config();

const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
});

async function setup() {
  let conn;
  try {
    conn = await pool.getConnection();

    // Create database
    await conn.query('CREATE DATABASE IF NOT EXISTS abyte_pos');
    await conn.query('USE abyte_pos');

    // ========== TABLES ==========

    await conn.query(`
      CREATE TABLE IF NOT EXISTS roles (
        role_id INT PRIMARY KEY AUTO_INCREMENT,
        role_name VARCHAR(50) NOT NULL UNIQUE
      )
    `);

    await conn.query(`INSERT IGNORE INTO roles (role_name) VALUES ('Admin'), ('Manager'), ('Cashier')`);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(role_id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS categories (
        category_id INT PRIMARY KEY AUTO_INCREMENT,
        category_name VARCHAR(100) NOT NULL UNIQUE
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS products (
        product_id INT PRIMARY KEY AUTO_INCREMENT,
        product_name VARCHAR(200) NOT NULL,
        category_id INT,
        price DECIMAL(10, 2) NOT NULL,
        stock_quantity INT NOT NULL DEFAULT 0,
        barcode VARCHAR(100) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(category_id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        inventory_id INT PRIMARY KEY AUTO_INCREMENT,
        product_id INT UNIQUE NOT NULL,
        available_stock INT NOT NULL DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(product_id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS customers (
        customer_id INT PRIMARY KEY AUTO_INCREMENT,
        customer_name VARCHAR(100),
        phone_number VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sales (
        sale_id INT PRIMARY KEY AUTO_INCREMENT,
        sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_amount DECIMAL(10, 2) NOT NULL,
        discount DECIMAL(10, 2) DEFAULT 0,
        net_amount DECIMAL(10, 2) NOT NULL,
        user_id INT NOT NULL,
        customer_id INT DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sale_details (
        sale_detail_id INT PRIMARY KEY AUTO_INCREMENT,
        sale_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
        FOREIGN KEY (product_id) REFERENCES products(product_id)
      )
    `);

    // ========== DEFAULT DATA (required for system to work) ==========

    // Walk-in Customer (default, required for POS)
    await conn.query(`INSERT IGNORE INTO customers (customer_id, customer_name, phone_number) VALUES (1, 'Walk-in Customer', 'N/A')`);

    // Default Admin account
    const adminHash = await bcrypt.hash('Admin@123', 10);
    await conn.query(
      `INSERT IGNORE INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)`,
      ['Admin', 'admin@pos.com', adminHash, 1]
    );

    console.log('');
    console.log('  Database setup complete!');
    console.log('  ========================');
    console.log('  Database:  abyte_pos');
    console.log('  Tables:    8 created');
    console.log('');
    console.log('  Default Admin Account:');
    console.log('  Email:     admin@pos.com');
    console.log('  Password:  Admin@123');
    console.log('');
    console.log('  Login and create Manager/Cashier accounts from the Users page.');
    console.log('  Add your products, categories, and customers from the dashboard.');
    console.log('');
  } catch (err) {
    console.error('Setup error:', err);
  } finally {
    if (conn) conn.release();
    await pool.end();
    process.exit(0);
  }
}

setup();
