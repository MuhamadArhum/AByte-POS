// =============================================================
// test-api.js — AByte POS Automated API Test Suite
//
// Usage:
//   node test-api.js
//   node test-api.js --url http://localhost:5000
//   node test-api.js --username admin@test.com --password 123456
//
// Covers all 36 route files, module by module.
// Creates test data, verifies responses, cleans up after itself.
// =============================================================

const http  = require('http');
const https = require('https');
const url   = require('url');

// ── Config ──────────────────────────────────────────────────
const args     = process.argv.slice(2);
const getArg   = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const BASE_URL  = getArg('--url')      || 'http://localhost:5000/api';
const USERNAME  = getArg('--username') || 'admin@abyte.com';
const PASSWORD  = getArg('--password') || '123456';

// ── ANSI Colors ─────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
  white:  '\x1b[97m',
  bgGreen: '\x1b[42m',
  bgRed:   '\x1b[41m',
};

// ── HTTP Helper ─────────────────────────────────────────────
let token = '';

function request(method, path, body = null) {
  return new Promise((resolve) => {
    const fullUrl  = `${BASE_URL}${path}`;
    const parsed   = url.parse(fullUrl);
    const isHttps  = parsed.protocol === 'https:';
    const lib      = isHttps ? https : http;
    const bodyStr  = body ? JSON.stringify(body) : null;

    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.path,
      method:   method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => resolve({ status: 0, body: { message: err.message } }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ status: 0, body: { message: 'Timeout' } }); });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Test Runner ─────────────────────────────────────────────
const results = { passed: 0, failed: 0, skipped: 0, total: 0, failures: [] };

function pass(module, desc) {
  results.passed++;
  results.total++;
  console.log(`  ${C.green}PASS${C.reset} ${C.gray}[${module}]${C.reset} ${desc}`);
}

function fail(module, desc, reason) {
  results.failed++;
  results.total++;
  const msg = `  ${C.red}FAIL${C.reset} ${C.gray}[${module}]${C.reset} ${desc} ${C.red}— ${reason}${C.reset}`;
  console.log(msg);
  results.failures.push({ module, desc, reason });
}

function skip(module, desc, reason) {
  results.skipped++;
  results.total++;
  console.log(`  ${C.yellow}SKIP${C.reset} ${C.gray}[${module}]${C.reset} ${desc} ${C.gray}(${reason})${C.reset}`);
}

function section(name) {
  console.log(`\n${C.bold}${C.cyan}━━━  ${name}  ━━━${C.reset}`);
}

async function test(module, desc, method, path, body, expectStatus, validator) {
  results.total++;
  const res = await request(method, path, body);

  if (res.status === 0) {
    results.failed++;
    const msg = `  ${C.red}FAIL${C.reset} ${C.gray}[${module}]${C.reset} ${desc} ${C.red}— ${res.body.message}${C.reset}`;
    console.log(msg);
    results.failures.push({ module, desc, reason: res.body.message });
    return null;
  }

  const statusOk = Array.isArray(expectStatus)
    ? expectStatus.includes(res.status)
    : res.status === expectStatus;

  if (!statusOk) {
    results.failed++;
    const reason = `Expected ${expectStatus}, got ${res.status}. ${res.body?.message || ''}`;
    const msg = `  ${C.red}FAIL${C.reset} ${C.gray}[${module}]${C.reset} ${desc} ${C.red}— ${reason}${C.reset}`;
    console.log(msg);
    results.failures.push({ module, desc, reason });
    return null;
  }

  if (validator && !validator(res.body)) {
    results.failed++;
    const reason = 'Response validation failed';
    const msg = `  ${C.red}FAIL${C.reset} ${C.gray}[${module}]${C.reset} ${desc} ${C.red}— ${reason}${C.reset}`;
    console.log(msg);
    results.failures.push({ module, desc, reason });
    return null;
  }

  results.passed++;
  console.log(`  ${C.green}PASS${C.reset} ${C.gray}[${module}]${C.reset} ${desc}`);
  return res.body;
}

