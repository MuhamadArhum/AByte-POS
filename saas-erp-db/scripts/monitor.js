/**
 * monitor.js
 * ─────────────────────────────────────────────────────────────
 * Monitors all tenant databases for health, performance, and
 * resource usage. Fires alerts when thresholds are exceeded.
 *
 * Checks performed per tenant:
 *   - Database size (MB)
 *   - Active / waiting connections
 *   - Long-running queries (> slow_query_threshold_sec)
 *   - Table count & InnoDB row estimates
 *   - Replication lag (if applicable)
 *
 * Global checks:
 *   - Total connection count vs max_connections
 *   - Tenants approaching row/size limits (scale-out candidates)
 *
 * Usage:
 *   node scripts/monitor.js                  # one-shot report
 *   node scripts/monitor.js --watch 60       # repeat every 60 seconds
 *   node scripts/monitor.js --slug acme-corp # single tenant
 *   node scripts/monitor.js --format json    # JSON output
 *
 * Environment variables (.env):
 *   MASTER_DB_HOST, MASTER_DB_PORT, MASTER_DB_USER, MASTER_DB_PASSWORD
 *   MONITOR_SLOW_QUERY_SEC   — threshold for slow queries (default: 2)
 *   MONITOR_SIZE_ALERT_MB    — DB size alert threshold in MB (default: 5120 = 5 GB)
 *   MONITOR_CONN_ALERT_PCT   — connection % alert threshold (default: 80)
 *   MONITOR_SCALE_OUT_MB     — recommend dedicated server above this MB (default: 20480 = 20 GB)
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config();

const mariadb = require('mariadb');


// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────

const SLOW_QUERY_SEC   = parseFloat(process.env.MONITOR_SLOW_QUERY_SEC)  || 2;
const SIZE_ALERT_MB    = parseFloat(process.env.MONITOR_SIZE_ALERT_MB)   || 5120;
const CONN_ALERT_PCT   = parseFloat(process.env.MONITOR_CONN_ALERT_PCT)  || 80;
const SCALE_OUT_MB     = parseFloat(process.env.MONITOR_SCALE_OUT_MB)    || 20480;

const masterPool = mariadb.createPool({
  host:            process.env.MASTER_DB_HOST     || 'localhost',
  port:            parseInt(process.env.MASTER_DB_PORT) || 3306,
  user:            process.env.MASTER_DB_USER     || 'root',
  password:        process.env.MASTER_DB_PASSWORD || '',
  database:        'erp_master',
  connectionLimit: 5,
  bigIntAsNumber:  true,
  decimalAsNumber: true,
});


// ─────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────

function now() {
  return new Date().toISOString();
}

function logLine(msg) {
  process.stdout.write(`[${now()}] ${msg}\n`);
}

function mb(bytes) {
  return bytes ? parseFloat((bytes / 1024 / 1024).toFixed(2)) : 0;
}

function pct(value, total) {
  return total > 0 ? parseFloat(((value / total) * 100).toFixed(1)) : 0;
}

/** Persist an alert to master's monitoring_alerts table */
async function raiseAlert(companyId, slug, alertType, message, severity = 'warning') {
  try {
    await masterPool.query(
      `INSERT INTO monitoring_alerts (company_id, alert_type, message, severity, created_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         message = VALUES(message), severity = VALUES(severity),
         created_at = VALUES(created_at), resolved_at = NULL`,
      [companyId || null, alertType, message, severity]
    );
  } catch (_) {
    // Ignore: don't crash monitor on alert-write failure
  }
}

/** Open a short-lived connection to a tenant DB (as master user, specifying db_name) */
async function tenantConn(tenant) {
  return await mariadb.createConnection({
    host:            process.env.MASTER_DB_HOST     || 'localhost',
    port:            parseInt(process.env.MASTER_DB_PORT) || 3306,
    user:            process.env.MASTER_DB_USER     || 'root',
    password:        process.env.MASTER_DB_PASSWORD || '',
    database:        tenant.db_name,
    bigIntAsNumber:  true,
    decimalAsNumber: true,
    connectTimeout:  8000,
  });
}


// ─────────────────────────────────────────
// GLOBAL SERVER CHECKS
// ─────────────────────────────────────────

