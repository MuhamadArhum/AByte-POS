# saas-erp-db — Multi-Tenant MariaDB Architecture

Production-ready database layer for a multi-tenant SaaS ERP.
Each tenant gets an **isolated database** (database-per-tenant model) with a
dedicated restricted MariaDB user. A shared `erp_master` database tracks
companies, migrations, backups, and monitoring.

---

## Folder Structure

```
saas-erp-db/
│
├── master/
│   └── create_master.sql          # Create erp_master + all global tables
│
├── tenant/
│   └── migrations/
│       ├── 001_initial_schema.sql # Full ERP schema (all modules)
│       ├── 002_add_indexes.sql    # Composite & covering indexes
│       └── NNN_<name>_down.sql   # Optional rollback files (naming convention)
│
├── middleware/
│   └── tenantDb.js                # Express middleware — pool-per-tenant injected as req.tenantDb
│
├── scripts/
│   ├── create_tenant.js           # Onboard a new tenant (DB + user + migrations + master record)
│   ├── run_migrations.js          # Apply pending migrations to all (or one) tenant DB(s)
│   ├── backup.js                  # Dump all tenant DBs to gzipped files with retention policy
│   ├── restore.js                 # Restore one tenant DB from a backup file
│   └── monitor.js                 # Health checks: size, connections, slow queries, lock waits
│
├── backups/                        # Created automatically by backup.js
│   └── YYYY-MM-DD/
│       └── <slug>_<timestamp>.sql.gz
│
├── logs/                           # Created automatically by run_migrations.js
│   └── migrations_<timestamp>.log
│
├── .env.example                    # All required environment variables
└── README.md                       # This file
```

---

## Quick Start

### 1. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your MariaDB credentials
```

### 2. Create the master database

```bash
mysql -u root -p < master/create_master.sql
```

### 3. Onboard your first tenant

```bash
node scripts/create_tenant.js \
  --name "Acme Corporation" \
  --slug "acme-corp" \
  --email "admin@acme.com" \
  --plan "growth"
```

### 4. Add the middleware to your Express app

```js
const { requireTenantDb } = require('./middleware/tenantDb');

// JWT verify must run BEFORE requireTenantDb
// JWT payload must include: { company_id: <int>, slug: <string> }
app.use('/api', verifyJwt, requireTenantDb, router);

// In your route handlers:
router.get('/products', async (req, res) => {
  const products = await req.tenantDb.query('SELECT * FROM products');
  res.json(products);
});
```

---

## Scripts Reference

### `create_tenant.js` — Onboard a new tenant

Creates the database, restricted user, runs all migrations, registers in master,
and seeds default data (warehouse, department, category).

```bash
node scripts/create_tenant.js \
  --name   "Company Name" \
  --slug   "company-slug"    \  # URL-safe, becomes DB name suffix
  --email  "owner@company.com" \
  --plan   "starter|growth|enterprise"   \  # controls pool size
  --max-users  25
```

### `run_migrations.js` — Apply / rollback migrations

```bash
# Apply to all tenants
node scripts/run_migrations.js

# Apply to one tenant
node scripts/run_migrations.js --slug acme-corp

# Preview without executing
node scripts/run_migrations.js --dry-run

# Rollback migration 003 (requires 003_..._down.sql)
node scripts/run_migrations.js --rollback 003 --slug acme-corp
```

Migration files must be named `NNN_description.sql` (e.g. `003_add_coupons.sql`).
Rollback files must be named `NNN_description_down.sql`.

Each migration is wrapped in a transaction. A checksum is recorded after
application — if the file changes later, a drift warning is logged.

### `backup.js` — Backup all tenant databases

```bash
# Backup all active tenants (gzipped, default 7-day retention)
node scripts/backup.js

# Backup one tenant
node scripts/backup.js --slug acme-corp

# Custom retention period
node scripts/backup.js --retention 30

# Dry run (preview only)
node scripts/backup.js --dry-run
```

Backups are stored in `backups/YYYY-MM-DD/<slug>_<timestamp>.sql.gz`.
Results are logged to `erp_master.backup_logs`.

**Recommended: run daily via cron**
```cron
0 2 * * * cd /opt/erp && node scripts/backup.js >> logs/backup.log 2>&1
```

### `restore.js` — Restore a tenant from backup

```bash
# Interactive (will prompt for confirmation)
node scripts/restore.js \
  --slug acme-corp \
  --file ./backups/2025-01-15/acme-corp_2025-01-15T02-00-00.sql.gz

