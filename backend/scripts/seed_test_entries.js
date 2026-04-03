// =============================================================
// seed_test_entries.js
// Creates Level 4 accounts + 100 test entries (JV, CPV, CRV)
// Run: node scripts/seed_test_entries.js
// =============================================================

require('dotenv').config();
const { query, getConnection } = require('../config/database');

// ── Helper: random int between min and max ────────────────────
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[rand(0, arr.length - 1)];

// ── Helper: date string N days ago ───────────────────────────
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

// ── Level 4 accounts to create ───────────────────────────────
// Format: { parent_code, code_suffix, name, type }
const L4_ACCOUNTS = [
  // Current Assets → Cash in Hand (1-01-001)
  { parentCode: '1-01-001', suffix: '001', name: 'Main Cash Box',        type: 'asset' },
  { parentCode: '1-01-001', suffix: '002', name: 'Petty Cash',           type: 'asset' },
  // Current Assets → Cash at Bank (1-01-002)
  { parentCode: '1-01-002', suffix: '001', name: 'HBL Business Account', type: 'asset' },
  { parentCode: '1-01-002', suffix: '002', name: 'MCB Current Account',  type: 'asset' },
  // Current Assets → Accounts Receivable (1-01-003)
  { parentCode: '1-01-003', suffix: '001', name: 'Trade Debtors',        type: 'asset' },
  { parentCode: '1-01-003', suffix: '002', name: 'Staff Advances',       type: 'asset' },
  // Current Liabilities → Accounts Payable (2-01-001)
  { parentCode: '2-01-001', suffix: '001', name: 'Trade Creditors',      type: 'liability' },
  { parentCode: '2-01-001', suffix: '002', name: 'Accrued Expenses',     type: 'liability' },
  // Current Liabilities → Sales Tax Payable (2-01-002)
  { parentCode: '2-01-002', suffix: '001', name: 'GST Payable',          type: 'liability' },
  // Owner Capital (3-01-001)
  { parentCode: '3-01-001', suffix: '001', name: 'Capital Introduced',   type: 'equity' },
  { parentCode: '3-01-001', suffix: '002', name: 'Drawings',             type: 'equity' },
  // Revenue → Product Sales (4-01-001)
  { parentCode: '4-01-001', suffix: '001', name: 'Retail Sales',         type: 'revenue' },
  { parentCode: '4-01-001', suffix: '002', name: 'Wholesale Sales',      type: 'revenue' },
  // Revenue → Service Revenue (4-01-002)
  { parentCode: '4-01-002', suffix: '001', name: 'Installation Charges', type: 'revenue' },
  { parentCode: '4-01-002', suffix: '002', name: 'Repair Services',      type: 'revenue' },
  // Other Income (4-02-001)
  { parentCode: '4-02-001', suffix: '001', name: 'Discount Received',    type: 'revenue' },
  // COGS → Purchase Cost (5-01-001)
  { parentCode: '5-01-001', suffix: '001', name: 'Raw Material Cost',    type: 'expense' },
  { parentCode: '5-01-001', suffix: '002', name: 'Finished Goods Cost',  type: 'expense' },
  // Salaries (5-02-001)
  { parentCode: '5-02-001', suffix: '001', name: 'Staff Salaries',       type: 'expense' },
  { parentCode: '5-02-001', suffix: '002', name: 'Overtime Pay',         type: 'expense' },
  // Rent (5-02-002)
  { parentCode: '5-02-002', suffix: '001', name: 'Shop Rent',            type: 'expense' },
  { parentCode: '5-02-002', suffix: '002', name: 'Warehouse Rent',       type: 'expense' },
  // Utilities (5-02-003)
  { parentCode: '5-02-003', suffix: '001', name: 'Electricity Bill',     type: 'expense' },
  { parentCode: '5-02-003', suffix: '002', name: 'Water Bill',           type: 'expense' },
  { parentCode: '5-02-003', suffix: '003', name: 'Gas Bill',             type: 'expense' },
  // Office Supplies (5-03-001)
  { parentCode: '5-03-001', suffix: '002', name: 'Stationery',           type: 'expense' },
  { parentCode: '5-03-001', suffix: '003', name: 'Printing & Copies',    type: 'expense' },
  // Telephone (5-03-002)
  { parentCode: '5-03-002', suffix: '001', name: 'Mobile Packages',      type: 'expense' },
  { parentCode: '5-03-002', suffix: '002', name: 'Internet Bill',        type: 'expense' },
];

