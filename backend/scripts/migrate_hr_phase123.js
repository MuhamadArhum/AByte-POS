// =============================================================
// migrate_hr_phase123.js
// HR Module Phase 1, 2, 3 — New Tables
// Run: node scripts/migrate_hr_phase123.js
// =============================================================

require('dotenv').config();
const { query } = require('../config/database');

async function run() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  HR Module Phase 1-2-3 Migration                    ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // ── 1. Departments ─────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS departments (
      department_id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      description TEXT,
      head_of_dept VARCHAR(100),
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ departments table');

  // Seed existing departments from staff table
  const existingDepts = await query(`SELECT DISTINCT department FROM staff WHERE department IS NOT NULL AND department != ''`);
  for (const { department } of existingDepts) {
    await query(`INSERT IGNORE INTO departments (name) VALUES (?)`, [department]);
  }
  if (existingDepts.length) console.log(`  → Seeded ${existingDepts.length} departments from staff records`);

  // ── 2. Salary Components ───────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS salary_components (
      component_id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      type ENUM('allowance','deduction') NOT NULL,
      calculation ENUM('fixed','percentage') DEFAULT 'fixed',
      default_value DECIMAL(10,2) DEFAULT 0,
      is_taxable TINYINT(1) DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ salary_components table');

  await query(`
    CREATE TABLE IF NOT EXISTS staff_salary_components (
      id INT AUTO_INCREMENT PRIMARY KEY,
      staff_id INT NOT NULL,
      component_id INT NOT NULL,
      custom_value DECIMAL(10,2) DEFAULT NULL,
      is_active TINYINT(1) DEFAULT 1,
      UNIQUE KEY uq_staff_component (staff_id, component_id),
      FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE CASCADE,
      FOREIGN KEY (component_id) REFERENCES salary_components(component_id) ON DELETE CASCADE
    )
  `);
  console.log('✓ staff_salary_components table');

  // Seed default components
  const defaultComponents = [
    ['House Rent Allowance', 'allowance', 'percentage', 20, 0],
    ['Medical Allowance',    'allowance', 'fixed',      1000, 0],
    ['Transport Allowance',  'allowance', 'fixed',      500,  0],
    ['EOBI Deduction',       'deduction', 'fixed',      270,  0],
    ['Income Tax',           'deduction', 'percentage', 5,    1],
    ['Absent Deduction',     'deduction', 'fixed',      0,    0],
  ];
  for (const [name, type, calc, val, taxable] of defaultComponents) {
    await query(
      `INSERT IGNORE INTO salary_components (name, type, calculation, default_value, is_taxable) VALUES (?,?,?,?,?)`,
      [name, type, calc, val, taxable]
    );
  }
  console.log('  → Seeded 6 default salary components');

  // ── 3. Shifts ──────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS shifts (
      shift_id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      grace_minutes INT DEFAULT 15,
      is_overnight TINYINT(1) DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ shifts table');

  // Add shift_id to staff
  try {
    await query(`ALTER TABLE staff ADD COLUMN shift_id INT DEFAULT NULL`);
    console.log('✓ staff.shift_id column added');
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    console.log('  (staff.shift_id already exists)');
  }

  // Seed default shifts
  const defaultShifts = [
    ['Morning Shift',   '08:00:00', '16:00:00', 15, 0],
    ['Evening Shift',   '14:00:00', '22:00:00', 15, 0],
    ['Night Shift',     '22:00:00', '06:00:00', 15, 1],
    ['General Shift',   '09:00:00', '17:00:00', 15, 0],
  ];
  for (const [name, start, end, grace, overnight] of defaultShifts) {
    await query(
      `INSERT IGNORE INTO shifts (name, start_time, end_time, grace_minutes, is_overnight) VALUES (?,?,?,?,?)`,
      [name, start, end, grace, overnight]
    );
  }
  console.log('  → Seeded 4 default shifts');

  // ── 4. Performance Appraisals ──────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS performance_appraisals (
      appraisal_id INT AUTO_INCREMENT PRIMARY KEY,
      staff_id INT NOT NULL,
      appraisal_date DATE NOT NULL,
      period_from DATE,
      period_to DATE,
      rating ENUM('excellent','good','satisfactory','needs_improvement','poor') NOT NULL,
      goals_achieved TEXT,
      strengths TEXT,
      improvements TEXT,
      overall_comments TEXT,
      appraised_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE CASCADE
    )
  `);
  console.log('✓ performance_appraisals table');

  // ── 5. Exit Requests ───────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS exit_requests (
      exit_id INT AUTO_INCREMENT PRIMARY KEY,
      staff_id INT NOT NULL,
      exit_type ENUM('resignation','termination','retirement','contract_end') NOT NULL,
      notice_date DATE NOT NULL,
      last_working_date DATE,
      reason TEXT,
      status ENUM('pending','approved','rejected','completed') DEFAULT 'pending',
      final_settlement DECIMAL(10,2) DEFAULT 0,
      settlement_notes TEXT,
      reviewed_by INT,
      review_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (staff_id) REFERENCES staff(staff_id) ON DELETE CASCADE
    )
  `);
  console.log('✓ exit_requests table');

  // ── 6. Leave Policies ──────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS leave_policies (
      policy_id INT AUTO_INCREMENT PRIMARY KEY,
      leave_type ENUM('annual','sick','emergency','unpaid','other') NOT NULL UNIQUE,
      annual_entitlement INT DEFAULT 0,
      carry_forward_allowed TINYINT(1) DEFAULT 0,
      max_carry_forward INT DEFAULT 0,
      accrual_type ENUM('monthly','quarterly','yearly') DEFAULT 'yearly',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
  console.log('✓ leave_policies table');

  await query(`
    INSERT IGNORE INTO leave_policies (leave_type, annual_entitlement, carry_forward_allowed, max_carry_forward, accrual_type) VALUES
    ('annual',    20, 1, 5, 'monthly'),
    ('sick',      10, 0, 0, 'yearly'),
    ('emergency',  5, 0, 0, 'yearly'),
    ('unpaid',     0, 0, 0, 'yearly'),
    ('other',      3, 0, 0, 'yearly')
  `);
  console.log('  → Seeded 5 default leave policies');

  // ── 7. Loan EMI Schedule ───────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS loan_emi_schedule (
      schedule_id INT AUTO_INCREMENT PRIMARY KEY,
      loan_id INT NOT NULL,
      emi_number INT NOT NULL,
      due_date DATE NOT NULL,
      emi_amount DECIMAL(10,2) NOT NULL,
      status ENUM('pending','paid','overdue') DEFAULT 'pending',
      paid_at DATETIME,
      FOREIGN KEY (loan_id) REFERENCES staff_loans(loan_id) ON DELETE CASCADE
    )
  `);
  console.log('✓ loan_emi_schedule table');

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  ✅  Migration completed successfully!               ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  process.exit(0);
}

run().catch(err => { console.error('Migration failed:', err); process.exit(1); });
