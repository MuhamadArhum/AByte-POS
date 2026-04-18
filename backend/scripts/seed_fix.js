// seed_fix.js — Fix remaining tables that didn't reach 100 entries
require('dotenv').config();
const { query } = require('../config/database');

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[rand(0, arr.length - 1)];
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };

async function run() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║   AByte ERP — Fix Seeder (Round 2)                ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  const [products, users, customers, staff, sections] = await Promise.all([
    query('SELECT product_id, price, cost_price FROM products WHERE is_active=1 LIMIT 200'),
    query('SELECT user_id FROM users'),
    query('SELECT customer_id FROM customers LIMIT 200'),
    query('SELECT staff_id FROM staff LIMIT 200'),
    query('SELECT section_id FROM sections LIMIT 10'),
  ]);
  const userIds = users.map(u => u.user_id);
  const custIds = customers.map(c => c.customer_id);
  const staffIds = staff.map(s => s.staff_id);
  const sectionIds = sections.length > 0 ? sections.map(s => s.section_id) : [null];

  // ── 1. SALES (need 100+) ── invoice_no max 20 chars ─────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM sales');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} sales (with short invoice_no)...`);
      const payMethods = ['cash', 'card', 'bank_transfer'];
      let ok = 0;
      for (let i = 0; i < needed + 20; i++) {
        if (ok >= needed) break;
        const prod = pick(products);
        const qty = rand(1, 5);
        const unitPrice = Number(prod.price) || rand(100, 5000);
        const total = qty * unitPrice;
        const ts = String(Date.now()).slice(-7);
        const invoiceNo = `SL-${ts}-${i % 1000}`;   // max ~16 chars
        const tokenNo = `T-${rand(1000, 9999)}`;
        const saleDate = daysAgo(rand(0, 180));
        try {
          const r = await query(
            `INSERT INTO sales (sub_total, sale_date, total_amount, discount, net_amount, user_id, customer_id,
             payment_method, amount_paid, status, tax_percent, additional_charges_percent, invoice_no, token_no)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [total, saleDate, total, 0, total, pick(userIds), pick(custIds),
             pick(payMethods), total, 'completed', 0, 0, invoiceNo, tokenNo]
          );
          const saleId = Number(r.insertId);
          await query(
            'INSERT INTO sale_details (sale_id, product_id, quantity, unit_price, total_price) VALUES (?,?,?,?,?)',
            [saleId, prod.product_id, qty, unitPrice, total]
          );
          ok++;
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Sales done (${ok} inserted)`);
    } else { console.log('   ✓ Sales already 100+'); }
  }

  // ── 2. STOCK ADJUSTMENTS (correct enum values) ──────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM stock_adjustments');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} stock adjustments...`);
      // correct enum: addition,subtraction,correction,damage,theft,return,opening_stock,expired
      const adjTypes = ['addition','subtraction','correction','damage','theft','return','expired'];
      const reasons = ['Physical count correction','Damaged goods','Expired stock','Inventory audit','Theft loss','Return to supplier'];
      let ok = 0;
      for (let i = 0; i < needed + 20; i++) {
        if (ok >= needed) break;
        const prod = pick(products);
        const adjType = pick(adjTypes);
        const qtyBefore = rand(10, 500);
        const qtyAdj = rand(1, 50);
        const qtyAfter = ['subtraction','damage','theft','expired'].includes(adjType)
          ? Math.max(0, qtyBefore - qtyAdj) : qtyBefore + qtyAdj;
        try {
          await query(
            `INSERT INTO stock_adjustments (product_id, store_id, adjustment_type, quantity_before,
             quantity_adjusted, quantity_after, reason, reference_number, created_by)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [prod.product_id, 1, adjType, qtyBefore, qtyAdj, qtyAfter,
             pick(reasons), `ADJ-${String(Date.now()).slice(-6)}-${i}`, pick(userIds)]
          );
          ok++;
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Stock Adjustments done (${ok} inserted)`);
    } else { console.log('   ✓ Stock Adjustments already 100+'); }
  }

  // ── 3. STOCK ISSUES (need 100+) ─────────────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM stock_issues');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} stock issues...`);
      const statuses = ['issued', 'returned', 'partial'];
      let ok = 0;
      for (let i = 0; i < needed + 20; i++) {
        if (ok >= needed) break;
        const prod = pick(products);
        const qty = rand(1, 20);
        const unitCost = Number(prod.cost_price) || rand(50, 2000);
        const issueNum = `ISS-${String(Date.now()).slice(-6)}-${i}`;
        try {
          const r = await query(
            `INSERT INTO stock_issues (issue_number, section_id, issue_date, notes, status, created_by)
             VALUES (?,?,?,?,?,?)`,
            [issueNum, pick(sectionIds), daysAgo(rand(0, 90)), 'Seed issue', pick(statuses), pick(userIds)]
          );
          await query(
            'INSERT INTO stock_issue_items (issue_id, product_id, quantity, unit_cost) VALUES (?,?,?,?)',
            [Number(r.insertId), prod.product_id, qty, unitCost]
          );
          ok++;
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Stock Issues done (${ok} inserted)`);
    } else { console.log('   ✓ Stock Issues already 100+'); }
  }

  // ── 4. LEAVE REQUESTS (need 100+) ───────────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM leave_requests');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} leave requests...`);
      const leaveTypes = ['annual','sick','casual','unpaid','maternity'];
      const statuses = ['pending','approved','rejected'];
      let ok = 0;
      for (let i = 0; i < needed + 50; i++) {
        if (ok >= needed) break;
        const days = rand(1, 5);
        const offset = rand(5, 180);
        const fromDate = daysAgo(offset);
        const toDate = daysAgo(offset - days);
        try {
          await query(
            `INSERT INTO leave_requests (staff_id, leave_type, from_date, to_date, days, reason, status, requested_by)
             VALUES (?,?,?,?,?,?,?,?)`,
            [pick(staffIds), pick(leaveTypes), fromDate, toDate, days, 'Seed leave request', pick(statuses), pick(userIds)]
          );
          ok++;
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Leave Requests done (${ok} inserted)`);
    } else { console.log('   ✓ Leave Requests already 100+'); }
  }

  // ── 5. BANK ACCOUNTS (account_id FK to accounts) ────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM bank_accounts');
    if (Number(cnt.c) < 10) {
      console.log(`── Seeding bank accounts...`);
      // Use asset accounts (Cash at Bank = 322 or similar)
      const bankLedgerAccts = await query(
        "SELECT account_id FROM accounts WHERE account_type='asset' AND is_active=1 LIMIT 20"
      );
      const acctIds = bankLedgerAccts.map(a => a.account_id);
      const banks = ['HBL','MCB','UBL','Meezan Bank','Bank Alfalah','Standard Chartered','Habib Metro','Askari Bank','NBP','Faysal Bank'];
      let ok = 0;
      for (let i = 0; i < 10; i++) {
        try {
          await query(
            `INSERT INTO bank_accounts (account_id, bank_name, account_number, account_holder, branch, opening_balance, current_balance)
             VALUES (?,?,?,?,?,?,?)`,
            [pick(acctIds), banks[i % banks.length],
             `AC${rand(100000,999999)}${rand(10,99)}`,
             `AByte Company ${i+1}`,
             `${banks[i % banks.length]} Main Branch`,
             rand(50000, 500000), rand(50000, 500000)]
          );
          ok++;
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Bank Accounts done (${ok} inserted)`);
    } else { console.log('   ✓ Bank Accounts already seeded'); }
  }

  // ── 6. TOP UP ACCOUNTING (journal, payment, receipt to 100+) ─
  {
    const [jCnt] = await query('SELECT COUNT(*) as c FROM journal_entries');
    const jNeeded = Math.max(0, 100 - Number(jCnt.c));
    if (jNeeded > 0) {
      console.log(`── Seeding ${jNeeded} more journal entries...`);
      const accts = await query('SELECT account_id FROM accounts WHERE is_active=1 LIMIT 50');
      const acctList = accts.map(a => a.account_id);
      let ok = 0;
      for (let i = 0; i < jNeeded; i++) {
        const amt = rand(1000, 100000);
        const ref = `JV-FIX-${String(Date.now()).slice(-6)}-${i}`;
        try {
          const r = await query(
            'INSERT INTO journal_entries (voucher_number, entry_date, description, total_debit, total_credit, created_by) VALUES (?,?,?,?,?,?)',
            [ref, daysAgo(rand(0,90)), 'Seed journal entry', amt, amt, pick(userIds)]
          );
          const jId = Number(r.insertId);
          await query(
            'INSERT INTO journal_entry_lines (journal_id, account_id, debit, credit, description) VALUES (?,?,?,?,?),(?,?,?,?,?)',
            [jId, pick(acctList), amt, 0, 'Dr side',
             jId, pick(acctList), 0, amt, 'Cr side']
          );
          ok++;
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Journal Entries done (${ok} inserted)`);
    }

    const [pCnt] = await query('SELECT COUNT(*) as c FROM payment_vouchers');
    const pNeeded = Math.max(0, 100 - Number(pCnt.c));
    if (pNeeded > 0) {
      console.log(`── Seeding ${pNeeded} more payment vouchers...`);
      const accts = await query('SELECT account_id FROM accounts WHERE is_active=1 LIMIT 50');
      const acctList = accts.map(a => a.account_id);
      let ok = 0;
      for (let i = 0; i < pNeeded; i++) {
        const amt = rand(500, 50000);
        const ref = `CPV-FIX-${String(Date.now()).slice(-6)}-${i}`;
        try {
          await query(
            `INSERT INTO payment_vouchers (voucher_number, voucher_date, payee_name, account_id,
             amount, payment_method, description, created_by) VALUES (?,?,?,?,?,?,?,?)`,
            [ref, daysAgo(rand(0,90)), 'Vendor Payment', pick(acctList),
             amt, 'cash', 'Seed payment', pick(userIds)]
          );
          ok++;
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Payment Vouchers done (${ok} inserted)`);
    }

    const [rCnt] = await query('SELECT COUNT(*) as c FROM receipt_vouchers');
    const rNeeded = Math.max(0, 100 - Number(rCnt.c));
    if (rNeeded > 0) {
      console.log(`── Seeding ${rNeeded} more receipt vouchers...`);
      const accts = await query('SELECT account_id FROM accounts WHERE is_active=1 LIMIT 50');
      const acctList = accts.map(a => a.account_id);
      let ok = 0;
      for (let i = 0; i < rNeeded; i++) {
        const amt = rand(500, 50000);
        const ref = `CRV-FIX-${String(Date.now()).slice(-6)}-${i}`;
        try {
          await query(
            `INSERT INTO receipt_vouchers (voucher_number, voucher_date, received_from, account_id,
             amount, payment_method, description, created_by) VALUES (?,?,?,?,?,?,?,?)`,
            [ref, daysAgo(rand(0,90)), 'Customer Payment', pick(acctList),
             amt, 'cash', 'Seed receipt', pick(userIds)]
          );
          ok++;
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Receipt Vouchers done (${ok} inserted)`);
    }
  }

  // ── FINAL COUNT ──────────────────────────────────────────────
  console.log('\n─── Final Table Counts ───');
  const tables = [
    'sales','customers','suppliers','staff','attendance','salary_payments',
    'purchase_orders','deliveries','returns','quotations','credit_sales',
    'stock_adjustments','stock_issues','expenses','holidays','leave_requests',
    'journal_entries','payment_vouchers','receipt_vouchers','inv_purchase_vouchers','bank_accounts'
  ];
  for (const t of tables) {
    try {
      const [r] = await query('SELECT COUNT(*) as c FROM `' + t + '`');
      const c = Number(r.c);
      const status = c >= 100 ? '✓' : c >= 50 ? '~' : '✗';
      console.log(`  ${status} ${t.padEnd(32)}: ${c}`);
    } catch(e) { console.log(`  ? ${t.padEnd(32)}: ERROR`); }
  }
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║  ✅  Fix seed complete!                           ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
