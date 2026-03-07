/**
 * restore.js
 * ─────────────────────────────────────────────────────────────
 * Restores a tenant database from a backup file (.sql or .sql.gz).
 * Steps:
 *   1. Fetch tenant credentials from erp_master
 *   2. Drop existing database (with confirmation flag)
 *   3. Recreate database + re-grant user permissions
 *   4. Feed backup file through mysql CLI (or gunzip | mysql)
 *   5. Log restore event to master_audit_log
 *
 * Usage:
 *   node scripts/restore.js --slug acme-corp --file ./backups/2025-01-15/acme-corp_2025-01-15T12-00-00.sql.gz
 *   node scripts/restore.js --slug acme-corp --file ./backup.sql --yes    # skip confirmation prompt
 *   node scripts/restore.js --slug acme-corp --file ./backup.sql --dry-run
 *
 * Environment variables (.env):
 *   MASTER_DB_HOST, MASTER_DB_PORT, MASTER_DB_USER, MASTER_DB_PASSWORD
 *   MYSQL_PATH       — path to mysql binary    (default: mysql)
 *   MYSQLDUMP_PATH   — path to mysqldump       (default: mysqldump)
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config();

const mariadb  = require('mariadb');
const fs       = require('fs');
const path     = require('path');
const zlib     = require('zlib');
const readline = require('readline');
const { spawn } = require('child_process');


// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────

const MYSQL_PATH     = process.env.MYSQL_PATH     || 'mysql';
const MYSQLDUMP_PATH = process.env.MYSQLDUMP_PATH || 'mysqldump';

const MASTER_CONFIG = {
  host:            process.env.MASTER_DB_HOST     || 'localhost',
  port:            parseInt(process.env.MASTER_DB_PORT) || 3306,
  user:            process.env.MASTER_DB_USER     || 'root',
  password:        process.env.MASTER_DB_PASSWORD || '',
  database:        'erp_master',
  bigIntAsNumber:  true,
  decimalAsNumber: true,
};


// ─────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────

function logLine(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

/** Ask user a yes/no question on stdin */
function confirm(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${question} [y/N] `, answer => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

/** Spawn a child process, piping a readable stream to its stdin */
function pipeToProcess(sourceStream, command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'inherit', 'pipe'] });

    sourceStream.pipe(child.stdin);
    sourceStream.on('error', reject);

    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(command)} exited ${code}: ${stderr}`));
      }
    });
  });
}


// ─────────────────────────────────────────
// FETCH TENANT FROM MASTER
// ─────────────────────────────────────────

async function fetchTenant(slug) {
  const conn = await mariadb.createConnection(MASTER_CONFIG);
  try {
    const rows = await conn.query(
      `SELECT id, slug, name, db_name, db_host, db_port, db_user, db_password
       FROM   companies
       WHERE  slug = ?
       LIMIT  1`,
      [slug]
    );
    return rows.length > 0 ? rows[0] : null;
  } finally {
    await conn.end();
  }
}


// ─────────────────────────────────────────
// RECREATE DATABASE + REGRANT USER
// ─────────────────────────────────────────

async function recreateDatabase(tenant, dryRun) {
  logLine(`  Recreating database: ${tenant.db_name}`);

  if (dryRun) {
    logLine(`  [DRY-RUN] Would DROP DATABASE IF EXISTS \`${tenant.db_name}\` then recreate`);
    return;
  }

  // Connect as root (no database selected)
  const rootConn = await mariadb.createConnection({
    ...MASTER_CONFIG,
    database: undefined,
  });

  try {
    await rootConn.query(`DROP DATABASE IF EXISTS \`${tenant.db_name}\``);
    logLine(`  Dropped database: ${tenant.db_name}`);

    await rootConn.query(
      `CREATE DATABASE \`${tenant.db_name}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    logLine(`  Created database: ${tenant.db_name}`);

    // Ensure user exists and has grants
    await rootConn.query(
      `CREATE USER IF NOT EXISTS '${tenant.db_user}'@'%' IDENTIFIED BY '${tenant.db_password}'`
    );
    await rootConn.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES
       ON \`${tenant.db_name}\`.* TO '${tenant.db_user}'@'%'`
    );
    await rootConn.query(`FLUSH PRIVILEGES`);
    logLine(`  Grants restored for user: ${tenant.db_user}`);

  } finally {
    await rootConn.end();
  }
}


// ─────────────────────────────────────────
// RESTORE BACKUP FILE INTO DATABASE
// ─────────────────────────────────────────