// ── Create Level 4 accounts ───────────────────────────────────
async function createL4Accounts() {
  console.log('\n─── Creating Level 4 accounts ───');
  const created = {};

  for (const acc of L4_ACCOUNTS) {
    // Find parent
    const parents = await query('SELECT * FROM accounts WHERE account_code = ?', [acc.parentCode]);
    if (parents.length === 0) {
      console.log(`  ⚠ Parent not found: ${acc.parentCode}`);
      continue;
    }
    const parent = parents[0];
    const newCode = `${parent.account_code}-${acc.suffix}`;

    // Skip if already exists
    const existing = await query('SELECT account_id, account_name FROM accounts WHERE account_code = ?', [newCode]);
    if (existing.length > 0) {
      console.log(`  ✓ Already exists: ${newCode} — ${existing[0].account_name}`);
      created[newCode] = { account_id: existing[0].account_id, account_name: existing[0].account_name, account_type: acc.type };
      continue;
    }

    const result = await query(
      `INSERT INTO accounts (account_code, account_name, group_id, parent_account_id, account_type, level, is_system, opening_balance, current_balance)
       VALUES (?, ?, ?, ?, ?, 4, 0, 0, 0)`,
      [newCode, acc.name, parent.group_id, parent.account_id, parent.account_type]
    );
    created[newCode] = { account_id: Number(result.insertId), account_name: acc.name, account_type: acc.type };
    console.log(`  + Created: ${newCode} — ${acc.name}`);
  }

  return created;
}

// ── Generate JV number ────────────────────────────────────────
async function nextJvNumber() {
  const [last] = await query('SELECT entry_number FROM journal_entries ORDER BY entry_id DESC LIMIT 1');
  let n = 1;
  if (last?.entry_number) {
    const m = last.entry_number.match(/JV(\d+)/);
    if (m) n = parseInt(m[1]) + 1;
  }
  return `JV${String(n).padStart(6, '0')}`;
}

// ── Generate CPV number ───────────────────────────────────────
async function nextCpvNumber() {
  const [last] = await query('SELECT voucher_number FROM payment_vouchers ORDER BY voucher_id DESC LIMIT 1');
  let n = 1;
  if (last?.voucher_number) {
    const m = last.voucher_number.match(/CPV(\d+)/);
    if (m) n = parseInt(m[1]) + 1;
  }
  return `CPV${String(n).padStart(6, '0')}`;
}

// ── Generate CRV number ───────────────────────────────────────
async function nextCrvNumber() {
  const [last] = await query('SELECT voucher_number FROM receipt_vouchers ORDER BY voucher_id DESC LIMIT 1');
  let n = 1;
  if (last?.voucher_number) {
    const m = last.voucher_number.match(/CRV(\d+)/);
    if (m) n = parseInt(m[1]) + 1;
  }
  return `CRV${String(n).padStart(6, '0')}`;
}

