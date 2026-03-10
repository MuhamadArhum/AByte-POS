// =============================================================
// create_tenant_saas.js
// Complete script to provision a new SaaS client:
//
//   node backend/scripts/create_tenant_saas.js \
//     --name   "Ahmed Store"         \
//     --code   "ahmed"               \
//     --email  "admin@ahmed.com"     \
//     --pass   "Admin@123"           \
//     --plan   basic                 \
//     --ntn    "1234567-8"           \
//     --strn   "12-34-5678-001-25"   \
//     --tax    17                    \
//     --color  "#3b82f6"
//
// What this script does:
//   1. Validates inputs
//   2. Creates new MariaDB database: abyte_pos_{code}
//   3. Runs full schema from database/schema.sql
//   4. Inserts default walk-in customer (id=1)
//   5. Inserts default store_settings row
//   6. Creates Admin user in new DB
//   7. Registers tenant in abyte_master.tenants
//   8. Creates tenant config in abyte_master.tenant_configs
//   9. Prints login URL and test instructions
// =============================================================

require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const mariadb = require('mariadb');
const bcrypt  = require('bcryptjs');
const fs      = require('fs');
const path    = require('path');

// ─── Parse CLI args ──────────────────────────────────────────
const args = process.argv.slice(2);
const get  = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };

const opts = {
  name:  get('--name'),
  code:  get('--code'),
  email: get('--email'),
  pass:  get('--pass')  || 'Admin@123',
  plan:  get('--plan')  || 'basic',
  ntn:   get('--ntn')   || null,
  strn:  get('--strn')  || null,
  tax:   parseFloat(get('--tax')   || '0'),
  color: get('--color') || '#10b981',
};

if (!opts.name || !opts.code || !opts.email) {
  console.error('Usage: node create_tenant_saas.js --name "Name" --code "slug" --email "admin@..." [options]');
  console.error('\nOptions:');
  console.error('  --pass   "Admin@123"     Admin password (default: Admin@123)');
  console.error('  --plan   basic           basic | professional | enterprise');
  console.error('  --ntn    "1234567-8"     NTN number');
  console.error('  --strn   "12-34-5678"    STRN number');
  console.error('  --tax    17              Tax rate %');
  console.error('  --color  "#10b981"       Brand color');
  process.exit(1);
}

// Validate plan
if (!['basic', 'professional', 'enterprise'].includes(opts.plan)) {
  console.error('plan must be: basic | professional | enterprise');
  process.exit(1);
}

// Sanitize code: lowercase alphanumeric + underscore
opts.code = opts.code.toLowerCase().replace(/[^a-z0-9_]/g, '_');
const dbName = `abyte_pos_${opts.code}`;

// ─── DB connection config ─────────────────────────────────────
const DB_CONFIG = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
};

const PLAN_MODULES = {
  basic:        ['inventory', 'sales', 'reports'],
  professional: ['inventory', 'sales', 'reports', 'accounting', 'hr_payroll'],
  enterprise:   ['inventory', 'sales', 'reports', 'accounting', 'hr_payroll', 'manufacturing', 'api_access'],
};

