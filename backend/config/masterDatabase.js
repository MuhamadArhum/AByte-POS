// =============================================================
// masterDatabase.js - Master DB Connection
// Connects to 'abyte_master' which stores tenant registry.
// This DB is separate from tenant DBs and holds the list of
// all clients and which database each one uses.
// =============================================================

const mariadb = require('mariadb');
require('dotenv').config();

const masterPool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: 'abyte_master',
  connectionLimit: 5,
  acquireTimeout: 30000,
  bigIntAsNumber: true,
  insertIdAsNumber: true,
  decimalAsNumber: true,
});

async function masterQuery(sql, params) {
  let conn;
  try {
    conn = await masterPool.getConnection();
    return await conn.query(sql, params);
  } finally {
    if (conn) conn.release();
  }
}

async function masterGetConnection() {
  return masterPool.getConnection();
}

module.exports = { masterQuery, masterGetConnection, masterPool };