// ── Create Journal Entries (40 JVs) ──────────────────────────
async function createJournalEntries(accounts) {
  console.log('\n─── Creating 40 Journal Entries (JV) ───');

  const cashBox      = accounts['1-01-001-001'];
  const petty        = accounts['1-01-001-002'];
  const hbl          = accounts['1-01-002-001'];
  const mcb          = accounts['1-01-002-002'];
  const debtors      = accounts['1-01-003-001'];
  const staffAdv     = accounts['1-01-003-002'];
  const creditors    = accounts['2-01-001-001'];
  const accrued      = accounts['2-01-001-002'];
  const gst          = accounts['2-01-002-001'];
  const capital      = accounts['3-01-001-001'];
  const drawings     = accounts['3-01-001-002'];
  const retailSales  = accounts['4-01-001-001'];
  const wholesale    = accounts['4-01-001-002'];
  const installation = accounts['4-01-002-001'];
  const repair       = accounts['4-01-002-002'];
  const discount     = accounts['4-02-001-001'];
  const rawCost      = accounts['5-01-001-001'];
  const goodsCost    = accounts['5-01-001-002'];
  const salaries     = accounts['5-02-001-001'];
  const overtime     = accounts['5-02-001-002'];
  const shopRent     = accounts['5-02-002-001'];
  const wareRent     = accounts['5-02-002-002'];
  const electric     = accounts['5-02-003-001'];
  const water        = accounts['5-02-003-002'];
  const gas          = accounts['5-02-003-003'];
  const stationery   = accounts['5-03-001-002'];
  const printing     = accounts['5-03-001-003'];
  const mobile       = accounts['5-03-002-001'];
  const internet     = accounts['5-03-002-002'];

  // Pre-defined JV templates: [description, [debit_account, credit_account, amount]]
  const jvTemplates = [
    ['Capital introduced by owner',            [cashBox, capital,   500000]],
    ['Capital introduced (bank transfer)',      [hbl,     capital,   300000]],
    ['Retail sales — cash received',           [cashBox, retailSales, 85000]],
    ['Wholesale sales — bank deposit',         [hbl,     wholesale,  120000]],
    ['Installation service revenue',           [cashBox, installation, 15000]],
    ['Repair service charges collected',       [cashBox, repair,      8500]],
    ['Raw material purchased on credit',       [rawCost, creditors,  65000]],
    ['Finished goods purchase — cash',         [goodsCost, cashBox,  45000]],
    ['Staff salaries paid — cash',             [salaries, cashBox,   95000]],
    ['Overtime pay disbursed',                 [overtime, cashBox,    8000]],
    ['Shop rent paid — cash',                  [shopRent, cashBox,   35000]],
    ['Warehouse rent via bank',                [wareRent, hbl,        25000]],
    ['Electricity bill paid',                  [electric, cashBox,    6500]],
    ['Water bill paid — cash',                 [water,    cashBox,    1200]],
    ['Gas bill via bank transfer',             [gas,      hbl,        2800]],
    ['Stationery purchased — cash',            [stationery, cashBox,  3200]],
    ['Printing charges paid',                  [printing, cashBox,    1800]],
    ['Mobile packages — cash',                 [mobile,   cashBox,    2500]],
    ['Internet bill paid',                     [internet, hbl,        4500]],
    ['Petty cash refilled from main box',      [petty,    cashBox,   10000]],
    ['Bank cash withdrawal to cash box',       [cashBox,  hbl,       50000]],
    ['Cash deposited into bank',               [hbl,      cashBox,   80000]],
    ['Customer advance received',              [cashBox,  debtors,   20000]],
    ['Debtor payment received — bank',         [hbl,      debtors,   35000]],
    ['Payment to supplier — bank',             [creditors, hbl,       55000]],
    ['GST collected on sales',                 [cashBox,  gst,       12000]],
    ['GST paid to FBR',                        [gst,      hbl,        9500]],
    ['Staff advance given',                    [staffAdv, cashBox,    5000]],
    ['Staff advance recovered',                [cashBox,  staffAdv,   3000]],
    ['Owner drawings — cash',                  [drawings, cashBox,   40000]],
    ['Discount received from supplier',        [creditors, discount,  4500]],
    ['Accrued rent expense recorded',          [shopRent, accrued,   35000]],
    ['Accrued salaries at month end',          [salaries, accrued,   95000]],
    ['Retail sales + GST (cash)',              [cashBox,  retailSales, 70000]],
    ['Wholesale order — bank receipt',         [hbl,      wholesale,  95000]],
    ['MCB account deposit',                    [mcb,      cashBox,   60000]],
    ['Transfer from HBL to MCB',              [mcb,      hbl,        30000]],
    ['Repair income — bank',                   [hbl,      repair,     12000]],
    ['Gas bill — petty cash',                  [gas,      petty,      1500]],
    ['Office internet renewal',                [internet, cashBox,    4500]],
  ];

  let count = 0;
  for (let i = 0; i < 40; i++) {
    const [desc, [drAcc, crAcc, baseAmt]] = jvTemplates[i % jvTemplates.length];
    const amount = baseAmt + rand(-baseAmt * 0.1, baseAmt * 0.1); // ±10% variation
    const date   = daysAgo(rand(1, 90));
    const jvNum  = await nextJvNumber();
    const conn   = await getConnection();

    try {
      await conn.beginTransaction();

      const result = await conn.query(
        'INSERT INTO journal_entries (entry_number, entry_date, description, total_debit, total_credit, status, created_by) VALUES (?, ?, ?, ?, ?, "posted", 1)',
        [jvNum, date, desc, amount, amount]
      );
      const entryId = Number(result.insertId);

      await conn.query(
        'INSERT INTO journal_entry_lines (entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, ?)',
        [entryId, drAcc.account_id, desc, amount, 0]
      );
      await conn.query(
        'INSERT INTO journal_entry_lines (entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, ?)',
        [entryId, crAcc.account_id, desc, 0, amount]
      );

      // Update balances
      await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [amount, drAcc.account_id]);
      await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [amount, crAcc.account_id]);

      await conn.commit();
      count++;
      console.log(`  [${String(i+1).padStart(2,'0')}] ${jvNum} | ${date} | ${desc.substring(0,40)} | ${amount.toLocaleString()}`);
    } catch (err) {
      await conn.rollback();
      console.error(`  ✗ JV ${i+1} failed:`, err.message);
    } finally {
      conn.release();
    }
  }

  console.log(`  → ${count} JVs created`);
}

