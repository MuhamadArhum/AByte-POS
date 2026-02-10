/**
 * Reset user passwords to default
 */

const bcrypt = require('bcryptjs');
const { query, getConnection } = require('./config/database');

async function resetPasswords() {
  console.log('🔄 Resetting user passwords...\n');

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // Default password
    const defaultPassword = 'password';
    const hash = await bcrypt.hash(defaultPassword, 10);

    // Get all users
    const users = await conn.query('SELECT user_id, username, email FROM users');

    for (let user of users) {
      await conn.query(
        'UPDATE users SET password_hash = ? WHERE user_id = ?',
        [hash, user.user_id]
      );
      console.log(`✅ Reset password for ${user.username} (${user.email})`);
    }

    await conn.commit();

    console.log('\n✅ All passwords reset to: password');
    console.log('\nLogin Credentials:');
    users.forEach(u => {
      console.log(`   ${u.email} / password`);
    });

  } catch (err) {
    await conn.rollback();
    console.error('❌ Error:', err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}

resetPasswords();
