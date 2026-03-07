// migrate_audit_enhance.js - Add old_values and new_values columns to audit_logs
const { getConnection } = require('../config/database');

async function migrate() {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    // Check if columns already exist
    const cols = await conn.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'audit_logs'
        AND COLUMN_NAME IN ('old_values', 'new_values')
    `);

    const existingCols = Array.isArray(cols) ? cols.map(c => c.COLUMN_NAME) : [];

    if (!existingCols.includes('old_values')) {
      await conn.query(`
        ALTER TABLE audit_logs
        ADD COLUMN old_values JSON NULL AFTER details
      `);
      console.log('Added column: old_values');
    } else {
      console.log('Column old_values already exists, skipping.');
    }

    if (!existingCols.includes('new_values')) {
      await conn.query(`
        ALTER TABLE audit_logs
        ADD COLUMN new_values JSON NULL AFTER old_values
      `);
      console.log('Added column: new_values');
    } else {
      console.log('Column new_values already exists, skipping.');
    }

    await conn.commit();
    console.log('Migration completed successfully.');
  } catch (err) {
    await conn.rollback();
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

migrate();
