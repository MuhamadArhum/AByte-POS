-- ============================================================
-- AByte Master Database Schema
-- Database: abyte_master
-- Purpose: Multi-tenant management
-- Usage: mysql -u root -p abyte_master < master_schema.sql
-- ============================================================

-- Plans
CREATE TABLE IF NOT EXISTS plans (
    plan_id INT PRIMARY KEY AUTO_INCREMENT,
    plan_name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    monthly_price DECIMAL(10,2) DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO plans (plan_name, display_name, monthly_price) VALUES
('basic', 'Basic', 0),
('professional', 'Professional', 5000),
('enterprise', 'Enterprise', 10000);

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
