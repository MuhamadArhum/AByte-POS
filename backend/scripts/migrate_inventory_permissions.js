// migrate_inventory_permissions.js
// Adds new inventory module keys (bundles, variants, stockcount) to existing role_permissions
const { query } = require('../config/database');

const NEW_MANAGER_KEYS = [
  'inventory.bundles',
  'inventory.variants',
  'inventory.stockcount',
];

async function migrate() {
  try {
    for (const key of NEW_MANAGER_KEYS) {
      await query(
        'INSERT IGNORE INTO role_permissions (role_name, module_key, is_allowed) VALUES (?, ?, 1)',
        ['Manager', key]
      );
    }
    console.log(`Seeded ${NEW_MANAGER_KEYS.length} new inventory keys for Manager.`);

    // Admin already has null (full access), no rows needed
    // Cashier doesn't need inventory access
    console.log('Migration completed.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
