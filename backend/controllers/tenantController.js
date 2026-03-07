// =============================================================
// tenantController.js - Tenant (Client) Management
// Handles creating, listing, updating, and deleting tenants.
// Each tenant gets their own isolated database.
// Only accessible by Super Admin (via master credentials).
// =============================================================

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { masterQuery, masterGetConnection } = require('../config/masterDatabase');
const { queryDb, getPool } = require('../config/database');

// GET /api/tenants — list all tenants with stats
exports.getAll = async (req, res) => {
  try {
    const tenants = await masterQuery(
      'SELECT tenant_id, tenant_code, tenant_name, db_name, is_active, admin_email, created_at FROM tenants ORDER BY created_at DESC'
    );

    // Get basic stats for each tenant
    const result = await Promise.all(tenants.map(async (t) => {
      try {
        const [users] = await queryDb(t.db_name, 'SELECT COUNT(*) as cnt FROM users');
        const [products] = await queryDb(t.db_name, 'SELECT COUNT(*) as cnt FROM products');
        const [sales] = await queryDb(t.db_name, 'SELECT COUNT(*) as cnt FROM sales');
        return { ...t, stats: { users: users.cnt, products: products.cnt, sales: sales.cnt } };
      } catch {
        return { ...t, stats: { users: 0, products: 0, sales: 0 } };
      }
    }));

    res.json({ data: result });
  } catch (err) {
    console.error('getAll tenants error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/tenants — create new tenant (new client)
// Creates a fresh database with full schema + admin user
exports.create = async (req, res) => {
  const { tenant_code, tenant_name, admin_name, admin_email, admin_password } = req.body;

  if (!tenant_code || !tenant_name || !admin_email || !admin_password) {
    return res.status(400).json({ message: 'tenant_code, tenant_name, admin_email, admin_password required' });
  }

  // tenant_code must be alphanumeric + underscore only
  if (!/^[a-z0-9_]+$/.test(tenant_code)) {
    return res.status(400).json({ message: 'tenant_code must be lowercase letters, numbers, underscore only' });
  }

  // Check if tenant_code already exists
  const existing = await masterQuery('SELECT tenant_id FROM tenants WHERE tenant_code = ?', [tenant_code]);
  if (existing.length > 0) {
    return res.status(400).json({ message: 'Company code already exists' });
  }

  const dbName = `abyte_pos_${tenant_code}`;
  const conn = await masterGetConnection();

  try {
    // Step 1: Create the new database
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);

    // Step 2: Run schema on new database
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    let schema = fs.readFileSync(schemaPath, 'utf8');

    // Replace the hardcoded DB name in schema with the new DB name
    schema = schema.replace(/CREATE DATABASE IF NOT EXISTS `abyte_pos`;/g, '');
    schema = schema.replace(/USE `abyte_pos`;/g, `USE \`${dbName}\`;`);
    schema = schema.replace(/USE abyte_pos;/g, `USE \`${dbName}\`;`);

    // Add USE statement at top if not present
    if (!schema.includes(`USE \`${dbName}\``)) {
      schema = `USE \`${dbName}\`;\n` + schema;
    }

    // Split and run statements
    const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      try {
        await conn.query(stmt);
      } catch (e) {
        // Ignore duplicate/already exists errors from schema
        if (!e.message.includes('already exists') && !e.message.includes('Duplicate')) {
          console.warn('Schema stmt warning:', e.message.substring(0, 80));
        }
      }
    }

    // Step 3: Create admin user in new tenant DB
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(admin_password, salt);
    await conn.query(`USE \`${dbName}\``);
    await conn.query(
      `INSERT INTO users (username, name, email, password_hash, role_id, role_name) VALUES (?, ?, ?, ?, 1, 'Admin')`,
      ['admin', admin_name || 'Admin', admin_email, passwordHash]
    );

    // Step 4: Register tenant in master DB
    await conn.beginTransaction();
    await conn.query(
      'INSERT INTO tenants (tenant_code, tenant_name, db_name, admin_email, is_active) VALUES (?, ?, ?, ?, 1)',
      [tenant_code, tenant_name, dbName, admin_email]
    );
    await conn.commit();

    res.status(201).json({
      message: 'Tenant created successfully',
      tenant: { tenant_code, tenant_name, db_name: dbName, admin_email },
    });
  } catch (err) {
    try { await conn.rollback(); } catch {}
    console.error('Create tenant error:', err);
    // Clean up DB if creation failed
    try { await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``); } catch {}
    res.status(500).json({ message: 'Failed to create tenant: ' + err.message });
  } finally {
    conn.release();
  }
};

// PUT /api/tenants/:id — update tenant (name, status)
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_name, is_active } = req.body;

    const updates = [];
    const params = [];
    if (tenant_name !== undefined) { updates.push('tenant_name = ?'); params.push(tenant_name); }
    if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }

    if (updates.length === 0) return res.status(400).json({ message: 'Nothing to update' });

    params.push(id);
    await masterQuery(`UPDATE tenants SET ${updates.join(', ')} WHERE tenant_id = ?`, params);
    res.json({ message: 'Tenant updated' });
  } catch (err) {
    console.error('Update tenant error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/tenants/:id — deactivate (soft delete only, DB preserved)
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const tenants = await masterQuery('SELECT tenant_code FROM tenants WHERE tenant_id = ?', [id]);
    if (tenants.length === 0) return res.status(404).json({ message: 'Tenant not found' });

    // Safety: never delete the default tenant
    if (tenants[0].tenant_code === 'default') {
      return res.status(400).json({ message: 'Cannot delete the default tenant' });
    }

    await masterQuery('UPDATE tenants SET is_active = 0 WHERE tenant_id = ?', [id]);
    res.json({ message: 'Tenant deactivated (database preserved)' });
  } catch (err) {
    console.error('Delete tenant error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/tenants/:id/reset-password — reset tenant admin password
exports.resetAdminPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;
    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters' });
    }

    const tenants = await masterQuery('SELECT db_name, admin_email FROM tenants WHERE tenant_id = ?', [id]);
    if (tenants.length === 0) return res.status(404).json({ message: 'Tenant not found' });

    const { db_name, admin_email } = tenants[0];
    const hash = await bcrypt.hash(new_password, 10);
    await queryDb(db_name, 'UPDATE users SET password_hash = ? WHERE email = ?', [hash, admin_email]);

    res.json({ message: 'Admin password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
