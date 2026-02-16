/**
 * Migration: Holidays & Leave Requests
 * Run: node backend/migrate_holidays_leaves.js
 */

const { getConnection } = require('./config/database');

async function migrate() {
  console.log('Starting Holidays & Leave Requests migration...\n');

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // Create holidays table
    console.log('Creating holidays table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS holidays (
        holiday_id INT PRIMARY KEY AUTO_INCREMENT,
        holiday_date DATE NOT NULL,
        holiday_name VARCHAR(200) NOT NULL,
        description TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
        INDEX idx_holiday_date (holiday_date)
      )
    `);
    console.log('  holidays table ready');

    // Create leave_requests table
    console.log('Creating leave_requests table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        request_id INT PRIMARY KEY AUTO_INCREMENT,
        staff_id INT NOT NULL,
        leave_type ENUM('annual','sick','emergency','unpaid','other') DEFAULT 'annual',
        from_date DATE NOT NULL,
        to_date DATE NOT NULL,
        days INT NOT NULL,
        reason TEXT,
        status ENUM('pending','approved','rejected') DEFAULT 'pending',
        review_notes TEXT,
        requested_by INT,
        reviewed_by INT,
        reviewed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
        FOREIGN KEY (requested_by) REFERENCES users(user_id) ON DELETE SET NULL,
        FOREIGN KEY (reviewed_by) REFERENCES users(user_id) ON DELETE SET NULL,
        INDEX idx_leave_staff (staff_id),
        INDEX idx_leave_status (status),
        INDEX idx_leave_dates (from_date, to_date)
      )
    `);
    console.log('  leave_requests table ready');

    await conn.commit();
    console.log('\nHolidays & Leave Requests migration completed successfully!');
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
