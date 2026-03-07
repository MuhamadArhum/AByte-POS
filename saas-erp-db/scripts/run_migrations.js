/**
 * run_migrations.js
 * ─────────────────────────────────────────────────────────────
 * Runs pending SQL migrations for ALL tenant databases (or one).
 * Reads migration files in numeric order (001_, 002_...).
 * Tracks which migrations have been applied in each tenant's
 * `_migrations` table. Safe to re-run: skips applied files.
 *
 * Usage:
 *   node scripts/run_migrations.js                  # all tenants
 *   node scripts/run_migrations.js --slug acme-corp # one tenant
 *   node scripts/run_migrations.js --dry-run        # preview only
 *   node scripts/run_migrations.js --rollback 003   # rollback (requires 003_down.sql)
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config();

const mariadb = require('mariadb');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR
  || path.join(__dirname, '..', 'tenant', 'migrations');

const LOG_FILE = path.join(__dirname, '..', 'logs', `migrations_${timestamp()}.log`);

const masterPool = mariadb.createPool({
  host:            process.env.MASTER_DB_HOST     || 'localhost',
  port:            parseInt(process.env.MASTER_DB_PORT) || 3306,
  user:            process.env.MASTER_DB_USER     || 'root',
  password:        process.env.MASTER_DB_PASSWORD || '',
  database:        'erp_master',
  connectionLimit: 3,
  bigIntAsNumber:  true,
  decimalAsNumber: true,
});


// ─────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (_) {}
}

function fileChecksum(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** Return sorted migration .sql files from MIGRATIONS_DIR */
function getMigrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.match(/^\d{3}_.+\.sql$/) && !f.includes('_down'))
    .sort();
}

/** Return rollback file if it exists */
function getRollbackFile(migrationName) {
  const base    = migrationName.replace('.sql', '_down.sql');
  const absPath = path.join(MIGRATIONS_DIR, base);
  return fs.existsSync(absPath) ? absPath : null;
}

/** Execute each SQL statement in a file via an open connection */
async function executeSqlFile(conn, filePath, dryRun = false) {
  const sql = fs.readFileSync(filePath, 'utf8');

  // Normalize: strip comments, split on semicolons
  const statements = sql
    .replace(/--.*$/gm, '')               // strip line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')     // strip block comments
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 3);

  if (dryRun) {
    log(`    [DRY-RUN] Would run ${statements.length} statement(s) from ${path.basename(filePath)}`);
    return statements.length;
  }

  for (const stmt of statements) {
    await conn.query(stmt);
  }
  return statements.length;
}


// ─────────────────────────────────────────
// GET ALL ACTIVE TENANT CONFIGS
// ─────────────────────────────────────────
async function getAllTenants(slugFilter) {
  let sql = `SELECT id, slug, name, db_name, db_host, db_port, db_user, db_password
             FROM   companies
             WHERE  is_active = 1`;
  const params = [];

  if (slugFilter) {
    sql += ' AND slug = ?';
    params.push(slugFilter);
  }

  return await masterPool.query(sql + ' ORDER BY id ASC', params);
}


// ─────────────────────────────────────────
// CONNECT TO TENANT DB
// ─────────────────────────────────────────
async function connectTenant(tenant) {
  return await mariadb.createConnection({
    host:            tenant.db_host || 'localhost',
    port:            tenant.db_port || 3306,
    user:            tenant.db_user,
    password:        tenant.db_password,
    database:        tenant.db_name,
    bigIntAsNumber:  true,
    decimalAsNumber: true,
  });
}


// ─────────────────────────────────────────
// GET APPLIED MIGRATIONS FOR A TENANT
// ─────────────────────────────────────────
async function getAppliedMigrations(conn) {
  try {
    const rows = await conn.query('SELECT migration_name, checksum FROM _migrations');
    return new Map(rows.map(r => [r.migration_name, r.checksum]));
  } catch (_) {
    // _migrations table doesn't exist yet — happens on very first run
    return new Map();
  }
}


// ─────────────────────────────────────────
// MARK MIGRATION APPLIED IN MASTER + TENANT
// ─────────────────────────────────────────
async function markApplied(tenantConn, masterPool, companyId, migrationName, checksum) {
  // Tenant-local record
  await tenantConn.query(
    `INSERT IGNORE INTO _migrations (migration_name, checksum) VALUES (?, ?)`,
    [migrationName, checksum]
  );

  // Master-level record (for global visibility)
  await masterPool.query(
    `INSERT IGNORE INTO tenant_migrations (company_id, migration_name, checksum)
     VALUES (?, ?, ?)`,
    [companyId, migrationName, checksum]
  );
}


