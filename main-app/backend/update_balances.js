// ============================================================
// update_balances.js
// Usage:  node update_balances.js <db_name>
// Example: node update_balances.js abyte_pos
// ============================================================
require('dotenv').config();
if (!process.env.DB_PASSWORD && !process.env.DB_HOST) {
  require('dotenv').config({ path: require('path').join(__dirname, '.env.production') });
}
const mariadb = require('mariadb');
const BALANCES = require('./balance_data');

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

async function run() {
  let conn;
  try {
    conn = await pool.getConnection();

    console.log(`\n╔══════════════════════════════════════════════╗`);
    console.log(`  Updating Balances → DB: ${DB_NAME}`);
    console.log(`╚══════════════════════════════════════════════╝\n`);

    let updated  = 0;
    let skipped  = 0;
    let zeroSkip = 0;

    for (const [name, debit, credit] of BALANCES) {
      // Skip zero-balance entries — no update needed
      if (debit === 0 && credit === 0) {
        zeroSkip++;
        continue;
      }

      const net = debit - credit; // positive = debit balance, negative = credit balance

      // Only update leaf accounts (accounts that have no children)
      const result = await conn.query(
        `UPDATE accounts
            SET opening_balance = ?,
                current_balance  = ?
          WHERE UPPER(TRIM(account_name)) = UPPER(TRIM(?))
            AND NOT EXISTS (
              SELECT 1 FROM accounts c
               WHERE c.parent_account_id = accounts.account_id
            )`,
        [net, net, name]
      );

      if (result.affectedRows > 0) {
        updated += result.affectedRows;
        if (result.affectedRows > 1) {
          console.warn(`  ⚠ "${name}" matched ${result.affectedRows} rows`);
        }
      } else {
        console.warn(`  ⚠ No match: "${name}"`);
        skipped++;
      }

      if ((updated + skipped) % 50 === 0) {
        process.stdout.write(`  ... ${updated} updated\r`);
      }
    }

    console.log(`\n✓ Updated   : ${updated} accounts`);
    console.log(`  Zero-bal  : ${zeroSkip} skipped (balance was 0/0)`);
    if (skipped) console.log(`⚠ No match  : ${skipped} entries (check warnings above)`);
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
