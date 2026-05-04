// =============================================================
// AByte Printer Agent v2.1
// Runs on cashier PC — bridges AByte POS web app to local printers
//
// Supports multiple printers per PC:
//   - Invoice printers  (receipts, invoices)
//   - KOT printers      (kitchen order tickets, category-routed)
//
// Connection types: network (TCP), usb (serial), windows (shared)
//
// Endpoints:
//   GET  /                      — Web UI dashboard
//   GET  /health                — liveness + printer summary
//   GET  /jobs                  — job log (last 500)
//   DELETE /jobs                — clear job log
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

const app     = express();
const PORT    = process.env.PORT || 3001;
const VERSION = '2.1.0';

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

// ── Job Log ───────────────────────────────────────────────────
const MAX_JOBS = 500;
let jobLog = [];

function addJob(job) {
  jobLog.unshift({ id: crypto.randomUUID(), ts: new Date().toISOString(), ...job });
  if (jobLog.length > MAX_JOBS) jobLog = jobLog.slice(0, MAX_JOBS);
}

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

// ── Web UI ────────────────────────────────────────────────────
function buildUI() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AByte Printer Agent</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:      #0f1117;
    --surface: #1a1d27;
    --border:  #2a2d3a;
    --text:    #e2e8f0;
    --muted:   #64748b;
    --green:   #22c55e;
    --red:     #ef4444;
    --amber:   #f59e0b;
    --blue:    #3b82f6;
    --purple:  #a855f7;
    --orange:  #f97316;
  }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; min-height: 100vh; }

  /* Header */
  .header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 14px 24px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 100; }
  .header-logo { width: 32px; height: 32px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; color: #fff; flex-shrink: 0; }
  .header-title { font-size: 16px; font-weight: 700; }
  .header-sub { font-size: 12px; color: var(--muted); }
  .header-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 8px var(--green); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:.5;} }
  .status-label { font-size: 12px; color: var(--green); font-weight: 600; }
  .version-badge { background: var(--border); color: var(--muted); font-size: 11px; padding: 2px 8px; border-radius: 20px; }

  /* Main layout */
  .main { max-width: 1100px; margin: 0 auto; padding: 24px; display: grid; gap: 20px; }

  /* Section */
  .section { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .section-header { padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); display: flex; align-items: center; gap: 8px; }
  .section-title span { font-size: 15px; }

  /* Stats row */
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--border); }
  .stat { background: var(--surface); padding: 16px 20px; }
  .stat-value { font-size: 28px; font-weight: 800; line-height: 1; }
  .stat-label { font-size: 11px; color: var(--muted); margin-top: 4px; text-transform: uppercase; letter-spacing: .4px; }
  .stat-value.green { color: var(--green); }
  .stat-value.red   { color: var(--red); }
  .stat-value.blue  { color: var(--blue); }
  .stat-value.amber { color: var(--amber); }

  /* Printers grid */
  .printers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; padding: 16px; }
  .printer-card { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
  .printer-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .printer-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
  .printer-icon.invoice { background: rgba(59,130,246,.15); }
  .printer-icon.kot     { background: rgba(249,115,22,.15); }
  .printer-name { font-weight: 700; font-size: 14px; }
  .printer-meta { font-size: 11px; color: var(--muted); margin-top: 1px; }
  .printer-badges { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
  .badge { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .badge.invoice { background: rgba(59,130,246,.15); color: #93c5fd; }
  .badge.kot     { background: rgba(249,115,22,.15); color: #fdba74; }
  .badge.network { background: rgba(34,197,94,.12); color: #86efac; }
  .badge.usb     { background: rgba(168,85,247,.12); color: #d8b4fe; }
  .badge.windows { background: rgba(245,158,11,.12); color: #fcd34d; }
  .badge.master  { background: rgba(239,68,68,.12); color: #fca5a5; }
  .no-printers   { padding: 32px; text-align: center; color: var(--muted); }

  /* Jobs table */
  .jobs-toolbar { display: flex; align-items: center; gap: 10px; }
  .filter-group { display: flex; gap: 6px; }
  .filter-btn { background: transparent; border: 1px solid var(--border); color: var(--muted); font-size: 12px; padding: 4px 12px; border-radius: 20px; cursor: pointer; transition: all .15s; }
  .filter-btn:hover { border-color: var(--blue); color: var(--text); }
  .filter-btn.active { background: var(--blue); border-color: var(--blue); color: #fff; }
  .clear-btn { background: transparent; border: 1px solid var(--border); color: var(--red); font-size: 12px; padding: 4px 12px; border-radius: 20px; cursor: pointer; transition: all .15s; margin-left: auto; }
  .clear-btn:hover { background: rgba(239,68,68,.1); border-color: var(--red); }
  .refresh-indicator { font-size: 11px; color: var(--muted); }

  .jobs-table { width: 100%; border-collapse: collapse; }
  .jobs-table th { text-align: left; padding: 10px 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; color: var(--muted); border-bottom: 1px solid var(--border); }
  .jobs-table td { padding: 10px 20px; border-bottom: 1px solid rgba(42,45,58,.6); vertical-align: top; }
  .jobs-table tr:last-child td { border-bottom: none; }
  .jobs-table tr:hover td { background: rgba(255,255,255,.02); }
  .job-type { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }
  .job-type.invoice { background: rgba(59,130,246,.15); color: #93c5fd; }
  .job-type.kot     { background: rgba(249,115,22,.15); color: #fdba74; }
  .job-type.test    { background: rgba(168,85,247,.12); color: #d8b4fe; }
  .status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .status-pill.success { background: rgba(34,197,94,.12); color: #86efac; }
  .status-pill.failed  { background: rgba(239,68,68,.12); color: #fca5a5; }
  .status-pill.partial { background: rgba(245,158,11,.12); color: #fcd34d; }
  .job-printer { font-size: 13px; font-weight: 500; }
  .job-detail  { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .job-error   { font-size: 11px; color: var(--red); margin-top: 3px; font-family: monospace; }
  .job-time    { font-size: 12px; color: var(--muted); white-space: nowrap; }
  .job-sub-results { margin-top: 6px; display: grid; gap: 3px; }
  .sub-result { font-size: 11px; padding: 2px 0; display: flex; align-items: center; gap: 6px; }
  .dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .dot.ok  { background: var(--green); }
  .dot.err { background: var(--red); }
  .no-jobs { padding: 48px; text-align: center; color: var(--muted); }
  .no-jobs-icon { font-size: 40px; margin-bottom: 12px; }

  /* Auto-refresh toggle */
  .toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
  .toggle input { display: none; }
  .toggle-track { width: 32px; height: 18px; background: var(--border); border-radius: 9px; position: relative; transition: background .2s; }
  .toggle input:checked + .toggle-track { background: var(--blue); }
  .toggle-thumb { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; background: #fff; border-radius: 50%; transition: transform .2s; }
  .toggle input:checked ~ .toggle-track .toggle-thumb { transform: translateX(14px); }
  .toggle-label { font-size: 12px; color: var(--muted); }

  @media (max-width: 640px) {
    .stats { grid-template-columns: repeat(2,1fr); }
    .main  { padding: 16px; }
    .jobs-table th:nth-child(4), .jobs-table td:nth-child(4) { display: none; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-logo">A</div>
  <div>
    <div class="header-title">AByte Printer Agent</div>
    <div class="header-sub">Local thermal printer bridge</div>
  </div>
  <div class="header-right">
    <div style="display:flex;align-items:center;gap:6px;">
      <div class="status-dot"></div>
      <span class="status-label">RUNNING</span>
    </div>
    <span class="version-badge">v${VERSION}</span>
  </div>
</div>

<div class="main">

  <!-- Stats -->
  <div class="section">
    <div class="stats" id="stats">
      <div class="stat"><div class="stat-value blue" id="st-printers">-</div><div class="stat-label">Printers</div></div>
      <div class="stat"><div class="stat-value" id="st-total">-</div><div class="stat-label">Total Jobs</div></div>
      <div class="stat"><div class="stat-value green" id="st-success">-</div><div class="stat-label">Succeeded</div></div>
      <div class="stat"><div class="stat-value red" id="st-failed">-</div><div class="stat-label">Failed</div></div>
    </div>
  </div>

  <!-- Printers -->
  <div class="section">
    <div class="section-header">
      <div class="section-title"><span>🖨️</span> Configured Printers</div>
    </div>
    <div id="printers-container"></div>
  </div>

  <!-- Jobs -->
  <div class="section">
    <div class="section-header">
      <div class="section-title"><span>📋</span> Print Jobs</div>
      <div class="jobs-toolbar">
        <div class="filter-group">
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="invoice">Invoice</button>
          <button class="filter-btn" data-filter="kot">KOT</button>
          <button class="filter-btn" data-filter="test">Test</button>
          <button class="filter-btn" data-filter="failed">Failed</button>
        </div>
        <label class="toggle" title="Auto-refresh every 3s">
          <input type="checkbox" id="auto-refresh" checked>
          <div class="toggle-track"><div class="toggle-thumb"></div></div>
          <span class="toggle-label">Auto</span>
        </label>
        <span class="refresh-indicator" id="refresh-indicator"></span>
        <button class="clear-btn" id="clear-jobs-btn">🗑 Clear</button>
      </div>
    </div>
    <div id="jobs-container"></div>
  </div>

</div>

<script>
  let allJobs = [];
  let activeFilter = 'all';
  let refreshTimer = null;
  let lastRefresh = null;

  // ── Fetch & Render ─────────────────────────────────────────
  async function fetchData() {
    try {
      const [healthRes, jobsRes] = await Promise.all([
        fetch('/health'),
        fetch('/jobs'),
      ]);
      const health = await healthRes.json();
      const jobs   = await jobsRes.json();

      allJobs = jobs.jobs || [];
      renderStats(health, jobs.stats);
      renderPrinters(health.printerList || []);
      renderJobs();
      lastRefresh = new Date();
      document.getElementById('refresh-indicator').textContent = 'Updated ' + lastRefresh.toLocaleTimeString();
    } catch(e) {
      document.getElementById('refresh-indicator').textContent = 'Fetch error';
    }
  }

  function renderStats(health, stats) {
    document.getElementById('st-printers').textContent = health.printers ?? '-';
    document.getElementById('st-total').textContent    = stats?.total   ?? allJobs.length;
    document.getElementById('st-success').textContent  = stats?.success ?? '-';
    document.getElementById('st-failed').textContent   = stats?.failed  ?? '-';
  }

  function renderPrinters(printers) {
    const c = document.getElementById('printers-container');
    if (!printers.length) {
      c.innerHTML = '<div class="no-printers">No printers configured. Add printers via the API or AByte POS Settings.</div>';
      return;
    }
    const cards = printers.map(p => {
      const target = p.connection === 'network' ? p.ip + ':' + (p.port || 9100) :
                     p.connection === 'usb'     ? (p.com || 'COM?') : (p.printer_name || '?');
      const icon   = p.type === 'kot' ? '🍽️' : '🧾';
      return \`<div class="printer-card">
        <div class="printer-card-header">
          <div class="printer-icon \${p.type}">\${icon}</div>
          <div>
            <div class="printer-name">\${esc(p.name)}</div>
            <div class="printer-meta">\${esc(target)}</div>
          </div>
        </div>
        <div class="printer-badges">
          <span class="badge \${p.type}">\${p.type.toUpperCase()}</span>
          <span class="badge \${p.connection}">\${p.connection.toUpperCase()}</span>
          \${p.is_master ? '<span class="badge master">MASTER</span>' : ''}
          \${(p.categories||[]).length ? '<span class="badge" style="background:rgba(100,116,139,.15);color:#94a3b8;">' + p.categories.length + ' cats</span>' : ''}
        </div>
      </div>\`;
    }).join('');
    c.innerHTML = '<div class="printers-grid">' + cards + '</div>';
  }

  function renderJobs() {
    const c = document.getElementById('jobs-container');
    const filtered = activeFilter === 'all'    ? allJobs :
                     activeFilter === 'failed' ? allJobs.filter(j => j.status === 'failed' || j.status === 'partial') :
                     allJobs.filter(j => j.type === activeFilter);

    if (!filtered.length) {
      c.innerHTML = '<div class="no-jobs"><div class="no-jobs-icon">📭</div><div>No ' + (activeFilter === 'all' ? '' : activeFilter + ' ') + 'jobs yet</div></div>';
      return;
    }

    const rows = filtered.map(j => {
      const timeAgo = formatAgo(j.ts);
      const fullTime = new Date(j.ts).toLocaleString();

      // Sub-results for KOT multi-printer
      let subHtml = '';
      if (j.results && j.results.length > 1) {
        subHtml = '<div class="job-sub-results">' + j.results.map(r =>
          \`<div class="sub-result"><div class="dot \${r.success ? 'ok' : 'err'}"></div><span style="color:var(--muted)">\${esc(r.printer)}</span>\${r.role ? ' <span style="font-size:10px;opacity:.6">(\${r.role})</span>' : ''}\${r.items ? ' · \${r.items} items' : ''}\${!r.success && r.error ? ' — <span style="color:var(--red)">\${esc(r.error)}</span>' : ''}</div>\`
        ).join('') + '</div>';
      }

      // Error
      const errHtml = j.error ? \`<div class="job-error">⚠ \${esc(j.error)}</div>\` : '';

      // Detail line
      const details = [];
      if (j.invoiceNo) details.push('Invoice: ' + j.invoiceNo);
      if (j.tokenNo)   details.push('Token: ' + j.tokenNo);
      if (j.items != null) details.push(j.items + ' items');
      if (j.printerCount > 1) details.push(j.printerCount + ' printers');
      const detailHtml = details.length ? \`<div class="job-detail">\${esc(details.join(' · '))}</div>\` : '';

      const statusClass = j.status === 'success' ? 'success' : j.status === 'partial' ? 'partial' : 'failed';
      const statusLabel = j.status === 'success' ? '✓ Success' : j.status === 'partial' ? '⚡ Partial' : '✗ Failed';

      return \`<tr>
        <td><span class="job-type \${j.type}">\${j.type.toUpperCase()}</span></td>
        <td>
          <div class="job-printer">\${esc(j.printer || '—')}</div>
          \${detailHtml}
          \${errHtml}
          \${subHtml}
        </td>
        <td><span class="status-pill \${statusClass}">\${statusLabel}</span></td>
        <td><span class="job-time" title="\${fullTime}">\${timeAgo}</span></td>
      </tr>\`;
    }).join('');

    c.innerHTML = \`<table class="jobs-table">
      <thead><tr>
        <th style="width:90px">Type</th>
        <th>Printer / Detail</th>
        <th style="width:110px">Status</th>
        <th style="width:100px">Time</th>
      </tr></thead>
      <tbody>\${rows}</tbody>
    </table>\`;
  }

  function formatAgo(ts) {
    const diff = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (diff < 5)   return 'just now';
    if (diff < 60)  return diff + 's ago';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    return new Date(ts).toLocaleTimeString();
  }

  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Filter buttons ─────────────────────────────────────────
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderJobs();
    });
  });

  // ── Clear jobs ─────────────────────────────────────────────
  document.getElementById('clear-jobs-btn').addEventListener('click', async () => {
    if (!confirm('Clear all job logs?')) return;
    await fetch('/jobs', { method: 'DELETE' });
    await fetchData();
  });

  // ── Auto refresh ───────────────────────────────────────────
  function startRefresh() {
    stopRefresh();
    refreshTimer = setInterval(fetchData, 3000);
  }
  function stopRefresh() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  }

  document.getElementById('auto-refresh').addEventListener('change', function() {
    this.checked ? startRefresh() : stopRefresh();
  });

  // ── Init ───────────────────────────────────────────────────
  fetchData();
  startRefresh();
</script>
</body>
</html>`;
}

// ── Routes ────────────────────────────────────────────────────

// Web UI
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(buildUI());
});

// Health check
app.get('/health', (req, res) => {
  const printers = getPrinters();
  const stats = {
    total:   jobLog.length,
    success: jobLog.filter(j => j.status === 'success').length,
    failed:  jobLog.filter(j => j.status === 'failed' || j.status === 'partial').length,
  };
  res.json({
    status:      'ok',
    version:     VERSION,
    printers:    printers.length,
    invoice:     printers.filter(p => p.type === 'invoice').length,
    kot:         printers.filter(p => p.type === 'kot').length,
    printerList: printers,
    jobStats:    stats,
  });
});

// Job log
app.get('/jobs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 200, MAX_JOBS);
  const type  = req.query.type;
  const jobs  = type ? jobLog.filter(j => j.type === type) : jobLog;
  res.json({
    jobs: jobs.slice(0, limit),
    stats: {
      total:   jobLog.length,
      success: jobLog.filter(j => j.status === 'success').length,
      failed:  jobLog.filter(j => j.status === 'failed').length,
      partial: jobLog.filter(j => j.status === 'partial').length,
    },
  });
});

app.delete('/jobs', (req, res) => {
  jobLog = [];
  console.log('[jobs] Log cleared');
  res.json({ success: true, message: 'Job log cleared' });
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

  const started = Date.now();
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
    const ms = Date.now() - started;

    addJob({
      type:    'test',
      printer: printer.name,
      status:  'success',
      items:   null,
      durationMs: ms,
    });

    console.log(`[test] OK: ${printer.name} (${ms}ms)`);
    res.json({ success: true, message: `Test page sent to "${printer.name}"` });
  } catch (e) {
    const ms = Date.now() - started;
    addJob({
      type:    'test',
      printer: printer.name,
      status:  'failed',
      error:   e.message,
      durationMs: ms,
    });
    console.error(`[test] FAIL: ${printer.name} (${ms}ms) —`, e.message);
    res.status(500).json({ error: e.message, printer: { name: printer.name, connection: printer.connection } });
  }
});

// Print invoice / receipt
app.post('/print/invoice', async (req, res) => {
  const { receiptData, printerId } = req.body;
  if (!receiptData) return res.status(400).json({ error: 'receiptData is required' });

  const printers = getPrinters().filter(p => p.type === 'invoice');
  if (printers.length === 0) {
    addJob({ type: 'invoice', printer: '(none)', status: 'failed', error: 'No invoice printer configured' });
    return res.status(400).json({ error: 'No invoice printer configured. Add one in Printer settings.' });
  }

  const printer = printerId ? printers.find(p => p.id === printerId) || printers[0] : printers[0];
  const started = Date.now();

  try {
    const buf = buildInvoiceESCPOS(receiptData, printer);
    await sendToPrinter(printer, buf);
    const ms = Date.now() - started;

    addJob({
      type:       'invoice',
      printer:    printer.name,
      status:     'success',
      invoiceNo:  receiptData.invoiceNo || null,
      tokenNo:    receiptData.tokenNo   || null,
      items:      (receiptData.items || []).length,
      durationMs: ms,
    });

    console.log(`[print/invoice] OK — ${printer.name} (${ms}ms)`);
    res.json({ success: true, printer: printer.name });
  } catch (e) {
    const ms = Date.now() - started;
    addJob({
      type:       'invoice',
      printer:    printer.name,
      status:     'failed',
      invoiceNo:  receiptData.invoiceNo || null,
      tokenNo:    receiptData.tokenNo   || null,
      items:      (receiptData.items || []).length,
      error:      e.message,
      durationMs: ms,
    });
    console.error(`[print/invoice] FAIL — ${printer.name} (${ms}ms):`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// Print KOT — master (XPR) gets all items, section printers get their categories
app.post('/print/kot', async (req, res) => {
  const { kotData } = req.body;
  if (!kotData) return res.status(400).json({ error: 'kotData is required' });

  const allKOT = getPrinters().filter(p => p.type === 'kot');
  if (allKOT.length === 0) {
    addJob({ type: 'kot', printer: '(none)', status: 'failed', error: 'No KOT printer configured' });
    return res.status(400).json({ error: 'No KOT printer configured. Add one in Printer settings.' });
  }

  const masterPrinters  = allKOT.filter(p => p.is_master);
  const sectionPrinters = allKOT.filter(p => !p.is_master);
  const items           = kotData.items || [];
  const results         = [];
  const started         = Date.now();

  // ── 1. Master / XPR printers — receive COMPLETE order ────────────
  for (const printer of masterPrinters) {
    const t0 = Date.now();
    try {
      const buf = buildKOTESCPOS({ ...kotData, items, categoryName: 'Complete Order' }, printer);
      await sendToPrinter(printer, buf);
      results.push({ printer: printer.name, role: 'master', items: items.length, success: true, durationMs: Date.now()-t0 });
      console.log(`[print/kot] MASTER OK — ${printer.name}: all ${items.length} items (${Date.now()-t0}ms)`);
    } catch (e) {
      results.push({ printer: printer.name, role: 'master', items: items.length, success: false, error: e.message, durationMs: Date.now()-t0 });
      console.error(`[print/kot] MASTER FAIL — ${printer.name}:`, e.message);
    }
  }

  // ── 2. Section printers — routed by category ──────────────────────
  if (sectionPrinters.length > 0) {
    const printerJobs = new Map();

    for (const item of items) {
      const catId = item.category_id ? Number(item.category_id) : null;

      let matched = null;
      for (const p of sectionPrinters) {
        if (!p.categories || p.categories.length === 0) continue;
        if (catId && p.categories.map(Number).includes(catId)) { matched = p; break; }
      }
      if (!matched) matched = sectionPrinters.find(p => !p.categories || p.categories.length === 0);
      if (!matched) matched = sectionPrinters[0];

      if (!printerJobs.has(matched.id)) printerJobs.set(matched.id, { printer: matched, items: [] });
      printerJobs.get(matched.id).items.push(item);
    }

    for (const { printer, items: sectionItems } of printerJobs.values()) {
      const catNames = [...new Set(sectionItems.map(i => i.category_name).filter(Boolean))];
      const label    = catNames.length > 0 ? catNames.join(' / ') : printer.name;
      const t0 = Date.now();
      try {
        const buf = buildKOTESCPOS({ ...kotData, items: sectionItems, categoryName: label }, printer);
        await sendToPrinter(printer, buf);
        results.push({ printer: printer.name, role: 'section', items: sectionItems.length, success: true, durationMs: Date.now()-t0 });
        console.log(`[print/kot] SECTION OK — ${printer.name} [${label}]: ${sectionItems.length} items (${Date.now()-t0}ms)`);
      } catch (e) {
        results.push({ printer: printer.name, role: 'section', items: sectionItems.length, success: false, error: e.message, durationMs: Date.now()-t0 });
        console.error(`[print/kot] SECTION FAIL — ${printer.name}:`, e.message);
      }
    }
  }

  const allOk    = results.every(r => r.success);
  const anyOk    = results.some(r => r.success);
  const jobStatus = allOk ? 'success' : anyOk ? 'partial' : 'failed';
  const ms        = Date.now() - started;

  // Single printer → simple log; multiple → show all
  const printerLabel = results.length === 1 ? results[0].printer : `${results.length} printers`;
  const firstError   = results.find(r => !r.success)?.error || null;

  addJob({
    type:         'kot',
    printer:      printerLabel,
    status:       jobStatus,
    tokenNo:      kotData.tokenNo || null,
    tableNo:      kotData.tableNo || null,
    items:        items.length,
    printerCount: results.length,
    results,
    error:        firstError,
    durationMs:   ms,
  });

  res.status(allOk ? 200 : 207).json({ success: allOk, results });
});

// ── Start ─────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
  const printers = getPrinters();
  console.log(`\n========================================`);
  console.log(`  AByte Printer Agent v${VERSION} — RUNNING`);
  console.log(`========================================`);
  console.log(`  URL       : http://localhost:${PORT}`);
  console.log(`  UI        : http://localhost:${PORT}/`);
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