// ── IDs tracker for cleanup ──────────────────────────────────
const created = {
  userId:          null,
  customerId:      null,
  categoryId:      null,
  productId:       null,
  supplierId:      null,
  saleId:          null,
  pendingSaleId:   null,
  deliveryId:      null,
  purchaseOrderId: null,
  staffId:         null,
  accountId:       null,
  journalEntryId:  null,
  quotationId:     null,
  roleId:          null,
};

// ════════════════════════════════════════════════════════════
//   MAIN TEST SUITE
// ════════════════════════════════════════════════════════════
async function runTests() {
  console.log(`\n${C.bold}${C.white}╔══════════════════════════════════════════════╗`);
  console.log(`║      AByte POS — Automated API Test Suite    ║`);
  console.log(`╚══════════════════════════════════════════════╝${C.reset}`);
  console.log(`${C.gray}  Base URL : ${BASE_URL}`);
  console.log(`  Username : ${USERNAME}`);
  console.log(`  Started  : ${new Date().toLocaleString()}${C.reset}\n`);

  // ── 1. AUTH ───────────────────────────────────────────────
  section('1. AUTH');

  // Wrong credentials
  await test('Auth', 'POST /auth/login — wrong password returns 401', 'POST', '/auth/login',
    { username: USERNAME, password: 'wrong_password_xyz' }, 401);

  // Correct login
  const loginRes = await test('Auth', 'POST /auth/login — valid credentials', 'POST', '/auth/login',
    { username: USERNAME, password: PASSWORD }, 200,
    body => body.token);

  if (!loginRes) {
    console.log(`\n${C.red}${C.bold}Cannot continue — Login failed. Check credentials & server.${C.reset}`);
    printSummary(); process.exit(1);
  }
  token = loginRes.token;

  await test('Auth', 'GET  /auth/verify — valid token', 'GET', '/auth/verify', null, 200,
    body => body.user);

  // Bad token check
  const savedToken = token;
  token = 'bad.token.here';
  await test('Auth', 'GET  /auth/verify — invalid token returns 401', 'GET', '/auth/verify', null, 401);
  token = savedToken;

  // ── 2. SETTINGS ───────────────────────────────────────────
  section('2. SETTINGS');

  await test('Settings', 'GET  /settings', 'GET', '/settings', null, 200,
    body => body.business_name !== undefined);

  await test('Settings', 'PUT  /settings — update business name', 'PUT', '/settings',
    { business_name: 'AByte POS Test' }, 200);

  await test('Settings', 'GET  /settings/printers', 'GET', '/settings/printers', null, 200);

  await test('Settings', 'GET  /settings/printers/check', 'GET', '/settings/printers/check?purpose=receipt', null, 200);

  // ── 3. USERS ──────────────────────────────────────────────
  section('3. USERS');

  await test('Users', 'GET  /users', 'GET', '/users', null, 200,
    body => Array.isArray(body));

  await test('Users', 'GET  /users/roles', 'GET', '/users/roles', null, 200,
    body => Array.isArray(body));

  const newUser = await test('Users', 'POST /users — create test user', 'POST', '/users',
    { name: 'Test User API', username: 'testuser_api_del', email: 'testapi_del@abyte.com', password: 'Test1234!', role_name: 'Manager' },
    [200, 201], body => body.user_id || body.id);

  if (newUser) {
    created.userId = newUser.user_id || newUser.id;

    await test('Users', `PUT  /users/${created.userId} — update test user`, 'PUT', `/users/${created.userId}`,
      { name: 'Test User Updated', username: 'testuser_api_del', email: 'testapi_del@abyte.com', role_name: 'Manager' }, 200);
  }

  // ── 4. CUSTOMERS ──────────────────────────────────────────
  section('4. CUSTOMERS');

  await test('Customers', 'GET  /customers', 'GET', '/customers', null, 200,
    body => Array.isArray(body) || Array.isArray(body?.data));

  const newCust = await test('Customers', 'POST /customers — create test customer', 'POST', '/customers',
    { name: 'TEST_API_CUSTOMER', phone: '03001234999', email: 'apicust@test.com', address: '123 Test St' },
    [200, 201], body => body.customer_id || body.id);

  if (newCust) {
    created.customerId = newCust.customer_id || newCust.id;

    await test('Customers', `GET  /customers/${created.customerId}`, 'GET', `/customers/${created.customerId}`, null, 200,
      body => body.customer_id || body.id);

    await test('Customers', `PUT  /customers/${created.customerId}`, 'PUT', `/customers/${created.customerId}`,
      { name: 'TEST_API_CUSTOMER_UPDATED', phone: '03001234999' }, 200);
  }

  // ── 5. PRODUCTS ───────────────────────────────────────────
  section('5. PRODUCTS');

  await test('Products', 'GET  /products/categories', 'GET', '/products/categories', null, 200,
    body => Array.isArray(body));

  const newCat = await test('Products', 'POST /products/categories — create test category', 'POST', '/products/categories',
    { name: 'TEST_API_CAT', description: 'Auto test category' },
    [200, 201], body => body.category_id || body.id);

  if (newCat) created.categoryId = newCat.category_id || newCat.id;

  await test('Products', 'GET  /products', 'GET', '/products', null, 200);
  await test('Products', 'GET  /products?search=test', 'GET', '/products?search=test', null, 200);

  const newProd = await test('Products', 'POST /products — create test product', 'POST', '/products',
    {
      name: 'TEST_API_PRODUCT',
      sku: 'TST-API-001',
      barcode: '1234567890123',
      price: 500,
      cost_price: 300,
      stock_quantity: 100,
      category_id: created.categoryId || 1,
      product_type: 'finished_goods',
    },
    [200, 201], body => body.product_id || body.id);

  if (newProd) {
    created.productId = newProd.product_id || newProd.id;

    await test('Products', `GET  /products/${created.productId}`, 'GET', `/products/${created.productId}`, null, 200,
      body => body.product_id || body.id);

    await test('Products', `PUT  /products/${created.productId}`, 'PUT', `/products/${created.productId}`,
      { name: 'TEST_API_PRODUCT_UPDATED', price: 550, cost_price: 300, stock_quantity: 100, category_id: created.categoryId || 1 }, 200);
  }

  // ── 6. INVENTORY ──────────────────────────────────────────
  section('6. INVENTORY');

  await test('Inventory', 'GET  /inventory', 'GET', '/inventory', null, 200,
    body => Array.isArray(body) || Array.isArray(body?.data));

  await test('Inventory', 'GET  /inventory/low-stock', 'GET', '/inventory/low-stock', null, 200);

  if (created.productId) {
    await test('Inventory', `PUT  /inventory/${created.productId} — update stock`, 'PUT', `/inventory/${created.productId}`,
      { stock_quantity: 95, reason: 'API Test adjustment' }, 200);
  }

  // ── 7. SUPPLIERS ──────────────────────────────────────────
  section('7. SUPPLIERS');

  await test('Suppliers', 'GET  /suppliers', 'GET', '/suppliers', null, 200,
    body => Array.isArray(body) || Array.isArray(body?.data));

  const newSupplier = await test('Suppliers', 'POST /suppliers — create test supplier', 'POST', '/suppliers',
    { name: 'TEST_API_SUPPLIER', phone: '03009998888', email: 'supplier@test.com', address: 'Supplier City' },
    [200, 201], body => body.supplier_id || body.id);

  if (newSupplier) {
    created.supplierId = newSupplier.supplier_id || newSupplier.id;

    await test('Suppliers', `GET  /suppliers/${created.supplierId}`, 'GET', `/suppliers/${created.supplierId}`, null, 200);

    await test('Suppliers', `PUT  /suppliers/${created.supplierId}`, 'PUT', `/suppliers/${created.supplierId}`,
      { name: 'TEST_API_SUPPLIER_UPDATED', phone: '03009998888' }, 200);

    await test('Suppliers', `GET  /suppliers/${created.supplierId}/payments`, 'GET',
      `/suppliers/${created.supplierId}/payments`, null, 200);
  }

  // ── 8. PURCHASE ORDERS ────────────────────────────────────
  section('8. PURCHASE ORDERS');

  await test('PurchaseOrders', 'GET  /purchase-orders', 'GET', '/purchase-orders', null, 200);
  await test('PurchaseOrders', 'GET  /purchase-orders/stock-alerts', 'GET', '/purchase-orders/stock-alerts', null, 200);
  await test('PurchaseOrders', 'GET  /purchase-orders/stock-alerts/stats', 'GET', '/purchase-orders/stock-alerts/stats', null, 200);

  if (created.supplierId && created.productId) {
    const newPO = await test('PurchaseOrders', 'POST /purchase-orders — create test PO', 'POST', '/purchase-orders',
      {
        supplier_id: created.supplierId,
        expected_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        notes: 'API Test PO',
        items: [{ product_id: created.productId, quantity: 10, unit_cost: 250 }],
      },
      [200, 201], body => body.po_id || body.id);

    if (newPO) {
      created.purchaseOrderId = newPO.po_id || newPO.id;

      await test('PurchaseOrders', `GET  /purchase-orders/${created.purchaseOrderId}`, 'GET',
        `/purchase-orders/${created.purchaseOrderId}`, null, 200);

      await test('PurchaseOrders', `PUT  /purchase-orders/${created.purchaseOrderId} — cancel`, 'PUT',
        `/purchase-orders/${created.purchaseOrderId}/cancel`, {}, 200);
    }
  } else {
    skip('PurchaseOrders', 'POST /purchase-orders', 'No supplier/product available');
  }

  // ── 9. PURCHASE VOUCHERS ──────────────────────────────────
  section('9. PURCHASE VOUCHERS');

  await test('PurchaseVouchers', 'GET  /purchase-vouchers', 'GET', '/purchase-vouchers', null, 200);

  // ── 10. CASH REGISTER ─────────────────────────────────────
  section('10. CASH REGISTER');

  const currentReg = await test('Register', 'GET  /register/current', 'GET', '/register/current', null, 200);
  await test('Register', 'GET  /register/history', 'GET', '/register/history', null, 200);

  if (currentReg && !currentReg.register_id) {
    await test('Register', 'POST /register/open — open register', 'POST', '/register/open',
      { opening_balance: 5000, notes: 'API Test open' }, [200, 201]);
  } else {
    skip('Register', 'POST /register/open', 'Register already open');
  }

  // ── 11. SALES ─────────────────────────────────────────────
  section('11. SALES');

  await test('Sales', 'GET  /sales', 'GET', '/sales', null, 200);
  await test('Sales', 'GET  /sales/today', 'GET', '/sales/today', null, 200);
  await test('Sales', 'GET  /sales/pending', 'GET', '/sales/pending', null, 200);

  if (created.productId && created.customerId) {
    const newSale = await test('Sales', 'POST /sales — create test sale (completed)', 'POST', '/sales',
      {
        customer_id: created.customerId,
        payment_method: 'cash',
        status: 'completed',
        items: [{ product_id: created.productId, quantity: 1, price: 500 }],
        sub_total: 500,
        tax_amount: 0,
        service_amount: 0,
        discount_amount: 0,
        total_amount: 500,
        amount_paid: 500,
        notes: 'API Test Sale',
      },
      [200, 201], body => body.sale_id || body.id);

    if (newSale) {
      created.saleId = newSale.sale_id || newSale.id;
      await test('Sales', `GET  /sales/${created.saleId}`, 'GET', `/sales/${created.saleId}`, null, 200,
        body => body.sale_id || body.id);
    }

    // Pending sale
    const pendingSale = await test('Sales', 'POST /sales — create pending sale', 'POST', '/sales',
      {
        customer_id: created.customerId,
        payment_method: 'cash',
        status: 'pending',
        items: [{ product_id: created.productId, quantity: 1, price: 500 }],
        sub_total: 500, tax_amount: 0, service_amount: 0, discount_amount: 0,
        total_amount: 500, amount_paid: 0, notes: 'API Test Pending Sale',
      },
      [200, 201]);

    if (pendingSale) {
      created.pendingSaleId = pendingSale.sale_id || pendingSale.id;
      await test('Sales', `PUT  /sales/${created.pendingSaleId}/complete`, 'PUT',
        `/sales/${created.pendingSaleId}/complete`,
        { payment_method: 'cash', amount_paid: 500, total_amount: 500 }, 200);
    }
  } else {
    skip('Sales', 'POST /sales', 'No product/customer available');
  }

  // ── 12. RETURNS ───────────────────────────────────────────
  section('12. RETURNS');

  await test('Returns', 'GET  /returns', 'GET', '/returns', null, 200);

  if (created.saleId) {
    await test('Returns', `GET  /returns/sale/${created.saleId}`, 'GET',
      `/returns/sale/${created.saleId}`, null, 200);
  } else {
    skip('Returns', 'GET /returns/sale/:id', 'No sale created');
  }

  // ── 13. DELIVERIES ────────────────────────────────────────
  section('13. DELIVERIES');

  await test('Deliveries', 'GET  /deliveries/stats', 'GET', '/deliveries/stats', null, 200);
  await test('Deliveries', 'GET  /deliveries', 'GET', '/deliveries', null, 200);

  if (created.customerId) {
    const newDel = await test('Deliveries', 'POST /deliveries — create test delivery', 'POST', '/deliveries',
      {
        customer_id: created.customerId,
        sale_id: created.saleId || null,
        delivery_address: '123 Test Street',
        delivery_city: 'Karachi',
        delivery_phone: '03001234567',
        delivery_charges: 150,
        notes: 'API Test Delivery',
      },
      [200, 201], body => body.delivery_id || body.id);

    if (newDel) {
      created.deliveryId = newDel.delivery_id || newDel.id;

      await test('Deliveries', `GET  /deliveries/${created.deliveryId}`, 'GET',
        `/deliveries/${created.deliveryId}`, null, 200);

      await test('Deliveries', `PATCH /deliveries/${created.deliveryId}/status — assigned`, 'PATCH',
        `/deliveries/${created.deliveryId}/status`, { status: 'assigned' }, 200);

      await test('Deliveries', `PUT  /deliveries/${created.deliveryId} — update rider`, 'PUT',
        `/deliveries/${created.deliveryId}`,
        { delivery_address: '123 Test Street', delivery_city: 'Karachi', delivery_phone: '03001234567',
          rider_name: 'Test Rider', rider_phone: '03111234567', delivery_charges: 150, status: 'assigned' }, 200);
    }
  } else {
    skip('Deliveries', 'POST /deliveries', 'No customer available');
  }

  // ── 14. QUOTATIONS ────────────────────────────────────────
  section('14. QUOTATIONS');

  await test('Quotations', 'GET  /quotations/stats', 'GET', '/quotations/stats', null, 200);
  await test('Quotations', 'GET  /quotations', 'GET', '/quotations', null, 200);

  if (created.customerId && created.productId) {
    const newQuote = await test('Quotations', 'POST /quotations — create test quotation', 'POST', '/quotations',
      {
        customer_id: created.customerId,
        valid_until: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        notes: 'API Test Quotation',
        items: [{ product_id: created.productId, quantity: 2, price: 500 }],
        sub_total: 1000, discount_amount: 0, total_amount: 1000,
      },
      [200, 201], body => body.quotation_id || body.id);

    if (newQuote) {
      created.quotationId = newQuote.quotation_id || newQuote.id;
      await test('Quotations', `GET  /quotations/${created.quotationId}`, 'GET',
        `/quotations/${created.quotationId}`, null, 200);
      await test('Quotations', `PUT  /quotations/${created.quotationId}/status — expire`, 'PUT',
        `/quotations/${created.quotationId}/status`, { status: 'expired' }, 200);
    }
  }

  // ── 15. CREDIT SALES ──────────────────────────────────────
  section('15. CREDIT SALES');

  const { default: csModule } = await (async () => {
    const r = await request('GET', '/credit-sales');
    return { default: r };
  })();
  if (csModule.status === 200) pass('CreditSales', 'GET  /credit-sales');
  else fail('CreditSales', 'GET  /credit-sales', `Status ${csModule.status}`);

  // ── 16. PRICE RULES ───────────────────────────────────────
  section('16. PRICE RULES');
  await test('PriceRules', 'GET  /price-rules', 'GET', '/price-rules', null, 200);

  // ── 17. SALES TARGETS ─────────────────────────────────────
  section('17. SALES TARGETS');
  await test('SalesTargets', 'GET  /sales-targets', 'GET', '/sales-targets', null, 200);

  // ── 18. HR / STAFF ────────────────────────────────────────
  section('18. HR / STAFF');

  await test('HR', 'GET  /staff', 'GET', '/staff', null, 200);
  await test('HR', 'GET  /staff/attendance', 'GET', '/staff/attendance', null, 200);
  await test('HR', 'GET  /staff/holidays', 'GET', '/staff/holidays', null, 200);
  await test('HR', 'GET  /staff/loans', 'GET', '/staff/loans', null, 200);
  await test('HR', 'GET  /staff/advance-payments', 'GET', '/staff/advance-payments', null, 200);
  await test('HR', 'GET  /staff/leave-requests', 'GET', '/staff/leave-requests', null, 200);
  await test('HR', 'GET  /staff/increments', 'GET', '/staff/increments', null, 200);
  await test('HR', 'GET  /staff/payroll/preview', 'GET', '/staff/payroll/preview', null, 200);
  await test('HR', 'GET  /staff/reports/salary-sheet', 'GET', '/staff/reports/salary-sheet', null, 200);
  await test('HR', 'GET  /staff/reports/daily-attendance', 'GET', '/staff/reports/daily-attendance', null, 200);
  await test('HR', 'GET  /staff/reports/attendance-monthly', 'GET', '/staff/reports/attendance-monthly', null, 200);
  await test('HR', 'GET  /staff/reports/salary-summary', 'GET', '/staff/reports/salary-summary', null, 200);

  const newStaff = await test('HR', 'POST /staff — create test staff', 'POST', '/staff',
    {
      name: 'TEST_API_STAFF',
      employee_id: 'EMP-API-TEST-001',
      designation: 'Tester',
      department: 'QA',
      phone: '03001239999',
      email: 'stafftest@api.com',
      joining_date: '2024-01-01',
      salary: 30000,
      salary_type: 'monthly',
    },
    [200, 201], body => body.staff_id || body.id);

  if (newStaff) {
    created.staffId = newStaff.staff_id || newStaff.id;
    await test('HR', `GET  /staff/${created.staffId}`, 'GET', `/staff/${created.staffId}`, null, 200);
    await test('HR', `GET  /staff/${created.staffId}/attendance`, 'GET',
      `/staff/${created.staffId}/attendance`, null, 200);
  }

  // ── 19. ACCOUNTING ────────────────────────────────────────
  section('19. ACCOUNTING');

  await test('Accounting', 'GET  /accounting/account-groups', 'GET', '/accounting/account-groups', null, 200);
  await test('Accounting', 'GET  /accounting/accounts', 'GET', '/accounting/accounts', null, 200);
  await test('Accounting', 'GET  /accounting/accounts/next-code', 'GET', '/accounting/accounts/next-code', null, 200);
  await test('Accounting', 'GET  /accounting/journal-entries', 'GET', '/accounting/journal-entries', null, 200);
  await test('Accounting', 'GET  /accounting/bank-accounts', 'GET', '/accounting/bank-accounts', null, 200);
  await test('Accounting', 'GET  /accounting/general-ledger', 'GET', '/accounting/general-ledger', null, 200);
  await test('Accounting', 'GET  /accounting/payment-vouchers', 'GET', '/accounting/payment-vouchers', null, 200);
  await test('Accounting', 'GET  /accounting/receipt-vouchers', 'GET', '/accounting/receipt-vouchers', null, 200);
  await test('Accounting', 'GET  /accounting/reports/trial-balance', 'GET', '/accounting/reports/trial-balance', null, 200);
  await test('Accounting', 'GET  /accounting/reports/trial-balance-6col', 'GET', '/accounting/reports/trial-balance-6col', null, 200);
  await test('Accounting', 'GET  /accounting/reports/profit-loss', 'GET', '/accounting/reports/profit-loss', null, 200);
  await test('Accounting', 'GET  /accounting/reports/balance-sheet', 'GET', '/accounting/reports/balance-sheet', null, 200);

  // ── 20. REPORTS ───────────────────────────────────────────
  section('20. REPORTS');

  const today = new Date().toISOString().split('T')[0];
  await test('Reports', 'GET  /reports/dashboard', 'GET', '/reports/dashboard', null, 200);
  await test('Reports', 'GET  /reports/daily', 'GET', '/reports/daily', null, 200);
  await test('Reports', 'GET  /reports/date-range', 'GET', `/reports/date-range?start_date=${today}&end_date=${today}`, null, 200);
  await test('Reports', 'GET  /reports/product', 'GET', '/reports/product', null, 200);
  await test('Reports', 'GET  /reports/inventory', 'GET', '/reports/inventory', null, 200);

  // ── 21. SALES REPORTS ─────────────────────────────────────
  section('21. SALES REPORTS');

  await test('SalesReports', 'GET  /sales-reports/summary', 'GET', `/sales-reports/summary?date_from=${today}&date_to=${today}`, null, 200);
  await test('SalesReports', 'GET  /sales-reports/hourly', 'GET', `/sales-reports/hourly?date=${today}`, null, 200);
  await test('SalesReports', 'GET  /sales-reports/payment-breakdown', 'GET', `/sales-reports/payment-breakdown?date_from=${today}&date_to=${today}`, null, 200);
  await test('SalesReports', 'GET  /sales-reports/cashier-performance', 'GET', `/sales-reports/cashier-performance?date_from=${today}&date_to=${today}`, null, 200);
  await test('SalesReports', 'GET  /sales-reports/daily-trend', 'GET', `/sales-reports/daily-trend?date_from=${today}&date_to=${today}`, null, 200);
  await test('SalesReports', 'GET  /sales-reports/top-customers', 'GET', `/sales-reports/top-customers?date_from=${today}&date_to=${today}`, null, 200);
  await test('SalesReports', 'GET  /sales-reports/comparison', 'GET', '/sales-reports/comparison', null, 200);

  // ── 22. INVENTORY REPORTS ─────────────────────────────────
  section('22. INVENTORY REPORTS');

  await test('InvReports', 'GET  /inventory-reports/summary', 'GET', '/inventory-reports/summary', null, 200);
  await test('InvReports', 'GET  /inventory-reports/top-products', 'GET', '/inventory-reports/top-products', null, 200);
  await test('InvReports', 'GET  /inventory-reports/category-breakdown', 'GET', '/inventory-reports/category-breakdown', null, 200);
  await test('InvReports', 'GET  /inventory-reports/slow-movers', 'GET', '/inventory-reports/slow-movers', null, 200);
  await test('InvReports', 'GET  /inventory-reports/items-ledger', 'GET', '/inventory-reports/items-ledger', null, 200);
  await test('InvReports', 'GET  /inventory-reports/item-wise-purchase', 'GET', '/inventory-reports/item-wise-purchase', null, 200);
  await test('InvReports', 'GET  /inventory-reports/supplier-wise', 'GET', '/inventory-reports/supplier-wise', null, 200);
  await test('InvReports', 'GET  /inventory-reports/issuance-summary', 'GET', '/inventory-reports/issuance-summary', null, 200);
  await test('InvReports', 'GET  /inventory-reports/stock-reconciliation', 'GET', '/inventory-reports/stock-reconciliation', null, 200);

  // ── 23. AUDIT LOG ─────────────────────────────────────────
  section('23. AUDIT LOG');

  await test('Audit', 'GET  /audit', 'GET', '/audit', null, 200);
  await test('Audit', 'GET  /audit/actions', 'GET', '/audit/actions', null, 200);

  // ── 24. ANALYTICS ─────────────────────────────────────────
  section('24. ANALYTICS');

  await test('Analytics', 'GET  /analytics', 'GET', '/analytics', null, 200);

  // ── 25. STORES ────────────────────────────────────────────
  section('25. STORES');

  await test('Stores', 'GET  /stores', 'GET', '/stores', null, 200);

  // ── 26. PERMISSIONS ───────────────────────────────────────
  section('26. PERMISSIONS');

  await test('Permissions', 'GET  /permissions', 'GET', '/permissions', null, 200);

  // ── 27. BACKUP ────────────────────────────────────────────
  section('27. BACKUP');

  await test('Backup', 'POST /backup — trigger backup', 'POST', '/backup', {}, [200, 201],
    body => body.filename || body.message || body.success);

  // ════════════════════════════════════════════════════════
  //   CLEANUP — delete all test data
  // ════════════════════════════════════════════════════════
  section('CLEANUP — Deleting Test Data');

  if (created.deliveryId)
    await test('Cleanup', `DELETE /deliveries/${created.deliveryId}`, 'DELETE', `/deliveries/${created.deliveryId}`, null, 200);

  if (created.quotationId)
    await test('Cleanup', `DELETE /quotations/${created.quotationId}`, 'DELETE', `/quotations/${created.quotationId}`, null, 200);

  if (created.saleId)
    await test('Cleanup', `DELETE /sales/${created.saleId}`, 'DELETE', `/sales/${created.saleId}`, null, 200);

  if (created.purchaseOrderId)
    await test('Cleanup', `DELETE /purchase-orders/${created.purchaseOrderId}`, 'DELETE',
      `/purchase-orders/${created.purchaseOrderId}`, null, [200, 400]);

  if (created.productId)
    await test('Cleanup', `DELETE /products/${created.productId}`, 'DELETE', `/products/${created.productId}`, null, 200);

  if (created.categoryId)
    await test('Cleanup', `DELETE /products/categories/${created.categoryId}`, 'DELETE',
      `/products/categories/${created.categoryId}`, null, [200, 400]);

  if (created.supplierId)
    await test('Cleanup', `DELETE /suppliers/${created.supplierId}`, 'DELETE', `/suppliers/${created.supplierId}`, null, 200);

  if (created.customerId)
    await test('Cleanup', `DELETE /customers/${created.customerId}`, 'DELETE', `/customers/${created.customerId}`, null, 200);

  if (created.staffId)
    await test('Cleanup', `DELETE /staff/${created.staffId}`, 'DELETE', `/staff/${created.staffId}`, null, 200);

  if (created.userId)
    await test('Cleanup', `DELETE /users/${created.userId}`, 'DELETE', `/users/${created.userId}`, null, 200);

  // ── Print Summary ─────────────────────────────────────────
  printSummary();
}

