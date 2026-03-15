// migrate_ai_permission.js
// Adds system.ai_widget permission key to role_permissions
// Manager gets it by default, Cashier does NOT (Admin always has full access)

const { query } = require('../config/database');

async function migrate() {
  try {
    // Grant to Manager
    await query(
      'INSERT IGNORE INTO role_permissions (role_name, module_key, is_allowed) VALUES (?, ?, 1)',
      ['Manager', 'system.ai_widget']
    );
    console.log('✓ Manager: system.ai_widget permission added');

    // Cashier does NOT get AI widget by default (admin can enable it in Settings > Access Control)
    console.log('✓ Cashier: NOT granted (can be enabled via Settings > Access Control)');

    console.log('\nMigration completed. system.ai_widget permission is now available.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
