/**
 * Migration: Advance Payments & Payroll Features
 * Run: node backend/migrate_advance_payments.js
 */

const { getConnection } = require('./config/database');

async function migrate() {
  console.log('Starting Advance Payments migration...\n');

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // Create advance_payments table
    console.log('Creating advance_payments table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS advance_payments (
        advance_id INT PRIMARY KEY AUTO_INCREMENT,
        staff_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_date DATE NOT NULL,
        payment_method ENUM('cash','bank_transfer','cheque') DEFAULT 'cash',
        reason TEXT,
        paid_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
        FOREIGN KEY (paid_by) REFERENCES users(user_id),
        INDEX idx_advance_staff (staff_id),
        INDEX idx_advance_date (payment_date)
      )
    `);
    console.log('  advance_payments table ready');

    await conn.commit();
    console.log('\nAdvance Payments migration completed successfully!');
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
