-- AByte POS Database Schema (Reference Only)
-- To setup database, run: npm run seed
-- Last updated: 2026-02-12 (matches production DB)
CREATE DATABASE IF NOT EXISTS abyte_pos;
USE abyte_pos;

-- ============================================================
-- LEVEL 0: No foreign key dependencies
-- ============================================================

-- Roles
CREATE TABLE IF NOT EXISTS roles (
    role_id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

INSERT IGNORE INTO roles (role_name) VALUES ('Admin'), ('Manager'), ('Cashier');

-- Categories
CREATE TABLE IF NOT EXISTS categories (
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(100) NOT NULL UNIQUE
);

-- Variant Types (e.g. Size, Color)
CREATE TABLE IF NOT EXISTS variant_types (
    variant_type_id INT PRIMARY KEY AUTO_INCREMENT,
    variant_name VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
    category_id INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO expense_categories (category_name, description) VALUES
('Rent', 'Store rent and property costs'),
('Utilities', 'Electricity, water, internet'),
('Salaries', 'Employee salaries and wages'),
('Marketing', 'Advertising and promotional expenses'),
('Maintenance', 'Equipment and store maintenance'),
('Supplies', 'Office and store supplies'),
('Other', 'Miscellaneous expenses');

-- ============================================================
-- LEVEL 1: Depends on Level 0
-- ============================================================

-- Users
CREATE TABLE IF NOT EXISTS users (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    role_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
);

-- Variant Values (e.g. Small, Medium, Red, Blue)
CREATE TABLE IF NOT EXISTS variant_values (
    variant_value_id INT PRIMARY KEY AUTO_INCREMENT,
    variant_type_id INT NOT NULL,
    value_name VARCHAR(50) NOT NULL,
    FOREIGN KEY (variant_type_id) REFERENCES variant_types(variant_type_id) ON DELETE CASCADE
);

-- ============================================================
-- LEVEL 2: Depends on Level 1
-- ============================================================

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

-- Products
CREATE TABLE IF NOT EXISTS products (
    product_id INT PRIMARY KEY AUTO_INCREMENT,
    product_name VARCHAR(200) NOT NULL,
    category_id INT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    has_variants TINYINT(1) DEFAULT 0,
    barcode VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id INT PRIMARY KEY AUTO_INCREMENT,
    supplier_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    tax_id VARCHAR(50),
    payment_terms VARCHAR(100),
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_supplier_name (supplier_name),
    INDEX idx_supplier_active (is_active)
);

-- Stores / Branches
CREATE TABLE IF NOT EXISTS stores (
    store_id INT PRIMARY KEY AUTO_INCREMENT,
    store_name VARCHAR(200) NOT NULL,
    store_code VARCHAR(20) NOT NULL UNIQUE,
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    manager_id INT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_store_active (is_active),
    INDEX idx_store_code (store_code)
);

INSERT IGNORE INTO stores (store_id, store_name, store_code, is_active)
VALUES (1, 'Main Store', 'MAIN', 1);

-- Staff / Employees
CREATE TABLE IF NOT EXISTS staff (
    staff_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE,
    employee_id VARCHAR(50) UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    position VARCHAR(100),
    department VARCHAR(100),
    salary DECIMAL(10, 2),
    salary_type ENUM('hourly', 'daily', 'monthly') DEFAULT 'monthly',
    hire_date DATE NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    leave_balance INT DEFAULT 20,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_staff_active (is_active),
    INDEX idx_staff_name (full_name),
    INDEX idx_staff_employee_id (employee_id)
);

-- Staff Loans
CREATE TABLE IF NOT EXISTS staff_loans (
    loan_id INT PRIMARY KEY AUTO_INCREMENT,
    staff_id INT NOT NULL,
    loan_amount DECIMAL(12,2) NOT NULL,
    remaining_balance DECIMAL(12,2) NOT NULL,
    monthly_deduction DECIMAL(12,2) DEFAULT 0,
    loan_date DATE NOT NULL,
    status ENUM('active','completed','cancelled') DEFAULT 'active',
    reason TEXT,
    approved_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
    FOREIGN KEY (approved_by) REFERENCES users(user_id),
    INDEX idx_loan_staff (staff_id),
    INDEX idx_loan_status (status)
);

-- Loan Repayments
CREATE TABLE IF NOT EXISTS loan_repayments (
    repayment_id INT PRIMARY KEY AUTO_INCREMENT,
    loan_id INT NOT NULL,
    staff_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    repayment_date DATE NOT NULL,
    payment_method ENUM('cash','bank_transfer','salary_deduction') DEFAULT 'cash',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loan_id) REFERENCES staff_loans(loan_id),
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
    INDEX idx_repayment_loan (loan_id)
);

-- Salary Increments
CREATE TABLE IF NOT EXISTS salary_increments (
    increment_id INT PRIMARY KEY AUTO_INCREMENT,
    staff_id INT NOT NULL,
    old_salary DECIMAL(10,2) NOT NULL,
    new_salary DECIMAL(10,2) NOT NULL,
    increment_amount DECIMAL(10,2) NOT NULL,
    increment_percentage DECIMAL(5,2),
    effective_date DATE NOT NULL,
    reason VARCHAR(255),
    approved_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
    FOREIGN KEY (approved_by) REFERENCES users(user_id),
    INDEX idx_increment_staff (staff_id)
);

-- Store Settings (single row with setting_id=1)
CREATE TABLE IF NOT EXISTS store_settings (
    setting_id INT PRIMARY KEY AUTO_INCREMENT,
    store_name VARCHAR(255) DEFAULT 'AByte POS Store',
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(100),
    website VARCHAR(100),
    receipt_header TEXT,
    receipt_footer TEXT DEFAULT 'Thank you for shopping with us!',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO store_settings (setting_id, store_name, receipt_footer)
VALUES (1, 'AByte POS Store', 'Thank you for shopping with us!');

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

-- Chat Messages (AI assistant)
CREATE TABLE IF NOT EXISTS chat_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    role ENUM('user', 'assistant') NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    expense_id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category VARCHAR(50),
    expense_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    user_id INT,
    FOREIGN KEY (user_id) REFERENCES users(user_id)
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

-- ============================================================
-- LEVEL 3: Depends on Level 2
-- ============================================================

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

-- Inventory
CREATE TABLE IF NOT EXISTS inventory (
    inventory_id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL UNIQUE,
    available_stock INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);

-- Product Variants (e.g. T-Shirt - Large/Red)
CREATE TABLE IF NOT EXISTS product_variants (
    variant_id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    sku VARCHAR(100) NOT NULL UNIQUE,
    variant_name VARCHAR(200),
    price_adjustment DECIMAL(10, 2) DEFAULT 0.00,
    stock_quantity INT NOT NULL DEFAULT 0,
    barcode VARCHAR(100) UNIQUE,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    INDEX idx_product_variants_product_id (product_id)
);

-- Product Bundles (combo deals)
CREATE TABLE IF NOT EXISTS product_bundles (
    bundle_id INT PRIMARY KEY AUTO_INCREMENT,
    bundle_name VARCHAR(200) NOT NULL,
    description TEXT,
    discount_type ENUM('percentage', 'fixed_price', 'fixed_amount') NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    start_date DATE,
    end_date DATE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_product_bundles_active (is_active)
);

-- Sales
CREATE TABLE IF NOT EXISTS sales (
    sale_id INT PRIMARY KEY AUTO_INCREMENT,
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10, 2) DEFAULT 0.00,
    bundle_discount DECIMAL(10, 2) DEFAULT 0.00,
    bundle_count INT DEFAULT 0,
    net_amount DECIMAL(10, 2) NOT NULL,
    user_id INT NOT NULL,
    customer_id INT DEFAULT 1,
    tax_rate DECIMAL(5, 2) DEFAULT 0.00,
    tax_amount DECIMAL(10, 2) DEFAULT 0.00,
    payment_method VARCHAR(50) DEFAULT 'Cash',
    tax DECIMAL(10, 2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'completed',
    tax_percent DECIMAL(5, 2) DEFAULT 0.00,
    additional_charges_percent DECIMAL(5, 2) DEFAULT 0.00,
    additional_charges_amount DECIMAL(10, 2) DEFAULT 0.00,
    note TEXT,
    amount_paid DECIMAL(10, 2) DEFAULT 0.00,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);

-- Cash Registers
CREATE TABLE IF NOT EXISTS cash_registers (
    register_id INT PRIMARY KEY AUTO_INCREMENT,
    opened_by INT NOT NULL,
    closed_by INT,
    opening_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    closing_balance DECIMAL(10, 2),
    expected_balance DECIMAL(10, 2),
    cash_sales_total DECIMAL(10, 2) DEFAULT 0.00,
    card_sales_total DECIMAL(10, 2) DEFAULT 0.00,
    total_cash_in DECIMAL(10, 2) DEFAULT 0.00,
    total_cash_out DECIMAL(10, 2) DEFAULT 0.00,
    difference DECIMAL(10, 2),
    status ENUM('open', 'closed') DEFAULT 'open',
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    close_note TEXT,
    FOREIGN KEY (opened_by) REFERENCES users(user_id),
    FOREIGN KEY (closed_by) REFERENCES users(user_id),
    INDEX idx_register_status (status)
);

-- Purchase Orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id INT PRIMARY KEY AUTO_INCREMENT,
    po_number VARCHAR(50) NOT NULL UNIQUE,
    supplier_id INT NOT NULL,
    order_date DATE NOT NULL,
    expected_date DATE,
    received_date DATE,
    status ENUM('draft', 'pending', 'received', 'cancelled') DEFAULT 'pending',
    total_amount DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_by INT NOT NULL,
    store_id INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_po_number (po_number),
    INDEX idx_po_status (status),
    INDEX idx_po_supplier (supplier_id),
    INDEX idx_po_store (store_id)
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
    attendance_id INT PRIMARY KEY AUTO_INCREMENT,
    staff_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    check_in TIME,
    check_out TIME,
    status ENUM('present', 'absent', 'half_day', 'leave', 'holiday') DEFAULT 'present',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE CASCADE,
    UNIQUE KEY unique_attendance (staff_id, attendance_date),
    INDEX idx_attendance_date (attendance_date),
    INDEX idx_attendance_staff (staff_id)
);

-- Salary Payments
CREATE TABLE IF NOT EXISTS salary_payments (
    payment_id INT PRIMARY KEY AUTO_INCREMENT,
    staff_id INT NOT NULL,
    payment_date DATE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    deductions DECIMAL(10, 2) DEFAULT 0.00,
    bonuses DECIMAL(10, 2) DEFAULT 0.00,
    net_amount DECIMAL(10, 2) NOT NULL,
    payment_method ENUM('cash', 'bank_transfer', 'cheque') DEFAULT 'bank_transfer',
    notes TEXT,
    paid_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
    FOREIGN KEY (paid_by) REFERENCES users(user_id),
    INDEX idx_payment_date (payment_date),
    INDEX idx_payment_staff (staff_id)
);

-- Stock Alerts
CREATE TABLE IF NOT EXISTS stock_alerts (
    alert_id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    alert_type ENUM('low_stock', 'out_of_stock', 'overstock') NOT NULL,
    threshold_value INT,
    current_stock INT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    INDEX idx_alert_active (is_active),
    INDEX idx_alert_product (product_id)
);

-- Supplier Payments
CREATE TABLE IF NOT EXISTS supplier_payments (
    payment_id INT PRIMARY KEY AUTO_INCREMENT,
    supplier_id INT NOT NULL,
    purchase_order_id INT,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method ENUM('cash', 'bank_transfer', 'cheque', 'credit') DEFAULT 'cash',
    reference_number VARCHAR(100),
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_payment_date (payment_date),
    INDEX idx_payment_supplier (supplier_id)
);

-- Store Inventory (stock per store)
CREATE TABLE IF NOT EXISTS store_inventory (
    store_inventory_id INT PRIMARY KEY AUTO_INCREMENT,
    store_id INT NOT NULL,
    product_id INT NOT NULL,
    available_stock INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(store_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    UNIQUE KEY unique_store_product (store_id, product_id),
    INDEX idx_store_inv_store (store_id),
    INDEX idx_store_inv_product (product_id)
);

-- Daily Sales Summary (materialized for fast analytics)
CREATE TABLE IF NOT EXISTS daily_sales_summary (
    summary_id INT PRIMARY KEY AUTO_INCREMENT,
    summary_date DATE NOT NULL UNIQUE,
    store_id INT DEFAULT 1,
    total_sales DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_transactions INT NOT NULL DEFAULT 0,
    total_items_sold INT NOT NULL DEFAULT 0,
    total_discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    avg_transaction_value DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_summary_date (summary_date),
    INDEX idx_summary_store (store_id)
);

-- Product Performance Metrics
CREATE TABLE IF NOT EXISTS product_metrics (
    metric_id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    metric_date DATE NOT NULL,
    units_sold INT NOT NULL DEFAULT 0,
    revenue DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    profit DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    UNIQUE KEY unique_product_date (product_id, metric_date),
    INDEX idx_metric_date (metric_date),
    INDEX idx_metric_product (product_id)
);

-- Returns
CREATE TABLE IF NOT EXISTS returns (
    return_id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    refund_amount DECIMAL(10, 2) NOT NULL,
    reason TEXT,
    user_id INT,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);

-- ============================================================
-- LEVEL 4: Depends on Level 3
-- ============================================================

-- Variant Combinations (links variants to type+value pairs)
CREATE TABLE IF NOT EXISTS variant_combinations (
    combination_id INT PRIMARY KEY AUTO_INCREMENT,
    variant_id INT NOT NULL,
    variant_value_id INT NOT NULL,
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE,
    FOREIGN KEY (variant_value_id) REFERENCES variant_values(variant_value_id),
    INDEX idx_variant_combinations_variant_id (variant_id)
);

-- Variant Inventory
CREATE TABLE IF NOT EXISTS variant_inventory (
    variant_inventory_id INT PRIMARY KEY AUTO_INCREMENT,
    variant_id INT NOT NULL UNIQUE,
    available_stock INT NOT NULL DEFAULT 0,
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE CASCADE
);

-- Bundle Items (products in a bundle)
CREATE TABLE IF NOT EXISTS bundle_items (
    bundle_item_id INT PRIMARY KEY AUTO_INCREMENT,
    bundle_id INT NOT NULL,
    product_id INT NOT NULL,
    variant_id INT,
    quantity_required INT NOT NULL DEFAULT 1,
    FOREIGN KEY (bundle_id) REFERENCES product_bundles(bundle_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (variant_id) REFERENCES product_variants(variant_id) ON DELETE SET NULL,
    INDEX idx_bundle_items_bundle_id (bundle_id),
    INDEX idx_bundle_items_product_id (product_id)
);

-- Sale Details
CREATE TABLE IF NOT EXISTS sale_details (
    sale_detail_id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    variant_id INT,
    variant_name VARCHAR(200),
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    INDEX idx_sale_details_variant_id (variant_id)
);

-- Sale Bundles (bundles applied to a sale)
CREATE TABLE IF NOT EXISTS sale_bundles (
    sale_bundle_id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    bundle_id INT NOT NULL,
    bundle_name VARCHAR(200) NOT NULL,
    discount_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id) ON DELETE CASCADE,
    FOREIGN KEY (bundle_id) REFERENCES product_bundles(bundle_id),
    INDEX idx_sale_bundles_sale_id (sale_id)
);

-- Payments (split payment support)
CREATE TABLE IF NOT EXISTS payments (
    payment_id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    method VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id)
);

-- Return Details
CREATE TABLE IF NOT EXISTS return_details (
    return_detail_id INT PRIMARY KEY AUTO_INCREMENT,
    return_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    refund_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (return_id) REFERENCES returns(return_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
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

-- Purchase Order Items
CREATE TABLE IF NOT EXISTS purchase_order_items (
    po_item_id INT PRIMARY KEY AUTO_INCREMENT,
    po_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity_ordered INT NOT NULL,
    quantity_received INT DEFAULT 0,
    unit_cost DECIMAL(10, 2) NOT NULL,
    total_cost DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (po_id) REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    INDEX idx_po_item_po (po_id),
    INDEX idx_po_item_product (product_id)
);

-- Stock Transfers (between stores)
CREATE TABLE IF NOT EXISTS stock_transfers (
    transfer_id INT PRIMARY KEY AUTO_INCREMENT,
    from_store_id INT NOT NULL,
    to_store_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
    notes TEXT,
    created_by INT NOT NULL,
    FOREIGN KEY (from_store_id) REFERENCES stores(store_id),
    FOREIGN KEY (to_store_id) REFERENCES stores(store_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_transfer_from (from_store_id),
    INDEX idx_transfer_to (to_store_id),
    INDEX idx_transfer_date (transfer_date)
);
