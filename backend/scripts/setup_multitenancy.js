// =============================================================
// setup_multitenancy.js
// Run ONCE to set up multi-tenancy:
//   node backend/scripts/setup_multitenancy.js
//
// What it does:
//   1. Creates 'abyte_master' database
//   2. Creates 'tenants' table in master DB
//   3. Registers existing 'abyte_pos' as the 'default' tenant
// =============================================================

require('dotenv').config();
const mariadb = require('mariadb');

async function run() {
  const conn = await mariadb.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    console.log('Setting up multi-tenancy...\n');

    // 1. Create master database
    await conn.query('CREATE DATABASE IF NOT EXISTS `abyte_master`');
    console.log('✓ Created abyte_master database');

    // 2. Create tenants table
    await conn.query('USE `abyte_master`');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        tenant_id    INT PRIMARY KEY AUTO_INCREMENT,
        tenant_code  VARCHAR(50) NOT NULL UNIQUE,
        tenant_name  VARCHAR(100) NOT NULL,
        db_name      VARCHAR(100) NOT NULL,
        admin_email  VARCHAR(100),
        is_active    TINYINT(1) DEFAULT 1,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_tenant_code (tenant_code),
        INDEX idx_is_active (is_active)
      )
    `);
    console.log('✓ Created tenants table');

    // 3. Register existing abyte_pos as default tenant
    const existing = await conn.query(
      "SELECT tenant_id FROM tenants WHERE tenant_code = 'default'"
    );

    if (existing.length === 0) {
      // Get admin email from abyte_pos
      let adminEmail = 'admin@pos.com';
      try {
        const adminRows = await conn.query(
          "SELECT email FROM abyte_pos.users WHERE role_name = 'Admin' LIMIT 1"
        );
        if (adminRows.length > 0) adminEmail = adminRows[0].email;
      } catch {}

      await conn.query(
        `INSERT INTO tenants (tenant_code, tenant_name, db_name, admin_email, is_active)
         VALUES ('default', 'Default Company', 'abyte_pos', ?, 1)`,
        [adminEmail]
      );
      console.log('✓ Registered abyte_pos as default tenant (code: "default")');
    } else {
      console.log('✓ Default tenant already registered');
    }

    console.log('\n✅ Multi-tenancy setup complete!');
    console.log('\nLogin credentials unchanged:');
    console.log('  Company Code: default (or leave blank)');
    console.log('  Email:        admin@pos.com');
    console.log('  Password:     Admin@123');
    console.log('\nTo create new clients: Settings → Tenants → Add New Client');
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

run();