function printSummary() {
  const { passed, failed, skipped, total, failures } = results;
  const passRate = total > 0 ? Math.round((passed / (total - skipped)) * 100) : 0;

  console.log(`\n${C.bold}${C.white}╔══════════════════════════════════════════════╗`);
  console.log(`║                 TEST SUMMARY                 ║`);
  console.log(`╚══════════════════════════════════════════════╝${C.reset}`);
  console.log(`  ${C.green}Passed  : ${passed}${C.reset}`);
  console.log(`  ${C.red}Failed  : ${failed}${C.reset}`);
  console.log(`  ${C.yellow}Skipped : ${skipped}${C.reset}`);
  console.log(`  Total   : ${total}`);
  console.log(`  Pass Rate: ${passRate >= 90 ? C.green : passRate >= 70 ? C.yellow : C.red}${passRate}%${C.reset}`);

  if (failures.length > 0) {
    console.log(`\n${C.bold}${C.red}Failed Tests:${C.reset}`);
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}. [${f.module}] ${f.desc}`);
      console.log(`     ${C.gray}${f.reason}${C.reset}`);
    });
  }

  const verdict = failed === 0
    ? `${C.bgGreen}${C.bold}  ALL TESTS PASSED  ${C.reset}`
    : failed <= 3
    ? `${C.yellow}${C.bold}  MOSTLY PASSING — Fix ${failed} issue(s)  ${C.reset}`
    : `${C.bgRed}${C.bold}  ${failed} TESTS FAILED — Needs attention  ${C.reset}`;

  console.log(`\n  ${verdict}\n`);
}

// ── Run ──────────────────────────────────────────────────────
runTests().catch(err => {
  console.error(`${C.red}Fatal Error:${C.reset}`, err.message);
  process.exit(1);
});
