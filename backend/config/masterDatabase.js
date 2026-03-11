// masterDatabase.js - Stub for single-client mode
// In SaaS multi-tenant mode, this connects to the abyte_master DB.
// In single-client mode, it routes to the same local DB.

const { query, getConnection } = require('./database');

async function masterQuery(sql, params) {
  return query(sql, params);
}

async function masterGetConnection() {
  return getConnection();
}

module.exports = { masterQuery, masterGetConnection };
