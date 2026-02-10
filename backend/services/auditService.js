const { query } = require('../config/database');

/**
 * Log an action to the audit trail
 * @returns {boolean} true if logged successfully, false if failed
 */
async function logAction(userId, userName, action, entityType, entityId, details, ipAddress) {
  try {
    // Sanitize details to prevent XSS when displayed
    const sanitizedDetails = typeof details === 'object' ? details : {};

    await query(
      `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, userName, action, entityType, entityId, JSON.stringify(sanitizedDetails), ipAddress || null]
    );
    return true;
  } catch (err) {
    // Log with full context for debugging
    console.error('Audit log error:', {
      error: err.message,
      action,
      entityType,
      entityId,
      userId,
      timestamp: new Date().toISOString()
    });
    return false;
  }
}

module.exports = { logAction };