// ── Create Payment Vouchers (30 CPVs) ────────────────────────
async function createPaymentVouchers(accounts) {
  console.log('\n─── Creating 30 Cash Payment Vouchers (CPV) ───');

  const expenseAccounts = [
    { acc: accounts['5-02-001-001'], label: 'Staff Salaries' },
    { acc: accounts['5-02-001-002'], label: 'Overtime Pay' },
    { acc: accounts['5-02-002-001'], label: 'Shop Rent' },
    { acc: accounts['5-02-002-002'], label: 'Warehouse Rent' },
    { acc: accounts['5-02-003-001'], label: 'Electricity' },
    { acc: accounts['5-02-003-002'], label: 'Water Utility' },
    { acc: accounts['5-02-003-003'], label: 'Gas Utility' },
    { acc: accounts['5-03-001-002'], label: 'Stationery' },
    { acc: accounts['5-03-001-003'], label: 'Printing' },
    { acc: accounts['5-03-002-001'], label: 'Mobile Package' },
    { acc: accounts['5-03-002-002'], label: 'Internet Bill' },
    { acc: accounts['5-01-001-001'], label: 'Raw Material Purchase' },
  ].filter(e => e.acc);

  const payees = [
    'ABC Suppliers', 'XYZ Trading', 'Ali Enterprises', 'Hassan & Sons',
    'City Power Company', 'PTCL', 'Jazz Telecom', 'Office Depot',
    'Landlord Ahmad', 'Skilled Staff', 'General Store', 'Utility Dept',
    'Print Shop', 'Fuel Station', 'Maintenance Co.', 'Tech Vendors',
  ];

  let count = 0;
  for (let i = 0; i < 30; i++) {
    const { acc, label } = expenseAccounts[i % expenseAccounts.length];
    const amount   = rand(1000, 80000);
    const date     = daysAgo(rand(1, 90));
    const payee    = pick(payees);
    const cpvNum   = await nextCpvNumber();
    const narration = `${label} — ${date}`;

    try {
      await query(
        `INSERT INTO payment_vouchers (voucher_number, voucher_date, payment_to, payment_type, account_id, amount, payment_method, description, created_by)
         VALUES (?, ?, ?, 'expense', ?, ?, 'cash', ?, 1)`,
        [cpvNum, date, payee, acc.account_id, amount, narration]
      );
      count++;
      console.log(`  [${String(i+1).padStart(2,'0')}] ${cpvNum} | ${date} | ${payee.padEnd(20)} | ${acc.account_name.padEnd(22)} | ${amount.toLocaleString()}`);
    } catch (err) {
      console.error(`  ✗ CPV ${i+1} failed:`, err.message);
    }
  }

  console.log(`  → ${count} CPVs created`);
}