# Skip confirmation prompt (for automation)
node scripts/restore.js --slug acme-corp --file ./backup.sql.gz --yes

# Dry run
node scripts/restore.js --slug acme-corp --file ./backup.sql.gz --dry-run
```

⚠️ Restore **drops and recreates** the database. All current data is replaced.

### `monitor.js` — Health monitoring

```bash
# One-shot report (text)
node scripts/monitor.js

# Monitor single tenant
node scripts/monitor.js --slug acme-corp

# Watch mode — check every 60 seconds
node scripts/monitor.js --watch 60

# JSON output (for integration with dashboards)
node scripts/monitor.js --format json
```

Checks performed:
- Database size (alerts at `MONITOR_SIZE_ALERT_MB`, recommends dedicated server at `MONITOR_SCALE_OUT_MB`)
- Connection count and lock contention
- Slow queries running longer than `MONITOR_SLOW_QUERY_SEC` seconds
- InnoDB lock waits
- Global server health (max_connections usage, uptime, aborted connects)

Alerts are written to `erp_master.monitoring_alerts`.

**Recommended: run every 5 minutes via cron**
```cron
*/5 * * * * cd /opt/erp && node scripts/monitor.js >> logs/monitor.log 2>&1
```

---

## Tenant Isolation Model

| Concern           | Approach                                        |
|-------------------|-------------------------------------------------|
| Data isolation    | Separate database per tenant                   |
| Auth isolation    | Dedicated MariaDB user per tenant (min grants) |
| Connection pooling| Per-tenant pool cached in memory (LRU eviction)|
| Migration tracking| `_migrations` table inside each tenant DB      |
| Global visibility | `tenant_migrations` in erp_master              |
| Pool sizing       | Based on plan: starter=3, growth=10, enterprise=25 |

---

## Scaling Guide

### When a tenant outgrows shared hosting

`monitor.js` will flag tenants with `SCALE_OUT_RECOMMENDED` when their DB
exceeds `MONITOR_SCALE_OUT_MB` (default 20 GB).

To migrate that tenant to a dedicated server:

1. **Backup** current DB: `node scripts/backup.js --slug acme-corp`
2. **Provision** new MariaDB server
3. **Restore** to new server: `node scripts/restore.js --slug acme-corp --file ./backup.sql.gz`
4. **Update master record**:
   ```sql
   UPDATE companies
   SET db_host = 'new-db-host', db_port = 3306
   WHERE slug = 'acme-corp';
   ```
5. **Evict pool** (or restart app): the middleware will pick up new credentials on next request

### Read replicas

For high-read tenants, add a replica and route read-only queries through it:
```js
// In tenantDb.js getOrCreatePool(), add a secondary read pool:
const readPool = mariadb.createPool({ host: creds.db_read_host, ... });
wrappedPool.readQuery = async (sql, params) => readPool.query(sql, params);
```

---

## Environment Variables

```env
# Master database (root-level access for provisioning)
MASTER_DB_HOST=localhost
MASTER_DB_PORT=3306
MASTER_DB_USER=root
MASTER_DB_PASSWORD=your_root_password

# Host where tenant DBs live (can differ from master host)
DB_HOST_FOR_TENANTS=localhost
DB_PORT_FOR_TENANTS=3306

# Migrations directory (absolute path)
MIGRATIONS_DIR=/opt/erp/saas-erp-db/tenant/migrations

# Backup settings
BACKUP_ROOT=/opt/erp/backups
BACKUP_RETENTION=7
BACKUP_COMPRESS=true
MYSQLDUMP_PATH=mysqldump
MYSQL_PATH=mysql

# Monitor thresholds
MONITOR_SLOW_QUERY_SEC=2
MONITOR_SIZE_ALERT_MB=5120
MONITOR_CONN_ALERT_PCT=80
MONITOR_SCALE_OUT_MB=20480
```

---

## erp_master Tables

| Table               | Purpose                                          |
|---------------------|--------------------------------------------------|
| `companies`         | Tenant registry — credentials, plan, status      |
| `tenant_migrations` | Global migration history (all tenants)           |
| `backup_logs`       | Backup run history — status, file, size          |
| `monitoring_alerts` | Active alerts raised by monitor.js               |
| `connection_stats`  | Periodic snapshots of connection & size metrics  |
| `master_audit_log`  | Administrative events (create, suspend, restore) |
