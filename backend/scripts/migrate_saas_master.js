// =============================================================
// migrate_saas_master.js
// Run ONCE to upgrade abyte_master for full SaaS multi-tenancy:
//   node backend/scripts/migrate_saas_master.js
//
// What it does:
//   1. Adds plan + subdomain columns to tenants table
//   2. Creates tenant_configs table (branding, tax, receipt, modules)
//   3. Creates plans reference table with module lists
//   4. Seeds plan data (basic / professional / enterprise)
//   5. Seeds default config for existing default tenant
// =============================================================

require('dotenv').config();
const mariadb = require('mariadb');

const DB_CONFIG = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: false,
  bigIntAsNumber: true,
};

async function run() {
  const conn = await mariadb.createConnection({ ...DB_CONFIG, database: 'abyte_master' });

  try {
    console.log('Upgrading abyte_master for SaaS multi-tenancy...\n');

    // ── 1. Add plan column to tenants ────────────────────────────
    const cols = await conn.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'abyte_master' AND TABLE_NAME = 'tenants'
    `);
    const colNames = cols.map(c => c.COLUMN_NAME);

    if (!colNames.includes('plan')) {
      await conn.query(`
        ALTER TABLE tenants
        ADD COLUMN plan ENUM('basic','professional','enterprise') NOT NULL DEFAULT 'basic'
        AFTER admin_email
      `);
      console.log('✓ Added plan column to tenants');
    } else {
      console.log('  plan column already exists');
    }

    if (!colNames.includes('subdomain')) {
      await conn.query(`
        ALTER TABLE tenants
        ADD COLUMN subdomain VARCHAR(63) NULL UNIQUE AFTER plan
      `);
      // Set subdomain = tenant_code for existing rows
      await conn.query(`UPDATE tenants SET subdomain = tenant_code WHERE subdomain IS NULL`);
      console.log('✓ Added subdomain column to tenants (synced from tenant_code)');
    } else {
      console.log('  subdomain column already exists');
    }

    if (!colNames.includes('trial_ends_at')) {
      await conn.query(`
        ALTER TABLE tenants
        ADD COLUMN trial_ends_at DATE NULL AFTER subdomain
      `);
      console.log('✓ Added trial_ends_at column to tenants');
    }

    // ── 2. Create plans reference table ──────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS plans (
        plan_name        VARCHAR(30)     PRIMARY KEY,
        display_name     VARCHAR(60)     NOT NULL,
        monthly_price    DECIMAL(10,2)   NOT NULL DEFAULT 0,
        max_users        SMALLINT        NOT NULL DEFAULT 10,
        modules          JSON            NOT NULL,
        description      TEXT            NULL,
        is_active        TINYINT(1)      NOT NULL DEFAULT 1,
        created_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ plans table ready');

    // Seed plans (INSERT IGNORE = skip if already exists)
    await conn.query(`
      INSERT IGNORE INTO plans (plan_name, display_name, monthly_price, max_users, modules, description)
      VALUES
        (
          'basic',
          'Basic Plan',
          5000.00,
          5,
          '["inventory","sales","reports"]',
          'Core POS: Inventory, Sales & basic reports. Rs. 5,000/month'
        ),
        (
          'professional',
          'Professional Plan',
          10000.00,
          20,
          '["inventory","sales","reports","accounting","hr_payroll"]',
          'Full ERP: + Accounting & HR/Payroll. Rs. 10,000/month'
        ),
        (
          'enterprise',
          'Enterprise Plan',
          20000.00,
          999,
          '["inventory","sales","reports","accounting","hr_payroll","manufacturing","api_access"]',
          'Enterprise: + Manufacturing & API access. Rs. 20,000/month'
        )
    `);
    console.log('✓ Plans seeded (basic / professional / enterprise)');

    // ── 3. Create tenant_configs table ───────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tenant_configs (
        config_id          INT          PRIMARY KEY AUTO_INCREMENT,
        tenant_id          INT          NOT NULL UNIQUE,
        -- Branding
        company_name       VARCHAR(150) NOT NULL DEFAULT '',
        logo_url           VARCHAR(500) NULL,
        primary_color      VARCHAR(7)   NOT NULL DEFAULT '#10b981',
        currency_symbol    VARCHAR(10)  NOT NULL DEFAULT 'Rs.',
        currency_code      VARCHAR(3)   NOT NULL DEFAULT 'PKR',
        timezone           VARCHAR(60)  NOT NULL DEFAULT 'Asia/Karachi',
        -- Tax
        tax_name           VARCHAR(30)  NOT NULL DEFAULT 'GST',
        tax_rate           DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        ntn                VARCHAR(30)  NULL,
        strn               VARCHAR(30)  NULL,
        is_tax_exempt      TINYINT(1)   NOT NULL DEFAULT 0,
        -- Receipt config
        receipt_header     TEXT         NULL,
        receipt_footer     TEXT         NULL,
        show_tax_on_receipt   TINYINT(1) NOT NULL DEFAULT 1,
        show_logo_on_receipt  TINYINT(1) NOT NULL DEFAULT 1,
        show_ntn_on_receipt   TINYINT(1) NOT NULL DEFAULT 1,
        -- Module overrides (admin can turn off individual modules even if plan allows)
        modules_enabled    JSON         NULL,
        -- Metadata
        created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        CONSTRAINT fk_tc_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
        INDEX idx_tenant (tenant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ tenant_configs table ready');

    // ── 4. Seed default config for the default tenant ─────────────
    const [defaultTenant] = await conn.query(
      "SELECT tenant_id, tenant_name FROM tenants WHERE tenant_code = 'default' LIMIT 1"
    );

    if (defaultTenant) {
      const existing = await conn.query(
        'SELECT config_id FROM tenant_configs WHERE tenant_id = ?',
        [defaultTenant.tenant_id]
      );
      if (existing.length === 0) {
        await conn.query(
          `INSERT INTO tenant_configs
            (tenant_id, company_name, tax_name, tax_rate, receipt_footer)
           VALUES (?, ?, 'GST', 0, 'Thank you for shopping!')`,
          [defaultTenant.tenant_id, defaultTenant.tenant_name]
        );
        console.log('✓ Default tenant config seeded');
      } else {
        console.log('  Default tenant config already exists');
      }
    }

    // ── 5. Platform audit log ─────────────────────────────────────
    await conn.query(`
      CREATE TABLE IF NOT EXISTS master_audit_log (
        id         BIGINT       PRIMARY KEY AUTO_INCREMENT,
        tenant_id  INT          NULL,
        action     VARCHAR(80)  NOT NULL,
        actor      VARCHAR(100) NOT NULL DEFAULT 'system',
        details    JSON         NULL,
        ip_address VARCHAR(45)  NULL,
        created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tenant  (tenant_id),
        INDEX idx_action  (action),
        INDEX idx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✓ master_audit_log table ready');

    console.log('\n✅ Master DB migration complete!');
    console.log('\nNext steps:');
    console.log('  1. Restart the backend server');
    console.log('  2. Add your first SaaS tenant:');
    console.log('     node backend/scripts/create_tenant_saas.js --name "Ahmed Store" --code "ahmed" --email "admin@ahmed.com" --plan basic');
    console.log('  3. Add Windows hosts entry: 127.0.0.1 ahmed.localhost');

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
