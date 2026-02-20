const { getConnection } = require('./config/database');

async function migrate() {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sales_targets (
        target_id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NULL,
        target_type ENUM('daily', 'weekly', 'monthly') NOT NULL DEFAULT 'monthly',
        target_amount DECIMAL(12,2) NOT NULL,
        target_orders INT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id),
        FOREIGN KEY (created_by) REFERENCES users(user_id),
        INDEX idx_target_user (user_id),
        INDEX idx_target_period (period_start, period_end),
        INDEX idx_target_active (is_active)
      )
    `);
    console.log('Created sales_targets table');

    await conn.query(`
      CREATE TABLE IF NOT EXISTS target_achievements (
        achievement_id INT PRIMARY KEY AUTO_INCREMENT,
        target_id INT NOT NULL,
        achievement_date DATE NOT NULL,
        actual_amount DECIMAL(12,2) DEFAULT 0,
        actual_orders INT DEFAULT 0,
        achievement_percentage DECIMAL(5,2) DEFAULT 0,
        FOREIGN KEY (target_id) REFERENCES sales_targets(target_id) ON DELETE CASCADE,
        UNIQUE KEY unique_target_date (target_id, achievement_date)
      )
    `);
    console.log('Created target_achievements table');

    await conn.commit();
    console.log('\nSales targets migration completed successfully!');
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed:', err);
  } finally {
    conn.release();
    process.exit();
  }
}

migrate();
