// check_balance_diff.js — shows unmatched accounts between trial balance and DB
require('dotenv').config();
if (!process.env.DB_PASSWORD && !process.env.DB_HOST) {
  require('dotenv').config({ path: require('path').join(__dirname, '.env.production') });
}
const mariadb = require('mariadb');
const BALANCES = require('./balance_data');

const DB_NAME = process.argv[2] || process.env.DB_NAME || 'abyte_pos';

const pool = mariadb.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: DB_NAME,
  connectionLimit: 5,
  bigIntAsNumber: true,
  decimalAsNumber: true,
});

async function run() {
  let conn;
  try {
    conn = await pool.getConnection();

    // Load all leaf account names from DB
    const rows = await conn.query(`
      SELECT UPPER(TRIM(account_name)) AS uname, account_name, opening_balance
      FROM accounts a
      WHERE NOT EXISTS (
        SELECT 1 FROM accounts c WHERE c.parent_account_id = a.account_id
      )
    `);
    const dbLeaves = new Map();
    for (const r of rows) dbLeaves.set(r.uname, { name: r.account_name, bal: r.opening_balance });

    console.log(`\n╔══════════════════════════════════════════════════════╗`);
    console.log(`  Balance Diff Check → DB: ${DB_NAME}`);
    console.log(`╚══════════════════════════════════════════════════════╝\n`);

    let tbDebitLeaf = 0, tbCreditLeaf = 0;
    let dbDebit = 0, dbCredit = 0;
    const unmatched = [];
    const matched   = [];

    for (const [name, debit, credit] of BALANCES) {
      const key = name.toUpperCase().trim();
      const dbRow = dbLeaves.get(key);

      if (!dbRow) {
        // Not found in DB at all (parent accounts or truly missing)
        if (debit !== 0 || credit !== 0) {
          unmatched.push({ name, debit, credit, reason: 'not in DB' });
        }
        continue;
      }

      // Found — it's a leaf account
      const net = debit - credit;
      tbDebitLeaf  += debit;
      tbCreditLeaf += credit;

      if (dbRow.bal > 0) dbDebit  += dbRow.bal;
      else               dbCredit += Math.abs(dbRow.bal);

      const dbNet = dbRow.bal;
      if (Math.abs(net - dbNet) > 0) {
        matched.push({ name, tbNet: net, dbNet, diff: net - dbNet });
      }
    }

    // Show mismatched (different value)
    if (matched.length) {
      console.log('── Accounts with WRONG balance in DB ──────────────────');
      for (const m of matched) {
        console.log(`  "${m.name}"`);
        console.log(`    Trial Balance: ${m.tbNet}  |  DB: ${m.dbNet}  |  Diff: ${m.diff}`);
      }
      console.log('');
    }

    // Show unmatched (not found in DB as leaf)
    if (unmatched.length) {
      console.log('── Accounts NOT FOUND in DB (non-zero in trial balance) ─');
      let missDebit = 0, missCredit = 0;
      for (const u of unmatched) {
        console.log(`  "${u.name}"  debit:${u.debit}  credit:${u.credit}`);
        missDebit  += u.debit;
        missCredit += u.credit;
      }
      console.log(`\n  Missing Debit Total  : ${missDebit}`);
      console.log(`  Missing Credit Total : ${missCredit}`);
    }

    console.log('\n── Summary ─────────────────────────────────────────────');
    console.log(`  Mismatched values : ${matched.length}`);
    console.log(`  Not found (non-0) : ${unmatched.length}`);
    console.log(`\n✅ Check complete\n`);

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

run();
