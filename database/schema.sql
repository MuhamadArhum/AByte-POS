-- AByte POS Database Schema (Reference Only)
-- To setup database, run: npm run seed
-- Last updated: 2026-02-24 (matches production DB)
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
    UNIQUE INDEX idx_customer_phone (phone_number),
    INDEX idx_customer_name (customer_name),
    FULLTEXT INDEX idx_customer_search (customer_name)
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
    FOREIGN KEY (category_id) REFERENCES categories(category_id),
    INDEX idx_product_name (product_name),
    INDEX idx_product_category (category_id),
    FULLTEXT INDEX idx_product_search (product_name)
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

-- Advance Payments (advance salary)
CREATE TABLE IF NOT EXISTS advance_payments (
    advance_id INT PRIMARY KEY AUTO_INCREMENT,
    staff_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method ENUM('cash','bank_transfer','cheque') DEFAULT 'cash',
    reason TEXT,
    paid_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
    FOREIGN KEY (paid_by) REFERENCES users(user_id),
    INDEX idx_advance_staff (staff_id),
    INDEX idx_advance_date (payment_date)
);

-- Holidays
CREATE TABLE IF NOT EXISTS holidays (
    holiday_id INT PRIMARY KEY AUTO_INCREMENT,
    holiday_date DATE NOT NULL,
    holiday_name VARCHAR(200) NOT NULL,
    description TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_holiday_date (holiday_date)
);

