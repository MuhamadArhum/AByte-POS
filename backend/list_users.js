
const { query } = require('./config/database');

async function listUsers() {
  try {
    const users = await query('SELECT user_id, name, email, role_id FROM users');
    console.log('Users in DB:', users);
  } catch (err) {
    console.error('Error listing users:', err);
  }
  process.exit();
}

listUsers();
