-- ============================================================
-- AByte Master Database Schema
-- Database: abyte_master
-- Purpose: Multi-tenant management
-- Usage: mysql -u root -p abyte_master < master_schema.sql
-- ============================================================

-- Modules (available modules with pricing)
CREATE TABLE IF NOT EXISTS modules (
    module_id INT PRIMARY KEY AUTO_INCREMENT,
    module_key VARCHAR(50) NOT NULL UNIQUE,
    module_name VARCHAR(100) NOT NULL,
    price_pkr DECIMAL(10,2) NOT NULL DEFAULT 0,
    description TEXT,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO modules (module_key, module_name, price_pkr, description) VALUES
('sales',     'Sale',        2250, 'POS, Orders, Returns, Credit Sales, Quotations, Deliveries'),
('inventory', 'Inventory',   2250, 'Products, Stock, Purchase Orders, GRN, Suppliers'),
('accounts',  'Accounts',    2999, 'Journal Entries, Vouchers, Bank Accounts, Ledger'),
('hr',        'HR & Payroll',2999, 'Staff, Attendance, Salary, Leaves, Loans');

-- Tenants (Clients)
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_code VARCHAR(50) NOT NULL UNIQUE,
    tenant_name VARCHAR(200) NOT NULL,
    db_name VARCHAR(100) NOT NULL UNIQUE,
    admin_email VARCHAR(150) NOT NULL,
    plan VARCHAR(50) DEFAULT 'basic',
    subdomain VARCHAR(100) NOT NULL UNIQUE,
    is_active TINYINT(1) DEFAULT 1,
    trial_ends_at DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_code (tenant_code),
    INDEX idx_subdomain (subdomain),
    INDEX idx_active (is_active)
);

-- Super Admins
CREATE TABLE IF NOT EXISTS super_admins (
    admin_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tenant Configs (branding, tax, receipt settings)
CREATE TABLE IF NOT EXISTS tenant_configs (
    config_id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL UNIQUE,
    company_name VARCHAR(200),
    logo_url TEXT,
    primary_color VARCHAR(20) DEFAULT '#10b981',
    currency_symbol VARCHAR(10) DEFAULT 'Rs.',
    currency_code VARCHAR(10) DEFAULT 'PKR',
    timezone VARCHAR(50) DEFAULT 'Asia/Karachi',
    tax_name VARCHAR(50) DEFAULT 'GST',
    tax_rate DECIMAL(5,2) DEFAULT 0,
    ntn VARCHAR(50) NULL,
    strn VARCHAR(50) NULL,
    is_tax_exempt TINYINT(1) DEFAULT 0,
    receipt_header TEXT,
    receipt_footer TEXT DEFAULT 'Thank you for shopping!',
    show_tax_on_receipt TINYINT(1) DEFAULT 1,
    show_logo_on_receipt TINYINT(1) DEFAULT 1,
    show_ntn_on_receipt TINYINT(1) DEFAULT 1,
    modules_enabled JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);