-- Leave Requests
CREATE TABLE IF NOT EXISTS leave_requests (
    request_id INT PRIMARY KEY AUTO_INCREMENT,
    staff_id INT NOT NULL,
    leave_type ENUM('annual','sick','emergency','unpaid','other') DEFAULT 'annual',
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    days INT NOT NULL,
    reason TEXT,
    status ENUM('pending','approved','rejected') DEFAULT 'pending',
    review_notes TEXT,
    requested_by INT,
    reviewed_by INT,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
    FOREIGN KEY (requested_by) REFERENCES users(user_id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_leave_staff (staff_id),
    INDEX idx_leave_status (status),
    INDEX idx_leave_dates (from_date, to_date)
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
    tax_rate DECIMAL(5,2) DEFAULT 0,
    currency_symbol VARCHAR(10) DEFAULT 'Rs.',
    receipt_logo TEXT,
    low_stock_threshold INT DEFAULT 10,
    default_payment_method ENUM('cash','card','online') DEFAULT 'cash',
    auto_print_receipt TINYINT(1) DEFAULT 0,
    barcode_prefix VARCHAR(10) DEFAULT '',
    invoice_prefix VARCHAR(20) DEFAULT 'INV-',
    date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
    timezone VARCHAR(50) DEFAULT 'Asia/Karachi',
    business_hours_open TIME DEFAULT '09:00:00',
    business_hours_close TIME DEFAULT '21:00:00',
    allow_negative_stock TINYINT(1) DEFAULT 0,
    discount_requires_approval TINYINT(1) DEFAULT 0,
    max_cashier_discount DECIMAL(5,2) DEFAULT 50.00,
    session_timeout_minutes INT DEFAULT 480,
    receipt_show_store_name TINYINT(1) DEFAULT 1,
    receipt_show_address TINYINT(1) DEFAULT 1,
    receipt_show_phone TINYINT(1) DEFAULT 1,
    receipt_show_tax TINYINT(1) DEFAULT 1,
    receipt_paper_width ENUM('58mm','80mm') DEFAULT '80mm',
    printer_type ENUM('none','network','usb') DEFAULT 'none',
    printer_ip VARCHAR(100) DEFAULT NULL,
    printer_port INT DEFAULT 9100,
    printer_name VARCHAR(255) DEFAULT NULL,
    printer_paper_width INT DEFAULT 80,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO store_settings (setting_id, store_name, receipt_footer)
VALUES (1, 'AByte POS Store', 'Thank you for shopping with us!');

-- Printers (multi-printer support)
CREATE TABLE IF NOT EXISTS printers (
    printer_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    type ENUM('network','usb') NOT NULL,
    ip_address VARCHAR(100) DEFAULT NULL,
    port INT DEFAULT 9100,
    printer_share_name VARCHAR(255) DEFAULT NULL,
    paper_width INT DEFAULT 80,
    purpose VARCHAR(50) NOT NULL DEFAULT 'receipt',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

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


-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
    expense_id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category VARCHAR(50),
    expense_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    user_id INT,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_expense_date (expense_date),
    INDEX idx_expense_category (category)
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
-- ACCOUNTING MODULE
-- ============================================================

-- Account Groups (asset, liability, equity, revenue, expense)
CREATE TABLE IF NOT EXISTS account_groups (
    group_id INT PRIMARY KEY AUTO_INCREMENT,
    group_name VARCHAR(100) NOT NULL,
    group_type ENUM('asset','liability','equity','revenue','expense') NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_group_type (group_type)
);

INSERT IGNORE INTO account_groups (group_id, group_name, group_type, description) VALUES
(1, 'Current Assets', 'asset', 'Cash, inventory, accounts receivable'),
(2, 'Fixed Assets', 'asset', 'Property, equipment, vehicles'),
(3, 'Current Liabilities', 'liability', 'Accounts payable, short-term loans'),
(4, 'Long-term Liabilities', 'liability', 'Long-term loans, mortgages'),
(5, 'Equity', 'equity', 'Owner equity, retained earnings'),
(6, 'Sales Revenue', 'revenue', 'Product and service sales'),
(7, 'Other Revenue', 'revenue', 'Interest, gains'),
(8, 'Cost of Goods Sold', 'expense', 'Direct costs'),
(9, 'Operating Expenses', 'expense', 'Salaries, rent, utilities'),
(10, 'Other Expenses', 'expense', 'Interest, losses');

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS accounts (
    account_id INT PRIMARY KEY AUTO_INCREMENT,
    account_code VARCHAR(20) NOT NULL UNIQUE,
    account_name VARCHAR(200) NOT NULL,
    group_id INT NOT NULL,
    parent_account_id INT NULL,
    account_type ENUM('asset','liability','equity','revenue','expense') NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    opening_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES account_groups(group_id),
    FOREIGN KEY (parent_account_id) REFERENCES accounts(account_id) ON DELETE SET NULL,
    INDEX idx_account_code (account_code),
    INDEX idx_account_type (account_type),
    INDEX idx_active (is_active)
);

INSERT IGNORE INTO accounts (account_code, account_name, group_id, account_type, opening_balance) VALUES
('1001', 'Cash in Hand', 1, 'asset', 0),
('1002', 'Cash at Bank', 1, 'asset', 0),
('1003', 'Accounts Receivable', 1, 'asset', 0),
('1004', 'Inventory', 1, 'asset', 0),
('1101', 'Furniture & Fixtures', 2, 'asset', 0),
('1102', 'Equipment', 2, 'asset', 0),
('2001', 'Accounts Payable', 3, 'liability', 0),
('2002', 'Short-term Loans', 3, 'liability', 0),
('3001', 'Owner Capital', 5, 'equity', 0),
('3002', 'Retained Earnings', 5, 'equity', 0),
('4001', 'Product Sales', 6, 'revenue', 0),
('4002', 'Service Revenue', 6, 'revenue', 0),
('5001', 'Cost of Goods Sold', 8, 'expense', 0),
('6001', 'Salaries Expense', 9, 'expense', 0),
('6002', 'Rent Expense', 9, 'expense', 0),
('6003', 'Utilities Expense', 9, 'expense', 0),
('6004', 'Office Supplies', 9, 'expense', 0);

-- Journal Entries (double-entry accounting)
CREATE TABLE IF NOT EXISTS journal_entries (
    entry_id INT PRIMARY KEY AUTO_INCREMENT,
    entry_number VARCHAR(50) NOT NULL UNIQUE,
    entry_date DATE NOT NULL,
    reference_type VARCHAR(50) NULL,
    reference_id INT NULL,
    description TEXT,
    total_debit DECIMAL(15,2) NOT NULL,
    total_credit DECIMAL(15,2) NOT NULL,
    status ENUM('draft','posted','reversed') DEFAULT 'draft',
    created_by INT NOT NULL,
    posted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_entry_date (entry_date),
    INDEX idx_status (status),
    INDEX idx_reference (reference_type, reference_id)
);

-- Journal Entry Lines
CREATE TABLE IF NOT EXISTS journal_entry_lines (
    line_id INT PRIMARY KEY AUTO_INCREMENT,
    entry_id INT NOT NULL,
    account_id INT NOT NULL,
    description TEXT,
    debit DECIMAL(15,2) DEFAULT 0,
    credit DECIMAL(15,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (entry_id) REFERENCES journal_entries(entry_id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id),
    INDEX idx_entry (entry_id),
    INDEX idx_account (account_id)
);

-- Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
    bank_account_id INT PRIMARY KEY AUTO_INCREMENT,
    account_id INT NOT NULL,
    bank_name VARCHAR(200) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    account_holder VARCHAR(200),
    branch VARCHAR(200),
    ifsc_code VARCHAR(20),
    opening_balance DECIMAL(15,2) DEFAULT 0,
    current_balance DECIMAL(15,2) DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id),
    INDEX idx_active (is_active)
);

-- Payment Vouchers
CREATE TABLE IF NOT EXISTS payment_vouchers (
    voucher_id INT PRIMARY KEY AUTO_INCREMENT,
    voucher_number VARCHAR(50) NOT NULL UNIQUE,
    voucher_date DATE NOT NULL,
    payment_to VARCHAR(200) NOT NULL,
    payment_type ENUM('supplier','expense','staff','other') DEFAULT 'expense',
    account_id INT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_method ENUM('cash','bank','cheque','online') DEFAULT 'cash',
    cheque_number VARCHAR(50) NULL,
    bank_account_id INT NULL,
    description TEXT,
    journal_entry_id INT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id),
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(bank_account_id),
    FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(entry_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_date (voucher_date),
    INDEX idx_type (payment_type)
);

-- Receipt Vouchers
CREATE TABLE IF NOT EXISTS receipt_vouchers (
    voucher_id INT PRIMARY KEY AUTO_INCREMENT,
    voucher_number VARCHAR(50) NOT NULL UNIQUE,
    voucher_date DATE NOT NULL,
    received_from VARCHAR(200) NOT NULL,
    receipt_type ENUM('customer','sales','other') DEFAULT 'customer',
    account_id INT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_method ENUM('cash','bank','cheque','online') DEFAULT 'cash',
    cheque_number VARCHAR(50) NULL,
    bank_account_id INT NULL,
    description TEXT,
    journal_entry_id INT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id),
    FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(bank_account_id),
    FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(entry_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_date (voucher_date),
    INDEX idx_type (receipt_type)
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
    token_no VARCHAR(20) NULL,
    invoice_no VARCHAR(20) NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    INDEX idx_sale_date (sale_date),
    INDEX idx_sale_status (status),
    INDEX idx_sale_payment_method (payment_method),
    INDEX idx_sale_date_status (sale_date, status)
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

-- Stock Adjustments (manual inventory corrections)
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

-- Store Inventory (stock per store for multi-store support)
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

-- Returns
CREATE TABLE IF NOT EXISTS returns (
    return_id INT PRIMARY KEY AUTO_INCREMENT,
    sale_id INT NOT NULL,
    return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    refund_amount DECIMAL(10, 2) NOT NULL,
    reason TEXT,
    user_id INT,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    INDEX idx_return_date (return_date),
    INDEX idx_return_sale (sale_id)
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

-- Variant Inventory (stock tracking per variant)
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
    INDEX idx_sale_bundles_sale_id (sale_id),
    INDEX idx_sale_bundles_bundle_id (bundle_id)
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

-- ============================================================
-- SALES MODULE EXTENSION TABLES
-- ============================================================

-- Quotations
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
);

-- Quotation Items
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
);

-- Credit Sales
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
);

-- Credit Payments
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
);

