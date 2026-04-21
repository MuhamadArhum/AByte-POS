const bcrypt  = require('bcryptjs');
const fs      = require('fs');
const path    = require('path');
const { query, getConnection, tenantQuery, getTenantConnection } = require('../config/database');
const logger  = require('../config/logger');

const MODULES = {
  sales:     { name: 'Sale',        price: 2250 },
  inventory: { name: 'Inventory',   price: 2250 },
  accounts:  { name: 'Accounts',    price: 2999 },
  hr:        { name: 'HR & Payroll',price: 2999 },
};

// GET /api/tenants
exports.getAll = async (req, res) => {
  try {
    const tenants = await query(`
      SELECT t.*, tc.company_name, tc.logo_url, tc.modules_enabled
      FROM tenants t
      LEFT JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id
      ORDER BY t.created_at DESC
    `);

    const result = await Promise.all(tenants.map(async (t) => {
      try {
        const [users] = await tenantQuery(t.db_name, `SELECT COUNT(*) as cnt FROM \`${t.db_name}\`.users`);
        const [sales] = await tenantQuery(t.db_name, `SELECT COUNT(*) as cnt FROM \`${t.db_name}\`.sales`);
        return { ...t, stats: { users: users?.cnt || 0, sales: sales?.cnt || 0 } };
      } catch {
        return { ...t, stats: { users: 0, sales: 0 } };
      }
    }));

    res.json({ data: result });
  } catch (err) {
    logger.error('getAll tenants error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/tenants/:id
exports.getOne = async (req, res) => {
  try {
    const rows = await query(`
      SELECT t.*, tc.company_name, tc.logo_url, tc.modules_enabled,
             tc.currency_symbol, tc.tax_rate, tc.receipt_footer
      FROM tenants t
      LEFT JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id
      WHERE t.tenant_id = ?
    `, [req.params.id]);

    if (rows.length === 0) return res.status(404).json({ message: 'Tenant not found' });
    res.json({ data: rows[0] });
  } catch (err) {
    logger.error('getOne error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/tenants — Create new client
exports.create = async (req, res) => {
  const {
    tenant_code, tenant_name, admin_name, admin_email, admin_password,
    modules = [], company_name,
  } = req.body;

  if (!tenant_code || !tenant_name || !admin_email || !admin_password) {
    return res.status(400).json({ message: 'tenant_code, tenant_name, admin_email, admin_password required' });
  }
  if (!/^[a-z0-9_]+$/.test(tenant_code)) {
    return res.status(400).json({ message: 'tenant_code: lowercase letters, numbers, underscore only' });
  }
  if (modules.length === 0) {
    return res.status(400).json({ message: 'At least one module required' });
  }

  const existing = await query('SELECT tenant_id FROM tenants WHERE tenant_code = ?', [tenant_code]);
  if (existing.length > 0) {
    return res.status(400).json({ message: 'Company code already exists' });
  }

  const dbName = `abyte_pos_${tenant_code}`;
  const conn   = await getConnection();

  try {
    // Step 1: Create DB
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);

    // Step 2: Apply schema
    const schemaPath = path.resolve(__dirname, process.env.SCHEMA_PATH || '../../database/schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8');
    schema = schema
      .replace(/CREATE DATABASE IF NOT EXISTS `abyte_pos`;/g, '')
      .replace(/USE `abyte_pos`;/g, `USE \`${dbName}\`;`)
      .replace(/USE abyte_pos;/g, `USE \`${dbName}\`;`);

    if (!schema.includes(`USE \`${dbName}\``)) {
      schema = `USE \`${dbName}\`;\n` + schema;
    }

    const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      try { await conn.query(stmt); } catch (e) {
        if (!e.message.includes('already exists') && !e.message.includes('Duplicate')) {
          logger.warn('Schema stmt warning', { msg: e.message.substring(0, 80) });
        }
      }
    }

    // Step 3: Create admin user in tenant DB
    const passwordHash = await bcrypt.hash(admin_password, 10);
    await conn.query(`USE \`${dbName}\``);
    await conn.query(
      `INSERT INTO users (username, name, email, password_hash, role_id, role_name)
       VALUES (?, ?, ?, ?, 1, 'Admin')`,
      ['admin', admin_name || 'Admin', admin_email, passwordHash]
    );

    // Step 4: Switch back to master DB and register tenant
    await conn.query(`USE \`${process.env.MASTER_DB || 'abyte_master'}\``);
    await conn.beginTransaction();
    const result = await conn.query(
      `INSERT INTO tenants (tenant_code, tenant_name, db_name, admin_email, is_active, subdomain)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [tenant_code, tenant_name, dbName, admin_email, tenant_code]
    );
    const tenantId = Number(result.insertId);

    await conn.query(
      `INSERT INTO tenant_configs (tenant_id, company_name, modules_enabled)
       VALUES (?, ?, ?)`,
      [tenantId, company_name || tenant_name, JSON.stringify(modules)]
    );

    await conn.commit();

    // Calculate monthly price
    const monthly = modules.reduce((sum, m) => sum + (MODULES[m]?.price || 0), 0);

    res.status(201).json({
      message: 'Client created successfully',
      tenant: { tenant_id: tenantId, tenant_code, tenant_name, db_name: dbName, modules, monthly_price: monthly },
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    try { await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``); } catch {}
    logger.error('Create tenant error', { error: err.message });
    res.status(500).json({ message: 'Failed to create client: ' + err.message });
  } finally {
    conn.release();
  }
};

// PUT /api/tenants/:id — Update modules, status
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_name, is_active, modules } = req.body;

    if (tenant_name !== undefined) {
      await query('UPDATE tenants SET tenant_name = ? WHERE tenant_id = ?', [tenant_name, id]);
    }
    if (is_active !== undefined) {
      await query('UPDATE tenants SET is_active = ? WHERE tenant_id = ?', [is_active ? 1 : 0, id]);
    }
    if (modules !== undefined) {
      await query('UPDATE tenant_configs SET modules_enabled = ? WHERE tenant_id = ?', [JSON.stringify(modules), id]);
    }

    res.json({ message: 'Client updated' });
  } catch (err) {
    logger.error('Update tenant error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/tenants/:id/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const tenants = await query('SELECT db_name, admin_email FROM tenants WHERE tenant_id = ?', [req.params.id]);
    if (tenants.length === 0) return res.status(404).json({ message: 'Client not found' });

    const { db_name, admin_email } = tenants[0];
    const hash = await bcrypt.hash(new_password, 10);
    await tenantQuery(db_name, `UPDATE \`${db_name}\`.users SET password_hash = ? WHERE email = ?`, [hash, admin_email]);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    logger.error('Reset password error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/tenants/stats — Dashboard stats
exports.getStats = async (req, res) => {
  try {
    const [{ total }]  = await query('SELECT COUNT(*) as total FROM tenants');
    const [{ active }] = await query('SELECT COUNT(*) as active FROM tenants WHERE is_active = 1');

    const tenants = await query('SELECT db_name, modules_enabled FROM tenants t JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id WHERE t.is_active = 1');

    let monthlyRevenue = 0;
    tenants.forEach(t => {
      const mods = typeof t.modules_enabled === 'string' ? JSON.parse(t.modules_enabled || '[]') : (t.modules_enabled || []);
      mods.forEach(m => { monthlyRevenue += MODULES[m]?.price || 0; });
    });

    res.json({ total, active, inactive: total - active, monthly_revenue: monthlyRevenue });
  } catch (err) {
    logger.error('getStats error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/modules — Available modules list
exports.getModules = async (_req, res) => {
  res.json({
    data: Object.entries(MODULES).map(([key, m]) => ({ key, ...m }))
  });
};

// GET /api/tenants/activity — Login activity summary for all tenants
exports.getActivity = async (req, res) => {
  try {
    const tenants = await query(`
      SELECT t.tenant_id, t.tenant_code, t.db_name, t.is_active,
             COALESCE(tc.company_name, t.tenant_name) AS display_name
      FROM tenants t
      LEFT JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id
      ORDER BY t.created_at DESC
    `);

    const results = await Promise.all(tenants.map(async (t) => {
      try {
        const [todayCount] = await tenantQuery(t.db_name,
          `SELECT COUNT(*) AS cnt FROM \`${t.db_name}\`.audit_logs
           WHERE action = 'USER_LOGIN' AND DATE(created_at) = CURDATE()`
        );
        const [weekCount] = await tenantQuery(t.db_name,
          `SELECT COUNT(*) AS cnt FROM \`${t.db_name}\`.audit_logs
           WHERE action = 'USER_LOGIN' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
        );
        const [lastLogin] = await tenantQuery(t.db_name,
          `SELECT user_name, ip_address, created_at
           FROM \`${t.db_name}\`.audit_logs
           WHERE action = 'USER_LOGIN'
           ORDER BY created_at DESC LIMIT 1`
        );
        const [totalLogins] = await tenantQuery(t.db_name,
          `SELECT COUNT(*) AS cnt FROM \`${t.db_name}\`.audit_logs WHERE action = 'USER_LOGIN'`
        );

        return {
          tenant_id:    t.tenant_id,
          tenant_code:  t.tenant_code,
          display_name: t.display_name,
          is_active:    t.is_active,
          today_logins: todayCount?.cnt || 0,
          week_logins:  weekCount?.cnt  || 0,
          total_logins: totalLogins?.cnt || 0,
          last_login:   lastLogin || null,
        };
      } catch {
        return {
          tenant_id:    t.tenant_id,
          tenant_code:  t.tenant_code,
          display_name: t.display_name,
          is_active:    t.is_active,
          today_logins: 0,
          week_logins:  0,
          total_logins: 0,
          last_login:   null,
        };
      }
    }));

    res.json({ data: results });
  } catch (err) {
    logger.error('getActivity error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/tenants/:id/activity — Detailed login history for one tenant
exports.getTenantActivity = async (req, res) => {
  try {
    const tenants = await query(
      `SELECT t.tenant_id, t.db_name, t.is_active,
              COALESCE(tc.company_name, t.tenant_name) AS display_name
       FROM tenants t LEFT JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id
       WHERE t.tenant_id = ?`,
      [req.params.id]
    );
    if (tenants.length === 0) return res.status(404).json({ message: 'Tenant not found' });

    const { db_name } = tenants[0];

    const logs = await tenantQuery(db_name,
      `SELECT log_id, user_name, ip_address, created_at
       FROM \`${db_name}\`.audit_logs
       WHERE action = 'USER_LOGIN'
       ORDER BY created_at DESC
       LIMIT 100`
    );

    const [todayCount] = await tenantQuery(db_name,
      `SELECT COUNT(*) AS cnt FROM \`${db_name}\`.audit_logs
       WHERE action = 'USER_LOGIN' AND DATE(created_at) = CURDATE()`
    );
    const [weekCount] = await tenantQuery(db_name,
      `SELECT COUNT(*) AS cnt FROM \`${db_name}\`.audit_logs
       WHERE action = 'USER_LOGIN' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
    );

    // Daily breakdown for last 7 days
    const daily = await tenantQuery(db_name,
      `SELECT DATE(created_at) AS day, COUNT(*) AS cnt
       FROM \`${db_name}\`.audit_logs
       WHERE action = 'USER_LOGIN' AND created_at >= DATE_SUB(NOW(), INTERVAL 6 DAY)
       GROUP BY DATE(created_at)
       ORDER BY day ASC`
    );

    res.json({
      tenant:       tenants[0],
      today_logins: todayCount?.cnt || 0,
      week_logins:  weekCount?.cnt  || 0,
      daily_chart:  daily,
      logs,
    });
  } catch (err) {
    logger.error('getTenantActivity error', { error: err.message });
    res.status(500).json({ message: 'Server error' });
  }
};
