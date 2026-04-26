// =============================================================
// migrate.js - Database Migration Script
// Adds all missing columns and tables to existing tenant DBs
// Run: node migrate.js
// =============================================================

const mariadb = require('mariadb');
const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '.env.production'),
});

const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
});

async function runMigration(conn, dbName) {
  console.log(`\n📦 Migrating: ${dbName}`);
  await conn.query(`USE \`${dbName}\``);

  // ── 1. ALTER EXISTING TABLES ──────────────────────────────

  const alters = [
    // users
    `ALTER TABLE users
       ADD COLUMN IF NOT EXISTS username VARCHAR(100) NOT NULL DEFAULT '',
       ADD COLUMN IF NOT EXISTS role_name VARCHAR(50) NOT NULL DEFAULT 'Cashier'`,

    // Populate username & role_name for existing rows
    `UPDATE users u JOIN roles r ON u.role_id = r.role_id
     SET u.role_name = r.role_name WHERE u.role_name = '' OR u.role_name IS NULL`,
    `UPDATE users SET username = email WHERE username = '' OR username IS NULL`,

    // categories
    `ALTER TABLE categories
       ADD COLUMN IF NOT EXISTS category_type VARCHAR(50) DEFAULT 'finished_good',
       ADD COLUMN IF NOT EXISTS parent_id INT NULL,
       ADD COLUMN IF NOT EXISTS description TEXT NULL,
       ADD COLUMN IF NOT EXISTS is_active TINYINT(1) DEFAULT 1`,

    // products
    `ALTER TABLE products
       ADD COLUMN IF NOT EXISTS product_type VARCHAR(50) DEFAULT 'finished_good',
       ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'pcs',
       ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) DEFAULT 0,
       ADD COLUMN IF NOT EXISTS min_stock_level INT DEFAULT 0,
       ADD COLUMN IF NOT EXISTS sku VARCHAR(100) NULL,
       ADD COLUMN IF NOT EXISTS description TEXT NULL,
       ADD COLUMN IF NOT EXISTS has_variants TINYINT(1) DEFAULT 0`,

    // inventory
    `ALTER TABLE inventory
       ADD COLUMN IF NOT EXISTS avg_cost DECIMAL(10,4) DEFAULT 0`,

    // customers
    `ALTER TABLE customers
       ADD COLUMN IF NOT EXISTS email VARCHAR(100) NULL,
       ADD COLUMN IF NOT EXISTS company VARCHAR(150) NULL,
       ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50) NULL,
       ADD COLUMN IF NOT EXISTS address TEXT NULL`,

    // sales
    `ALTER TABLE sales
       ADD COLUMN IF NOT EXISTS sub_total DECIMAL(12,2) DEFAULT 0,
       ADD COLUMN IF NOT EXISTS bundle_discount DECIMAL(12,2) DEFAULT 0,
       ADD COLUMN IF NOT EXISTS bundle_count INT DEFAULT 0,
       ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash',
       ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) DEFAULT 0,
       ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed',
       ADD COLUMN IF NOT EXISTS tax_percent DECIMAL(5,2) DEFAULT 0,
       ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) DEFAULT 0,
       ADD COLUMN IF NOT EXISTS additional_charges_percent DECIMAL(5,2) DEFAULT 0,
       ADD COLUMN IF NOT EXISTS additional_charges_amount DECIMAL(12,2) DEFAULT 0,
       ADD COLUMN IF NOT EXISTS note TEXT NULL,
       ADD COLUMN IF NOT EXISTS token_no VARCHAR(20) NULL,
       ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(50) NULL`,

    // sale_details
    `ALTER TABLE sale_details
       ADD COLUMN IF NOT EXISTS variant_id INT NULL,
       ADD COLUMN IF NOT EXISTS variant_name VARCHAR(200) NULL`,

    // audit_logs
    `ALTER TABLE audit_logs
       ADD COLUMN IF NOT EXISTS old_values JSON NULL,
       ADD COLUMN IF NOT EXISTS new_values JSON NULL`,

    // payment_vouchers - main account
    `ALTER TABLE payment_vouchers
       ADD COLUMN IF NOT EXISTS main_account_id INT NULL`,

    // receipt_vouchers - main account
    `ALTER TABLE receipt_vouchers
       ADD COLUMN IF NOT EXISTS main_account_id INT NULL`,
  ];

  for (const sql of alters) {
    try {
      await conn.query(sql);
    } catch (e) {
      console.warn(`  ⚠️  ALTER warning: ${e.message.split('\n')[0]}`);
    }
  }

  // ── 2. CREATE MISSING TABLES ──────────────────────────────

  const creates = [

    `CREATE TABLE IF NOT EXISTS settings (
       setting_id INT PRIMARY KEY AUTO_INCREMENT,
       company_name VARCHAR(200),
       company_address TEXT,
       company_phone VARCHAR(50),
       company_email VARCHAR(100),
       currency_symbol VARCHAR(10) DEFAULT 'Rs',
       tax_name VARCHAR(50) DEFAULT 'Tax',
       tax_rate DECIMAL(5,2) DEFAULT 0,
       ntn VARCHAR(50),
       strn VARCHAR(50),
       receipt_header TEXT,
       receipt_footer TEXT,
       logo_url VARCHAR(500),
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS customer_addresses (
       address_id INT PRIMARY KEY AUTO_INCREMENT,
       customer_id INT NOT NULL,
       address_text TEXT NOT NULL,
       label VARCHAR(50) DEFAULT 'Home',
       is_default TINYINT(1) DEFAULT 0,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE
     )`,

    `CREATE TABLE IF NOT EXISTS sale_bundles (
       id INT PRIMARY KEY AUTO_INCREMENT,
       sale_id INT NOT NULL,
       bundle_id INT,
       bundle_name VARCHAR(200),
       discount_amount DECIMAL(10,2) DEFAULT 0
     )`,

    `CREATE TABLE IF NOT EXISTS credit_sales (
       credit_id INT PRIMARY KEY AUTO_INCREMENT,
       sale_id INT NOT NULL,
       customer_id INT,
       total_amount DECIMAL(12,2) NOT NULL,
       paid_amount DECIMAL(12,2) DEFAULT 0,
       remaining_amount DECIMAL(12,2) NOT NULL,
       balance_due DECIMAL(12,2) DEFAULT 0,
       due_date DATE NULL,
       status VARCHAR(20) DEFAULT 'pending',
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS credit_payments (
       payment_id INT PRIMARY KEY AUTO_INCREMENT,
       credit_sale_id INT NOT NULL,
       amount DECIMAL(12,2) NOT NULL,
       payment_method VARCHAR(50) DEFAULT 'cash',
       notes TEXT,
       received_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS returns (
       return_id INT PRIMARY KEY AUTO_INCREMENT,
       sale_id INT NOT NULL,
       user_id INT NOT NULL,
       reason TEXT,
       refund_amount DECIMAL(10,2) DEFAULT 0,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS return_details (
       return_detail_id INT PRIMARY KEY AUTO_INCREMENT,
       return_id INT NOT NULL,
       product_id INT NOT NULL,
       quantity INT NOT NULL,
       refund_price DECIMAL(10,2) DEFAULT 0
     )`,

    `CREATE TABLE IF NOT EXISTS quotations (
       quotation_id INT PRIMARY KEY AUTO_INCREMENT,
       quotation_number VARCHAR(50),
       customer_id INT,
       created_by INT,
       subtotal DECIMAL(12,2) DEFAULT 0,
       discount DECIMAL(12,2) DEFAULT 0,
       tax_amount DECIMAL(12,2) DEFAULT 0,
       total_amount DECIMAL(12,2) DEFAULT 0,
       notes TEXT,
       valid_until DATE NULL,
       status VARCHAR(20) DEFAULT 'draft',
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS quotation_items (
       item_id INT PRIMARY KEY AUTO_INCREMENT,
       quotation_id INT NOT NULL,
       product_id INT NOT NULL,
       variant_id INT NULL,
       quantity INT NOT NULL,
       unit_price DECIMAL(10,2) NOT NULL,
       total_price DECIMAL(10,2) NOT NULL
     )`,

    `CREATE TABLE IF NOT EXISTS suppliers (
       supplier_id INT PRIMARY KEY AUTO_INCREMENT,
       supplier_name VARCHAR(200) NOT NULL,
       contact_person VARCHAR(100),
       phone VARCHAR(50),
       email VARCHAR(100),
       address TEXT,
       tax_id VARCHAR(50),
       payment_terms VARCHAR(100),
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS supplier_payments (
       payment_id INT PRIMARY KEY AUTO_INCREMENT,
       supplier_id INT NOT NULL,
       purchase_order_id INT NULL,
       amount DECIMAL(12,2) NOT NULL,
       payment_date DATE NOT NULL,
       payment_method VARCHAR(50) DEFAULT 'cash',
       reference_number VARCHAR(100),
       notes TEXT,
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS purchase_orders (
       po_id INT PRIMARY KEY AUTO_INCREMENT,
       po_number VARCHAR(50),
       supplier_id INT,
       order_date DATE,
       expected_date DATE,
       total_amount DECIMAL(12,2) DEFAULT 0,
       additional_charges DECIMAL(10,2) DEFAULT 0,
       notes TEXT,
       status VARCHAR(20) DEFAULT 'pending',
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS purchase_order_items (
       item_id INT PRIMARY KEY AUTO_INCREMENT,
       po_id INT NOT NULL,
       product_id INT NOT NULL,
       quantity_ordered INT NOT NULL,
       unit_cost DECIMAL(10,2) NOT NULL,
       total_cost DECIMAL(12,2) NOT NULL
     )`,

    `CREATE TABLE IF NOT EXISTS inv_purchase_vouchers (
       pv_id INT PRIMARY KEY AUTO_INCREMENT,
       pv_number VARCHAR(50),
       po_id INT NULL,
       supplier_id INT,
       voucher_date DATE,
       total_amount DECIMAL(12,2) DEFAULT 0,
       shipping_cost DECIMAL(10,2) DEFAULT 0,
       extra_charges DECIMAL(10,2) DEFAULT 0,
       other_charges DECIMAL(10,2) DEFAULT 0,
       discount_percent DECIMAL(5,2) DEFAULT 0,
       discount_amount DECIMAL(10,2) DEFAULT 0,
       tax_percent DECIMAL(5,2) DEFAULT 0,
       tax_amount DECIMAL(10,2) DEFAULT 0,
       notes TEXT,
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS inv_purchase_voucher_items (
       item_id INT PRIMARY KEY AUTO_INCREMENT,
       pv_id INT NOT NULL,
       product_id INT NOT NULL,
       quantity_received INT NOT NULL,
       unit_price DECIMAL(10,2) NOT NULL,
       total_price DECIMAL(12,2) NOT NULL
     )`,

    `CREATE TABLE IF NOT EXISTS purchase_returns (
       pr_id INT PRIMARY KEY AUTO_INCREMENT,
       pr_number VARCHAR(50),
       pv_id INT NULL,
       supplier_id INT,
       return_date DATE,
       total_amount DECIMAL(12,2) DEFAULT 0,
       notes TEXT,
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS purchase_return_items (
       item_id INT PRIMARY KEY AUTO_INCREMENT,
       pr_id INT NOT NULL,
       product_id INT NOT NULL,
       quantity_returned INT NOT NULL,
       unit_price DECIMAL(10,2) NOT NULL,
       total_price DECIMAL(12,2) NOT NULL
     )`,

    `CREATE TABLE IF NOT EXISTS opening_stock_entries (
       entry_id INT PRIMARY KEY AUTO_INCREMENT,
       product_id INT NOT NULL,
       quantity INT NOT NULL,
       unit_cost DECIMAL(10,4) DEFAULT 0,
       entry_date DATE,
       notes TEXT,
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS stock_layers (
       layer_id INT PRIMARY KEY AUTO_INCREMENT,
       product_id INT NOT NULL,
       pv_id INT NULL,
       source_type VARCHAR(50),
       ref_date DATE,
       qty_original INT DEFAULT 0,
       qty_remaining INT DEFAULT 0,
       unit_cost DECIMAL(10,4) DEFAULT 0,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS stock_adjustments (
       adjustment_id INT PRIMARY KEY AUTO_INCREMENT,
       product_id INT NOT NULL,
       adjustment_type VARCHAR(50),
       quantity_before INT DEFAULT 0,
       quantity_adjusted INT DEFAULT 0,
       quantity_after INT DEFAULT 0,
       reason TEXT,
       reference_number VARCHAR(100),
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS sections (
       section_id INT PRIMARY KEY AUTO_INCREMENT,
       section_name VARCHAR(100) NOT NULL,
       description TEXT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS stock_issues (
       issue_id INT PRIMARY KEY AUTO_INCREMENT,
       issue_number VARCHAR(50),
       section_id INT,
       issue_date DATE,
       notes TEXT,
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS stock_issue_items (
       item_id INT PRIMARY KEY AUTO_INCREMENT,
       issue_id INT NOT NULL,
       product_id INT NOT NULL,
       quantity INT NOT NULL,
       unit_cost DECIMAL(10,4) DEFAULT 0
     )`,

    `CREATE TABLE IF NOT EXISTS stock_issue_returns (
       return_id INT PRIMARY KEY AUTO_INCREMENT,
       return_number VARCHAR(50),
       section_id INT,
       return_date DATE,
       notes TEXT,
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS stock_issue_return_items (
       item_id INT PRIMARY KEY AUTO_INCREMENT,
       return_id INT NOT NULL,
       product_id INT NOT NULL,
       quantity INT NOT NULL
     )`,

    `CREATE TABLE IF NOT EXISTS raw_sales (
       sale_id INT PRIMARY KEY AUTO_INCREMENT,
       sale_number VARCHAR(50),
       section_id INT,
       customer_name VARCHAR(100),
       sale_date DATE,
       total_amount DECIMAL(12,2) DEFAULT 0,
       notes TEXT,
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS raw_sale_items (
       item_id INT PRIMARY KEY AUTO_INCREMENT,
       sale_id INT NOT NULL,
       product_id INT NOT NULL,
       quantity INT NOT NULL,
       unit_price DECIMAL(10,2) NOT NULL,
       total_price DECIMAL(12,2) NOT NULL
     )`,

    `CREATE TABLE IF NOT EXISTS stores (
       store_id INT PRIMARY KEY AUTO_INCREMENT,
       store_name VARCHAR(200) NOT NULL,
       store_code VARCHAR(50),
       address TEXT,
       phone VARCHAR(50),
       email VARCHAR(100),
       manager_id INT NULL,
       is_active TINYINT(1) DEFAULT 1,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS store_inventory (
       id INT PRIMARY KEY AUTO_INCREMENT,
       store_id INT NOT NULL,
       product_id INT NOT NULL,
       available_stock INT DEFAULT 0,
       UNIQUE KEY uq_store_product (store_id, product_id)
     )`,

    `CREATE TABLE IF NOT EXISTS stock_transfers (
       transfer_id INT PRIMARY KEY AUTO_INCREMENT,
       from_store_id INT,
       to_store_id INT,
       product_id INT NOT NULL,
       quantity INT NOT NULL,
       status VARCHAR(20) DEFAULT 'pending',
       notes TEXT,
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS product_variants (
       variant_id INT PRIMARY KEY AUTO_INCREMENT,
       product_id INT NOT NULL,
       sku VARCHAR(100),
       variant_name VARCHAR(200),
       price_adjustment DECIMAL(10,2) DEFAULT 0,
       stock_quantity INT DEFAULT 0,
       barcode VARCHAR(100),
       is_active TINYINT(1) DEFAULT 1,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS variant_inventory (
       id INT PRIMARY KEY AUTO_INCREMENT,
       variant_id INT NOT NULL UNIQUE,
       available_stock INT DEFAULT 0
     )`,

    `CREATE TABLE IF NOT EXISTS variant_types (
       variant_type_id INT PRIMARY KEY AUTO_INCREMENT,
       variant_name VARCHAR(100) NOT NULL UNIQUE
     )`,

    `CREATE TABLE IF NOT EXISTS variant_values (
       variant_value_id INT PRIMARY KEY AUTO_INCREMENT,
       variant_type_id INT NOT NULL,
       value_name VARCHAR(100) NOT NULL
     )`,

    `CREATE TABLE IF NOT EXISTS variant_combinations (
       id INT PRIMARY KEY AUTO_INCREMENT,
       variant_id INT NOT NULL,
       variant_value_id INT NOT NULL
     )`,

    `CREATE TABLE IF NOT EXISTS product_bundles (
       bundle_id INT PRIMARY KEY AUTO_INCREMENT,
       bundle_name VARCHAR(200) NOT NULL,
       description TEXT,
       discount_type VARCHAR(20) DEFAULT 'percentage',
       discount_value DECIMAL(10,2) DEFAULT 0,
       start_date DATE NULL,
       end_date DATE NULL,
       is_active TINYINT(1) DEFAULT 1,
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS bundle_items (
       id INT PRIMARY KEY AUTO_INCREMENT,
       bundle_id INT NOT NULL,
       product_id INT NOT NULL,
       variant_id INT NULL,
       quantity_required INT DEFAULT 1
     )`,

    `CREATE TABLE IF NOT EXISTS price_rules (
       rule_id INT PRIMARY KEY AUTO_INCREMENT,
       rule_name VARCHAR(200) NOT NULL,
       rule_type VARCHAR(50),
       description TEXT,
       priority INT DEFAULT 0,
       start_date DATE NULL,
       end_date DATE NULL,
       min_quantity INT DEFAULT 1,
       buy_quantity INT NULL,
       get_quantity INT NULL,
       discount_type VARCHAR(20) DEFAULT 'percentage',
       discount_value DECIMAL(10,2) DEFAULT 0,
       max_uses INT NULL,
       applies_to VARCHAR(20) DEFAULT 'all',
       is_active TINYINT(1) DEFAULT 1,
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS price_rule_products (
       id INT PRIMARY KEY AUTO_INCREMENT,
       rule_id INT NOT NULL,
       product_id INT NULL,
       category_id INT NULL
     )`,

    `CREATE TABLE IF NOT EXISTS deliveries (
       delivery_id INT PRIMARY KEY AUTO_INCREMENT,
       delivery_number VARCHAR(50),
       sale_id INT,
       customer_id INT,
       delivery_address TEXT,
       delivery_city VARCHAR(100),
       delivery_phone VARCHAR(50),
       rider_name VARCHAR(100),
       rider_phone VARCHAR(50),
       status VARCHAR(20) DEFAULT 'pending',
       delivery_charges DECIMAL(10,2) DEFAULT 0,
       estimated_delivery DATE NULL,
       notes TEXT,
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS cash_registers (
       register_id INT PRIMARY KEY AUTO_INCREMENT,
       opened_by INT NOT NULL,
       opening_balance DECIMAL(12,2) DEFAULT 0,
       closing_balance DECIMAL(12,2) NULL,
       status VARCHAR(20) DEFAULT 'open',
       opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       closed_at TIMESTAMP NULL
     )`,

    `CREATE TABLE IF NOT EXISTS cash_movements (
       movement_id INT PRIMARY KEY AUTO_INCREMENT,
       register_id INT NOT NULL,
       type VARCHAR(20) NOT NULL,
       amount DECIMAL(12,2) NOT NULL,
       reason TEXT,
       user_id INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS printers (
       printer_id INT PRIMARY KEY AUTO_INCREMENT,
       name VARCHAR(100) NOT NULL,
       type VARCHAR(20) DEFAULT 'network',
       ip_address VARCHAR(50),
       port INT DEFAULT 9100,
       printer_share_name VARCHAR(200),
       paper_width INT DEFAULT 80,
       purpose VARCHAR(50) DEFAULT 'receipt',
       is_active TINYINT(1) DEFAULT 1,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS sales_targets (
       target_id INT PRIMARY KEY AUTO_INCREMENT,
       user_id INT NOT NULL,
       target_type VARCHAR(20) DEFAULT 'amount',
       target_amount DECIMAL(12,2) DEFAULT 0,
       target_orders INT DEFAULT 0,
       period_start DATE NOT NULL,
       period_end DATE NOT NULL,
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS role_permissions (
       id INT PRIMARY KEY AUTO_INCREMENT,
       role_name VARCHAR(50) NOT NULL,
       module_key VARCHAR(100) NOT NULL,
       is_allowed TINYINT(1) DEFAULT 1,
       UNIQUE KEY uq_role_module (role_name, module_key)
     )`,

    `CREATE TABLE IF NOT EXISTS backups (
       backup_id INT PRIMARY KEY AUTO_INCREMENT,
       filename VARCHAR(500) NOT NULL,
       file_size BIGINT DEFAULT 0,
       created_by INT NULL,
       type VARCHAR(20) DEFAULT 'manual',
       status VARCHAR(20) DEFAULT 'completed',
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    // ── ACCOUNTING ──────────────────────────────────────────

    `CREATE TABLE IF NOT EXISTS account_groups (
       group_id INT PRIMARY KEY AUTO_INCREMENT,
       group_type VARCHAR(50),
       group_name VARCHAR(100) NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS accounts (
       account_id INT PRIMARY KEY AUTO_INCREMENT,
       account_code VARCHAR(50),
       account_name VARCHAR(200) NOT NULL,
       group_id INT NULL,
       parent_account_id INT NULL,
       account_type VARCHAR(50),
       level INT DEFAULT 1,
       is_system TINYINT(1) DEFAULT 0,
       opening_balance DECIMAL(14,2) DEFAULT 0,
       current_balance DECIMAL(14,2) DEFAULT 0,
       description TEXT,
       is_active TINYINT(1) DEFAULT 1,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS journal_entries (
       entry_id INT PRIMARY KEY AUTO_INCREMENT,
       entry_number VARCHAR(50),
       entry_date DATE NOT NULL,
       description TEXT,
       total_debit DECIMAL(14,2) DEFAULT 0,
       total_credit DECIMAL(14,2) DEFAULT 0,
       status VARCHAR(20) DEFAULT 'posted',
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS journal_entry_lines (
       line_id INT PRIMARY KEY AUTO_INCREMENT,
       entry_id INT NOT NULL,
       account_id INT NOT NULL,
       description TEXT,
       debit DECIMAL(14,2) DEFAULT 0,
       credit DECIMAL(14,2) DEFAULT 0
     )`,

    `CREATE TABLE IF NOT EXISTS bank_accounts (
       bank_account_id INT PRIMARY KEY AUTO_INCREMENT,
       account_id INT NULL,
       bank_name VARCHAR(100),
       account_number VARCHAR(100),
       account_holder VARCHAR(100),
       branch VARCHAR(100),
       ifsc_code VARCHAR(50),
       opening_balance DECIMAL(14,2) DEFAULT 0,
       current_balance DECIMAL(14,2) DEFAULT 0,
       is_active TINYINT(1) DEFAULT 1,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS payment_vouchers (
       voucher_id INT PRIMARY KEY AUTO_INCREMENT,
       voucher_number VARCHAR(50),
       voucher_date DATE NOT NULL,
       payment_to VARCHAR(200),
       payment_type VARCHAR(50),
       account_id INT NULL,
       amount DECIMAL(14,2) NOT NULL,
       payment_method VARCHAR(50) DEFAULT 'cash',
       cheque_number VARCHAR(100),
       bank_account_id INT NULL,
       description TEXT,
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS receipt_vouchers (
       voucher_id INT PRIMARY KEY AUTO_INCREMENT,
       voucher_number VARCHAR(50),
       voucher_date DATE NOT NULL,
       received_from VARCHAR(200),
       receipt_type VARCHAR(50),
       account_id INT NULL,
       amount DECIMAL(14,2) NOT NULL,
       payment_method VARCHAR(50) DEFAULT 'cash',
       cheque_number VARCHAR(100),
       bank_account_id INT NULL,
       description TEXT,
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    // ── STAFF / HR ───────────────────────────────────────────

    `CREATE TABLE IF NOT EXISTS staff (
       staff_id INT PRIMARY KEY AUTO_INCREMENT,
       user_id INT NULL,
       employee_id VARCHAR(50),
       full_name VARCHAR(100) NOT NULL,
       phone VARCHAR(50),
       email VARCHAR(100),
       address TEXT,
       position VARCHAR(100),
       department VARCHAR(100),
       salary DECIMAL(12,2) DEFAULT 0,
       salary_type VARCHAR(20) DEFAULT 'monthly',
       hire_date DATE NULL,
       is_active TINYINT(1) DEFAULT 1,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS departments (
       dept_id INT PRIMARY KEY AUTO_INCREMENT,
       name VARCHAR(100) NOT NULL,
       description TEXT,
       head_of_dept INT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS shifts (
       shift_id INT PRIMARY KEY AUTO_INCREMENT,
       name VARCHAR(100) NOT NULL,
       start_time TIME,
       end_time TIME,
       grace_minutes INT DEFAULT 0,
       is_overnight TINYINT(1) DEFAULT 0,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS attendance (
       attendance_id INT PRIMARY KEY AUTO_INCREMENT,
       staff_id INT NOT NULL,
       attendance_date DATE NOT NULL,
       check_in TIME NULL,
       check_out TIME NULL,
       status VARCHAR(20) DEFAULT 'present',
       notes TEXT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS salary_payments (
       payment_id INT PRIMARY KEY AUTO_INCREMENT,
       staff_id INT NOT NULL,
       payment_date DATE NOT NULL,
       from_date DATE,
       to_date DATE,
       amount DECIMAL(12,2) NOT NULL,
       deductions DECIMAL(12,2) DEFAULT 0,
       bonuses DECIMAL(12,2) DEFAULT 0,
       net_amount DECIMAL(12,2) NOT NULL,
       payment_method VARCHAR(50) DEFAULT 'cash',
       notes TEXT,
       paid_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS salary_increments (
       increment_id INT PRIMARY KEY AUTO_INCREMENT,
       staff_id INT NOT NULL,
       old_salary DECIMAL(12,2),
       new_salary DECIMAL(12,2),
       increment_amount DECIMAL(12,2),
       increment_percentage DECIMAL(5,2),
       effective_date DATE,
       reason TEXT,
       approved_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS salary_components (
       component_id INT PRIMARY KEY AUTO_INCREMENT,
       name VARCHAR(100) NOT NULL,
       type VARCHAR(20) DEFAULT 'earning',
       calculation VARCHAR(50) DEFAULT 'fixed',
       default_value DECIMAL(12,2) DEFAULT 0,
       is_taxable TINYINT(1) DEFAULT 0,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS staff_salary_components (
       id INT PRIMARY KEY AUTO_INCREMENT,
       staff_id INT NOT NULL,
       component_id INT NOT NULL,
       custom_value DECIMAL(12,2) NULL,
       is_active TINYINT(1) DEFAULT 1
     )`,

    `CREATE TABLE IF NOT EXISTS staff_loans (
       loan_id INT PRIMARY KEY AUTO_INCREMENT,
       staff_id INT NOT NULL,
       loan_amount DECIMAL(12,2) NOT NULL,
       remaining_balance DECIMAL(12,2) NOT NULL,
       monthly_deduction DECIMAL(12,2) DEFAULT 0,
       loan_date DATE,
       reason TEXT,
       approved_by INT,
       debit_account_id INT NULL,
       credit_account_id INT NULL,
       status VARCHAR(20) DEFAULT 'active',
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS loan_repayments (
       repayment_id INT PRIMARY KEY AUTO_INCREMENT,
       loan_id INT NOT NULL,
       staff_id INT NOT NULL,
       amount DECIMAL(12,2) NOT NULL,
       repayment_date DATE NOT NULL,
       payment_method VARCHAR(50) DEFAULT 'deduction',
       notes TEXT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS advance_payments (
       advance_id INT PRIMARY KEY AUTO_INCREMENT,
       staff_id INT NOT NULL,
       amount DECIMAL(12,2) NOT NULL,
       payment_date DATE NOT NULL,
       payment_method VARCHAR(50) DEFAULT 'cash',
       reason TEXT,
       paid_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS holidays (
       holiday_id INT PRIMARY KEY AUTO_INCREMENT,
       holiday_date DATE NOT NULL,
       holiday_name VARCHAR(100) NOT NULL,
       description TEXT,
       created_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS leave_requests (
       leave_id INT PRIMARY KEY AUTO_INCREMENT,
       staff_id INT NOT NULL,
       leave_type VARCHAR(50) DEFAULT 'casual',
       from_date DATE NOT NULL,
       to_date DATE NOT NULL,
       days INT DEFAULT 1,
       reason TEXT,
       status VARCHAR(20) DEFAULT 'pending',
       requested_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS performance_appraisals (
       appraisal_id INT PRIMARY KEY AUTO_INCREMENT,
       staff_id INT NOT NULL,
       appraisal_date DATE,
       period_from DATE,
       period_to DATE,
       rating DECIMAL(3,1),
       goals_achieved TEXT,
       strengths TEXT,
       improvements TEXT,
       overall_comments TEXT,
       appraised_by INT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,

    `CREATE TABLE IF NOT EXISTS exit_requests (
       exit_id INT PRIMARY KEY AUTO_INCREMENT,
       staff_id INT NOT NULL,
       exit_type VARCHAR(20) DEFAULT 'resignation',
       notice_date DATE,
       last_working_date DATE,
       reason TEXT,
       final_settlement DECIMAL(12,2) DEFAULT 0,
       settlement_notes TEXT,
       status VARCHAR(20) DEFAULT 'pending',
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`,
  ];

  let created = 0;
  let skipped = 0;
  for (const sql of creates) {
    try {
      await conn.query(sql);
      created++;
    } catch (e) {
      console.warn(`  ⚠️  CREATE warning: ${e.message.split('\n')[0]}`);
      skipped++;
    }
  }

  console.log(`  ✅ Altered existing tables`);
  console.log(`  ✅ Created ${created} new tables (${skipped} skipped/warnings)`);
}

async function main() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log('✅ Connected to MariaDB');

    // Get all tenant DBs
    const tenants = await conn.query('SELECT db_name FROM abyte_master.tenants WHERE is_active = 1');
    console.log(`📋 Found ${tenants.length} active tenant(s)`);

    for (const tenant of tenants) {
      await runMigration(conn, tenant.db_name);
    }

    console.log('\n🎉 Migration complete!\n');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

main();
