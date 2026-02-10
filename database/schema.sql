-- AByte POS Database Schema (Reference Only)
-- To setup database, run: npm run seed
CREATE DATABASE IF NOT EXISTS abyte_pos;
USE abyte_pos;

-- Roles
CREATE TABLE IF NOT EXISTS roles (
    role_id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

INSERT IGNORE INTO roles (role_name) VALUES ('Admin'), ('Manager'), ('Cashier');

-- Users
CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(100) NOT NULL UNIQUE
);

-- Products
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
);

-- Inventory
CREATE TABLE IF NOT EXISTS inventory (
    inventory_id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT UNIQUE NOT NULL,
    available_stock INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    customer_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_name VARCHAR(100),
    phone_number VARCHAR(20),
    email VARCHAR(150),
    company VARCHAR(150),
    tax_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_customer_phone (phone_number)
);

INSERT IGNORE INTO customers (customer_id, customer_name, phone_number) VALUES (1, 'Walk-in Customer', NULL);

-- Customer Addresses (multiple addresses per customer)
CREATE TABLE IF NOT EXISTS customer_addresses (
    address_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    address_text TEXT NOT NULL,
    label VARCHAR(50) DEFAULT 'Default',
    is_default TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    INDEX idx_address_customer (customer_id)
);

-- Sales
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
);

-- Sale Details
CREATE TABLE IF NOT EXISTS sale_details (
    sale_detail_id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
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
);

-- Cash Registers
CREATE TABLE IF NOT EXISTS cash_registers (
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
    FOREIGN KEY (closed_by) REFERENCES users(user_id),
    INDEX idx_register_status (status)
);

-- Cash Movements
CREATE TABLE IF NOT EXISTS cash_movements (
    movement_id INT PRIMARY KEY AUTO_INCREMENT,
    register_id INT NOT NULL,
    type ENUM('cash_in', 'cash_out') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (register_id) REFERENCES cash_registers(register_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- Returns
CREATE TABLE IF NOT EXISTS returns (
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
);

-- Return Details
CREATE TABLE IF NOT EXISTS return_details (
    return_detail_id INT PRIMARY KEY AUTO_INCREMENT,
    return_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity_returned INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    refund_amount DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (return_id) REFERENCES returns(return_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Store Settings (single row with setting_id=1)
CREATE TABLE IF NOT EXISTS store_settings (
    setting_id INT PRIMARY KEY AUTO_INCREMENT,
    store_name VARCHAR(200) NOT NULL DEFAULT 'AByte POS',
    address TEXT,
    phone VARCHAR(30),
    email VARCHAR(150),
    website VARCHAR(200),
    receipt_footer TEXT DEFAULT 'Thank you for your purchase!',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO store_settings (setting_id, store_name, receipt_footer)
VALUES (1, 'AByte POS', 'Thank you for your purchase!');

-- Backups
CREATE TABLE IF NOT EXISTS backups (
    backup_id INT PRIMARY KEY AUTO_INCREMENT,
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    type ENUM('manual', 'scheduled') DEFAULT 'manual',
    status ENUM('completed', 'failed') DEFAULT 'completed',
    FOREIGN KEY (created_by) REFERENCES users(user_id)
);
