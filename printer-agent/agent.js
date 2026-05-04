// =============================================================
// AByte Printer Agent v2.0
// Runs on cashier PC — bridges AByte POS web app to local printers
//
// Supports multiple printers per PC:
//   - Invoice printers  (receipts, invoices)
//   - KOT printers      (kitchen order tickets, category-routed)
//
// Connection types: network (TCP), usb (serial), windows (shared)
//
// Endpoints:
//   GET  /health                — liveness + printer summary
//   GET  /printers              — list configured printers
//   POST /printers              — add printer
//   PUT  /printers/:id          — update printer
//   DELETE /printers/:id        — remove printer
//   POST /printers/:id/test     — send test page to specific printer
//   POST /print/invoice         — print receipt / invoice
//   POST /print/kot             — print KOT (routes to printers by category)
// =============================================================

const express  = require('express');
const cors     = require('cors');
const net      = require('net');
const fs       = require('fs');
const path     = require('path');
const { exec } = require('child_process');
const crypto   = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Config ────────────────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, 'config.json');

const DEFAULT_CONFIG = {
  printers: [],
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (!Array.isArray(data.printers)) data.printers = [];
      return data;
    }
  } catch (e) {
    console.warn('[config] Read error:', e.message, '— using defaults');
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (e) {
    console.error('[config] Save error:', e.message);
  }
}

let config = loadConfig();

// ── Middleware ─────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// ── ESC/POS Commands ──────────────────────────────────────────
const ESC = 0x1B;
const GS  = 0x1D;

const CMD = {
  INIT:          Buffer.from([ESC, 0x40]),
  ALIGN_CENTER:  Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_LEFT:    Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_RIGHT:   Buffer.from([ESC, 0x61, 0x02]),
  BOLD_ON:       Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF:      Buffer.from([ESC, 0x45, 0x00]),
  DOUBLE_SIZE:   Buffer.from([ESC, 0x21, 0x30]),
  DOUBLE_HEIGHT: Buffer.from([ESC, 0x21, 0x10]),
  NORMAL_SIZE:   Buffer.from([ESC, 0x21, 0x00]),
  CUT_PARTIAL:   Buffer.from([GS,  0x56, 0x41, 0x05]),
  CUT_FULL:      Buffer.from([GS,  0x56, 0x00]),
  OPEN_DRAWER:   Buffer.from([ESC, 0x70, 0x00, 0x19, 0xFA]),
  FEED_3:        Buffer.from([ESC, 0x64, 0x03]),
  FEED_5:        Buffer.from([ESC, 0x64, 0x05]),
};

function txt(s) { return Buffer.from(String(s) + '\n', 'utf8'); }