// ─── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log(`║  Creating tenant: ${opts.name.padEnd(27)}║`);
  console.log(`║  Code: ${opts.code.padEnd(37)}║`);
  console.log(`║  Plan: ${opts.plan.padEnd(37)}║`);
  console.log(`║  DB:   ${dbName.padEnd(37)}║`);
  console.log('╚══════════════════════════════════════════════╝\n');

  let rootConn;
  try {
    rootConn = await mariadb.createConnection(DB_CONFIG);

    // ── 1. Create database ────────────────────────────────────
    process.stdout.write('[1/7] Creating database... ');
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log('✓');

    // ── 2. Run schema ──────────────────────────────────────────
    process.stdout.write('[2/7] Applying schema... ');
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`schema.sql not found at ${schemaPath}`);
    }

    let schema = fs.readFileSync(schemaPath, 'utf8');
    schema = schema.replace(/CREATE DATABASE IF NOT EXISTS `abyte_pos`;/g, '');
    schema = schema.replace(/USE `abyte_pos`;/g,  `USE \`${dbName}\`;`);
    schema = schema.replace(/USE abyte_pos;/g,     `USE \`${dbName}\`;`);
    if (!schema.includes(`USE \`${dbName}\``)) {
      schema = `USE \`${dbName}\`;\n` + schema;
    }

    const stmts = schema.split(';').map(s => s.trim()).filter(s => s.length > 3);
    let applied = 0;
    for (const stmt of stmts) {
      try {
        await rootConn.query(stmt);
        applied++;
      } catch (e) {
        if (!e.message.includes('already exists') && !e.message.includes('Duplicate')) {
          // Only warn on non-trivial errors
          if (!e.message.includes("doesn't exist")) {
            console.warn(`\n  WARN: ${e.message.substring(0, 100)}`);
          }
        }
      }
    }
    console.log(`✓ (${applied} statements)`);

    // ── 3. Seed essentials ─────────────────────────────────────
    process.stdout.write('[3/7] Seeding defaults... ');
    await rootConn.query(`USE \`${dbName}\``);

    // Walk-in customer (ID = 1, required by POS)
    await rootConn.query(`
      INSERT IGNORE INTO customers (customer_id, customer_name, phone_number)
      VALUES (1, 'Walk-in Customer', NULL)
    `);

    // Update store settings with tenant-specific values (schema already inserts a default row)
    await rootConn.query(`
      INSERT INTO store_settings (setting_id, store_name, receipt_footer, tax_rate, currency_symbol)
      VALUES (1, ?, 'Thank you for shopping!', ?, 'Rs.')
      ON DUPLICATE KEY UPDATE store_name = VALUES(store_name), tax_rate = VALUES(tax_rate), currency_symbol = VALUES(currency_symbol)
    `, [opts.name, opts.tax]);

    // Create role_permissions table (not in base schema.sql — added by RBAC module)
    await rootConn.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        permission_id INT PRIMARY KEY AUTO_INCREMENT,
        role_name     VARCHAR(50)  NOT NULL,
        module_key    VARCHAR(100) NOT NULL,
        is_allowed    TINYINT(1)   NOT NULL DEFAULT 1,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_role_module (role_name, module_key)
      )
    `);

    // RBAC permissions seeded for Manager and Cashier
    const permSql = `
      INSERT IGNORE INTO role_permissions (role_name, module_key, is_allowed) VALUES
        ('Manager','dashboard',1),('Manager','sales',1),('Manager','sales.pos',1),
        ('Manager','sales.orders',1),('Manager','sales.register',1),('Manager','sales.returns',1),
        ('Manager','sales.quotations',1),('Manager','sales.credit',1),('Manager','sales.layaway',1),
        ('Manager','sales.coupons',1),('Manager','sales.loyalty',1),('Manager','sales.giftcards',1),
        ('Manager','sales.pricerules',1),('Manager','sales.targets',1),('Manager','sales.invoices',1),
        ('Manager','sales.reports',1),('Manager','inventory',1),('Manager','inventory.products',1),
        ('Manager','inventory.categories',1),('Manager','inventory.purchases',1),
        ('Manager','inventory.transfers',1),('Manager','inventory.adjustments',1),
        ('Manager','inventory.alerts',1),('Manager','inventory.suppliers',1),
        ('Manager','inventory.reports',1),('Manager','hr',1),('Manager','hr.customers',1),
        ('Manager','hr.staff',1),('Manager','hr.attendance',1),('Manager','system',1),
        ('Manager','system.stores',1),('Manager','system.audit',1),
        ('Cashier','dashboard',1),('Cashier','sales',1),('Cashier','sales.pos',1),
        ('Cashier','sales.orders',1),('Cashier','sales.register',1),
        ('Cashier','hr',1),('Cashier','hr.customers',1)
    `;
    await rootConn.query(permSql);
    console.log('✓');

    // ── 4. Create admin user ───────────────────────────────────
    process.stdout.write('[4/7] Creating admin user... ');
    const hash = await bcrypt.hash(opts.pass, 10);
    await rootConn.query(`
      INSERT INTO users (username, name, email, password_hash, role_id, role_name)
      VALUES ('admin', ?, ?, ?, 1, 'Admin')
    `, [opts.name + ' Admin', opts.email, hash]);
    console.log('✓');

    // ── 5. Check master DB + migration ────────────────────────
    process.stdout.write('[5/7] Checking master DB... ');
    await rootConn.query('USE `abyte_master`');
    // Verify tenant_configs table exists (run migration if needed)
    const tables = await rootConn.query(`
      SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = 'abyte_master' AND TABLE_NAME IN ('tenant_configs','plans')
    `);
    if (tables.length < 2) {
      console.log('\n  ⚠  tenant_configs table missing! Run migrate_saas_master.js first:');
      console.log('     node backend/scripts/migrate_saas_master.js');
      process.exit(1);
    }
    console.log('✓');

    // ── 6. Register in master DB ──────────────────────────────
    process.stdout.write('[6/7] Registering tenant... ');
    const existing = await rootConn.query(
      'SELECT tenant_id FROM tenants WHERE tenant_code = ?',
      [opts.code]
    );
    if (existing.length > 0) {
      throw new Error(`Tenant code "${opts.code}" already exists in master DB`);
    }

    const tResult = await rootConn.query(
      `INSERT INTO tenants (tenant_code, tenant_name, db_name, admin_email, is_active, plan, subdomain)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [opts.code, opts.name, dbName, opts.email, opts.plan, opts.code]
    );
    const tenantId = Number(tResult.insertId);
    console.log(`✓ (tenant_id: ${tenantId})`);

    // ── 7. Create tenant config ───────────────────────────────
    process.stdout.write('[7/7] Creating tenant config... ');
    await rootConn.query(
      `INSERT INTO tenant_configs
         (tenant_id, company_name, primary_color, tax_name, tax_rate,
          ntn, strn, receipt_footer, modules_enabled)
       VALUES (?, ?, ?, 'GST', ?, ?, ?, 'Thank you for shopping!', ?)`,
      [
        tenantId, opts.name, opts.color, opts.tax,
        opts.ntn, opts.strn,
        JSON.stringify(PLAN_MODULES[opts.plan]),
      ]
    );
    console.log('✓');

    // ── Done ──────────────────────────────────────────────────
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  ✅ Tenant created successfully!             ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Subdomain : ${opts.code.padEnd(31)}║`);
    console.log(`║  Database  : ${dbName.padEnd(31)}║`);
    console.log(`║  Plan      : ${opts.plan.padEnd(31)}║`);
    console.log(`║  Admin     : ${opts.email.padEnd(31)}║`);
    console.log(`║  Password  : ${opts.pass.padEnd(31)}║`);
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║  WINDOWS SETUP:                              ║');
    console.log(`║  Add to C:\\Windows\\System32\\drivers\\etc\\hosts:║`);
    console.log(`║  127.0.0.1  ${(opts.code + '.localhost').padEnd(33)}║`);
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║  LOGIN URL (dev):                            ║');
    console.log(`║  http://${(opts.code + '.localhost:5173').padEnd(37)}║`);
    console.log('╚══════════════════════════════════════════════╝\n');

  } catch (err) {
    console.error('\n❌ Failed:', err.message);
    // Attempt cleanup of partially created DB
    if (rootConn) {
      try {
        await rootConn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
        console.log('  Cleaned up partially created database.');
      } catch {}
    }
    process.exit(1);
  } finally {
    if (rootConn) await rootConn.end();
  }
}

main();
