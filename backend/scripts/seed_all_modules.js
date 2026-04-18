// =============================================================
// seed_all_modules.js
// Seeds 100+ entries in every major table across all modules
// Run: node scripts/seed_all_modules.js
// =============================================================

require('dotenv').config();
const { query } = require('../config/database');

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[rand(0, arr.length - 1)];
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };
const timeStr = (h, m) => `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;

async function run() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║   AByte ERP — Full System Data Seeder             ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  // ── Fetch existing IDs ──────────────────────────────────────
  const [products, categories, users, suppliers, customers, staff, stores] = await Promise.all([
    query('SELECT product_id, price, cost_price FROM products WHERE is_active=1 LIMIT 200'),
    query('SELECT category_id FROM categories LIMIT 20'),
    query('SELECT user_id FROM users'),
    query('SELECT supplier_id FROM suppliers'),
    query('SELECT customer_id FROM customers'),
    query('SELECT staff_id FROM staff'),
    query('SELECT store_id FROM stores'),
  ]);

  const productIds = products.map(p => p.product_id);
  const catIds = categories.map(c => c.category_id);
  const userIds = users.map(u => u.user_id);
  const supplierIds = suppliers.map(s => s.supplier_id);
  const customerIds = customers.map(c => c.customer_id);
  const staffIds = staff.map(s => s.staff_id);
  const storeId = stores.length > 0 ? stores[0].store_id : 1;

  // ── 1. CUSTOMERS (need 100+) ────────────────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM customers');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} customers...`);
      const names = ['Ahmad','Bilal','Farrukh','Hassan','Imran','Junaid','Kamran','Liaqat','Mansoor','Naveed',
        'Omar','Pervez','Qasim','Rashid','Salman','Tahir','Usman','Waqas','Yasir','Zahid',
        'Amna','Bushra','Chandni','Dua','Erum','Fatima','Gul','Hira','Iqra','Javeria'];
      for (let i = 0; i < needed; i++) {
        const name = `${pick(names)} ${pick(names)}`;
        const phone = `03${rand(10,99)}${rand(1000000,9999999)}`;
        try {
          await query(
            'INSERT INTO customers (customer_name, phone_number, email, address) VALUES (?,?,?,?)',
            [name, phone, `cust${Date.now()}_${i}@abyte.com`, `${rand(1,999)} Block ${String.fromCharCode(65+rand(0,25))}, Lahore`]
          );
        } catch(e) { /* skip duplicates */ }
      }
      console.log(`   ✓ Customers done`);
    } else {
      console.log('   ✓ Customers already 100+');
    }
  }

  // ── 2. SUPPLIERS (need 100+) ────────────────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM suppliers');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} suppliers...`);
      const bizNames = ['Trading Co','Enterprises','Distributors','Suppliers','Brothers','Sons & Co','International','Pvt Ltd'];
      const prefixes = ['Al-Hamza','Zaman','Bashir','Khalid','Tariq','Fahad','Rizwan','Adil','Mohsin','Sohail','Noman'];
      for (let i = 0; i < needed; i++) {
        const name = `${pick(prefixes)} ${pick(bizNames)} ${i + 1}`;
        const phone = `03${rand(10,99)}${rand(1000000,9999999)}`;
        try {
          await query(
            'INSERT INTO suppliers (supplier_name, contact_person, phone, email, address) VALUES (?,?,?,?,?)',
            [name, `Contact ${i}`, phone, `supp${Date.now()}_${i}@abyte.com`, `Industrial Area, Lahore`]
          );
        } catch(e) { /* skip duplicates */ }
      }
      console.log(`   ✓ Suppliers done`);
    } else {
      console.log('   ✓ Suppliers already 100+');
    }
  }

  // Refresh IDs after seeding customers/suppliers
  const [freshCustomers, freshSuppliers, freshStaff] = await Promise.all([
    query('SELECT customer_id FROM customers LIMIT 200'),
    query('SELECT supplier_id FROM suppliers LIMIT 200'),
    query('SELECT staff_id FROM staff LIMIT 200'),
  ]);
  const freshCustIds = freshCustomers.map(c => c.customer_id);
  const freshSuppIds = freshSuppliers.map(s => s.supplier_id);
  const freshStaffIds = freshStaff.map(s => s.staff_id);

  // ── 3. STAFF (need 100+) ────────────────────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM staff');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} staff members...`);
      const positions = ['Cashier','Manager','Sales Rep','Inventory Officer','Delivery Boy','Accountant','HR Officer','Security Guard'];
      const depts = ['Sales','Operations','Finance','HR','Logistics','Admin'];
      const firstNames = ['Ali','Ahmed','Hassan','Bilal','Usman','Omer','Wahab','Tariq','Saad','Raza',
        'Zara','Aisha','Fatima','Maryam','Sana','Rabia','Nadia','Asma','Huma','Sobia'];
      const lastNames = ['Khan','Malik','Ahmed','Hussain','Butt','Sheikh','Qureshi','Chaudhry','Nawaz','Iqbal'];
      for (let i = 0; i < needed; i++) {
        const fullName = `${pick(firstNames)} ${pick(lastNames)}`;
        const empId = `EMP-${String(Date.now()).slice(-6)}-${i}`;
        const salary = rand(25000, 120000);
        try {
          await query(
            'INSERT INTO staff (full_name, employee_id, position, department, phone, email, hire_date, salary, salary_type) VALUES (?,?,?,?,?,?,?,?,?)',
            [fullName, empId, pick(positions), pick(depts),
             `03${rand(10,99)}${rand(1000000,9999999)}`,
             `emp${Date.now()}_${i}@abyte.com`,
             daysAgo(rand(30, 1000)), salary, 'monthly']
          );
        } catch(e) { /* skip duplicates */ }
      }
      console.log(`   ✓ Staff done`);
    } else {
      console.log('   ✓ Staff already 100+');
    }
  }

  // Refresh staff IDs
  const allStaff = await query('SELECT staff_id FROM staff');
  const allStaffIds = allStaff.map(s => s.staff_id);

  // ── 4. SALES (need 100+) ────────────────────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM sales');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} sales...`);
      const payMethods = ['cash','card','bank_transfer'];
      for (let i = 0; i < needed; i++) {
        const custId = pick(freshCustIds);
        const prod = pick(products);
        const qty = rand(1, 5);
        const unitPrice = Number(prod.price) || rand(100, 5000);
        const total = qty * unitPrice;
        const invoiceNo = `INV-SEED-${Date.now()}-${i}`;
        const tokenNo = `T-${rand(1000,9999)}`;
        const saleDate = daysAgo(rand(0, 180));

        try {
          const r = await query(
            `INSERT INTO sales (sub_total, sale_date, total_amount, discount, net_amount, user_id, customer_id,
             payment_method, amount_paid, status, tax_percent, additional_charges_percent, invoice_no, token_no)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [total, saleDate, total, 0, total, pick(userIds), custId,
             pick(payMethods), total, 'completed', 0, 0, invoiceNo, tokenNo]
          );
          const saleId = Number(r.insertId);
          await query(
            'INSERT INTO sale_details (sale_id, product_id, quantity, unit_price, total_price) VALUES (?,?,?,?,?)',
            [saleId, prod.product_id, qty, unitPrice, total]
          );
          // Update inventory
          await query('UPDATE inventory SET available_stock = GREATEST(0, available_stock - ?) WHERE product_id = ?',
            [qty, prod.product_id]);
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Sales done`);
    } else {
      console.log('   ✓ Sales already 100+');
    }
  }

  // ── 5. PURCHASE ORDERS + ITEMS (need 100+) ─────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM purchase_orders');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} purchase orders...`);
      const statuses = ['pending','received','cancelled'];
      for (let i = 0; i < needed; i++) {
        const suppId = pick(freshSuppIds);
        const prod = pick(products);
        const qty = rand(10, 100);
        const cost = Number(prod.cost_price) || rand(50, 2000);
        const total = qty * cost;
        const poNum = `PO-SEED-${Date.now()}-${i}`;
        const orderDate = daysAgo(rand(0, 120));
        try {
          const r = await query(
            `INSERT INTO purchase_orders (po_number, supplier_id, order_date, expected_date, total_amount, notes, created_by)
             VALUES (?,?,?,?,?,?,?)`,
            [poNum, suppId, orderDate, daysAgo(rand(-30, 0)), total, 'Seed data', pick(userIds)]
          );
          const poId = Number(r.insertId);
          await query(
            'INSERT INTO purchase_order_items (po_id, product_id, quantity_ordered, unit_cost, total_cost) VALUES (?,?,?,?,?)',
            [poId, prod.product_id, qty, cost, total]
          );
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Purchase Orders done`);
    } else {
      console.log('   ✓ Purchase Orders already 100+');
    }
  }

  // ── 6. PURCHASE VOUCHERS (need 100+) ───────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM inv_purchase_vouchers');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} purchase vouchers...`);
      for (let i = 0; i < needed; i++) {
        const suppId = pick(freshSuppIds);
        const prod = pick(products);
        const qty = rand(5, 50);
        const unitCost = Number(prod.cost_price) || rand(50, 3000);
        const total = qty * unitCost;
        const pvNum = `PV-SEED-${Date.now()}-${i}`;
        try {
          const r = await query(
            `INSERT INTO inv_purchase_vouchers (pv_number, supplier_id, voucher_date, total_amount, notes, created_by)
             VALUES (?,?,?,?,?,?)`,
            [pvNum, suppId, daysAgo(rand(0, 120)), total, 'Seed data', pick(userIds)]
          );
          const pvId = Number(r.insertId);
          await query(
            'INSERT INTO inv_purchase_voucher_items (pv_id, product_id, quantity_received, unit_price, total_price) VALUES (?,?,?,?,?)',
            [pvId, prod.product_id, qty, unitCost, total]
          );
          await query('UPDATE inventory SET available_stock = available_stock + ? WHERE product_id = ?', [qty, prod.product_id]);
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Purchase Vouchers done`);
    } else {
      console.log('   ✓ Purchase Vouchers already 100+');
    }
  }

  // ── 7. DELIVERIES (need 100+) ───────────────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM deliveries');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} deliveries...`);
      const cities = ['Lahore','Karachi','Islamabad','Rawalpindi','Faisalabad','Multan','Peshawar','Quetta'];
      const statuses = ['pending','assigned','delivered','cancelled'];
      for (let i = 0; i < needed; i++) {
        const custId = pick(freshCustIds);
        const delivNum = `DEL-SEED-${Date.now()}-${i}`;
        try {
          await query(
            `INSERT INTO deliveries (delivery_number, customer_id, delivery_address, delivery_city, delivery_phone,
             status, delivery_charges, notes, created_by)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [delivNum, custId, `${rand(1,999)} Street ${rand(1,50)}`, pick(cities),
             `03${rand(10,99)}${rand(1000000,9999999)}`, pick(statuses),
             rand(100, 500), 'Seed delivery', pick(userIds)]
          );
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Deliveries done`);
    } else {
      console.log('   ✓ Deliveries already 100+');
    }
  }

  // ── 8. RETURNS + RETURN_DETAILS (need 100+) ─────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM returns');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} returns...`);
      const reasons = ['Defective item','Wrong product','Customer changed mind','Damaged in transit','Expired product'];
      const completedSales = await query('SELECT sale_id FROM sales WHERE status=\'completed\' LIMIT 200');
      const saleIdsList = completedSales.map(s => s.sale_id);
      for (let i = 0; i < needed; i++) {
        const saleId = pick(saleIdsList);
        const prod = pick(products);
        const qty = rand(1, 3);
        const refundAmt = Number(prod.price) * qty || rand(100, 2000);
        try {
          const r = await query(
            'INSERT INTO returns (sale_id, return_date, refund_amount, reason, user_id) VALUES (?,?,?,?,?)',
            [saleId, daysAgo(rand(0, 60)), refundAmt, pick(reasons), pick(userIds)]
          );
          await query(
            'INSERT INTO return_details (return_id, product_id, quantity, refund_price) VALUES (?,?,?,?)',
            [Number(r.insertId), prod.product_id, qty, refundAmt]
          );
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Returns done`);
    } else {
      console.log('   ✓ Returns already 100+');
    }
  }

  // ── 9. QUOTATIONS + ITEMS (need 100+) ──────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM quotations');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} quotations...`);
      const statuses = ['draft','sent','accepted','rejected','expired'];
      for (let i = 0; i < needed; i++) {
        const custId = pick(freshCustIds);
        const prod = pick(products);
        const qty = rand(1, 10);
        const unitPrice = Number(prod.price) || rand(100, 5000);
        const subtotal = qty * unitPrice;
        const qNum = `QT-SEED-${Date.now()}-${i}`;
        try {
          const r = await query(
            `INSERT INTO quotations (quotation_number, customer_id, created_by, subtotal, discount, tax_amount,
             total_amount, notes, valid_until, status) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [qNum, custId, pick(userIds), subtotal, 0, 0, subtotal, 'Seed quotation',
             daysAgo(-rand(1,30)), pick(statuses)]
          );
          await query(
            `INSERT INTO quotation_items (quotation_id, product_id, quantity, unit_price, total_price)
             VALUES (?,?,?,?,?)`,
            [Number(r.insertId), prod.product_id, qty, unitPrice, subtotal]
          );
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Quotations done`);
    } else {
      console.log('   ✓ Quotations already 100+');
    }
  }

  // ── 10. CREDIT SALES (need 100+) ────────────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM credit_sales');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} credit sales...`);
      const completedSales = await query('SELECT s.sale_id, s.customer_id, s.total_amount FROM sales s WHERE s.status=\'completed\' LIMIT 200');
      const statuses = ['pending','partial','paid'];
      for (let i = 0; i < needed; i++) {
        const sale = pick(completedSales);
        const total = Number(sale.total_amount) || rand(1000, 50000);
        const paidAmt = rand(0, total);
        const status = paidAmt === 0 ? 'pending' : paidAmt >= total ? 'paid' : 'partial';
        try {
          await query(
            `INSERT INTO credit_sales (sale_id, customer_id, total_amount, paid_amount, balance_due, due_date, status, created_by)
             VALUES (?,?,?,?,?,?,?,?)`,
            [sale.sale_id, sale.customer_id, total, paidAmt, total - paidAmt,
             daysAgo(-rand(7, 60)), status, pick(userIds)]
          );
        } catch(e) { /* skip duplicates */ }
      }
      console.log(`   ✓ Credit Sales done`);
    } else {
      console.log('   ✓ Credit Sales already 100+');
    }
  }

  // ── 11. ATTENDANCE (need 100+) ──────────────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM attendance');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} attendance records...`);
      const statuses = ['present','absent','late','half_day'];
      const allStaff2 = await query('SELECT staff_id FROM staff LIMIT 100');
      const sIds = allStaff2.map(s => s.staff_id);
      let seeded = 0;
      for (let d = 0; d < 60 && seeded < needed; d++) {
        for (const sid of sIds) {
          if (seeded >= needed) break;
          const attDate = daysAgo(d);
          const st = pick(statuses);
          const checkIn = st !== 'absent' ? timeStr(rand(8,10), rand(0,59)) : null;
          const checkOut = checkIn ? timeStr(rand(16,19), rand(0,59)) : null;
          try {
            await query(
              'INSERT IGNORE INTO attendance (staff_id, attendance_date, check_in, check_out, status) VALUES (?,?,?,?,?)',
              [sid, attDate, checkIn, checkOut, st]
            );
            seeded++;
          } catch(e) { /* skip */ }
        }
      }
      console.log(`   ✓ Attendance done`);
    } else {
      console.log('   ✓ Attendance already 100+');
    }
  }

  // ── 12. SALARY PAYMENTS (need 100+) ─────────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM salary_payments');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} salary payments...`);
      const allStaff3 = await query('SELECT staff_id, salary FROM staff LIMIT 100');
      const months = ['2026-01','2026-02','2026-03','2026-04','2025-12','2025-11'];
      let seeded = 0;
      for (const m of months) {
        for (const s of allStaff3) {
          if (seeded >= needed) break;
          const baseSalary = Number(s.salary) || rand(25000, 80000);
          const bonuses = rand(0, 5000);
          const deductions = rand(0, 2000);
          const net = baseSalary + bonuses - deductions;
          const fromDate = `${m}-01`;
          const toDate = `${m}-${m.endsWith('-02') ? '28' : m.endsWith('-04') || m.endsWith('-06') || m.endsWith('-09') || m.endsWith('-11') ? '30' : '31'}`;
          try {
            await query(
              `INSERT IGNORE INTO salary_payments (staff_id, payment_date, amount, from_date, to_date,
               deductions, bonuses, net_amount, payment_method, notes, paid_by)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
              [s.staff_id, toDate, baseSalary, fromDate, toDate,
               deductions, bonuses, net, 'cash', 'Monthly salary', pick(userIds)]
            );
            seeded++;
          } catch(e) { /* skip duplicates */ }
        }
        if (seeded >= needed) break;
      }
      console.log(`   ✓ Salary Payments done`);
    } else {
      console.log('   ✓ Salary Payments already 100+');
    }
  }

  // ── 13. STOCK ADJUSTMENTS (need 100+) ───────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM stock_adjustments');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} stock adjustments...`);
      const adjTypes = ['increase','decrease','damage','theft','expiry','correction'];
      const reasons = ['Physical count correction','Damaged goods','Expired stock','Inventory audit','Transfer','Theft loss'];
      for (let i = 0; i < needed; i++) {
        const prod = pick(products);
        const adjType = pick(adjTypes);
        const qtyBefore = rand(10, 500);
        const qtyAdj = rand(1, 50);
        const qtyAfter = adjType === 'decrease' || adjType === 'damage' || adjType === 'theft' || adjType === 'expiry'
          ? Math.max(0, qtyBefore - qtyAdj) : qtyBefore + qtyAdj;
        try {
          await query(
            `INSERT INTO stock_adjustments (product_id, store_id, adjustment_type, quantity_before,
             quantity_adjusted, quantity_after, reason, reference_number, created_by)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [prod.product_id, storeId, adjType, qtyBefore, qtyAdj, qtyAfter,
             pick(reasons), `ADJ-SEED-${Date.now()}-${i}`, pick(userIds)]
          );
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Stock Adjustments done`);
    } else {
      console.log('   ✓ Stock Adjustments already 100+');
    }
  }

  // ── 14. STOCK ISSUES + ITEMS (need 100+) ────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM stock_issues');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} stock issues...`);
      const sections = await query('SELECT section_id FROM sections LIMIT 10');
      const sectionIds = sections.length > 0 ? sections.map(s => s.section_id) : [null];
      const statuses = ['issued','returned','partial'];
      for (let i = 0; i < needed; i++) {
        const issueNum = `ISS-SEED-${Date.now()}-${i}`;
        const prod = pick(products);
        const qty = rand(1, 20);
        const unitCost = Number(prod.cost_price) || rand(50, 2000);
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
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Stock Issues done`);
    } else {
      console.log('   ✓ Stock Issues already 100+');
    }
  }

  // ── 15. EXPENSES (need 100+) ─────────────────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM expenses');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} expenses...`);
      const expCats = ['rent','utilities','salaries','marketing','maintenance','transport','stationery','other'];
      const expTitles = ['Monthly Rent','Electricity Bill','Water Bill','Internet Bill','Mobile Packages',
        'Vehicle Fuel','Office Maintenance','Marketing Campaign','Staff Meal','Miscellaneous'];
      for (let i = 0; i < needed; i++) {
        try {
          await query(
            'INSERT INTO expenses (title, amount, category, expense_date, description, user_id) VALUES (?,?,?,?,?,?)',
            [pick(expTitles), rand(500, 50000), pick(expCats), daysAgo(rand(0, 180)),
             'Seed expense entry', pick(userIds)]
          );
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Expenses done`);
    } else {
      console.log('   ✓ Expenses already 100+');
    }
  }

  // ── 16. HOLIDAYS (need 100+) ─────────────────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM holidays');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} holidays...`);
      const holNames = ['Eid ul Fitr','Eid ul Adha','Independence Day','Pakistan Day','Labour Day',
        'Christmas','New Year','Muharram','Ashura','Milad un Nabi','Quaid Birthday','Iqbal Day'];
      for (let i = 0; i < needed; i++) {
        const holDate = `${pick(['2024','2025','2026'])}-${String(rand(1,12)).padStart(2,'0')}-${String(rand(1,28)).padStart(2,'0')}`;
        try {
          await query(
            'INSERT IGNORE INTO holidays (holiday_date, holiday_name, description, created_by) VALUES (?,?,?,?)',
            [holDate, `${pick(holNames)} ${i}`, 'Public holiday - seed data', pick(userIds)]
          );
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Holidays done`);
    } else {
      console.log('   ✓ Holidays already 100+');
    }
  }

  // ── 17. LEAVE REQUESTS (need 100+) ──────────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM leave_requests');
    const needed = Math.max(0, 100 - Number(cnt.c));
    if (needed > 0) {
      console.log(`── Seeding ${needed} leave requests...`);
      const leaveTypes = ['annual','sick','casual','unpaid','maternity'];
      const statuses = ['pending','approved','rejected'];
      const allStaff4 = await query('SELECT staff_id FROM staff');
      const sIds4 = allStaff4.map(s => s.staff_id);
      for (let i = 0; i < needed; i++) {
        const fromDate = daysAgo(rand(-30, 90));
        const days = rand(1, 5);
        const toDate = daysAgo(rand(-30 - days, 90 - days));
        try {
          await query(
            `INSERT INTO leave_requests (staff_id, leave_type, from_date, to_date, days, reason, status, requested_by)
             VALUES (?,?,?,?,?,?,?,?)`,
            [pick(sIds4), pick(leaveTypes), fromDate, toDate, days, 'Seed leave request', pick(statuses), pick(userIds)]
          );
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Leave Requests done`);
    } else {
      console.log('   ✓ Leave Requests already 100+');
    }
  }

  // ── 18. BANK ACCOUNTS (if empty) ────────────────────────────
  {
    const [cnt] = await query('SELECT COUNT(*) as c FROM bank_accounts');
    if (Number(cnt.c) < 10) {
      console.log(`── Seeding bank accounts...`);
      const banks = ['HBL','MCB','UBL','Meezan Bank','Bank Alfalah','Standard Chartered','Habib Metro','Askari Bank'];
      for (let i = 0; i < 10; i++) {
        try {
          await query(
            `INSERT INTO bank_accounts (account_name, bank_name, account_number, iban, branch_name, opening_balance, current_balance)
             VALUES (?,?,?,?,?,?,?)`,
            [`${pick(banks)} Account ${i+1}`, pick(banks), `PK${rand(10,99)}${rand(1000000000,9999999999)}`,
             `PK${rand(10,99)}BANK${rand(10000000000000000,99999999999999999)}`,
             `Branch ${String.fromCharCode(65+rand(0,25))}`, rand(50000, 500000), rand(50000, 500000)]
          ).catch(() => {});
        } catch(e) { /* skip */ }
      }
      console.log(`   ✓ Bank Accounts done`);
    }
  }

  // ── FINAL COUNT ─────────────────────────────────────────────
  console.log('\n─── Final Table Counts ───');
  const tables = ['sales','customers','suppliers','staff','attendance','salary_payments',
    'purchase_orders','deliveries','returns','quotations','credit_sales',
    'stock_adjustments','stock_issues','expenses','holidays','leave_requests',
    'journal_entries','payment_vouchers','receipt_vouchers','inv_purchase_vouchers','bank_accounts'];

  for (const t of tables) {
    const [r] = await query('SELECT COUNT(*) as c FROM `' + t + '`');
    const c = Number(r.c);
    const status = c >= 100 ? '✓' : c >= 50 ? '~' : '✗';
    console.log(`  ${status} ${t.padEnd(30)} : ${c}`);
  }

  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║  ✅  Full system seed complete!                   ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');
}

run().then(() => process.exit(0)).catch(e => { console.error('Fatal:', e.message); process.exit(1); });