function buildInvoiceESCPOS(d, printerCfg) {
  const W      = printerCfg.paper_width === 58 ? 32 : 42;
  const bufs   = [];
  const push   = (...b) => b.forEach(x => bufs.push(x));
  const dashes = '-'.repeat(W);
  const equals = '='.repeat(W);

  const split = (l, r) => {
    l = String(l); r = String(r);
    const gap = W - l.length - r.length;
    return gap > 0 ? l + ' '.repeat(gap) + r : l.slice(0, W - r.length - 1) + ' ' + r;
  };
  const padR = (s, n) => String(s).slice(0, n).padEnd(n);
  const padL = (s, n) => String(s).slice(0, n).padStart(n);

  push(CMD.INIT);

  // Header
  push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_HEIGHT);
  push(txt((d.storeName || 'Store').toUpperCase()));
  push(CMD.NORMAL_SIZE, CMD.BOLD_OFF);
  if (d.storeAddress) push(txt(d.storeAddress));
  if (d.storePhone)   push(txt('Tel: ' + d.storePhone));
  push(CMD.ALIGN_LEFT, txt(dashes));

  // Meta
  push(CMD.BOLD_ON);
  if (d.invoiceNo) push(txt(split('Invoice:', d.invoiceNo)));
  else             push(txt(split('Receipt #:', String(d.saleId || ''))));
  push(CMD.BOLD_OFF);

  if (d.tokenNo) {
    push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_HEIGHT);
    push(txt('Token: ' + d.tokenNo));
    push(CMD.NORMAL_SIZE, CMD.BOLD_OFF, CMD.ALIGN_LEFT);
  }
  push(txt(split('Date:', d.date || new Date().toLocaleString())));
  push(txt(split('Cashier:', d.cashierName || '')));
  if (d.customerName) push(txt(split('Customer:', d.customerName)));
  if (d.tableNo)      push(txt(split('Table:', d.tableNo)));
  push(txt(dashes));

  // Items header
  const nameW = W - 16;
  push(CMD.BOLD_ON);
  push(txt(padR('Item', nameW) + padR('Qty', 5) + padL('Price', 11)));
  push(CMD.BOLD_OFF, txt(dashes));

  const cs = d.currencySymbol || 'Rs.';
  for (const item of (d.items || [])) {
    push(txt(padR(item.name, nameW) + padR(item.quantity, 5) + padL(cs + Number(item.price).toFixed(2), 11)));
    if (item.note) push(txt('  * ' + item.note));
  }
  push(txt(dashes));

  // Totals
  if (Number(d.discount)      > 0) push(txt(split('Discount:',           `-${cs}${Number(d.discount).toFixed(2)}`)));
  if (Number(d.taxAmount)     > 0) push(txt(split(`Tax (${d.taxPercent || 0}%):`, `${cs}${Number(d.taxAmount).toFixed(2)}`)));
  if (Number(d.chargesAmount) > 0) push(txt(split('Charges:',            `${cs}${Number(d.chargesAmount).toFixed(2)}`)));
  push(txt(equals));
  push(CMD.BOLD_ON, CMD.DOUBLE_HEIGHT);
  push(txt(split('TOTAL:', `${cs}${Number(d.totalAmount || 0).toFixed(2)}`)));
  push(CMD.NORMAL_SIZE, CMD.BOLD_OFF, txt(equals));
  push(txt(split(`Paid (${d.paymentMethod || 'Cash'}):`, `${cs}${Number(d.amountPaid || 0).toFixed(2)}`)));
  if (Number(d.changeDue) > 0) push(txt(split('Change Due:', `${cs}${Number(d.changeDue).toFixed(2)}`)));
  push(txt(dashes));

  // Footer
  push(CMD.ALIGN_CENTER);
  push(txt(d.footer || 'Thank you!'));
  push(CMD.ALIGN_LEFT, CMD.FEED_3);
  if (printerCfg.cut_paper  !== false) push(CMD.CUT_PARTIAL);
  if (printerCfg.open_drawer)          push(CMD.OPEN_DRAWER);

  return Buffer.concat(bufs);
}

function buildKOTESCPOS(d, printerCfg) {
  const W    = printerCfg.paper_width === 58 ? 32 : 42;
  const bufs = [];
  const push = (...b) => b.forEach(x => bufs.push(x));

  push(CMD.INIT);

  // KOT Header
  push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_SIZE);
  push(txt('KOT'));
  push(CMD.NORMAL_SIZE, CMD.BOLD_OFF);
  push(txt('='.repeat(W)));
  push(CMD.ALIGN_LEFT);

  // Order info
  if (d.tokenNo) {
    push(CMD.BOLD_ON, CMD.DOUBLE_HEIGHT, CMD.ALIGN_CENTER);
    push(txt('Token: ' + d.tokenNo));
    push(CMD.NORMAL_SIZE, CMD.BOLD_OFF, CMD.ALIGN_LEFT);
  }
  if (d.tableNo) {
    push(CMD.BOLD_ON, CMD.DOUBLE_HEIGHT, CMD.ALIGN_CENTER);
    push(txt('Table: ' + d.tableNo));
    push(CMD.NORMAL_SIZE, CMD.BOLD_OFF, CMD.ALIGN_LEFT);
  }
  push(txt(d.date || new Date().toLocaleString()));
  if (d.cashierName) push(txt('By: ' + d.cashierName));
  if (d.categoryName) {
    push(CMD.ALIGN_CENTER, CMD.BOLD_ON);
    push(txt('[ ' + d.categoryName + ' ]'));
    push(CMD.BOLD_OFF, CMD.ALIGN_LEFT);
  }
  push(txt('-'.repeat(W)));

  // Items — large and clear
  for (const item of (d.items || [])) {
    push(CMD.BOLD_ON, CMD.DOUBLE_HEIGHT);
    push(txt(`${item.quantity}x  ${item.name}`));
    push(CMD.NORMAL_SIZE, CMD.BOLD_OFF);
    if (item.note) push(txt('   -> ' + item.note));
  }

  push(txt('='.repeat(W)));
  push(CMD.FEED_5);
  if (printerCfg.cut_paper !== false) push(CMD.CUT_PARTIAL);

  return Buffer.concat(bufs);
}