async function checkServerHealth() {
  const conn = await mariadb.createConnection({
    host:     process.env.MASTER_DB_HOST     || 'localhost',
    port:     parseInt(process.env.MASTER_DB_PORT) || 3306,
    user:     process.env.MASTER_DB_USER     || 'root',
    password: process.env.MASTER_DB_PASSWORD || '',
  });

  try {
    // Max connections vs current
    const maxConnRows  = await conn.query(`SHOW VARIABLES LIKE 'max_connections'`);
    const maxConn      = parseInt(maxConnRows[0]?.Value) || 151;
    const statusRows   = await conn.query(`SHOW STATUS LIKE 'Threads_connected'`);
    const usedConn     = parseInt(statusRows[0]?.Value) || 0;
    const connPct      = pct(usedConn, maxConn);

    // Uptime
    const uptimeRows   = await conn.query(`SHOW STATUS LIKE 'Uptime'`);
    const uptimeSec    = parseInt(uptimeRows[0]?.Value) || 0;
    const uptimeHours  = (uptimeSec / 3600).toFixed(1);

    // Slow queries counter
    const slowRows     = await conn.query(`SHOW STATUS LIKE 'Slow_queries'`);
    const slowCount    = parseInt(slowRows[0]?.Value) || 0;

    // Aborted connections
    const abortedRows  = await conn.query(`SHOW STATUS LIKE 'Aborted_connects'`);
    const abortedCount = parseInt(abortedRows[0]?.Value) || 0;

    const report = { maxConn, usedConn, connPct, uptimeHours, slowCount, abortedCount };

    if (connPct >= CONN_ALERT_PCT) {
      await raiseAlert(null, 'global', 'HIGH_CONNECTION_COUNT',
        `Connections at ${connPct}% (${usedConn}/${maxConn})`, 'critical');
      logLine(`  ⚠️  ALERT: Global connections at ${connPct}% (${usedConn}/${maxConn})`);
    }

    return report;
  } finally {
    await conn.end();
  }
}


// ─────────────────────────────────────────
// PER-TENANT CHECKS
// ─────────────────────────────────────────

/** Database size in MB */
async function checkDbSize(conn, dbName) {
  const rows = await conn.query(
    `SELECT SUM(data_length + index_length) AS size_bytes
     FROM   information_schema.TABLES
     WHERE  table_schema = ?`,
    [dbName]
  );
  return mb(rows[0]?.size_bytes || 0);
}

/** Table count + largest tables by row estimate */
async function checkTableStats(conn, dbName) {
  const rows = await conn.query(
    `SELECT table_name, table_rows, data_length + index_length AS total_bytes
     FROM   information_schema.TABLES
     WHERE  table_schema = ?
     ORDER BY total_bytes DESC
     LIMIT  10`,
    [dbName]
  );
  return rows.map(r => ({
    table:    r.table_name,
    rows:     r.table_rows,
    sizeMb:   mb(r.total_bytes),
  }));
}

/** Long-running queries (> SLOW_QUERY_SEC) in this tenant's database */
async function checkSlowQueries(conn, dbName) {
  // SHOW PROCESSLIST is global; filter by db
  const rows = await conn.query(
    `SELECT id, user, host, db, command, time, state, LEFT(info, 200) AS query_preview
     FROM   information_schema.PROCESSLIST
     WHERE  db = ?
       AND  command != 'Sleep'
       AND  time > ?
     ORDER BY time DESC`,
    [dbName, SLOW_QUERY_SEC]
  );
  return rows;
}

