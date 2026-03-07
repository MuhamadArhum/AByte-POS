/**
 * tenantDb.js
 * ─────────────────────────────────────────────────────────────
 * Express middleware that:
 *   1. Reads company_id (or slug) from the verified JWT token
 *   2. Looks up tenant DB credentials in erp_master
 *   3. Returns a cached connection pool (creates one if cold)
 *   4. Injects `req.tenantDb` — a pool with helper query methods
 *
 * Usage in routes:
 *   router.get('/products', requireTenantDb, async (req, res) => {
 *     const products = await req.tenantDb.query('SELECT * FROM products');
 *     res.json(products);
 *   });
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config();

const mariadb = require('mariadb');

// ─────────────────────────────────────────
// MASTER DB POOL (shared, small)
// ─────────────────────────────────────────
const masterPool = mariadb.createPool({
  host:             process.env.MASTER_DB_HOST     || 'localhost',
  port:             parseInt(process.env.MASTER_DB_PORT) || 3306,
  user:             process.env.MASTER_DB_USER     || 'root',
  password:         process.env.MASTER_DB_PASSWORD || '',
  database:         'erp_master',
  connectionLimit:  5,       // master is only for credential lookups
  acquireTimeout:   10000,
  bigIntAsNumber:   true,
  decimalAsNumber:  true,
});

// ─────────────────────────────────────────
// TENANT POOL CACHE
// Key: company slug (string)
// Value: { pool, lastUsed, config }
// ─────────────────────────────────────────
const tenantPools = new Map();

// Pool config per plan
const POOL_SIZES = {
  starter:    3,
  growth:     10,
  enterprise: 25,
};

// Idle timeout: evict pools unused for 15 minutes to free connections
const IDLE_EVICTION_MS = 15 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [slug, entry] of tenantPools.entries()) {
    if (now - entry.lastUsed > IDLE_EVICTION_MS) {
      entry.pool.end().catch(() => {});  // drain pool gracefully
      tenantPools.delete(slug);
      console.log(`[tenantDb] Pool evicted for idle tenant: ${slug}`);
    }
  }
}, 5 * 60 * 1000);  // check every 5 minutes


// ─────────────────────────────────────────
// FETCH TENANT CREDENTIALS FROM MASTER
// ─────────────────────────────────────────
async function fetchTenantCredentials(companyId) {
  const rows = await masterPool.query(
    `SELECT id, slug, db_name, db_host, db_port, db_user, db_password, plan, is_active
     FROM   companies
     WHERE  id = ? AND is_active = 1
     LIMIT  1`,
    [companyId]
  );

  if (!rows || rows.length === 0) {
    return null;
  }
  return rows[0];
}

/** Same but look up by slug (useful for subdomain routing) */
async function fetchTenantCredentialsBySlug(slug) {
  const rows = await masterPool.query(
    `SELECT id, slug, db_name, db_host, db_port, db_user, db_password, plan, is_active
     FROM   companies
     WHERE  slug = ? AND is_active = 1
     LIMIT  1`,
    [slug]
  );
  return rows && rows.length > 0 ? rows[0] : null;
}


// ─────────────────────────────────────────
// GET OR CREATE TENANT POOL
// ─────────────────────────────────────────
function getOrCreatePool(creds) {
  const cacheKey = creds.slug;

  if (tenantPools.has(cacheKey)) {
    const entry = tenantPools.get(cacheKey);
    entry.lastUsed = Date.now();  // refresh idle timer
    return entry.pool;
  }

  const connectionLimit = POOL_SIZES[creds.plan] || POOL_SIZES.starter;

  const pool = mariadb.createPool({
    host:             creds.db_host || 'localhost',
    port:             creds.db_port || 3306,
    user:             creds.db_user,
    password:         creds.db_password,
    database:         creds.db_name,
    connectionLimit,
    acquireTimeout:   15000,
    bigIntAsNumber:   true,
    decimalAsNumber:  true,

    // Connection lifecycle hooks for observability
    initSql:          `SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO'`,
  });

  // Wrap pool with helper methods for cleaner controller code
  const wrappedPool = {
    _pool:      pool,
    companyId:  creds.id,
    slug:       creds.slug,
    dbName:     creds.db_name,

    /** Execute a query and return all rows */
    async query(sql, params) {
      return await pool.query(sql, params);
    },

    /** Get first row or null */
    async queryOne(sql, params) {
      const rows = await pool.query(sql, params);
      return rows && rows.length > 0 ? rows[0] : null;
    },

    /** Get a raw connection for transactions */
    async getConnection() {
      return await pool.getConnection();
    },

    /** Run callback inside a transaction; auto-commit or rollback */
    async transaction(callback) {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const result = await callback(conn);
        await conn.commit();
        return result;
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    },

    /** Pool stats (for monitoring) */
    stats() {
      return {
        activeConnections:    pool.activeConnections(),
        idleConnections:      pool.idleConnections(),
        totalConnections:     pool.totalConnections(),
        taskQueueSize:        pool.taskQueueSize(),
      };
    },
  };

  tenantPools.set(cacheKey, { pool: wrappedPool, lastUsed: Date.now(), creds });
  console.log(`[tenantDb] New pool created for tenant: ${creds.slug} (limit: ${connectionLimit})`);

  return wrappedPool;
}