// ── Print methods ─────────────────────────────────────────────
function printNetwork(buf, ip, port) {
  return new Promise((resolve, reject) => {
    const socket  = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Printer at ${ip}:${port} not reachable (timeout 5s)`));
    }, 5000);

    socket.connect(port, ip, () => {
      socket.write(buf, (err) => {
        clearTimeout(timeout);
        socket.destroy();
        if (err) reject(err); else resolve();
      });
    });
    socket.on('error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

function printUSB(buf, comPort, baudRate) {
  return new Promise((resolve, reject) => {
    try {
      const { SerialPort } = require('serialport');
      const port = new SerialPort({ path: comPort, baudRate: baudRate || 9600 });
      port.on('open', () => {
        port.write(buf, (err) => {
          port.close();
          if (err) reject(err); else resolve();
        });
      });
      port.on('error', reject);
    } catch (e) {
      reject(new Error('serialport module not found. Run: npm install serialport'));
    }
  });
}

function printWindows(buf, printerName) {
  const os      = require('os');
  const tmpFile = path.join(os.tmpdir(), `abyte_${Date.now()}.bin`);
  fs.writeFileSync(tmpFile, buf);
  return new Promise((resolve, reject) => {
    exec(`copy /B "${tmpFile}" "\\\\localhost\\${printerName}"`, (err) => {
      fs.unlink(tmpFile, () => {});
      if (err) reject(new Error('Windows print failed: ' + err.message));
      else resolve();
    });
  });
}

async function sendToPrinter(printerCfg, buf) {
  switch (printerCfg.connection) {
    case 'network': return printNetwork(buf, printerCfg.ip, printerCfg.port || 9100);
    case 'usb':     return printUSB(buf, printerCfg.com, printerCfg.baud);
    case 'windows': return printWindows(buf, printerCfg.printer_name);
    default:        throw new Error(`Unknown connection type: "${printerCfg.connection}". Use network | usb | windows`);
  }
}

// ── Printer list helpers ──────────────────────────────────────
function getPrinters()           { return config.printers || []; }
function getPrinterById(id)      { return getPrinters().find(p => p.id === id) || null; }
function savePrinters(printers)  { config.printers = printers; saveConfig(); }

// ── Routes ────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  const printers = getPrinters();
  res.json({
    status:    'ok',
    version:   '2.0.0',
    printers:  printers.length,
    invoice:   printers.filter(p => p.type === 'invoice').length,
    kot:       printers.filter(p => p.type === 'kot').length,
  });
});

// List all printers
app.get('/printers', (req, res) => {
  res.json({ data: getPrinters() });
});

// Add printer
app.post('/printers', (req, res) => {
  const { name, type, connection, ip, port, com, baud, printer_name, paper_width, categories, cut_paper, open_drawer, is_master } = req.body;
  if (!name || !type || !connection) return res.status(400).json({ error: 'name, type, and connection are required' });
  if (!['invoice', 'kot'].includes(type)) return res.status(400).json({ error: 'type must be invoice or kot' });
  if (!['network', 'usb', 'windows'].includes(connection)) return res.status(400).json({ error: 'connection must be network | usb | windows' });

  const printer = {
    id:           crypto.randomUUID(),
    name,
    type,
    connection,
    ip:           ip || null,
    port:         port || 9100,
    com:          com || null,
    baud:         baud || 9600,
    printer_name: printer_name || null,
    paper_width:  paper_width || 80,
    categories:   type === 'kot' ? (categories || []) : [],
    is_master:    type === 'kot' ? (is_master || false) : false,
    cut_paper:    cut_paper !== false,
    open_drawer:  open_drawer || false,
  };

  const printers = getPrinters();
  printers.push(printer);
  savePrinters(printers);
  console.log(`[printers] Added: ${name} (${type}, ${connection})`);
  res.status(201).json({ success: true, printer });
});

// Update printer
app.put('/printers/:id', (req, res) => {
  const printers = getPrinters();
  const idx = printers.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Printer not found' });

  const { name, type, connection, ip, port, com, baud, printer_name, paper_width, categories, cut_paper, open_drawer, is_master } = req.body;
  printers[idx] = {
    ...printers[idx],
    name:         name         ?? printers[idx].name,
    type:         type         ?? printers[idx].type,
    connection:   connection   ?? printers[idx].connection,
    ip:           ip           !== undefined ? ip : printers[idx].ip,
    port:         port         ?? printers[idx].port,
    com:          com          !== undefined ? com : printers[idx].com,
    baud:         baud         ?? printers[idx].baud,
    printer_name: printer_name !== undefined ? printer_name : printers[idx].printer_name,
    paper_width:  paper_width  ?? printers[idx].paper_width,
    categories:   printers[idx].type === 'kot' ? (categories ?? printers[idx].categories) : [],
    is_master:    printers[idx].type === 'kot' ? (is_master  ?? printers[idx].is_master ?? false) : false,
    cut_paper:    cut_paper    !== undefined ? cut_paper : printers[idx].cut_paper,
    open_drawer:  open_drawer  !== undefined ? open_drawer : printers[idx].open_drawer,
  };
  savePrinters(printers);
  console.log(`[printers] Updated: ${printers[idx].name}`);
  res.json({ success: true, printer: printers[idx] });
});

// Delete printer
app.delete('/printers/:id', (req, res) => {
  const printers = getPrinters();
  const idx = printers.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Printer not found' });
  const [removed] = printers.splice(idx, 1);
  savePrinters(printers);
  console.log(`[printers] Deleted: ${removed.name}`);
  res.json({ success: true });
});

// Test specific printer
app.post('/printers/:id/test', async (req, res) => {
  const printer = getPrinterById(req.params.id);
  if (!printer) return res.status(404).json({ error: 'Printer not found' });

  try {
    let buf;
    if (printer.type === 'kot') {
      buf = buildKOTESCPOS({
        tokenNo:      'TEST',
        date:         new Date().toLocaleString(),
        cashierName:  'System',
        categoryName: printer.is_master ? 'XPR / Complete Order' : 'Section Test',
        items:        [{ name: 'Test Item', quantity: 2 }, { name: 'Another Item', quantity: 1 }],
      }, printer);
    } else {
      buf = buildInvoiceESCPOS({
        storeName:     'AByte POS',
        storeAddress:  'Printer Test',
        saleId:        1,
        invoiceNo:     'TEST-001',
        date:          new Date().toLocaleString(),
        cashierName:   'System',
        currencySymbol:'Rs.',
        items:         [{ name: 'Test Item', quantity: 1, price: 100 }],
        totalAmount:   100, amountPaid: 100, changeDue: 0,
        footer:        'Printer working!',
      }, printer);
    }

    await sendToPrinter(printer, buf);
    console.log(`[test] OK: ${printer.name}`);
    res.json({ success: true, message: `Test page sent to "${printer.name}"` });
  } catch (e) {
    console.error(`[test] FAIL: ${printer.name} —`, e.message);
    res.status(500).json({ error: e.message, printer: { name: printer.name, connection: printer.connection } });
  }
});

// Print invoice / receipt
app.post('/print/invoice', async (req, res) => {
  const { receiptData, printerId } = req.body;
  if (!receiptData) return res.status(400).json({ error: 'receiptData is required' });

  const printers = getPrinters().filter(p => p.type === 'invoice');
  if (printers.length === 0) return res.status(400).json({ error: 'No invoice printer configured. Add one in Printer settings.' });

  // Use specific printer if requested, else first configured
  const printer = printerId ? printers.find(p => p.id === printerId) || printers[0] : printers[0];

  try {
    const buf = buildInvoiceESCPOS(receiptData, printer);
    await sendToPrinter(printer, buf);
    console.log(`[print/invoice] OK — printer: ${printer.name}`);
    res.json({ success: true, printer: printer.name });
  } catch (e) {
    console.error('[print/invoice] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Print KOT — master (XPR) gets all items, section printers get their categories
app.post('/print/kot', async (req, res) => {
  const { kotData } = req.body;
  if (!kotData) return res.status(400).json({ error: 'kotData is required' });

  const allKOT = getPrinters().filter(p => p.type === 'kot');
  if (allKOT.length === 0) return res.status(400).json({ error: 'No KOT printer configured. Add one in Printer settings.' });

  const masterPrinters  = allKOT.filter(p => p.is_master);
  const sectionPrinters = allKOT.filter(p => !p.is_master);
  const items           = kotData.items || [];
  const results         = [];

  // ── 1. Master / XPR printers — receive COMPLETE order ────────────
  for (const printer of masterPrinters) {
    try {
      const buf = buildKOTESCPOS({ ...kotData, items, categoryName: 'Complete Order' }, printer);
      await sendToPrinter(printer, buf);
      results.push({ printer: printer.name, role: 'master', items: items.length, success: true });
      console.log(`[print/kot] MASTER OK — ${printer.name}: all ${items.length} items`);
    } catch (e) {
      results.push({ printer: printer.name, role: 'master', items: items.length, success: false, error: e.message });
      console.error(`[print/kot] MASTER FAIL — ${printer.name}:`, e.message);
    }
  }

  // ── 2. Section printers — routed by category ──────────────────────
  if (sectionPrinters.length > 0) {
    const printerJobs = new Map(); // printer.id → { printer, items }

    for (const item of items) {
      const catId = item.category_id ? Number(item.category_id) : null;

      // Find section printer that handles this category
      let matched = null;
      for (const p of sectionPrinters) {
        if (!p.categories || p.categories.length === 0) continue; // catch-all — prefer specific match first
        if (catId && p.categories.map(Number).includes(catId)) { matched = p; break; }
      }
      // Fallback: catch-all section printer (empty categories)
      if (!matched) {
        matched = sectionPrinters.find(p => !p.categories || p.categories.length === 0);
      }
      // Last resort: first section printer
      if (!matched) matched = sectionPrinters[0];

      if (!printerJobs.has(matched.id)) {
        printerJobs.set(matched.id, { printer: matched, items: [] });
      }
      printerJobs.get(matched.id).items.push(item);
    }

    for (const { printer, items: sectionItems } of printerJobs.values()) {
      // Derive section label from matched categories
      const catNames = [...new Set(sectionItems.map(i => i.category_name).filter(Boolean))];
      const label    = catNames.length > 0 ? catNames.join(' / ') : printer.name;
      try {
        const buf = buildKOTESCPOS({ ...kotData, items: sectionItems, categoryName: label }, printer);
        await sendToPrinter(printer, buf);
        results.push({ printer: printer.name, role: 'section', items: sectionItems.length, success: true });
        console.log(`[print/kot] SECTION OK — ${printer.name} [${label}]: ${sectionItems.length} items`);
      } catch (e) {
        results.push({ printer: printer.name, role: 'section', items: sectionItems.length, success: false, error: e.message });
        console.error(`[print/kot] SECTION FAIL — ${printer.name}:`, e.message);
      }
    }
  }

  const allOk = results.every(r => r.success);
  res.status(allOk ? 200 : 207).json({ success: allOk, results });
});

// ── Start ─────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
  const printers = getPrinters();
  console.log(`\n========================================`);
  console.log(`  AByte Printer Agent v2.0 — RUNNING`);
  console.log(`========================================`);
  console.log(`  URL       : http://localhost:${PORT}`);
  console.log(`  Printers  : ${printers.length} configured`);
  printers.forEach(p => {
    const target = p.connection === 'network' ? `${p.ip}:${p.port}` :
                   p.connection === 'usb'     ? p.com :
                                                p.printer_name || '(not set)';
    console.log(`    - [${p.type.toUpperCase()}] ${p.name} → ${target}`);
  });
  console.log(`  Config    : ${CONFIG_FILE}`);
  console.log(`========================================\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[ERROR] Port ${PORT} is already in use.`);
    console.error(`  Another instance of AByte Printer Agent may be running.`);
    console.error(`  Stop it: taskkill /F /IM node.exe  then run start.bat again.\n`);
  } else {
    console.error('[ERROR]', err.message);
  }
  process.exit(1);
});
