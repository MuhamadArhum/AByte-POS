/**
 * Migration: Staff Management Module Overhaul
 * - Add leave_balance to staff table
 * - Add updated_at to attendance table
 *
 * Run: node backend/migrate_staff_overhaul.js
 */

const { getConnection } = require('./config/database');

async function migrate() {
  console.log('Starting Staff Overhaul migration...\n');

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // Add leave_balance column to staff table
    console.log('Adding leave_balance to staff table...');
    try {
      await conn.query(`ALTER TABLE staff ADD COLUMN leave_balance INT DEFAULT 20 AFTER is_active`);
      console.log('  leave_balance column added');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('  leave_balance column already exists, skipping');
      } else {
        throw e;
      }
    }

    // Add employee_id column to staff table
    console.log('Adding employee_id to staff table...');
    try {
      await conn.query(`ALTER TABLE staff ADD COLUMN employee_id VARCHAR(50) UNIQUE AFTER user_id`);
      console.log('  employee_id column added');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('  employee_id column already exists, skipping');
      } else {
        throw e;
      }
    }

    // Add updated_at column to attendance table
    console.log('Adding updated_at to attendance table...');
    try {
      await conn.query(`ALTER TABLE attendance ADD COLUMN updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP`);
      console.log('  updated_at column added');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('  updated_at column already exists, skipping');
      } else {
        throw e;
      }
    }

    await conn.commit();
    console.log('\nStaff Overhaul migration completed successfully!');
  } catch (error) {
    await conn.rollback();
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate().catch(() => process.exit(1));
