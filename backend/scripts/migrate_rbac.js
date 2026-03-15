// migrate_rbac.js - RBAC role_permissions table + default seeds
const { query, getConnection } = require('../config/database');

const MANAGER_MODULES = [
  'dashboard',
  'sales', 'sales.pos', 'sales.orders', 'sales.customers', 'sales.register', 'sales.returns',
  'sales.quotations', 'sales.credit', 'sales.pricerules', 'sales.targets', 'sales.deliveries',
  'sales.reports',
  'inventory', 'inventory.products', 'inventory.categories', 'inventory.purchases',
  'inventory.transfers', 'inventory.adjustments', 'inventory.alerts',
  'inventory.suppliers', 'inventory.reports',
  'inventory.bundles', 'inventory.variants', 'inventory.stockcount',
  'hr', 'hr.staff', 'hr.attendance', 'hr.daily-attendance',
  'hr.salary-sheet', 'hr.payroll', 'hr.advances', 'hr.loans', 'hr.increments',
  'hr.ledger', 'hr.holidays', 'hr.leaves', 'hr.reports',
  'accounts', 'accounts.chart', 'accounts.journal', 'accounts.ledger',
  'accounts.trial-balance', 'accounts.profit-loss', 'accounts.balance-sheet',
  'accounts.bank-accounts', 'accounts.payment-vouchers', 'accounts.receipt-vouchers',
  'accounts.expenses', 'accounts.analytics', 'accounts.reports',
  'system', 'system.stores', 'system.audit', 'system.ai_widget',
  // system.backup and system.settings excluded for Manager
];

const CASHIER_MODULES = [
  'dashboard',
  'sales', 'sales.pos', 'sales.orders', 'sales.register', 'sales.customers',
  'hr',
];

async function migrate() {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // Create table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        permission_id INT PRIMARY KEY AUTO_INCREMENT,
        role_name     VARCHAR(50)  NOT NULL,
        module_key    VARCHAR(100) NOT NULL,
        is_allowed    TINYINT(1)   NOT NULL DEFAULT 1,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_role_module (role_name, module_key)
      )
    `);
    console.log('Table role_permissions created/verified.');

    // Seed Manager defaults
    for (const mod of MANAGER_MODULES) {
      await conn.query(
        'INSERT IGNORE INTO role_permissions (role_name, module_key, is_allowed) VALUES (?, ?, 1)',
        ['Manager', mod]
      );
    }
    console.log(`Seeded ${MANAGER_MODULES.length} Manager permissions.`);

    // Seed Cashier defaults
    for (const mod of CASHIER_MODULES) {
      await conn.query(
        'INSERT IGNORE INTO role_permissions (role_name, module_key, is_allowed) VALUES (?, ?, 1)',
        ['Cashier', mod]
      );
    }
    console.log(`Seeded ${CASHIER_MODULES.length} Cashier permissions.`);

    await conn.commit();
    console.log('Migration completed successfully.');
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate();
