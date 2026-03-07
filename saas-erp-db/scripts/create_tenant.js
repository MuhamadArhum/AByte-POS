/**
 * create_tenant.js
 * ─────────────────────────────────────────────────────────────
 * Creates a new tenant database, dedicated MariaDB user,
 * runs all migrations, and registers the company in erp_master.
 *
 * Usage:
 *   node scripts/create_tenant.js \
 *     --name "Acme Corp" \
 *     --slug "acme-corp" \
 *     --email "admin@acme.com" \
 *     --plan "growth"
 *
 * Environment variables (set in .env):
 *   MASTER_DB_HOST, MASTER_DB_PORT, MASTER_DB_USER, MASTER_DB_PASSWORD
 *   DB_HOST_FOR_TENANTS  (host where tenant DBs will live)
 *   MIGRATIONS_DIR       (absolute path to tenant/migrations)
 *   DB_PASSWORD_SALT     (used in password generation — keep secret)
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config();

const mariadb   = require('mariadb');
const fs        = require('fs');
const path      = require('path');
const crypto    = require('crypto');
const { parseArgs } = require('util'); // Node 18+; polyfill below for older Node

// ─────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────
const MASTER_CONFIG = {
  host:            process.env.MASTER_DB_HOST     || 'localhost',
  port:            parseInt(process.env.MASTER_DB_PORT) || 3306,
  user:            process.env.MASTER_DB_USER     || 'root',
  password:        process.env.MASTER_DB_PASSWORD || '',
  database:        'erp_master',
  bigIntAsNumber:  true,
  decimalAsNumber: true,
  connectTimeout:  10000,
};

const TENANT_DB_HOST = process.env.DB_HOST_FOR_TENANTS || 'localhost';
const TENANT_DB_PORT = parseInt(process.env.DB_PORT_FOR_TENANTS) || 3306;

// Connection pool cache — shared with middleware
const poolCache = new Map();  // slug → mariadb pool

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR
  || path.join(__dirname, '..', 'tenant', 'migrations');


// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

/** Generate a cryptographically secure random password */
function generatePassword(length = 24) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

/** Sanitize user input to safe database name / user name */
function toDbIdentifier(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 50);
}

/** SHA-256 of a file's contents (used for migration checksums) */
function fileChecksum(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** Read and sort migration files from MIGRATIONS_DIR */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Migrations directory not found: ${MIGRATIONS_DIR}`);
  }
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();  // lexicographic order: 001_, 002_, 003_...
}

/** Execute a multi-statement SQL file on an open connection */
async function runSqlFile(conn, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');

  // Split on statement delimiter but preserve stored procedure bodies
  // MariaDB's multiStatements:true handles this automatically
  const statements = sql
    .split(/;\s*\n/)               // split by semicolon + newline
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const stmt of statements) {
    await conn.query(stmt + ';');
  }
}

/** Get a root-level connection (no database selected) */
async function getRootConnection() {
  return await mariadb.createConnection({
    ...MASTER_CONFIG,
    database: undefined,           // connect without selecting a database
  });
}

/** Get a connection to erp_master */
async function getMasterConnection() {
  return await mariadb.createConnection(MASTER_CONFIG);
}

/** Get a connection to a specific tenant database */
async function getTenantConnection(dbName, dbUser, dbPassword) {
  return await mariadb.createConnection({
    host:            TENANT_DB_HOST,
    port:            TENANT_DB_PORT,
    user:            dbUser,
    password:        dbPassword,
    database:        dbName,
    bigIntAsNumber:  true,
    decimalAsNumber: true,
    multiStatements: false,        // run statements one at a time for safety
    connectTimeout:  10000,
  });
}

/** Create or reuse a pool for a tenant (for middleware cache) */
function getOrCreatePool(slug, dbName, dbUser, dbPassword) {
  if (poolCache.has(slug)) return poolCache.get(slug);

  const pool = mariadb.createPool({
    host:             TENANT_DB_HOST,
    port:             TENANT_DB_PORT,
    user:             dbUser,
    password:         dbPassword,
    database:         dbName,
    connectionLimit:  5,           // per-tenant pool size; tune per plan
    acquireTimeout:   15000,
    bigIntAsNumber:   true,
    decimalAsNumber:  true,
  });

  poolCache.set(slug, pool);
  return pool;
}


// ─────────────────────────────────────────
// STEP 1 — Create database + restricted user
// ─────────────────────────────────────────
async function createDatabaseAndUser(rootConn, dbName, dbUser, dbPassword) {
  console.log(`  Creating database: ${dbName}`);
  await rootConn.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\`
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );

  console.log(`  Creating user: ${dbUser}@${TENANT_DB_HOST}`);
  // Create user only if it doesn't already exist (MariaDB 10.1+)
  await rootConn.query(
    `CREATE USER IF NOT EXISTS '${dbUser}'@'%' IDENTIFIED BY '${dbPassword}'`
  );

  // Grant only what the app needs — no SUPER, no GRANT OPTION
  await rootConn.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES
     ON \`${dbName}\`.* TO '${dbUser}'@'%'`
  );

  await rootConn.query(`FLUSH PRIVILEGES`);
  console.log(`  Grants applied.`);
}