// ─────────────────────────────────────────
// MIDDLEWARE — requireTenantDb
// ─────────────────────────────────────────
/**
 * Attach req.tenantDb based on JWT payload.
 * Your JWT must contain { company_id: <int>, slug: <string> }.
 * Place AFTER your JWT verify middleware.
 *
 * @example
 *   app.use('/api', verifyJwt, requireTenantDb, router);
 */
async function requireTenantDb(req, res, next) {
  try {
    // req.user is set by your JWT middleware
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: no user context' });
    }

    // Support both company_id (numeric) and slug (string)
    const companyId = user.company_id;
    const slug      = user.slug;

    if (!companyId && !slug) {
      return res.status(400).json({ message: 'Bad token: missing company identifier' });
    }

    // Check pool cache first (O(1) slug lookup)
    const cacheKey = slug || String(companyId);
    let pool;

    if (tenantPools.has(cacheKey)) {
      const entry = tenantPools.get(cacheKey);
      entry.lastUsed = Date.now();
      pool = entry.pool;
    } else {
      // Cache miss — hit master DB (happens once per tenant per pod restart)
      const creds = companyId
        ? await fetchTenantCredentials(companyId)
        : await fetchTenantCredentialsBySlug(slug);

      if (!creds) {
        return res.status(403).json({ message: 'Tenant not found or suspended' });
      }

      pool = getOrCreatePool(creds);
    }

    req.tenantDb    = pool;
    req.companyId   = pool.companyId;
    req.tenantSlug  = pool.slug;

    next();
  } catch (err) {
    console.error('[tenantDb] Middleware error:', err.message);
    next(err);
  }
}


// ─────────────────────────────────────────
// ALTERNATIVE: Subdomain-based routing
// For apps where tenant is identified by subdomain:
//   acme.myerp.com → slug = "acme"
// ─────────────────────────────────────────
async function requireTenantDbBySubdomain(req, res, next) {
  try {
    const host = req.hostname;                  // e.g. "acme.myerp.com"
    const slug = host.split('.')[0];            // "acme"

    if (!slug || slug === 'www' || slug === 'api') {
      return res.status(400).json({ message: 'Invalid tenant subdomain' });
    }

    let pool;

    if (tenantPools.has(slug)) {
      tenantPools.get(slug).lastUsed = Date.now();
      pool = tenantPools.get(slug).pool;
    } else {
      const creds = await fetchTenantCredentialsBySlug(slug);
      if (!creds) {
        return res.status(404).json({ message: `Tenant '${slug}' not found` });
      }
      pool = getOrCreatePool(creds);
    }

    req.tenantDb   = pool;
    req.companyId  = pool.companyId;
    req.tenantSlug = slug;
    next();

  } catch (err) {
    console.error('[tenantDb] Subdomain middleware error:', err.message);
    next(err);
  }
}


// ─────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────
module.exports = {
  requireTenantDb,
  requireTenantDbBySubdomain,
  getOrCreatePool,
  fetchTenantCredentials,
  fetchTenantCredentialsBySlug,
  tenantPools,   // expose for admin dashboard / monitoring
  masterPool,
};
