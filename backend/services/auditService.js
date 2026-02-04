const { query } = require('../config/database');

async function logAction(userId, userName, action, entityType, entityId, details, ipAddress) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, userName, action, entityType, entityId, JSON.stringify(details), ipAddress || null]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

module.exports = { logAction };
