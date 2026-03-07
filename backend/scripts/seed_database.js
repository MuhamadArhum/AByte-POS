// seed_database.js - Comprehensive database seeding with realistic Pakistani data
// Run: node backend/scripts/seed_database.js
// NOTE: MariaDB driver - INSERT returns result object (use r.insertId), SELECT returns array of rows
const { getConnection } = require('../config/database');

// ═══════════════════════════════════════════════════════════
// REALISTIC DATA ARRAYS
// ═══════════════════════════════════════════════════════════

const FIRST_NAMES = [
  'Ahmed', 'Muhammad', 'Ali', 'Hassan', 'Usman', 'Omar', 'Bilal', 'Hamza', 'Faisal', 'Tariq',
  'Imran', 'Asad', 'Zubair', 'Wasim', 'Kamran', 'Adnan', 'Rizwan', 'Sajid', 'Farhan', 'Junaid',
  'Ayesha', 'Fatima', 'Zainab', 'Maryam', 'Sana', 'Nadia', 'Amna', 'Rabia', 'Hina', 'Sara',
  'Mehreen', 'Saba', 'Noor', 'Iqra', 'Sadaf', 'Nimra', 'Sumbal', 'Farah', 'Kiran',
  'Shoaib', 'Babar', 'Amir', 'Shahid', 'Naeem', 'Waqas', 'Aamir', 'Shafiq', 'Nasir', 'Zahid'
];
const LAST_NAMES = [
  'Khan', 'Ahmed', 'Ali', 'Sheikh', 'Malik', 'Chaudhry', 'Butt', 'Qureshi', 'Siddiqui', 'Ansari',
  'Mirza', 'Hashmi', 'Rana', 'Bajwa', 'Abbasi', 'Syed', 'Baig', 'Raza', 'Hussain', 'Nawaz',
  'Javed', 'Akhtar', 'Aslam', 'Rafiq', 'Riaz', 'Sarwar', 'Yousuf', 'Zafar', 'Waqar', 'Niazi'
];
const CITIES = ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala'];
const AREAS = ['Defence', 'Gulshan', 'North Nazimabad', 'Clifton', 'PECHS', 'Johar Town', 'Gulberg', 'DHA', 'Bahria Town', 'F-7', 'G-9', 'I-8'];
const DEPARTMENTS = ['Sales', 'Inventory', 'Cashier', 'Management', 'HR', 'Accounts', 'IT', 'Security'];
const POSITIONS = ['Senior Cashier', 'Cashier', 'Store Manager', 'Inventory Manager', 'Accountant', 'HR Officer', 'IT Support', 'Security Guard'];
const PRODUCT_PREFIXES = ['Premium', 'Classic', 'Budget', 'Pro', 'Elite', 'Standard', 'Deluxe', 'Basic', 'Advanced', 'Ultra'];
const BANKS = ['HBL', 'MCB', 'UBL', 'Allied Bank', 'Bank Alfalah', 'Meezan Bank', 'Faysal Bank', 'Silk Bank', 'JS Bank', 'Bank of Punjab'];
const PAYMENT_METHODS = ['cash', 'bank_transfer', 'cheque'];
const LEAVE_TYPES = ['annual', 'sick', 'emergency', 'unpaid'];
const SALE_PAYMENT_METHODS = ['Cash', 'Card', 'Online', 'Bank Transfer'];
const PRODUCT_NAMES = [
  'Mobile Charger', 'USB Cable', 'Phone Case', 'Screen Protector', 'Earphones', 'Headphones',
  'Power Bank', 'Laptop Bag', 'Mouse', 'Keyboard', 'Monitor Stand', 'Webcam',
  'T-Shirt', 'Jeans', 'Kurta', 'Shalwar Kameez', 'Jacket', 'Sneakers', 'Sandals', 'Cap',
  'Rice 1kg', 'Sugar 1kg', 'Flour 2kg', 'Tea Sachet', 'Milk Pack', 'Yogurt', 'Eggs',
  'Shampoo', 'Conditioner', 'Face Wash', 'Moisturizer', 'Lipstick', 'Foundation',
  'Protein Powder', 'Vitamins', 'First Aid Kit', 'Mask Pack', 'Sanitizer',
  'Notebook', 'Pens Set', 'Stapler', 'Scissors', 'Glue Stick', 'File Folder',
  'Football', 'Cricket Bat', 'Badminton Racket', 'Yoga Mat', 'Jump Rope',
  'Pan Set', 'Dinner Plates', 'Mugs', 'Kettle', 'Toaster', 'Iron'
];
const PRODUCT_SUFFIXES = ['Pack', 'Set', 'Box', 'Unit', 'Bundle', 'Kit', 'Item', 'Piece', ''];