// ── Create Receipt Vouchers (30 CRVs) ────────────────────────
async function createReceiptVouchers(accounts) {
  console.log('\n─── Creating 30 Cash Receipt Vouchers (CRV) ───');

  const incomeAccounts = [
    { acc: accounts['4-01-001-001'], label: 'Retail Sales' },
    { acc: accounts['4-01-001-002'], label: 'Wholesale Sales' },
    { acc: accounts['4-01-002-001'], label: 'Installation Charges' },
    { acc: accounts['4-01-002-002'], label: 'Repair Services' },
    { acc: accounts['4-02-001-001'], label: 'Discount Received' },
    { acc: accounts['1-01-003-001'], label: 'Debtor Recovery' },
    { acc: accounts['3-01-001-001'], label: 'Capital Deposit' },
  ].filter(e => e.acc);

  const payers = [
    'Customer Ahmed', 'Retail Client', 'Walk-in Sale', 'Bulk Buyer Ltd',
    'Service Client', 'Online Order', 'Corporate Client', 'Regular Customer',
    'Debtor Ali', 'Owner Deposit', 'Distributor', 'Cash Counter',
    'Outlet #1', 'Outlet #2', 'Trade Customer', 'Advance Receipt',
  ];

  let count = 0;
  for (let i = 0; i < 30; i++) {
    const { acc, label } = incomeAccounts[i % incomeAccounts.length];
    const amount    = rand(2000, 150000);
    const date      = daysAgo(rand(1, 90));
    const payer     = pick(payers);
    const crvNum    = await nextCrvNumber();
    const narration = `${label} — ${date}`;

    try {
      await query(
        `INSERT INTO receipt_vouchers (voucher_number, voucher_date, received_from, receipt_type, account_id, amount, payment_method, description, created_by)
         VALUES (?, ?, ?, 'customer', ?, ?, 'cash', ?, 1)`,
        [crvNum, date, payer, acc.account_id, amount, narration]
      );
      count++;
      console.log(`  [${String(i+1).padStart(2,'0')}] ${crvNum} | ${date} | ${payer.padEnd(20)} | ${acc.account_name.padEnd(22)} | ${amount.toLocaleString()}`);
    } catch (err) {
      console.error(`  ✗ CRV ${i+1} failed:`, err.message);
    }
  }

  console.log(`  → ${count} CRVs created`);
}

// ── Main ──────────────────────────────────────────────────────
(async () => {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  AByte POS — Accounts Test Data Seeder      ║');
  console.log('║  40 JVs + 30 CPVs + 30 CRVs = 100 entries  ║');
  console.log('╚══════════════════════════════════════════════╝');

  try {
    const accountMap = await createL4Accounts();

    await createJournalEntries(accountMap);
    await createPaymentVouchers(accountMap);
    await createReceiptVouchers(accountMap);

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║  ✅  100 entries seeded successfully!        ║');
    console.log('╚══════════════════════════════════════════════╝\n');
  } catch (err) {
    console.error('\n✗ Seeder failed:', err.message);
    console.error(err.stack);
  }

  process.exit(0);
})();
