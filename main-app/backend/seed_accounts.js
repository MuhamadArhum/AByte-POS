// ============================================================
// seed_accounts.js
// Usage:  node seed_accounts.js <db_name>
// Example: node seed_accounts.js abyte_pos
// ============================================================
require('dotenv').config();
// VPS uses .env.production — fallback if DB creds not loaded
if (!process.env.DB_PASSWORD && !process.env.DB_HOST) {
  require('dotenv').config({ path: require('path').join(__dirname, '.env.production') });
}
const mariadb = require('mariadb');
const data1   = require('./accounts_data_1');
const data2   = require('./accounts_data_2');

const DB_NAME = process.argv[2] || process.env.DB_NAME || 'abyte_pos';

const pool = mariadb.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  port:             parseInt(process.env.DB_PORT) || 3306,
  user:             process.env.DB_USER     || 'root',
  password:         process.env.DB_PASSWORD || '',
  database:         DB_NAME,
  connectionLimit:  5,
  bigIntAsNumber:   true,
  insertIdAsNumber: true,
  decimalAsNumber:  true,
});

// Merged flat list — order matters: parents must come before children
const ALL_ACCOUNTS = [...data1, ...data2];
// Each row: [code, name, parent_code|null, group_id, account_type, is_active]

async function run() {
  let conn;
  try {
    conn = await pool.getConnection();

    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`  Seeding Chart of Accounts → DB: ${DB_NAME}`);
    console.log(`╚══════════════════════════════════════════════╝\n`);

    // ── Step 1: Disable FK checks so DELETE doesn't fail on constraints ──
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    // ── Step 2: Wipe all existing accounts ──
    const del = await conn.query('DELETE FROM accounts');
    console.log(`✓ Deleted ${del.affectedRows} existing accounts`);

    // Reset auto-increment so IDs start fresh
    await conn.query('ALTER TABLE accounts AUTO_INCREMENT = 1');

    // ── Step 3: Re-enable FK checks ──
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // ── Step 4: Check if 'level' column exists in accounts table ──
    const cols = await conn.query(`SHOW COLUMNS FROM accounts LIKE 'level'`);
    const hasLevel = cols.length > 0;
    if (!hasLevel) {
      // Add level column if missing
      await conn.query(`ALTER TABLE accounts ADD COLUMN level TINYINT(1) NOT NULL DEFAULT 1`);
      console.log(`✓ Added missing 'level' column to accounts table`);
    }

    // ── Step 5: Build a code→id map as we insert (for parent lookups) ──
    const codeToId = {};
    let inserted = 0;
    let skipped  = 0;

    for (const [code, name, parentCode, groupId, accountType, isActive] of ALL_ACCOUNTS) {
      const parentId = parentCode ? (codeToId[parentCode] ?? null) : null;

      if (parentCode && parentId === null) {
        console.warn(`  ⚠ Skipped "${name}" — parent code "${parentCode}" not found`);
        skipped++;
        continue;
      }

      // Level = number of dash-separated parts in code
      // A=1, A-01=2, A-01-01=3, A-01-01-001=4
      const level = code.split('-').length;

      const result = await conn.query(
        `INSERT INTO accounts
           (account_code, account_name, group_id, parent_account_id, account_type, is_active, opening_balance, current_balance, level)
         VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)`,
        [code, name, groupId, parentId, accountType, isActive, level]
      );

      codeToId[code] = result.insertId;
      inserted++;

      if (inserted % 50 === 0) {
        process.stdout.write(`  ... ${inserted} inserted\r`);
      }
    }

    console.log(`\n✓ Inserted  : ${inserted} accounts`);
    if (skipped) console.log(`⚠ Skipped   : ${skipped} accounts (check warnings above)`);
    console.log(`\n✅ Done!\n`);

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

run();
