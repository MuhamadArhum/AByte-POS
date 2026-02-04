const { query } = require('../config/database');

exports.getLogs = async (req, res) => {
  try {
    const { action, entity_type, user_id, date_start, date_end, page = 1, limit = 50 } = req.query;

    let sql = `SELECT * FROM audit_logs WHERE 1=1`;
    const params = [];

    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }
    if (entity_type) {
      sql += ' AND entity_type = ?';
      params.push(entity_type);
    }
    if (user_id) {
      sql += ' AND user_id = ?';
      params.push(user_id);
    }
    if (date_start) {
      sql += ' AND created_at >= ?';
      params.push(date_start);
    }
    if (date_end) {
      sql += ' AND created_at <= ?';
      params.push(date_end + ' 23:59:59');
    }

    // Get total count
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await query(countSql, params);
    const total = Number(countResult[0].total);

    // Add pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const logs = await query(sql, params);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ message: 'Failed to fetch audit logs' });
  }
};

exports.getLogById = async (req, res) => {
  try {
    const rows = await query('SELECT * FROM audit_logs WHERE log_id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Log not found' });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ message: 'Failed to fetch audit log' });
  }
};

exports.getActions = async (req, res) => {
  try {
    const rows = await query('SELECT DISTINCT action FROM audit_logs ORDER BY action');
    res.json(rows.map(r => r.action));
  } catch (error) {
    console.error('Get audit actions error:', error);
    res.status(500).json({ message: 'Failed to fetch actions' });
  }
};
