// migrate_coa_levels.js
// Redesigns Chart of Accounts to 4-level hierarchy
// Level 1 = System accounts (Assets, Liabilities, Equity, Revenue, Expenses)
// Level 2-4 = User-created sub-accounts (parent required)

require('dotenv').config();
const { query } = require('../config/database');

async function migrate() {
  console.log('=== Chart of Accounts Level Migration ===\n');

  try {
    // 1. Add level + is_system columns if not exist
    console.log('Step 1: Adding level & is_system columns...');
    await query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS level TINYINT NOT NULL DEFAULT 1`);
    await query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_system TINYINT NOT NULL DEFAULT 0`);
    console.log('  ✓ Columns added\n');

    // 2. Clear all existing accounts & groups (seeder garbage data)
    console.log('Step 2: Clearing existing data...');
    await query('SET FOREIGN_KEY_CHECKS = 0');
    await query('DELETE FROM journal_entry_lines');
    await query('DELETE FROM journal_entries');
    await query('DELETE FROM payment_vouchers');
    await query('DELETE FROM receipt_vouchers');
    await query('DELETE FROM bank_accounts');
    await query('DELETE FROM accounts');
    await query('DELETE FROM account_groups');
    await query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('  ✓ Existing data cleared\n');

    // 3. Seed clean account_groups (one per type for system use)
    console.log('Step 3: Seeding account groups...');
    const groups = [
      ['Assets',            'asset'],
      ['Liabilities',       'liability'],
      ['Equity',            'equity'],
      ['Revenue / Income',  'revenue'],
      ['Expenses',          'expense'],
    ];
    for (const [name, type] of groups) {
      await query(
        'INSERT INTO account_groups (group_name, group_type, description) VALUES (?, ?, ?)',
        [name, type, `Default group for ${name}`]
      );
    }
    console.log('  ✓ 5 account groups seeded\n');

    // 4. Fetch group IDs
    const groupRows = await query('SELECT group_id, group_type FROM account_groups');
    const groupMap = {};
    groupRows.forEach(g => { groupMap[g.group_type] = g.group_id; });

    // 5. Seed Level 1 system accounts  (code = single digit: 1,2,3,4,5)
    console.log('Step 4: Seeding Level 1 system accounts...');
    const level1 = [
      ['1', 'Assets',           'asset',     groupMap['asset']],
      ['2', 'Liabilities',      'liability', groupMap['liability']],
      ['3', 'Equity',           'equity',    groupMap['equity']],
      ['4', 'Revenue / Income', 'revenue',   groupMap['revenue']],
      ['5', 'Expenses',         'expense',   groupMap['expense']],
    ];
    for (const [code, name, type, gid] of level1) {
      await query(
        `INSERT INTO accounts (account_code, account_name, group_id, parent_account_id, account_type, level, is_system, opening_balance, current_balance)
         VALUES (?, ?, ?, NULL, ?, 1, 1, 0, 0)`,
        [code, name, gid, type]
      );
    }
    console.log('  ✓ 5 Level 1 system accounts created\n');

    // 6. Seed Level 2 accounts  (code = L1-XX  e.g. 1-01, 1-02)
    console.log('Step 5: Seeding sample Level 2 accounts...');
    const rootRows = await query('SELECT account_id, account_code, account_type, group_id FROM accounts WHERE level = 1');
    const rootMap = {};
    rootRows.forEach(r => { rootMap[r.account_type] = r; });

    const level2 = [
      // Assets
      [`${rootMap['asset'].account_code}-01`,    'Current Assets',         'asset',     rootMap['asset'].account_id,     rootMap['asset'].group_id],
      [`${rootMap['asset'].account_code}-02`,    'Fixed Assets',           'asset',     rootMap['asset'].account_id,     rootMap['asset'].group_id],
      // Liabilities
      [`${rootMap['liability'].account_code}-01`,'Current Liabilities',    'liability', rootMap['liability'].account_id, rootMap['liability'].group_id],
      [`${rootMap['liability'].account_code}-02`,'Long-term Liabilities',  'liability', rootMap['liability'].account_id, rootMap['liability'].group_id],
      // Equity
      [`${rootMap['equity'].account_code}-01`,   "Owner's Capital",        'equity',    rootMap['equity'].account_id,    rootMap['equity'].group_id],
      [`${rootMap['equity'].account_code}-02`,   'Retained Earnings',      'equity',    rootMap['equity'].account_id,    rootMap['equity'].group_id],
      // Revenue
      [`${rootMap['revenue'].account_code}-01`,  'Sales Revenue',          'revenue',   rootMap['revenue'].account_id,   rootMap['revenue'].group_id],
      [`${rootMap['revenue'].account_code}-02`,  'Other Income',           'revenue',   rootMap['revenue'].account_id,   rootMap['revenue'].group_id],
      // Expenses
      [`${rootMap['expense'].account_code}-01`,  'Cost of Goods Sold',     'expense',   rootMap['expense'].account_id,   rootMap['expense'].group_id],
      [`${rootMap['expense'].account_code}-02`,  'Operating Expenses',     'expense',   rootMap['expense'].account_id,   rootMap['expense'].group_id],
      [`${rootMap['expense'].account_code}-03`,  'Administrative Expenses','expense',   rootMap['expense'].account_id,   rootMap['expense'].group_id],
    ];
    for (const [code, name, type, pid, gid] of level2) {
      await query(
        `INSERT INTO accounts (account_code, account_name, group_id, parent_account_id, account_type, level, is_system, opening_balance, current_balance)
         VALUES (?, ?, ?, ?, ?, 2, 0, 0, 0)`,
        [code, name, gid, pid, type]
      );
    }
    console.log('  ✓ Level 2 accounts seeded\n');

    // 7. Seed Level 3 accounts  (code = L2-XXX  e.g. 1-01-001)
    console.log('Step 6: Seeding sample Level 3 accounts...');
    const l2Rows = await query('SELECT account_id, account_code, account_type, group_id FROM accounts WHERE level = 2');
    const l2Map = {};
    l2Rows.forEach(r => { l2Map[r.account_code] = r; });

    const level3 = [
      // Under Current Assets (1-01)
      [`1-01-001`, 'Cash in Hand',          'asset',     l2Map['1-01'].account_id, l2Map['1-01'].group_id],
      [`1-01-002`, 'Cash at Bank',          'asset',     l2Map['1-01'].account_id, l2Map['1-01'].group_id],
      [`1-01-003`, 'Accounts Receivable',   'asset',     l2Map['1-01'].account_id, l2Map['1-01'].group_id],
      [`1-01-004`, 'Inventory / Stock',     'asset',     l2Map['1-01'].account_id, l2Map['1-01'].group_id],
      // Under Fixed Assets (1-02)
      [`1-02-001`, 'Furniture & Fixtures',  'asset',     l2Map['1-02'].account_id, l2Map['1-02'].group_id],
      [`1-02-002`, 'Equipment',             'asset',     l2Map['1-02'].account_id, l2Map['1-02'].group_id],
      // Under Current Liabilities (2-01)
      [`2-01-001`, 'Accounts Payable',      'liability', l2Map['2-01'].account_id, l2Map['2-01'].group_id],
      [`2-01-002`, 'Sales Tax Payable',     'liability', l2Map['2-01'].account_id, l2Map['2-01'].group_id],
      // Under Long-term Liabilities (2-02)
      [`2-02-001`, 'Bank Loan',             'liability', l2Map['2-02'].account_id, l2Map['2-02'].group_id],
      // Under Owner's Capital (3-01)
      [`3-01-001`, 'Owner Capital',         'equity',    l2Map['3-01'].account_id, l2Map['3-01'].group_id],
      // Under Retained Earnings (3-02)
      [`3-02-001`, 'Retained Earnings',     'equity',    l2Map['3-02'].account_id, l2Map['3-02'].group_id],
      // Under Sales Revenue (4-01)
      [`4-01-001`, 'Product Sales',         'revenue',   l2Map['4-01'].account_id, l2Map['4-01'].group_id],
      [`4-01-002`, 'Service Revenue',       'revenue',   l2Map['4-01'].account_id, l2Map['4-01'].group_id],
      // Under Other Income (4-02)
      [`4-02-001`, 'Other Income',          'revenue',   l2Map['4-02'].account_id, l2Map['4-02'].group_id],
      // Under COGS (5-01)
      [`5-01-001`, 'Purchase Cost',         'expense',   l2Map['5-01'].account_id, l2Map['5-01'].group_id],
      // Under Operating Expenses (5-02)
      [`5-02-001`, 'Salaries & Wages',      'expense',   l2Map['5-02'].account_id, l2Map['5-02'].group_id],
      [`5-02-002`, 'Rent Expense',          'expense',   l2Map['5-02'].account_id, l2Map['5-02'].group_id],
      [`5-02-003`, 'Utilities',             'expense',   l2Map['5-02'].account_id, l2Map['5-02'].group_id],
      // Under Admin Expenses (5-03)
      [`5-03-001`, 'Office Supplies',       'expense',   l2Map['5-03'].account_id, l2Map['5-03'].group_id],
      [`5-03-002`, 'Telephone & Internet',  'expense',   l2Map['5-03'].account_id, l2Map['5-03'].group_id],
    ];
    for (const [code, name, type, pid, gid] of level3) {
      await query(
        `INSERT INTO accounts (account_code, account_name, group_id, parent_account_id, account_type, level, is_system, opening_balance, current_balance)
         VALUES (?, ?, ?, ?, ?, 3, 0, 0, 0)`,
        [code, name, gid, pid, type]
      );
    }
    console.log('  ✓ Level 3 accounts seeded\n');

    const total = await query('SELECT COUNT(*) as cnt FROM accounts');
    const byLevel = await query('SELECT level, COUNT(*) as cnt FROM accounts GROUP BY level ORDER BY level');
    console.log(`\n✅ Migration complete! Total accounts: ${total[0].cnt}`);
    byLevel.forEach(r => {
      const labels = ['', 'Level 1 (System Roots)', 'Level 2 (Groups)', 'Level 3 (Sub-Groups)', 'Level 4 (Detail)'];
      console.log(`   ${labels[r.level]}: ${r.cnt} accounts`);
    });
    console.log('\n   Code Pattern:');
    console.log('   L1: 1 | L2: 1-01 | L3: 1-01-001 | L4: 1-01-001-001');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  }
  process.exit();
}

migrate();
