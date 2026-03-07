/**
 * backup.js
 * ─────────────────────────────────────────────────────────────
 * Backs up ALL tenant databases (or one) using mysqldump.
 * Compresses output with gzip, enforces retention policy,
 * and logs every result to erp_master.backup_logs.
 *
 * Usage:
 *   node scripts/backup.js                          # all tenants
 *   node scripts/backup.js --slug acme-corp         # one tenant
 *   node scripts/backup.js --dry-run                # preview only
 *   node scripts/backup.js --retention 14           # keep N days (default 7)
 *
 * Environment variables (.env):
 *   MASTER_DB_HOST, MASTER_DB_PORT, MASTER_DB_USER, MASTER_DB_PASSWORD
 *   MYSQLDUMP_PATH   — path to mysqldump binary  (default: mysqldump)
 *   BACKUP_ROOT      — directory to store backups (default: ./backups)
 *   BACKUP_RETENTION — days to keep old backups   (default: 7)
 *   BACKUP_COMPRESS  — 'true' (default) to gzip output
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config();

const mariadb     = require('mariadb');
const { execFile } = require('child_process');
const fs          = require('fs');
const path        = require('path');
const zlib        = require('zlib');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);


// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────

const MYSQLDUMP_PATH   = process.env.MYSQLDUMP_PATH   || 'mysqldump';
const BACKUP_ROOT      = process.env.BACKUP_ROOT      || path.join(__dirname, '..', 'backups');
const BACKUP_RETENTION = parseInt(process.env.BACKUP_RETENTION) || 7;   // days
const BACKUP_COMPRESS  = process.env.BACKUP_COMPRESS  !== 'false';       // default true

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

function logLine(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function bytesToMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

/** Ensure a directory exists (recursive) */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Delete files older than retentionDays inside dir matching a glob prefix */
function pruneOldBackups(dir, slug, retentionDays) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let pruned = 0;

  const files = fs.readdirSync(dir).filter(f => f.startsWith(`${slug}_`));
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      pruned++;
      logLine(`  [PRUNE] Deleted old backup: ${file}`);
    }
  }
  return pruned;
}


// ─────────────────────────────────────────
// FETCH TENANTS FROM MASTER
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
// LOG BACKUP RESULT IN MASTER
// ─────────────────────────────────────────