// Helper functions
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randFloat = (min, max, decimals = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
const pick = (arr) => arr[rand(0, arr.length - 1)];
const fullName = () => `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
const phone = () => `03${rand(0, 4)}${rand(0, 9)}-${rand(1000000, 9999999)}`;
const emailOf = (name) => `${name.toLowerCase().replace(/[\s.]+/g, '.')}${rand(1, 999)}@gmail.com`;
const dateBack = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
};
const randomDate = (startDaysAgo, endDaysAgo = 0) => {
  const lo = Math.min(startDaysAgo, endDaysAgo);
  const hi = Math.max(startDaysAgo, endDaysAgo);
  return dateBack(rand(lo, hi));
};
const streetAddress = () => `${rand(1, 999)} Block ${String.fromCharCode(65 + rand(0, 25))}, ${pick(AREAS)}, ${pick(CITIES)}`;

// INSERT result helper - MariaDB returns result object for INSERT
const insertId = (result) => result ? Number(result.insertId) : null;

// ═══════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════

async function seed() {
  const conn = await getConnection();
  let adminUserId = 1;
  let categoryIds = [];
  let productIds = [];
  let customerIds = [1];
  let supplierIds = [];
  let staffIds = [];
  let saleIds = [];
  let accountIds = [];
  let bankAccountIds = [];
  let loanIds = [];
  let couponIds = [];
  let creditSaleIds = [];
  let layawayIds = [];
  let registerIds = [];

  try {
    // Get admin user
    const adminRows = await conn.query('SELECT user_id FROM users WHERE role_name = ? LIMIT 1', ['Admin']);
    if (adminRows && adminRows.length > 0) adminUserId = adminRows[0].user_id;
    console.log(`Using admin user_id: ${adminUserId}`);

    // ─────────────────────────────────────────
    // 1. CATEGORIES (20)
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    const categoryNames = [
      'Electronics', 'Mobile Phones', 'Laptops & Computers', 'Accessories',
      'Clothing - Men', 'Clothing - Women', 'Clothing - Kids', 'Footwear',
      'Groceries', 'Beverages', 'Dairy Products', 'Bakery',
      'Cosmetics & Beauty', 'Health & Wellness', 'Sports & Fitness',
      'Home Appliances', 'Kitchen Items', 'Stationery', 'Toys & Games', 'Auto Parts'
    ];
    for (const name of categoryNames) {
      await conn.query('INSERT IGNORE INTO categories (category_name) VALUES (?)', [name]);
    }
    await conn.commit();
    const catRows = await conn.query('SELECT category_id FROM categories');
    categoryIds = catRows.map(r => r.category_id);
    console.log(`Categories: ${categoryIds.length}`);

    // ─────────────────────────────────────────
    // 2. PRODUCTS (500)
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    for (let i = 0; i < 500; i++) {
      const catId = pick(categoryIds);
      const pName = `${pick(PRODUCT_PREFIXES)} ${pick(PRODUCT_NAMES)} ${pick(PRODUCT_SUFFIXES)}`.trim();
      const price = randFloat(50, 15000);
      const stock = rand(0, 500);
      const barcode = `BC${Date.now().toString().slice(-7)}${String(i).padStart(4, '0')}`;
      const result = await conn.query(
        'INSERT IGNORE INTO products (product_name, category_id, price, stock_quantity, barcode) VALUES (?, ?, ?, ?, ?)',
        [pName, catId, price, stock, barcode]
      );
      const pid = insertId(result);
      if (pid) {
        productIds.push(pid);
        await conn.query(
          'INSERT IGNORE INTO inventory (product_id, available_stock) VALUES (?, ?)',
          [pid, stock]
        );
      }
    }
    await conn.commit();
    const prodRows = await conn.query('SELECT product_id FROM products');
    productIds = prodRows.map(r => r.product_id);
    console.log(`Products: ${productIds.length}`);

    // ─────────────────────────────────────────
    // 3. CUSTOMERS (500) + ADDRESSES
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    for (let i = 0; i < 500; i++) {
      const name = fullName();
      const ph = rand(0, 1) ? phone() : null;
      const em = rand(0, 1) ? emailOf(name) : null;
      const company = rand(0, 3) === 0 ? `${pick(LAST_NAMES)} Enterprises` : null;
      const result = await conn.query(
        'INSERT IGNORE INTO customers (customer_name, phone_number, email, company) VALUES (?, ?, ?, ?)',
        [name, ph, em, company]
      );
      const cid = insertId(result);
      if (cid) {
        customerIds.push(cid);
        if (rand(0, 1)) {
          await conn.query(
            'INSERT INTO customer_addresses (customer_id, address_text, is_default) VALUES (?, ?, 1)',
            [cid, streetAddress()]
          );
        }
      }
    }
    await conn.commit();
    const custRows = await conn.query('SELECT customer_id FROM customers');
    customerIds = custRows.map(r => r.customer_id);
    console.log(`Customers: ${customerIds.length}`);

    // ─────────────────────────────────────────
    // 4. SUPPLIERS (50)
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    const supplierSuffixes = ['Traders', 'Enterprises', 'Co.', 'Pvt. Ltd.', 'Group', 'Brothers', 'International'];
    for (let i = 0; i < 50; i++) {
      const sName = `${pick(LAST_NAMES)} ${pick(supplierSuffixes)}`;
      const result = await conn.query(
        'INSERT IGNORE INTO suppliers (supplier_name, contact_person, phone, email, address, payment_terms) VALUES (?, ?, ?, ?, ?, ?)',
        [sName, fullName(), phone(), emailOf(sName), streetAddress(), `${rand(7, 45)} days`]
      );
      const sid = insertId(result);
      if (sid) supplierIds.push(sid);
    }
    await conn.commit();
    const suppRows = await conn.query('SELECT supplier_id FROM suppliers');
    supplierIds = suppRows.map(r => r.supplier_id);
    console.log(`Suppliers: ${supplierIds.length}`);

    // ─────────────────────────────────────────
    // 5. STAFF (30)
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    for (let i = 0; i < 30; i++) {
      const name = fullName();
      const empId = `EMP-${String(Date.now()).slice(-6)}-${i}`;
      const salary = randFloat(25000, 150000);
      const result = await conn.query(
        `INSERT IGNORE INTO staff (employee_id, full_name, phone, email, address, position, department, salary, salary_type, hire_date, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'monthly', ?, 1)`,
        [empId, name, phone(), emailOf(name), streetAddress(), pick(POSITIONS), pick(DEPARTMENTS), salary, randomDate(720, 30)]
      );
      const stid = insertId(result);
      if (stid) staffIds.push(stid);
    }
    await conn.commit();
    const staffRows = await conn.query('SELECT staff_id FROM staff');
    staffIds = staffRows.map(r => r.staff_id);
    console.log(`Staff: ${staffIds.length}`);

    // ─────────────────────────────────────────
    // 6. PURCHASE ORDERS + ITEMS (500 POs)
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    const poStatuses = ['pending', 'received', 'cancelled'];
    for (let i = 0; i < 500; i++) {
      const suppId = pick(supplierIds);
      const orderDate = randomDate(365, 1);
      const total = randFloat(5000, 200000);
      const poNumber = `PO-${Date.now()}-${i}`;
      const status = pick(poStatuses);
      const poRes = await conn.query(
        'INSERT INTO purchase_orders (po_number, supplier_id, order_date, total_amount, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [poNumber, suppId, orderDate, total, status, adminUserId]
      );
      const poId = insertId(poRes);
      if (poId) {
        const itemCount = rand(1, 3);
        for (let j = 0; j < itemCount; j++) {
          const prodId = pick(productIds);
          const qty = rand(5, 100);
          const unitCost = randFloat(100, 5000);
          await conn.query(
            'INSERT INTO purchase_order_items (po_id, product_id, quantity_ordered, quantity_received, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?, ?)',
            [poId, prodId, qty, status === 'received' ? qty : 0, unitCost, qty * unitCost]
          );
        }
      }
    }
    await conn.commit();
    console.log('Purchase Orders: 500');

    // ─────────────────────────────────────────
    // 7. SALES + SALE_DETAILS + PAYMENTS (500)
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    for (let i = 0; i < 500; i++) {
      const custId = pick(customerIds);
      const saleDate = randomDate(365, 1);
      const payMethod = pick(SALE_PAYMENT_METHODS);
      const itemCount = rand(1, 5);
      let total = 0;
      const items = [];
      for (let j = 0; j < itemCount; j++) {
        const prodId = pick(productIds);
        const qty = rand(1, 10);
        const price = randFloat(100, 10000);
        const lineTotal = parseFloat((qty * price).toFixed(2));
        total += lineTotal;
        items.push([prodId, qty, price, lineTotal]);
      }
      const discount = rand(0, 1) ? parseFloat((total * randFloat(0.01, 0.1)).toFixed(2)) : 0;
      const net = parseFloat((total - discount).toFixed(2));

      const saleRes = await conn.query(
        `INSERT INTO sales (sale_date, total_amount, discount, net_amount, user_id, customer_id, payment_method, amount_paid, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')`,
        [saleDate, total, discount, net, adminUserId, custId, payMethod, net]
      );
      const saleId = insertId(saleRes);
      if (saleId) {
        saleIds.push(saleId);
        for (const [prodId, qty, price, lineTotal] of items) {
          await conn.query(
            'INSERT INTO sale_details (sale_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
            [saleId, prodId, qty, price, lineTotal]
          );
        }
        await conn.query(
          'INSERT INTO payments (sale_id, method, amount) VALUES (?, ?, ?)',
          [saleId, payMethod, net]
        );
      }
    }
    await conn.commit();
    const saleRows = await conn.query('SELECT sale_id FROM sales');
    saleIds = saleRows.map(r => r.sale_id);
    console.log(`Sales: ${saleIds.length}`);

    // ─────────────────────────────────────────
    // 8. ATTENDANCE (500 records)
    // ─────────────────────────────────────────
    if (staffIds.length > 0) {
      await conn.beginTransaction();
      const attStatuses = ['present', 'absent', 'half_day', 'leave'];
      let attCount = 0;
      for (const sId of staffIds) {
        if (attCount >= 500) break;
        for (let d = 1; d <= 17 && attCount < 500; d++) {
          const attDate = dateBack(d);
          const status = pick(attStatuses);
          await conn.query(
            'INSERT IGNORE INTO attendance (staff_id, attendance_date, check_in, check_out, status) VALUES (?, ?, ?, ?, ?)',
            [sId, attDate, status === 'absent' ? null : '09:00:00', status === 'absent' ? null : '18:00:00', status]
          );
          attCount++;
        }
      }
      await conn.commit();
      console.log(`Attendance: ${attCount}`);
    }

    // ─────────────────────────────────────────
    // 9. SALARY PAYMENTS (500)
    // ─────────────────────────────────────────
    if (staffIds.length > 0) {
      await conn.beginTransaction();
      let salCount = 0;
      outer: for (let m = 1; m <= 17; m++) {
        for (const sId of staffIds) {
          if (salCount >= 500) break outer;
          const fromDate = dateBack(m * 30);
          const toDate = dateBack((m - 1) * 30 + 1);
          const payDate = toDate;
          const amount = randFloat(25000, 100000);
          const deductions = randFloat(0, 5000);
          const bonuses = randFloat(0, 3000);
          const net = parseFloat((amount - deductions + bonuses).toFixed(2));
          await conn.query(
            `INSERT INTO salary_payments (staff_id, payment_date, amount, from_date, to_date, deductions, bonuses, net_amount, payment_method, paid_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sId, payDate, amount, fromDate, toDate, deductions, bonuses, net, pick(PAYMENT_METHODS), adminUserId]
          );
          salCount++;
        }
      }
      await conn.commit();
      console.log(`Salary Payments: ${salCount}`);
    }

    // ─────────────────────────────────────────
    // 10. STAFF LOANS (100) + REPAYMENTS (400)
    // ─────────────────────────────────────────
    if (staffIds.length > 0) {
      await conn.beginTransaction();
      for (let i = 0; i < 100; i++) {
        const sId = pick(staffIds);
        const loanAmount = randFloat(10000, 200000);
        const monthlyDed = parseFloat((loanAmount / rand(6, 24)).toFixed(2));
        const loanDate = randomDate(500, 30);
        const loanRes = await conn.query(
          'INSERT INTO staff_loans (staff_id, loan_amount, remaining_balance, monthly_deduction, loan_date, status, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [sId, loanAmount, loanAmount, monthlyDed, loanDate, pick(['active', 'completed']), adminUserId]
        );
        const lid = insertId(loanRes);
        if (lid) loanIds.push(lid);
      }
      await conn.commit();

      await conn.beginTransaction();
      let repCount = 0;
      for (const lId of loanIds) {
        if (repCount >= 400) break;
        const loanRows = await conn.query('SELECT staff_id FROM staff_loans WHERE loan_id = ?', [lId]);
        if (!loanRows || loanRows.length === 0) continue;
        const staffId = loanRows[0].staff_id;
        const repayCount = rand(2, 6);
        for (let r = 0; r < repayCount && repCount < 400; r++) {
          const amount = randFloat(5000, 20000);
          const repDate = randomDate(400, 1);
          await conn.query(
            'INSERT INTO loan_repayments (loan_id, staff_id, amount, repayment_date, payment_method) VALUES (?, ?, ?, ?, ?)',
            [lId, staffId, amount, repDate, pick(['cash', 'bank_transfer', 'salary_deduction'])]
          );
          repCount++;
        }
      }
      await conn.commit();
      console.log(`Loans: ${loanIds.length}, Repayments: ${repCount}`);
    }

    // ─────────────────────────────────────────
    // 11. LEAVE REQUESTS (300)
    // ─────────────────────────────────────────
    if (staffIds.length > 0) {
      await conn.beginTransaction();
      const leaveStatuses = ['pending', 'approved', 'rejected'];
      for (let i = 0; i < 300; i++) {
        const sId = pick(staffIds);
        const fromDate = randomDate(300, 1);
        const days = rand(1, 7);
        const toDateObj = new Date(fromDate);
        toDateObj.setDate(toDateObj.getDate() + days);
        const toDateStr = toDateObj.toISOString().split('T')[0];
        const status = pick(leaveStatuses);
        await conn.query(
          `INSERT INTO leave_requests (staff_id, leave_type, from_date, to_date, days, reason, status, requested_by, reviewed_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [sId, pick(LEAVE_TYPES), fromDate, toDateStr, days, 'Personal reasons', status, adminUserId, status !== 'pending' ? adminUserId : null]
        );
      }
      await conn.commit();
      console.log('Leave Requests: 300');
    }

    // ─────────────────────────────────────────
    // 12. HOLIDAYS (50)
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    const holidayNames = [
      'Pakistan Day', 'Eid ul Fitr', 'Eid ul Adha', 'Independence Day', 'Quaid-e-Azam Day',
      'Labour Day', 'Iqbal Day', 'Ashura', 'Eid Milad un Nabi', 'New Year', 'Christmas',
      'Defence Day', 'Kashmir Day', 'Bank Holiday', 'Company Annual Day'
    ];
    for (let i = 0; i < 50; i++) {
      const hDate = randomDate(365, 1);
      await conn.query(
        'INSERT IGNORE INTO holidays (holiday_date, holiday_name, description, created_by) VALUES (?, ?, ?, ?)',
        [hDate, `${pick(holidayNames)} ${rand(2023, 2026)}`, 'National/Company holiday', adminUserId]
      );
    }
    await conn.commit();
    console.log('Holidays: 50');

    // ─────────────────────────────────────────
    // 13. SALARY INCREMENTS (200)
    // ─────────────────────────────────────────
    if (staffIds.length > 0) {
      await conn.beginTransaction();
      for (let i = 0; i < 200; i++) {
        const sId = pick(staffIds);
        const oldSal = randFloat(25000, 100000);
        const pct = randFloat(5, 30);
        const newSal = parseFloat((oldSal * (1 + pct / 100)).toFixed(2));
        const incAmount = parseFloat((newSal - oldSal).toFixed(2));
        await conn.query(
          `INSERT INTO salary_increments (staff_id, old_salary, new_salary, increment_amount, increment_percentage, effective_date, reason, approved_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [sId, oldSal, newSal, incAmount, pct, randomDate(365, 1), 'Annual increment / performance bonus', adminUserId]
        );
      }
      await conn.commit();
      console.log('Salary Increments: 200');
    }

    // ─────────────────────────────────────────
    // 14. ADVANCE PAYMENTS (200)
    // ─────────────────────────────────────────
    if (staffIds.length > 0) {
      await conn.beginTransaction();
      for (let i = 0; i < 200; i++) {
        const sId = pick(staffIds);
        await conn.query(
          'INSERT INTO advance_payments (staff_id, amount, payment_date, payment_method, reason, paid_by) VALUES (?, ?, ?, ?, ?, ?)',
          [sId, randFloat(5000, 50000), randomDate(365, 1), pick(['cash', 'bank_transfer', 'cheque']), 'Advance salary request', adminUserId]
        );
      }
      await conn.commit();
      console.log('Advance Payments: 200');
    }

    // ─────────────────────────────────────────
    // 15. EXTRA ACCOUNTS (60 beyond defaults)
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    const accountTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'];
    const typeGroupMap = { asset: [1, 2], liability: [3, 4], equity: [5], revenue: [6, 7], expense: [8, 9, 10] };
    const accQualifiers = ['Operating', 'General', 'Special', 'Reserve', 'Misc', 'Trade'];
    const accKinds = ['Account', 'Fund', 'Reserve', 'Expense', 'Revenue'];
    for (let i = 0; i < 60; i++) {
      const aType = pick(accountTypes);
      const gId = pick(typeGroupMap[aType]);
      const code = `A${Date.now().toString().slice(-5)}${i}`;
      const aName = `${pick(accQualifiers)} ${pick(accKinds)} ${i + 1}`;
      const result = await conn.query(
        'INSERT IGNORE INTO accounts (account_code, account_name, group_id, account_type, opening_balance) VALUES (?, ?, ?, ?, ?)',
        [code, aName, gId, aType, randFloat(0, 100000)]
      );
      const aid = insertId(result);
      if (aid) accountIds.push(aid);
    }
    await conn.commit();
    const accRows = await conn.query('SELECT account_id FROM accounts');
    accountIds = accRows.map(r => r.account_id);
    console.log(`Accounts total: ${accountIds.length}`);

    // ─────────────────────────────────────────
    // 16. JOURNAL ENTRIES + LINES (250)
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    for (let i = 0; i < 250; i++) {
      const amount = randFloat(1000, 100000);
      const entryNumber = `JE-${Date.now()}-${i}`;
      const entryDate = randomDate(365, 1);
      const jRes = await conn.query(
        `INSERT INTO journal_entries (entry_number, entry_date, description, total_debit, total_credit, status, created_by)
         VALUES (?, ?, ?, ?, ?, 'posted', ?)`,
        [entryNumber, entryDate, `Journal Entry #${i + 1}`, amount, amount, adminUserId]
      );
      const jid = insertId(jRes);
      if (jid) {
        await conn.query(
          'INSERT INTO journal_entry_lines (entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, 0)',
          [jid, pick(accountIds), 'Debit entry', amount]
        );
        await conn.query(
          'INSERT INTO journal_entry_lines (entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, 0, ?)',
          [jid, pick(accountIds), 'Credit entry', amount]
        );
      }
    }
    await conn.commit();
    console.log('Journal Entries: 250');

    // ─────────────────────────────────────────
    // 17. BANK ACCOUNTS (10)
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    const assetAccRows = await conn.query("SELECT account_id FROM accounts WHERE account_type = 'asset' LIMIT 1");
    const assetAccId = (assetAccRows && assetAccRows.length > 0) ? assetAccRows[0].account_id : accountIds[0];
    for (let i = 0; i < 10; i++) {
      const bankName = pick(BANKS);
      const accNum = `PK${Date.now()}${i}`.slice(0, 20);
      const baRes = await conn.query(
        `INSERT IGNORE INTO bank_accounts (account_id, bank_name, account_number, account_holder, branch, opening_balance, current_balance)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [assetAccId, bankName, accNum, fullName(), pick(CITIES) + ' Branch', randFloat(100000, 5000000), randFloat(100000, 5000000)]
      );
      const baid = insertId(baRes);
      if (baid) bankAccountIds.push(baid);
    }
    await conn.commit();
    if (bankAccountIds.length === 0) {
      const baRows = await conn.query('SELECT bank_account_id FROM bank_accounts LIMIT 10');
      bankAccountIds = baRows.map(r => r.bank_account_id);
    }
    console.log(`Bank Accounts: ${bankAccountIds.length}`);

    // ─────────────────────────────────────────
    // 18. PAYMENT VOUCHERS (500)
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    const pvTypes = ['supplier', 'expense', 'staff', 'other'];
    for (let i = 0; i < 500; i++) {
      const vNum = `PV-${Date.now()}-${i}`;
      const accId = pick(accountIds);
      await conn.query(
        `INSERT INTO payment_vouchers (voucher_number, voucher_date, payment_to, payment_type, account_id, amount, payment_method, description, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vNum, randomDate(365, 1), fullName(), pick(pvTypes), accId, randFloat(1000, 100000), pick(['cash', 'bank', 'cheque']), `Payment #${i + 1}`, adminUserId]
      );
    }
    await conn.commit();
    console.log('Payment Vouchers: 500');

    // ─────────────────────────────────────────
    // 19. RECEIPT VOUCHERS (500)
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    const rvTypes = ['customer', 'sales', 'other'];
    for (let i = 0; i < 500; i++) {
      const vNum = `RV-${Date.now()}-${i}`;
      const accId = pick(accountIds);
      await conn.query(
        `INSERT INTO receipt_vouchers (voucher_number, voucher_date, received_from, receipt_type, account_id, amount, payment_method, description, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [vNum, randomDate(365, 1), fullName(), pick(rvTypes), accId, randFloat(1000, 100000), pick(['cash', 'bank', 'cheque']), `Receipt #${i + 1}`, adminUserId]
      );
    }
    await conn.commit();
    console.log('Receipt Vouchers: 500');

    // ─────────────────────────────────────────
    // 20. EXPENSES (500)
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    const expCats = ['Rent', 'Utilities', 'Salaries', 'Marketing', 'Maintenance', 'Supplies', 'Other'];
    const expTitles = ['Monthly Rent', 'Electricity Bill', 'Internet Bill', 'Staff Salary', 'Advertisement', 'Store Maintenance', 'Office Supplies', 'Security Services', 'Cleaning Services', 'Miscellaneous'];
    for (let i = 0; i < 500; i++) {
      await conn.query(
        'INSERT INTO expenses (title, amount, category, expense_date, description, user_id) VALUES (?, ?, ?, ?, ?, ?)',
        [pick(expTitles), randFloat(500, 100000), pick(expCats), randomDate(365, 1), `Expense #${i + 1}`, adminUserId]
      );
    }
    await conn.commit();
    console.log('Expenses: 500');

    // ─────────────────────────────────────────
    // 21. QUOTATIONS (300) + ITEMS
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    const quotStatuses = ['draft', 'sent', 'accepted', 'rejected', 'expired'];
    let qCount = 0;
    for (let i = 0; i < 300; i++) {
      const custId = pick(customerIds);
      const qNum = `QT-${Date.now()}-${i}`;
      const itemCount = rand(1, 4);
      let subtotal = 0;
      const qItems = [];
      for (let j = 0; j < itemCount; j++) {
        const prodId = pick(productIds);
        const qty = rand(1, 10);
        const price = randFloat(100, 8000);
        const line = parseFloat((qty * price).toFixed(2));
        subtotal += line;
        qItems.push([prodId, qty, price, line]);
      }
      const total = parseFloat(subtotal.toFixed(2));
      const validUntil = dateBack(rand(-30, -90)); // future date
      const qRes = await conn.query(
        `INSERT INTO quotations (quotation_number, customer_id, subtotal, total_amount, status, valid_until, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [qNum, custId, total, total, pick(quotStatuses), validUntil, adminUserId]
      );
      const qid = insertId(qRes);
      if (qid) {
        qCount++;
        for (const [prodId, qty, price, line] of qItems) {
          await conn.query(
            'INSERT INTO quotation_items (quotation_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
            [qid, prodId, qty, price, line]
          );
        }
      }
    }
    await conn.commit();
    console.log(`Quotations: ${qCount}`);

    // ─────────────────────────────────────────
    // 22. CREDIT SALES (200) + PAYMENTS (400)
    // ─────────────────────────────────────────
    if (saleIds.length > 0) {
      await conn.beginTransaction();
      const sampleSaleIds = saleIds.slice(0, 200);
      for (const sId of sampleSaleIds) {
        const custId = pick(customerIds);
        const total = randFloat(1000, 50000);
        const paid = rand(0, 1) ? randFloat(0, total) : 0;
        const balance = parseFloat((total - paid).toFixed(2));
        const status = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'pending';
        const dueDate = dateBack(rand(-7, -60)); // future due date
        const csRes = await conn.query(
          `INSERT INTO credit_sales (sale_id, customer_id, total_amount, paid_amount, balance_due, due_date, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [sId, custId, total, paid, balance, dueDate, status, adminUserId]
        );
        const csid = insertId(csRes);
        if (csid) creditSaleIds.push(csid);
      }
      await conn.commit();

      await conn.beginTransaction();
      let cpCount = 0;
      for (const csId of creditSaleIds) {
        if (cpCount >= 400) break;
        const payCount = rand(1, 3);
        for (let p = 0; p < payCount && cpCount < 400; p++) {
          await conn.query(
            'INSERT INTO credit_payments (credit_sale_id, amount, payment_method, received_by) VALUES (?, ?, ?, ?)',
            [csId, randFloat(500, 20000), pick(['Cash', 'Card', 'Bank Transfer']), adminUserId]
          );
          cpCount++;
        }
      }
      await conn.commit();
      console.log(`Credit Sales: ${creditSaleIds.length}, Credit Payments: ${cpCount}`);
    }

    // ─────────────────────────────────────────
    // 23. LAYAWAY ORDERS (150) + ITEMS + PAYMENTS
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    for (let i = 0; i < 150; i++) {
      const custId = pick(customerIds);
      const layNum = `LAY-${Date.now()}-${i}`;
      const itemCount = rand(1, 3);
      let subtotal = 0;
      const layItems = [];
      for (let j = 0; j < itemCount; j++) {
        const prodId = pick(productIds);
        const qty = rand(1, 5);
        const price = randFloat(500, 10000);
        const line = parseFloat((qty * price).toFixed(2));
        subtotal += line;
        layItems.push([prodId, qty, price, line]);
      }
      const total = parseFloat(subtotal.toFixed(2));
      const deposit = parseFloat((total * randFloat(0.1, 0.5)).toFixed(2));
      const balance = parseFloat((total - deposit).toFixed(2));
      const expiryDate = dateBack(rand(-30, -90));
      const layRes = await conn.query(
        `INSERT INTO layaway_orders (layaway_number, customer_id, subtotal, total_amount, deposit_amount, paid_amount, balance_due, expiry_date, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [layNum, custId, total, total, deposit, deposit, balance, expiryDate, pick(['active', 'completed', 'cancelled']), adminUserId]
      );
      const layId = insertId(layRes);
      if (layId) {
        layawayIds.push(layId);
        for (const [prodId, qty, price, line] of layItems) {
          await conn.query(
            'INSERT INTO layaway_items (layaway_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
            [layId, prodId, qty, price, line]
          );
        }
        await conn.query(
          'INSERT INTO layaway_payments (layaway_id, amount, payment_method, received_by) VALUES (?, ?, ?, ?)',
          [layId, deposit, pick(['Cash', 'Card']), adminUserId]
        );
      }
    }
    await conn.commit();
    console.log(`Layaway Orders: ${layawayIds.length}`);

    // ─────────────────────────────────────────
    // 24. COUPONS (100) + REDEMPTIONS
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    for (let i = 0; i < 100; i++) {
      const code = `SAVE${rand(10, 99)}${String.fromCharCode(65 + rand(0, 25))}${rand(100, 999)}`;
      const discType = rand(0, 1) ? 'percentage' : 'fixed';
      const discVal = discType === 'percentage' ? rand(5, 50) : rand(100, 2000);
      const validFrom = randomDate(365, 90);
      const validUntil = dateBack(rand(-7, -180));
      const couRes = await conn.query(
        `INSERT IGNORE INTO coupons (code, description, discount_type, discount_value, min_purchase, usage_limit, valid_from, valid_until, is_active, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [code, `${discVal}${discType === 'percentage' ? '%' : ' Rs'} off`, discType, discVal, rand(500, 5000), rand(10, 200), validFrom, validUntil, adminUserId]
      );
      const cid = insertId(couRes);
      if (cid) couponIds.push(cid);
    }
    await conn.commit();

    if (couponIds.length > 0 && saleIds.length > 0) {
      await conn.beginTransaction();
      for (let i = 0; i < Math.min(200, couponIds.length * 2); i++) {
        const cId = pick(couponIds);
        const sId = pick(saleIds);
        await conn.query(
          'INSERT IGNORE INTO coupon_redemptions (coupon_id, sale_id, discount_applied) VALUES (?, ?, ?)',
          [cId, sId, randFloat(100, 2000)]
        ).catch(() => {});
      }
      await conn.commit();
    }
    console.log(`Coupons: ${couponIds.length}`);

    // ─────────────────────────────────────────
    // 25. GIFT CARDS (200)
    // ─────────────────────────────────────────
    const gcTableCheck = await conn.query('SHOW TABLES LIKE "gift_cards"');
    if (gcTableCheck.length > 0) {
      await conn.beginTransaction();
      let gcCount = 0;
      for (let i = 0; i < 200; i++) {
        const gcNum = `GC${Date.now().toString().slice(-8)}${String(i).padStart(3, '0')}`;
        const initBal = randFloat(500, 10000);
        const currentBal = randFloat(0, initBal);
        const gcRes = await conn.query(
          'INSERT IGNORE INTO gift_cards (card_number, initial_balance, current_balance, status, created_by) VALUES (?, ?, ?, ?, ?)',
          [gcNum, initBal, currentBal, pick(['active', 'depleted', 'expired']), adminUserId]
        ).catch(() => null);
        if (gcRes && insertId(gcRes)) gcCount++;
      }
      await conn.commit();
      console.log(`Gift Cards: ${gcCount}`);
    }

    // ─────────────────────────────────────────
    // 26. STOCK ADJUSTMENTS (500)
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    const adjTypes = ['addition', 'subtraction', 'correction', 'damage', 'theft'];
    const subtractive = ['subtraction', 'damage', 'theft'];
    for (let i = 0; i < 500; i++) {
      const prodId = pick(productIds);
      const adjType = pick(adjTypes);
      const qtyBefore = rand(0, 200);
      const qtyAdjusted = rand(1, 50);
      const qtyAfter = subtractive.includes(adjType) ? Math.max(0, qtyBefore - qtyAdjusted) : qtyBefore + qtyAdjusted;
      await conn.query(
        `INSERT INTO stock_adjustments (product_id, adjustment_type, quantity_before, quantity_adjusted, quantity_after, reason, reference_number, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [prodId, adjType, qtyBefore, qtyAdjusted, qtyAfter, `${adjType} - seeded`, `SA-SEED-${i}`, adminUserId]
      );
    }
    await conn.commit();
    console.log('Stock Adjustments: 500');

    // ─────────────────────────────────────────
    // 27. STOCK TRANSFERS (between stores)
    // ─────────────────────────────────────────
    const storeRows = await conn.query('SELECT store_id FROM stores WHERE is_active = 1');
    if (storeRows.length >= 2) {
      await conn.beginTransaction();
      const storeIds = storeRows.map(r => r.store_id);
      let stCount = 0;
      for (let i = 0; i < 200; i++) {
        const fromStore = storeIds[0];
        const toStore = storeIds[1];
        await conn.query(
          'INSERT INTO stock_transfers (from_store_id, to_store_id, product_id, quantity, status, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [fromStore, toStore, pick(productIds), rand(1, 50), pick(['pending', 'completed']), `Transfer #${i + 1}`, adminUserId]
        );
        stCount++;
      }
      await conn.commit();
      console.log(`Stock Transfers: ${stCount}`);
    } else {
      console.log('Stock Transfers: skipped (only 1 store in DB)');
    }

    // ─────────────────────────────────────────
    // 28. CASH REGISTERS (100) + MOVEMENTS
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    let movCount = 0;
    for (let i = 0; i < 100; i++) {
      const openBal = randFloat(5000, 50000);
      const closeBal = randFloat(5000, 100000);
      const openDate = randomDate(365, 2) + ' 09:00:00';
      const closeDate = randomDate(364, 1) + ' 21:00:00';
      const regRes = await conn.query(
        `INSERT INTO cash_registers (opened_by, closed_by, opening_balance, closing_balance, status, opened_at, closed_at)
         VALUES (?, ?, ?, ?, 'closed', ?, ?)`,
        [adminUserId, adminUserId, openBal, closeBal, openDate, closeDate]
      );
      const rid = insertId(regRes);
      if (rid) {
        registerIds.push(rid);
        const moveCount = rand(3, 7);
        for (let m = 0; m < moveCount; m++) {
          await conn.query(
            'INSERT INTO cash_movements (register_id, type, amount, reason, user_id) VALUES (?, ?, ?, ?, ?)',
            [rid, pick(['cash_in', 'cash_out']), randFloat(100, 10000), pick(['Sales', 'Expense', 'Petty cash', 'Customer refund']), adminUserId]
          );
          movCount++;
        }
      }
    }
    await conn.commit();
    console.log(`Cash Registers: ${registerIds.length}, Movements: ${movCount}`);

    // ─────────────────────────────────────────
    // 29. RETURNS (200) + RETURN DETAILS
    // ─────────────────────────────────────────
    if (saleIds.length > 0) {
      await conn.beginTransaction();
      let retCount = 0;
      for (const sId of saleIds.slice(0, 200)) {
        const refund = randFloat(100, 5000);
        const retRes = await conn.query(
          'INSERT INTO returns (sale_id, refund_amount, reason, user_id) VALUES (?, ?, ?, ?)',
          [sId, refund, pick(['Defective', 'Wrong item', 'Customer changed mind', 'Exchange']), adminUserId]
        );
        const retId = insertId(retRes);
        if (retId) {
          retCount++;
          await conn.query(
            'INSERT INTO return_details (return_id, product_id, quantity, refund_price) VALUES (?, ?, ?, ?)',
            [retId, pick(productIds), rand(1, 3), refund]
          );
        }
      }
      await conn.commit();
      console.log(`Returns: ${retCount}`);
    }

    // ─────────────────────────────────────────
    // 30. INVOICES (400) + INVOICE ITEMS
    // ─────────────────────────────────────────
    const invTableCheck = await conn.query('SHOW TABLES LIKE "invoices"');
    if (invTableCheck.length > 0) {
      await conn.beginTransaction();
      const invStatuses = ['draft', 'sent', 'paid'];
      let invCount = 0;
      for (let i = 0; i < 400; i++) {
        const custId = pick(customerIds);
        const invNum = `INV-${Date.now()}-${i}`;
        const itemCount = rand(1, 4);
        let subtotal = 0;
        const invItems = [];
        for (let j = 0; j < itemCount; j++) {
          const prodId = pick(productIds);
          const qty = rand(1, 10);
          const price = randFloat(100, 8000);
          const line = parseFloat((qty * price).toFixed(2));
          subtotal += line;
          invItems.push([prodId, qty, price, line]);
        }
        const total = parseFloat(subtotal.toFixed(2));
        const dueDate = dateBack(rand(-7, -60));
        const irRes = await conn.query(
          `INSERT INTO invoices (invoice_number, customer_id, subtotal, total_amount, status, due_date, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [invNum, custId, total, total, pick(invStatuses), dueDate, adminUserId]
        ).catch(() => null);
        const iid = irRes ? insertId(irRes) : null;
        if (iid) {
          invCount++;
          for (const [prodId, qty, price, line] of invItems) {
            await conn.query(
              'INSERT INTO invoice_items (invoice_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
              [iid, prodId, qty, price, line]
            ).catch(() => {});
          }
        }
      }
      await conn.commit();
      console.log(`Invoices: ${invCount}`);
    } else {
      console.log('Invoices: table not found, skipping');
    }

    // ─────────────────────────────────────────
    // 31. PRICE RULES (50)
    // ─────────────────────────────────────────
    const prTableCheck = await conn.query('SHOW TABLES LIKE "price_rules"');
    if (prTableCheck.length > 0) {
      await conn.beginTransaction();
      const prTypes = ['buy_x_get_y', 'quantity_discount', 'time_based', 'category_discount'];
      const prDiscTypes = ['percentage', 'fixed'];
      for (let i = 0; i < 50; i++) {
        const startDate = randomDate(90, 30);
        const endDate = dateBack(rand(-7, -90)); // future end date
        await conn.query(
          `INSERT INTO price_rules (rule_name, rule_type, discount_type, discount_value, min_quantity, is_active, start_date, end_date, created_by)
           VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`,
          [`Rule ${i + 1}`, pick(prTypes), pick(prDiscTypes), randFloat(5, 50), rand(1, 10), startDate, endDate, adminUserId]
        ).catch(() => {});
      }
      await conn.commit();
      console.log('Price Rules: 50');
    }

    // ─────────────────────────────────────────
    // 32. SALES TARGETS (100)
    // ─────────────────────────────────────────
    const stTableCheck = await conn.query('SHOW TABLES LIKE "sales_targets"');
    if (stTableCheck.length > 0) {
      await conn.beginTransaction();
      const targetTypes = ['daily', 'weekly', 'monthly'];
      for (let i = 0; i < 100; i++) {
        const year = rand(2024, 2026);
        const month = rand(1, 12);
        const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
        const periodEnd = `${year}-${String(month).padStart(2, '0')}-28`;
        await conn.query(
          `INSERT INTO sales_targets (target_type, target_amount, period_start, period_end, is_active, created_by)
           VALUES (?, ?, ?, ?, 1, ?)`,
          [pick(targetTypes), randFloat(100000, 2000000), periodStart, periodEnd, adminUserId]
        ).catch(() => {});
      }
      await conn.commit();
      console.log('Sales Targets: 100');
    }

    // ─────────────────────────────────────────
    // 33. AUDIT LOGS (500 extra)
    // ─────────────────────────────────────────
    await conn.beginTransaction();
    const auditActions = [
      'USER_LOGIN', 'SALE_CREATED', 'PRODUCT_UPDATED', 'STOCK_ADJUSTED', 'CUSTOMER_CREATED',
      'SUPPLIER_UPDATED', 'PO_CREATED', 'PO_RECEIVED', 'EXPENSE_CREATED', 'SALARY_PAID',
      'LOAN_ISSUED', 'LEAVE_REQUESTED', 'HOLIDAY_CREATED', 'REGISTER_OPENED', 'REGISTER_CLOSED',
      'COUPON_CREATED', 'JOURNAL_ENTRY_CREATED', 'PAYMENT_VOUCHER_CREATED', 'RECEIPT_VOUCHER_CREATED', 'RETURN_CREATED'
    ];
    const auditEntities = ['product', 'customer', 'sale', 'staff', 'purchase_order', 'expense', 'coupon', 'register'];
    for (let i = 0; i < 500; i++) {
      const details = JSON.stringify({ note: `Seeded audit entry #${i + 1}`, ref: rand(1, 100) });
      await conn.query(
        `INSERT INTO audit_logs (user_id, user_name, action, entity_type, entity_id, details, ip_address)
         VALUES (?, 'Admin', ?, ?, ?, ?, '127.0.0.1')`,
        [adminUserId, pick(auditActions), pick(auditEntities), rand(1, 500), details]
      );
    }
    await conn.commit();
    console.log('Audit Logs: 500 extra entries');

    console.log('\n✅ Database seeding completed successfully!');
    console.log(`  Categories: ${categoryIds.length} | Products: ${productIds.length}`);
    console.log(`  Customers: ${customerIds.length} | Suppliers: ${supplierIds.length}`);
    console.log(`  Staff: ${staffIds.length} | Sales: ${saleIds.length}`);
    console.log(`  Accounts: ${accountIds.length} | Coupons: ${couponIds.length}`);

  } catch (err) {
    try { await conn.rollback(); } catch (e) { /* ignore */ }
    console.error('Seeding failed:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
