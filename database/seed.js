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

async function seed() {
  let conn;
  try {
    conn = await pool.getConnection();

    // Create database
    await conn.query('CREATE DATABASE IF NOT EXISTS abyte_pos');
    await conn.query('USE abyte_pos');

    // Create tables
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

    // Seed default customer
    await conn.query(`INSERT IGNORE INTO customers (customer_id, customer_name, phone_number) VALUES (1, 'Walk-in Customer', 'N/A')`);

    // Seed users with proper bcrypt hashes
    const adminHash = await bcrypt.hash('Admin@123', 10);
    const managerHash = await bcrypt.hash('Manager@123', 10);
    const cashierHash = await bcrypt.hash('Cashier@123', 10);

    await conn.query(`INSERT IGNORE INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)`,
      ['Admin', 'admin@pos.com', adminHash, 1]);
    await conn.query(`INSERT IGNORE INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)`,
      ['Manager', 'manager@pos.com', managerHash, 2]);
    await conn.query(`INSERT IGNORE INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)`,
      ['Cashier', 'cashier@pos.com', cashierHash, 3]);

    // Seed categories
    await conn.query(`INSERT IGNORE INTO categories (category_name) VALUES ('General Store'), ('Mobile & Electronics'), ('Pharmacy'), ('Garments')`);

    // Seed products
    const products = [
      ['Basmati Rice 5kg', 1, 850.00, 50, '8901234560001'],
      ['Flour 10kg', 1, 650.00, 40, '8901234560002'],
      ['Sugar 1kg', 1, 150.00, 100, '8901234560003'],
      ['Cooking Oil 1L', 1, 480.00, 60, '8901234560004'],
      ['iPhone 14', 2, 249999.00, 5, '1901234560005'],
      ['Samsung Galaxy S23', 2, 179999.00, 8, '1901234560006'],
      ['USB-C Charger', 2, 1500.00, 30, '1901234560007'],
      ['Wireless Earbuds', 2, 3500.00, 20, '1901234560008'],
      ['Paracetamol 500mg', 3, 50.00, 200, '2901234560009'],
      ['Antibiotics Strip', 3, 350.00, 80, '2901234560010'],
      ['Bandages Pack', 3, 120.00, 150, '2901234560011'],
      ['Cough Syrup', 3, 180.00, 90, '2901234560012'],
      ['Cotton T-Shirt', 4, 799.00, 45, '3901234560013'],
      ['Denim Jeans', 4, 2499.00, 25, '3901234560014'],
      ['Winter Jacket', 4, 4999.00, 15, '3901234560015'],
      ['Sports Shoes', 4, 3499.00, 20, '3901234560016'],
    ];

    for (const p of products) {
      try {
        const result = await conn.query(
          'INSERT IGNORE INTO products (product_name, category_id, price, stock_quantity, barcode) VALUES (?, ?, ?, ?, ?)',
          p
        );
        if (result.affectedRows > 0) {
          await conn.query(
            'INSERT IGNORE INTO inventory (product_id, available_stock) VALUES (?, ?)',
            [Number(result.insertId), p[3]]
          );
        }
      } catch (e) {
        // skip duplicates
      }
    }

    console.log('Database seeded successfully!');
    console.log('Default users:');
    console.log('  Admin:   admin@pos.com   / Admin@123');
    console.log('  Manager: manager@pos.com / Manager@123');
    console.log('  Cashier: cashier@pos.com / Cashier@123');
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    if (conn) conn.release();
    await pool.end();
    process.exit(0);
  }
}

seed();