async function logBackupResult(companyId, slug, filePath, sizeMb, status, errorMsg) {
  try {
    await masterPool.query(
      `INSERT INTO backup_logs
         (company_id, backup_file, backup_size_mb, status, error_message, backed_up_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [companyId, filePath, sizeMb, status, errorMsg || null]
    );
  } catch (err) {
    logLine(`  [WARN] Could not write to backup_logs: ${err.message}`);
  }
}


// ─────────────────────────────────────────
// DUMP A SINGLE TENANT DATABASE
// ─────────────────────────────────────────

/**
 * Runs mysqldump for one tenant database.
 * Returns { filePath, sizeMb }.
 */
async function dumpTenantDb(tenant, backupDir, dryRun) {
  const ts       = timestamp();
  const fileName = BACKUP_COMPRESS
    ? `${tenant.slug}_${ts}.sql.gz`
    : `${tenant.slug}_${ts}.sql`;
  const filePath = path.join(backupDir, fileName);

  logLine(`  Dumping ${tenant.db_name} → ${fileName}`);

  if (dryRun) {
    logLine(`  [DRY-RUN] Would execute mysqldump and write to ${filePath}`);
    return { filePath, sizeMb: 0 };
  }

  // Build mysqldump args
  const args = [
    `--host=${tenant.db_host || 'localhost'}`,
    `--port=${tenant.db_port || 3306}`,
    `--user=${tenant.db_user}`,
    `--password=${tenant.db_password}`,
    '--single-transaction',         // consistent snapshot without locking
    '--quick',                      // stream large tables row-by-row
    '--skip-lock-tables',
    '--routines',                   // include stored procedures/functions
    '--triggers',                   // include triggers
    '--events',                     // include scheduled events
    '--hex-blob',                   // safe encoding for BLOB/BINARY data
    '--set-charset',
    '--default-character-set=utf8mb4',
    tenant.db_name,
  ];

  if (BACKUP_COMPRESS) {
    // Pipe mysqldump → gzip → file manually using streams
    await new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const dump  = spawn(MYSQLDUMP_PATH, args);
      const gzip  = zlib.createGzip({ level: 6 });
      const out   = fs.createWriteStream(filePath);

      dump.stdout.pipe(gzip).pipe(out);

      let stderr = '';
      dump.stderr.on('data', d => { stderr += d.toString(); });
      dump.on('error', reject);
      out.on('error', reject);
      out.on('finish', () => {
        if (dump.exitCode !== null && dump.exitCode !== 0) {
          reject(new Error(`mysqldump exited ${dump.exitCode}: ${stderr}`));
        } else {
          resolve();
        }
      });
      dump.on('close', code => {
        if (code !== 0) reject(new Error(`mysqldump exited ${code}: ${stderr}`));
      });
    });
  } else {
    // No compression: write plain SQL
    const { stdout } = await execFileAsync(MYSQLDUMP_PATH, args, { maxBuffer: 512 * 1024 * 1024 });
    fs.writeFileSync(filePath, stdout);
  }

  const stat    = fs.statSync(filePath);
  const sizeMb  = parseFloat(bytesToMB(stat.size));

  return { filePath, sizeMb };
}


// ─────────────────────────────────────────
// BACKUP ONE TENANT (orchestrate)
// ─────────────────────────────────────────

async function backupOneTenant(tenant, backupDir, retentionDays, dryRun) {
  logLine(`\n[${tenant.slug}] Starting backup — DB: ${tenant.db_name}`);

  try {
    const { filePath, sizeMb } = await dumpTenantDb(tenant, backupDir, dryRun);

    if (!dryRun) {
      await logBackupResult(tenant.id, tenant.slug, filePath, sizeMb, 'success', null);

      // Prune backups older than retentionDays
      const pruned = pruneOldBackups(backupDir, tenant.slug, retentionDays);
      if (pruned > 0) logLine(`  [PRUNE] Removed ${pruned} old backup(s) for ${tenant.slug}`);
    }

    logLine(`[${tenant.slug}] ✅ Backup complete — ${sizeMb} MB`);
    return { status: 'success', sizeMb };

  } catch (err) {
    logLine(`[${tenant.slug}] ❌ Backup failed: ${err.message}`);
    if (!dryRun) {
      await logBackupResult(tenant.id, tenant.slug, null, 0, 'failed', err.message);
    }
    return { status: 'failed', error: err.message };
  }
}


// ─────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────

async function main() {
  const args         = process.argv.slice(2);
  const slugFilter   = args[args.indexOf('--slug') + 1]      || null;
  const dryRun       = args.includes('--dry-run');
  const retentionArg = args[args.indexOf('--retention') + 1] || null;
  const retention    = retentionArg ? parseInt(retentionArg) : BACKUP_RETENTION;

  // Create backup directory: backups/YYYY-MM-DD/
  const dateDir  = new Date().toISOString().slice(0, 10);
  const backupDir = path.join(BACKUP_ROOT, dateDir);
  if (!dryRun) ensureDir(backupDir);

  logLine('═══════════════════════════════════════════════════');
  logLine(`Backup Runner — ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  logLine(`Backup root  : ${BACKUP_ROOT}`);
  logLine(`Today's dir  : ${backupDir}`);
  logLine(`Retention    : ${retention} day(s)`);
  logLine(`Compression  : ${BACKUP_COMPRESS ? 'gzip' : 'none'}`);
  logLine('═══════════════════════════════════════════════════');

  const tenants = await getAllTenants(slugFilter);
  logLine(`Tenants found: ${tenants.length}\n`);

  const summary = { total: tenants.length, success: 0, failed: 0, totalMb: 0 };

  for (const tenant of tenants) {
    const result = await backupOneTenant(tenant, backupDir, retention, dryRun);
    if (result.status === 'success') {
      summary.success++;
      summary.totalMb += result.sizeMb || 0;
    } else {
      summary.failed++;
    }
  }

  logLine('\n═══════════════════ SUMMARY ═══════════════════');
  logLine(`Total tenants : ${summary.total}`);
  logLine(`Success       : ${summary.success}`);
  logLine(`Failed        : ${summary.failed}`);
  logLine(`Total size    : ${summary.totalMb.toFixed(2)} MB`);
  logLine(`Backup dir    : ${backupDir}`);
  logLine('═══════════════════════════════════════════════');

  await masterPool.end();

  if (summary.failed > 0) process.exit(1);
}

main().catch(err => {
  console.error(`FATAL: ${err.message}`);
  console.error(err);
  process.exit(1);
});
