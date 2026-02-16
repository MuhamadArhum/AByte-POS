/**
 * Migration: Complete Accounts Module
 * Run: node backend/migrate_accounts_module.js
 */

const { getConnection } = require('./config/database');

async function migrate() {
  console.log('Starting Accounts Module migration...\n');

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // 1. Account Groups (Categories)
    console.log('Creating account_groups table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS account_groups (
        group_id INT PRIMARY KEY AUTO_INCREMENT,
        group_name VARCHAR(100) NOT NULL,
        group_type ENUM('asset','liability','equity','revenue','expense') NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_group_type (group_type)
      )
    `);
    console.log('  account_groups table ready');

    // Insert default account groups
    await conn.query(`
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
      (10, 'Other Expenses', 'expense', 'Interest, losses')
    `);

    // 2. Chart of Accounts
    console.log('Creating accounts table...');
    await conn.query(`
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
      )
    `);
    console.log('  accounts table ready');

    // Insert default accounts
    await conn.query(`
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
      ('6004', 'Office Supplies', 9, 'expense', 0)
    `);

    // 3. Journal Entries
    console.log('Creating journal_entries table...');
    await conn.query(`
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
      )
    `);
    console.log('  journal_entries table ready');

    // 4. Journal Entry Lines
    console.log('Creating journal_entry_lines table...');
    await conn.query(`
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
      )
    `);
    console.log('  journal_entry_lines table ready');

    // 5. Bank Accounts
    console.log('Creating bank_accounts table...');
    await conn.query(`
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
      )
    `);
    console.log('  bank_accounts table ready');

    // 6. Payment Vouchers
    console.log('Creating payment_vouchers table...');
    await conn.query(`
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
      )
    `);
    console.log('  payment_vouchers table ready');

    // 7. Receipt Vouchers
    console.log('Creating receipt_vouchers table...');
    await conn.query(`
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
      )
    `);
    console.log('  receipt_vouchers table ready');

    await conn.commit();
    console.log('\nAccounts Module migration completed successfully!');
    console.log('Default account groups and accounts have been created.');
  } catch (error) {
    await conn.rollback();
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate().catch(() => process.exit(1));