async function restoreBackupFile(tenant, filePath, dryRun) {
  const isGzipped = filePath.endsWith('.gz');
  logLine(`  Restoring from: ${path.basename(filePath)} ${isGzipped ? '(gzipped)' : ''}`);

  if (dryRun) {
    logLine(`  [DRY-RUN] Would pipe ${path.basename(filePath)} into mysql`);
    return;
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file not found: ${filePath}`);
  }

  // Build mysql CLI args
  const mysqlArgs = [
    `--host=${tenant.db_host || 'localhost'}`,
    `--port=${tenant.db_port || 3306}`,
    `--user=${tenant.db_user}`,
    `--password=${tenant.db_password}`,
    '--default-character-set=utf8mb4',
    '--max_allowed_packet=512M',
    tenant.db_name,
  ];

  const fileStream = fs.createReadStream(filePath);

  if (isGzipped) {
    // Decompress on the fly: file → gunzip → mysql stdin
    const gunzip = zlib.createGunzip();
    fileStream.pipe(gunzip);
    await pipeToProcess(gunzip, MYSQL_PATH, mysqlArgs);
  } else {
    // Plain SQL: file → mysql stdin
    await pipeToProcess(fileStream, MYSQL_PATH, mysqlArgs);
  }

  logLine(`  Restore complete.`);
}


// ─────────────────────────────────────────
// LOG RESTORE EVENT IN MASTER
// ─────────────────────────────────────────

async function logRestoreEvent(companyId, slug, filePath, actor) {
  const conn = await mariadb.createConnection(MASTER_CONFIG);
  try {
    await conn.query(
      `INSERT INTO master_audit_log (company_id, action, details, actor)
       VALUES (?, 'TENANT_RESTORED', ?, ?)`,
      [
        companyId,
        JSON.stringify({ slug, restored_from: path.basename(filePath), restored_at: new Date().toISOString() }),
        actor || 'system',
      ]
    );
  } finally {
    await conn.end();
  }
}


// ─────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────

async function main() {
  const args    = process.argv.slice(2);
  const get     = flag => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

  const slug    = get('--slug');
  const file    = get('--file');
  const dryRun  = args.includes('--dry-run');
  const yes     = args.includes('--yes');    // skip confirmation prompt
  const actor   = get('--actor') || 'operator';

  if (!slug || !file) {
    console.error('Usage: node restore.js --slug <tenant-slug> --file <backup-file> [--yes] [--dry-run]');
    process.exit(1);
  }

  const absFile = path.resolve(file);

  logLine('═══════════════════════════════════════════════════');
  logLine(`Restore Runner — ${dryRun ? 'DRY RUN' : 'LIVE ⚠️  DESTRUCTIVE'}`);
  logLine(`Tenant slug  : ${slug}`);
  logLine(`Backup file  : ${absFile}`);
  logLine('═══════════════════════════════════════════════════');

  // 1. Fetch tenant credentials
  logLine(`\n[1/4] Fetching tenant credentials...`);
  const tenant = await fetchTenant(slug);
  if (!tenant) {
    console.error(`❌ Tenant not found in erp_master: ${slug}`);
    process.exit(1);
  }
  logLine(`  Found: ${tenant.name} → ${tenant.db_name}`);

  // 2. Confirm (unless --yes or --dry-run)
  if (!dryRun && !yes) {
    console.log(`\n⚠️  WARNING: This will DROP and recreate database '${tenant.db_name}'.`);
    console.log(`   ALL CURRENT DATA WILL BE LOST and replaced with the backup.`);
    const ok = await confirm(`Are you sure you want to restore '${slug}'?`);
    if (!ok) {
      logLine('Restore cancelled by user.');
      process.exit(0);
    }
  }

  // 3. Recreate database
  logLine(`\n[2/4] Recreating database...`);
  await recreateDatabase(tenant, dryRun);

  // 4. Restore backup
  logLine(`\n[3/4] Restoring backup file...`);
  await restoreBackupFile(tenant, absFile, dryRun);

  // 5. Log event
  logLine(`\n[4/4] Logging restore event...`);
  if (!dryRun) {
    await logRestoreEvent(tenant.id, slug, absFile, actor);
  }

  logLine('\n✅ Restore completed successfully!');
  logLine(`   Tenant  : ${tenant.name} (${slug})`);
  logLine(`   Database: ${tenant.db_name}`);
  logLine(`   From    : ${path.basename(absFile)}`);
}

main().catch(err => {
  console.error(`\n❌ FATAL: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