// ─────────────────────────────────────────
// STEP 2 — Run all migrations on tenant DB
// ─────────────────────────────────────────
async function applyMigrations(tenantConn, migrationFiles) {
  // Ensure _migrations table exists (migration 001 creates it,
  // but we create it here too for bootstrapping safety)
  await tenantConn.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
      migration_name  VARCHAR(255)  NOT NULL UNIQUE,
      applied_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      checksum        CHAR(64)      NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  // Get already-applied migrations
  const applied = await tenantConn.query(
    'SELECT migration_name FROM _migrations'
  );
  const appliedSet = new Set(applied.map(r => r.migration_name));

  let count = 0;
  for (const fileName of migrationFiles) {
    if (appliedSet.has(fileName)) {
      console.log(`    [SKIP] ${fileName} — already applied`);
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, fileName);
    const checksum = fileChecksum(filePath);

    console.log(`    [RUN]  ${fileName}`);
    const sql = fs.readFileSync(filePath, 'utf8');

    // Execute each statement separately
    const statements = sql
      .split(/;\s*(?=\n|$)/m)
      .map(s => s.trim())
      .filter(s => s.length > 5 && !s.startsWith('--'));

    for (const stmt of statements) {
      await tenantConn.query(stmt);
    }

    // Record in _migrations (migration file itself also inserts, this is a safety net)
    await tenantConn.query(
      `INSERT IGNORE INTO _migrations (migration_name, checksum) VALUES (?, ?)`,
      [fileName, checksum]
    );
    count++;
  }

  return count;
}


// ─────────────────────────────────────────
// STEP 3 — Register company in erp_master
// ─────────────────────────────────────────
async function registerInMaster(masterConn, {
  name, slug, dbName, dbUser, dbPassword, plan, maxUsers, ownerEmail
}) {
  // Encrypt password with AES in production; plain for dev demo
  const result = await masterConn.query(
    `INSERT INTO companies
       (name, slug, db_name, db_host, db_port, db_user, db_password, plan, max_users, owner_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name), updated_at = NOW()`,
    [name, slug, dbName, TENANT_DB_HOST, TENANT_DB_PORT, dbUser, dbPassword, plan, maxUsers, ownerEmail]
  );

  await masterConn.query(
    `INSERT INTO master_audit_log (company_id, action, details, actor)
     VALUES (?, 'TENANT_CREATED', ?, 'system')`,
    [
      Number(result.insertId) || 0,
      JSON.stringify({ slug, db_name: dbName, plan })
    ]
  );

  return Number(result.insertId);
}