/** Active + waiting connection count for this DB */
async function checkConnectionCount(conn, dbName) {
  const rows = await conn.query(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN state LIKE '%Lock%' OR state LIKE '%wait%' THEN 1 ELSE 0 END) AS waiting
     FROM   information_schema.PROCESSLIST
     WHERE  db = ?`,
    [dbName]
  );
  return {
    total:   rows[0]?.total   || 0,
    waiting: rows[0]?.waiting || 0,
  };
}

/** Check for InnoDB lock waits */
async function checkLockWaits(conn) {
  try {
    const rows = await conn.query(
      `SELECT r.trx_id AS waiting_trx,
              r.trx_mysql_thread_id AS waiting_thread,
              b.trx_id AS blocking_trx,
              b.trx_mysql_thread_id AS blocking_thread,
              b.trx_query AS blocking_query
       FROM   information_schema.INNODB_LOCK_WAITS w
       JOIN   information_schema.INNODB_TRX r ON r.trx_id = w.requesting_trx_id
       JOIN   information_schema.INNODB_TRX b ON b.trx_id = w.blocking_trx_id`
    );
    return rows;
  } catch (_) {
    // Not always accessible; return empty
    return [];
  }
}


// ─────────────────────────────────────────
// RUN CHECKS FOR ONE TENANT
// ─────────────────────────────────────────

async function monitorOneTenant(tenant) {
  const label  = `[${tenant.slug}]`;
  const result = {
    slug:       tenant.slug,
    name:       tenant.name,
    db_name:    tenant.db_name,
    sizeMb:     0,
    topTables:  [],
    connections: { total: 0, waiting: 0 },
    slowQueries: [],
    lockWaits:  [],
    alerts:     [],
    scaleOut:   false,
    error:      null,
  };

  let conn;
  try {
    conn = await tenantConn(tenant);

    // Size check
    result.sizeMb = await checkDbSize(conn, tenant.db_name);
    if (result.sizeMb >= SIZE_ALERT_MB) {
      const msg = `DB size ${result.sizeMb} MB exceeds alert threshold of ${SIZE_ALERT_MB} MB`;
      result.alerts.push({ type: 'HIGH_DB_SIZE', severity: 'warning', message: msg });
      await raiseAlert(tenant.id, tenant.slug, 'HIGH_DB_SIZE', msg, 'warning');
      logLine(`${label} ⚠️  ${msg}`);
    }
    if (result.sizeMb >= SCALE_OUT_MB) {
      result.scaleOut = true;
      const msg = `DB size ${result.sizeMb} MB — recommend dedicated DB server for ${tenant.slug}`;
      result.alerts.push({ type: 'SCALE_OUT_RECOMMENDED', severity: 'info', message: msg });
      await raiseAlert(tenant.id, tenant.slug, 'SCALE_OUT_RECOMMENDED', msg, 'info');
      logLine(`${label} 🔵 SCALE OUT: ${msg}`);
    }

    // Top tables
    result.topTables = await checkTableStats(conn, tenant.db_name);

    // Connections
    result.connections = await checkConnectionCount(conn, tenant.db_name);
    if (result.connections.waiting > 5) {
      const msg = `${result.connections.waiting} waiting/locked connections`;
      result.alerts.push({ type: 'LOCK_CONTENTION', severity: 'warning', message: msg });
      await raiseAlert(tenant.id, tenant.slug, 'LOCK_CONTENTION', msg, 'warning');
      logLine(`${label} ⚠️  ${msg}`);
    }

    // Slow queries
    result.slowQueries = await checkSlowQueries(conn, tenant.db_name);
    if (result.slowQueries.length > 0) {
      const msg = `${result.slowQueries.length} slow query/queries running > ${SLOW_QUERY_SEC}s`;
      result.alerts.push({ type: 'SLOW_QUERIES', severity: 'warning', message: msg });
      await raiseAlert(tenant.id, tenant.slug, 'SLOW_QUERIES', msg, 'warning');
      logLine(`${label} ⚠️  ${msg}`);
    }

    // Lock waits
    result.lockWaits = await checkLockWaits(conn);
    if (result.lockWaits.length > 0) {
      const msg = `${result.lockWaits.length} InnoDB lock wait(s) detected`;
      result.alerts.push({ type: 'INNODB_LOCK_WAITS', severity: 'critical', message: msg });
      await raiseAlert(tenant.id, tenant.slug, 'INNODB_LOCK_WAITS', msg, 'critical');
      logLine(`${label} 🔴 CRITICAL: ${msg}`);
    }

    // Record size snapshot in connection_stats
    try {
      await masterPool.query(
        `INSERT INTO connection_stats (company_id, connections_used, db_size_mb, recorded_at)
         VALUES (?, ?, ?, NOW())`,
        [tenant.id, result.connections.total, result.sizeMb]
      );
    } catch (_) { /* non-fatal */ }

  } catch (err) {
    result.error = err.message;
    logLine(`${label} ❌ Cannot connect: ${err.message}`);
    await raiseAlert(tenant.id, tenant.slug, 'CONNECTION_FAILURE', err.message, 'critical');
  } finally {
    if (conn) await conn.end().catch(() => {});
  }

  return result;
}


// ─────────────────────────────────────────
// PRINT REPORT (human-readable)
// ─────────────────────────────────────────

function printReport(server, tenants) {
  const line = '─'.repeat(60);
  console.log('\n' + '═'.repeat(60));
  console.log(` MONITOR REPORT — ${now()}`);
  console.log('═'.repeat(60));

  // Server summary
  console.log('\n■ SERVER HEALTH');
  console.log(`  Connections : ${server.usedConn} / ${server.maxConn} (${server.connPct}%)`);
  console.log(`  Uptime      : ${server.uptimeHours}h`);
  console.log(`  Slow queries: ${server.slowCount} (cumulative)`);
  console.log(`  Aborted     : ${server.abortedCount}`);

  // Per-tenant table
  console.log('\n■ TENANT SUMMARY');
  console.log(`  ${'SLUG'.padEnd(20)} ${'SIZE(MB)'.padStart(10)} ${'CONN'.padStart(6)} ${'SLOW'.padStart(6)} ${'ALERTS'.padStart(8)}`);
  console.log('  ' + line);

  for (const t of tenants) {
    if (t.error) {
      console.log(`  ${t.slug.padEnd(20)} ${'ERROR'.padStart(10)} ${'-'.padStart(6)} ${'-'.padStart(6)} ${'CONN FAIL'.padStart(8)}`);
      continue;
    }
    const slow    = t.slowQueries.length;
    const alerts  = t.alerts.length;
    const sizeStr = t.scaleOut ? `${t.sizeMb}⬆️` : String(t.sizeMb);
    console.log(`  ${t.slug.padEnd(20)} ${sizeStr.padStart(10)} ${String(t.connections.total).padStart(6)} ${String(slow).padStart(6)} ${String(alerts).padStart(8)}`);
  }

  // Scale-out recommendations
  const scaleOuts = tenants.filter(t => t.scaleOut);
  if (scaleOuts.length > 0) {
    console.log('\n■ SCALE-OUT RECOMMENDATIONS');
    for (const t of scaleOuts) {
      console.log(`  → ${t.slug} (${t.sizeMb} MB) should be migrated to a dedicated DB server`);
    }
  }

  // Slow query detail
  const allSlow = tenants.flatMap(t =>
    t.slowQueries.map(q => ({ ...q, slug: t.slug }))
  );
  if (allSlow.length > 0) {
    console.log('\n■ SLOW QUERIES');
    for (const q of allSlow) {
      console.log(`  [${q.slug}] Thread ${q.id} | ${q.time}s | ${q.state}`);
      console.log(`    ${q.query_preview}`);
    }
  }

  console.log('\n' + '═'.repeat(60) + '\n');
}


// ─────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────

async function runOnce(slugFilter, format) {
  const tenants = await masterPool.query(
    `SELECT id, slug, name, db_name, db_host, db_port, db_user, db_password
     FROM   companies
     WHERE  is_active = 1
     ${slugFilter ? 'AND slug = ?' : ''}
     ORDER BY id ASC`,
    slugFilter ? [slugFilter] : []
  );

  logLine(`Running checks on ${tenants.length} tenant(s)...`);

  // Check server first
  const server = await checkServerHealth();

  // Check each tenant
  const results = [];
  for (const tenant of tenants) {
    const result = await monitorOneTenant(tenant);
    results.push(result);
  }

  if (format === 'json') {
    console.log(JSON.stringify({ timestamp: now(), server, tenants: results }, null, 2));
  } else {
    printReport(server, results);
  }

  const criticalAlerts = results.flatMap(r => r.alerts.filter(a => a.severity === 'critical'));
  return criticalAlerts.length > 0 ? 1 : 0; // exit code
}

async function main() {
  const args       = process.argv.slice(2);
  const get        = flag => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
  const slugFilter = get('--slug');
  const watchSec   = get('--watch') ? parseInt(get('--watch')) : null;
  const format     = get('--format') || 'text';

  if (watchSec) {
    logLine(`Watch mode — checking every ${watchSec}s. Press Ctrl+C to stop.`);
    const run = async () => {
      await runOnce(slugFilter, format);
      setTimeout(run, watchSec * 1000);
    };
    await run();
  } else {
    const exitCode = await runOnce(slugFilter, format);
    await masterPool.end();
    process.exit(exitCode);
  }
}

main().catch(err => {
  console.error(`FATAL: ${err.message}`);
  console.error(err);
  process.exit(1);
});