// ─────────────────────────────────────────
// RUN MIGRATIONS FOR A SINGLE TENANT
// ─────────────────────────────────────────
async function migrateOneTenant(tenant, migrationFiles, dryRun) {
  const label = `[${tenant.slug}]`;
  log(`${label} Starting migration — DB: ${tenant.db_name}`);

  let conn;
  const report = { slug: tenant.slug, applied: [], skipped: [], failed: [], errors: [] };

  try {
    conn = await connectTenant(tenant);

    // Ensure _migrations table exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id              INT UNSIGNED  PRIMARY KEY AUTO_INCREMENT,
        migration_name  VARCHAR(255)  NOT NULL UNIQUE,
        applied_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        checksum        CHAR(64)      NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const applied = await getAppliedMigrations(conn);

    for (const fileName of migrationFiles) {
      const filePath = path.join(MIGRATIONS_DIR, fileName);
      const checksum = fileChecksum(filePath);

      if (applied.has(fileName)) {
        // Checksum drift detection — warn if file changed since application
        const savedChecksum = applied.get(fileName);
        if (savedChecksum && savedChecksum !== checksum) {
          log(`${label} ⚠️  CHECKSUM MISMATCH: ${fileName} has been modified after application!`);
        }
        log(`${label}   [SKIP] ${fileName}`);
        report.skipped.push(fileName);
        continue;
      }

      log(`${label}   [APPLY] ${fileName}`);

      try {
        // Run in a transaction so a partial migration doesn't corrupt the DB
        await conn.beginTransaction();
        const stmtCount = await executeSqlFile(conn, filePath, dryRun);

        if (!dryRun) {
          await markApplied(conn, masterPool, tenant.id, fileName, checksum);
          await conn.commit();
        }

        log(`${label}   ✅ ${fileName} — ${stmtCount} statement(s)`);
        report.applied.push(fileName);

      } catch (migErr) {
        await conn.rollback();
        log(`${label}   ❌ FAILED: ${fileName} — ${migErr.message}`);
        report.failed.push(fileName);
        report.errors.push({ file: fileName, error: migErr.message });
        // Stop this tenant on failure to avoid cascade issues
        break;
      }
    }

  } catch (connErr) {
    log(`${label} Cannot connect: ${connErr.message}`);
    report.errors.push({ file: 'connection', error: connErr.message });
  } finally {
    if (conn) await conn.end();
  }

  return report;
}


// ─────────────────────────────────────────
// ROLLBACK A MIGRATION FOR ONE TENANT
// ─────────────────────────────────────────
async function rollbackMigration(tenant, migrationPrefix, dryRun) {
  const label = `[${tenant.slug}]`;
  const target = getMigrationFiles().find(f => f.startsWith(migrationPrefix));
  if (!target) throw new Error(`No migration found with prefix: ${migrationPrefix}`);

  const downFile = getRollbackFile(target);
  if (!downFile) throw new Error(`No rollback file found for: ${target}`);

  log(`${label} Rolling back: ${target} using ${path.basename(downFile)}`);
  const conn = await connectTenant(tenant);

  try {
    await conn.beginTransaction();
    await executeSqlFile(conn, downFile, dryRun);

    if (!dryRun) {
      await conn.query('DELETE FROM _migrations WHERE migration_name = ?', [target]);
      await masterPool.query(
        'DELETE FROM tenant_migrations WHERE company_id = ? AND migration_name = ?',
        [tenant.id, target]
      );
      await conn.commit();
    }

    log(`${label} Rollback complete: ${target}`);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}


// ─────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────
async function main() {
  const args      = process.argv.slice(2);
  const slugFilter = args[args.indexOf('--slug') + 1]     || null;
  const dryRun     = args.includes('--dry-run');
  const rollback   = args[args.indexOf('--rollback') + 1] || null;

  log('═══════════════════════════════════════════════════');
  log(`Migration Runner — ${dryRun ? 'DRY RUN ' : ''}${rollback ? 'ROLLBACK' : 'APPLY'}`);
  log('═══════════════════════════════════════════════════');

  const tenants        = await getAllTenants(slugFilter);
  const migrationFiles = getMigrationFiles();

  log(`Tenants: ${tenants.length}  |  Migration files: ${migrationFiles.length}`);
  log(`Migrations dir: ${MIGRATIONS_DIR}`);
  log('');

  const summary = { total: tenants.length, success: 0, partialFail: 0, connectFail: 0 };

  for (const tenant of tenants) {
    let report;
    if (rollback) {
      await rollbackMigration(tenant, rollback, dryRun);
      summary.success++;
    } else {
      report = await migrateOneTenant(tenant, migrationFiles, dryRun);
      if (report.errors.length === 0)    summary.success++;
      else if (report.applied.length > 0) summary.partialFail++;
      else                               summary.connectFail++;
    }
  }

  log('');
  log('═══════════ SUMMARY ═══════════');
  log(`Total tenants  : ${summary.total}`);
  log(`Success        : ${summary.success}`);
  log(`Partial fail   : ${summary.partialFail}`);
  log(`Connect fail   : ${summary.connectFail}`);
  log(`Log file       : ${LOG_FILE}`);
  log('');

  await masterPool.end();
}

main().catch(err => {
  log(`FATAL: ${err.message}`);
  console.error(err);
  process.exit(1);
});