// ─────────────────────────────────────────
// STEP 4 — Seed default data in tenant DB
// ─────────────────────────────────────────
async function seedDefaultData(tenantConn, companyId, ownerEmail) {
  // Insert "Main Warehouse"
  await tenantConn.query(`
    INSERT IGNORE INTO warehouses (name, code, is_active)
    VALUES ('Main Warehouse', 'MAIN', 1)
  `);

  // Insert a "General" department
  await tenantConn.query(`
    INSERT IGNORE INTO departments (name, code) VALUES ('General', 'GEN')
  `);

  // Insert default product category
  await tenantConn.query(`
    INSERT IGNORE INTO product_categories (name, code) VALUES ('General', 'GEN')
  `);

  console.log(`  Default seed data inserted.`);
}


// ─────────────────────────────────────────
// MAIN ORCHESTRATION
// ─────────────────────────────────────────
async function createTenant({ name, slug, email, plan = 'starter', maxUsers = 10 }) {
  if (!name || !slug || !email) {
    throw new Error('name, slug, and email are required');
  }

  const safeSlug  = toDbIdentifier(slug);
  const dbName    = `erp_tenant_${safeSlug}`;
  const dbUser    = `erp_u_${safeSlug}`.slice(0, 32);  // MariaDB user max 32 chars
  const dbPassword = generatePassword(28);

  console.log('\n═══════════════════════════════════════');
  console.log(` Creating tenant: ${name} (${safeSlug})`);
  console.log(` DB: ${dbName}  User: ${dbUser}`);
  console.log('═══════════════════════════════════════');

  let rootConn, masterConn, tenantConn;

  try {
    // ── 1. Connect as root
    console.log('\n[1/5] Connecting as root...');
    rootConn = await getRootConnection();

    // ── 2. Create DB + user
    console.log('\n[2/5] Creating database and user...');
    await createDatabaseAndUser(rootConn, dbName, dbUser, dbPassword);

    // ── 3. Connect to new tenant DB as new user
    console.log('\n[3/5] Connecting to tenant DB...');
    tenantConn = await getTenantConnection(dbName, dbUser, dbPassword);

    // ── 4. Run migrations
    console.log('\n[4/5] Running migrations...');
    const migrationFiles = getMigrationFiles();
    const appliedCount = await applyMigrations(tenantConn, migrationFiles);
    console.log(`  Applied ${appliedCount} migration(s).`);

    // ── 5. Register in master
    console.log('\n[5/5] Registering in master DB...');
    masterConn = await getMasterConnection();
    const companyId = await registerInMaster(masterConn, {
      name, slug: safeSlug, dbName, dbUser, dbPassword,
      plan, maxUsers, ownerEmail: email
    });

    // Seed defaults
    await seedDefaultData(tenantConn, companyId, email);

    // Warm up the pool in the cache
    getOrCreatePool(safeSlug, dbName, dbUser, dbPassword);

    console.log('\n✅ Tenant created successfully!');
    console.log(`   Company ID : ${companyId}`);
    console.log(`   DB Name    : ${dbName}`);
    console.log(`   DB User    : ${dbUser}`);
    console.log(`   DB Password: ${dbPassword}  ← store this securely!`);
    console.log('');

    return { companyId, dbName, dbUser, dbPassword, slug: safeSlug };

  } finally {
    if (tenantConn) await tenantConn.end();
    if (masterConn) await masterConn.end();
    if (rootConn)   await rootConn.end();
  }
}


// ─────────────────────────────────────────
// CLI ENTRYPOINT
// ─────────────────────────────────────────
if (require.main === module) {
  // Simple arg parsing for Node < 18; use parseArgs for Node 18+
  const args = process.argv.slice(2);
  const get  = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };

  const opts = {
    name:     get('--name'),
    slug:     get('--slug'),
    email:    get('--email'),
    plan:     get('--plan')     || 'starter',
    maxUsers: parseInt(get('--max-users')) || 10,
  };

  if (!opts.name || !opts.slug || !opts.email) {
    console.error('Usage: node create_tenant.js --name "..." --slug "..." --email "..." [--plan starter|growth|enterprise] [--max-users N]');
    process.exit(1);
  }

  createTenant(opts)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('\n❌ Tenant creation failed:', err.message);
      console.error(err.stack);
      process.exit(1);
    });
}

// Export for programmatic use (e.g. from a REST admin endpoint)
module.exports = { createTenant, getOrCreatePool, poolCache };
