// =============================================================
// database.js - MariaDB Database Connection Configuration
// This file creates a connection pool to the MariaDB database
// and exports helper functions for executing SQL queries.
// All controllers use these functions to interact with the DB.
// =============================================================

const mariadb = require('mariadb');  // MariaDB Node.js driver for database connections
require('dotenv').config();           // Load DB credentials from .env file

// --- Connection Pool ---
// A pool maintains multiple reusable database connections.
// Instead of opening/closing a connection for each query,
// the pool lends a connection and takes it back when done.
// This is much faster for a high-traffic POS system.
const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',       // Database server address
  port: parseInt(process.env.DB_PORT) || 3306,    // MariaDB port (default 3306)
  user: process.env.DB_USER || 'root',            // Database username
  password: process.env.DB_PASSWORD || '',         // Database password
  database: process.env.DB_NAME || 'abyte_pos',   // Database name to connect to
  connectionLimit: 10,                             // Max 10 simultaneous connections in the pool
  acquireTimeout: 30000,                           // Wait max 30 seconds to get a connection from pool
});

// --- getConnection() ---
// Returns a raw connection from the pool.
// Used when you need a transaction (BEGIN, COMMIT, ROLLBACK) - see salesController.js
// IMPORTANT: You must call conn.release() when done to return it to the pool.
async function getConnection() {
  return await pool.getConnection();
}

// --- query(sql, params) ---
// Executes a single SQL query and automatically releases the connection.
// This is the most commonly used function in all controllers.
// Example: query('SELECT * FROM products WHERE product_id = ?', [1])
// The ? placeholders prevent SQL injection by using parameterized queries.
async function query(sql, params) {
  let conn;
  try {
    conn = await pool.getConnection();           // Borrow a connection from the pool
    const result = await conn.query(sql, params); // Execute the SQL query
    return result;                                // Return the query results (rows)
  } finally {
    if (conn) conn.release();  // Always return the connection to the pool, even if an error occurs
  }
}

// Export the pool and helper functions for use in controllers
module.exports = { pool, getConnection, query };