-- Price Rules
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
);

-- Price Rule Products (which products/categories a rule applies to)
CREATE TABLE IF NOT EXISTS price_rule_products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rule_id INT NOT NULL,
    product_id INT NULL,
    category_id INT NULL,
    FOREIGN KEY (rule_id) REFERENCES price_rules(rule_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

-- Price Rule Usage
CREATE TABLE IF NOT EXISTS price_rule_usage (
    usage_id INT PRIMARY KEY AUTO_INCREMENT,
    rule_id INT NOT NULL,
    sale_id INT NOT NULL,
    discount_applied DECIMAL(10,2) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rule_id) REFERENCES price_rules(rule_id),
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id)
);

-- Sales Targets
CREATE TABLE IF NOT EXISTS sales_targets (
    target_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NULL,
    target_type ENUM('daily', 'weekly', 'monthly') NOT NULL DEFAULT 'monthly',
    target_amount DECIMAL(12,2) NOT NULL,
    target_orders INT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_target_user (user_id),
    INDEX idx_target_period (period_start, period_end),
    INDEX idx_target_active (is_active)
);

-- Target Achievements
CREATE TABLE IF NOT EXISTS target_achievements (
    achievement_id INT PRIMARY KEY AUTO_INCREMENT,
    target_id INT NOT NULL,
    achievement_date DATE NOT NULL,
    actual_amount DECIMAL(12,2) DEFAULT 0,
    actual_orders INT DEFAULT 0,
    achievement_percentage DECIMAL(5,2) DEFAULT 0,
    FOREIGN KEY (target_id) REFERENCES sales_targets(target_id) ON DELETE CASCADE,
    UNIQUE KEY unique_target_date (target_id, achievement_date)
);

-- Deliveries / Shipping
CREATE TABLE IF NOT EXISTS deliveries (
    delivery_id       INT PRIMARY KEY AUTO_INCREMENT,
    delivery_number   VARCHAR(50)  NOT NULL UNIQUE,
    sale_id           INT          NULL,
    customer_id       INT          NOT NULL,
    delivery_address  TEXT         NOT NULL,
    delivery_city     VARCHAR(100) DEFAULT '',
    delivery_phone    VARCHAR(20)  DEFAULT '',
    rider_name        VARCHAR(100) DEFAULT '',
    rider_phone       VARCHAR(20)  DEFAULT '',
    status            ENUM('pending','assigned','dispatched','in_transit','delivered','failed','cancelled')
                      NOT NULL DEFAULT 'pending',
    delivery_charges  DECIMAL(10,2) DEFAULT 0,
    estimated_delivery DATE         NULL,
    actual_delivery   TIMESTAMP    NULL,
    notes             TEXT,
    created_by        INT          NULL,
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sale_id)     REFERENCES sales(sale_id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    FOREIGN KEY (created_by)  REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_del_status   (status),
    INDEX idx_del_customer (customer_id),
    INDEX idx_del_number   (delivery_number),
    INDEX idx_del_date     (created_at)
);

