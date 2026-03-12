require('dotenv').config();
const mariadb = require('mariadb');
const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'abyte_pos',
  connectionLimit: 2,
});
pool.getConnection().then(conn => {
  return conn.query(
    "INSERT IGNORE INTO role_permissions (role_name, module_key, is_allowed) VALUES ('Admin', 'system.users', 1)"
  ).then(r => {
    console.log('Done. Rows affected:', r.affectedRows);
    conn.release();
    pool.end();
  });
}).catch(e => { console.error(e.message); process.exit(1); });
