
const bcrypt = require('bcryptjs');
const { query, pool } = require('./config/database');

async function resetPassword() {
  try {
    const password = 'Admin@123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    await query('UPDATE users SET password_hash = ? WHERE email = ?', [hash, 'admin@pos.com']);
    console.log('Password for admin@pos.com reset to: Admin@123');
  } catch (err) {
    console.error('Error resetting password:', err);
  } finally {
    if (pool) pool.end();
  }
}

resetPassword();
