// permissionController.js - RBAC permission management
const { query, getConnection } = require('../config/database');

// GET /api/permissions  → { Manager: [...], Cashier: [...] }
exports.getAllPermissions = async (req, res) => {
  try {
    const rows = await query(
      'SELECT role_name, module_key FROM role_permissions WHERE is_allowed = 1 ORDER BY role_name, module_key'
    );
    const result = { Manager: [], Cashier: [] };
    for (const row of rows) {
      if (result[row.role_name] !== undefined) {
        result[row.role_name].push(row.module_key);
      }
    }
    res.json(result);
  } catch (err) {
    console.error('getAllPermissions error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/permissions/:role  → { role, permissions: [...] }
exports.getPermissionsByRole = async (req, res) => {
  try {
    const { role } = req.params;
    if (!['Manager', 'Cashier'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be Manager or Cashier.' });
    }
    const rows = await query(
      'SELECT module_key FROM role_permissions WHERE role_name = ? AND is_allowed = 1',
      [role]
    );
    res.json({ role, permissions: rows.map(r => r.module_key) });
  } catch (err) {
    console.error('getPermissionsByRole error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/permissions/:role  → { message }   (Admin only)
exports.updatePermissions = async (req, res) => {
  const { role } = req.params;
  const { permissions } = req.body;

  if (!['Manager', 'Cashier'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role. Must be Manager or Cashier.' });
  }
  if (!Array.isArray(permissions)) {
    return res.status(400).json({ message: 'permissions must be an array of module keys.' });
  }

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // Delete all existing permissions for this role
    await conn.query('DELETE FROM role_permissions WHERE role_name = ?', [role]);

    // Insert new permissions
    if (permissions.length > 0) {
      const values = permissions.map(key => [role, key, 1]);
      await conn.query(
        'INSERT INTO role_permissions (role_name, module_key, is_allowed) VALUES ?',
        [values]
      );
    }

    await conn.commit();
    res.json({ message: `Permissions updated for ${role}` });
  } catch (err) {
    await conn.rollback();
    console.error('updatePermissions error:', err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};
