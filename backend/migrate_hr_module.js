/**
 * Migration: HR Module - Loans, Repayments, Salary Increments
 * Run: node backend/migrate_hr_module.js
 */

const { getConnection } = require('./config/database');

async function migrate() {
  console.log('Starting HR Module migration...\n');

  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // 1. Staff Loans
    console.log('Creating staff_loans table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS staff_loans (
        loan_id INT PRIMARY KEY AUTO_INCREMENT,
        staff_id INT NOT NULL,
        loan_amount DECIMAL(12,2) NOT NULL,
        remaining_balance DECIMAL(12,2) NOT NULL,
        monthly_deduction DECIMAL(12,2) DEFAULT 0,
        loan_date DATE NOT NULL,
        status ENUM('active','completed','cancelled') DEFAULT 'active',
        reason TEXT,
        approved_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
        FOREIGN KEY (approved_by) REFERENCES users(user_id),
        INDEX idx_loan_staff (staff_id),
        INDEX idx_loan_status (status)
      )
    `);
    console.log('  staff_loans table ready');

    // 2. Loan Repayments
    console.log('Creating loan_repayments table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS loan_repayments (
        repayment_id INT PRIMARY KEY AUTO_INCREMENT,
        loan_id INT NOT NULL,
        staff_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        repayment_date DATE NOT NULL,
        payment_method ENUM('cash','bank_transfer','salary_deduction') DEFAULT 'cash',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (loan_id) REFERENCES staff_loans(loan_id),
        FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
        INDEX idx_repayment_loan (loan_id)
      )
    `);
    console.log('  loan_repayments table ready');

    // 3. Salary Increments
    console.log('Creating salary_increments table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS salary_increments (
        increment_id INT PRIMARY KEY AUTO_INCREMENT,
        staff_id INT NOT NULL,
        old_salary DECIMAL(10,2) NOT NULL,
        new_salary DECIMAL(10,2) NOT NULL,
        increment_amount DECIMAL(10,2) NOT NULL,
        increment_percentage DECIMAL(5,2),
        effective_date DATE NOT NULL,
        reason VARCHAR(255),
        approved_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
        FOREIGN KEY (approved_by) REFERENCES users(user_id),
        INDEX idx_increment_staff (staff_id)
      )
    `);
    console.log('  salary_increments table ready');

    await conn.commit();
    console.log('\nHR Module migration completed successfully!');
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
