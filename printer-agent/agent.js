// =============================================================
// AByte Printer Agent v1.1
// Runs on cashier PC — bridges AByte POS web app to local printer
//
// Supports:
//   - Network thermal printers (TCP/IP, port 9100)
//   - USB/Serial printers (COM port)
//   - Windows shared printers
//
// Endpoints:
//   GET  /health        — liveness + printer info
//   GET  /config        — show current config
//   POST /config        — update config (saves to config.json)
//   GET  /printers      — list COM ports + Windows printers
//   POST /print         — print a receipt
//   POST /test          — print a test page
//   GET  /test          — friendly usage message
// =============================================================

const express  = require('express');
const cors     = require('cors');
const net      = require('net');
const fs       = require('fs');
const path     = require('path');
const { exec } = require('child_process');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Config ────────────────────────────────────────────────────
const CONFIG_FILE = path.join(__dirname, 'config.json');

const DEFAULT_CONFIG = {
  printer_type:         'network',
  printer_ip:           '192.168.1.100',
  printer_port:         9100,
  printer_com:          'COM3',
  printer_baud:         9600,
  windows_printer_name: '',
  paper_width:          32,
  cut_paper:            true,
  open_drawer:          false,
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    }
  } catch (e) {
    console.warn('Config read error:', e.message, '— using defaults');
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.error('Config save error:', e.message);
  }
}

let config = loadConfig();
console.log(`  Config loaded: ${CONFIG_FILE}`);

// Live reload config.json when file changes on disk
fs.watch(CONFIG_FILE, (event) => {
  if (event === 'change') {
    const fresh = loadConfig();
    config = fresh;
    console.log(`[config] Reloaded — printer: ${config.printer_type} ${config.printer_type === 'network' ? config.printer_ip + ':' + config.printer_port : config.printer_com}`);
  }
});

// ── Middleware ─────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// ── ESC/POS Commands ──────────────────────────────────────────
const ESC = 0x1B;
const GS  = 0x1D;

const CMD = {
  INIT:          Buffer.from([ESC, 0x40]),
  ALIGN_CENTER:  Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_LEFT:    Buffer.from([ESC, 0x61, 0x00]),
  BOLD_ON:       Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF:      Buffer.from([ESC, 0x45, 0x00]),
  DOUBLE_HEIGHT: Buffer.from([ESC, 0x21, 0x10]),
  NORMAL_SIZE:   Buffer.from([ESC, 0x21, 0x00]),
  CUT_PARTIAL:   Buffer.from([GS,  0x56, 0x41, 0x05]),
  CUT_FULL:      Buffer.from([GS,  0x56, 0x00]),
  OPEN_DRAWER:   Buffer.from([ESC, 0x70, 0x00, 0x19, 0xFA]),
  FEED_3:        Buffer.from([ESC, 0x64, 0x03]),
};

function buildESCPOS(d, cfg) {
  const W      = cfg.paper_width || 32;
  const buffers = [];

  const push   = (...bufs) => bufs.forEach(b => buffers.push(b));
  const line   = (s) => Buffer.from(String(s).substring(0, W * 2) + '\n', 'utf8');
  const dashes = '-'.repeat(W);
  const equals = '='.repeat(W);

  const center = (s) => {
    s = String(s).substring(0, W);
    const pad = Math.floor((W - s.length) / 2);
    return ' '.repeat(Math.max(0, pad)) + s;
  };
  const split  = (l, r) => {
    l = String(l); r = String(r);
    const gap = W - l.length - r.length;
    if (gap > 0) return l + ' '.repeat(gap) + r;
    return l.substring(0, W - r.length - 1) + ' ' + r;
  };
  const padR   = (s, n) => String(s).substring(0, n).padEnd(n);
  const padL   = (s, n) => String(s).substring(0, n).padStart(n);

  push(CMD.INIT);

  // Store header
  push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_HEIGHT);
  push(line((d.storeName || 'Store').toUpperCase()));
  push(CMD.NORMAL_SIZE, CMD.BOLD_OFF);
  if (d.storeAddress) push(line(d.storeAddress));
  if (d.storePhone)   push(line('Tel: ' + d.storePhone));
  push(CMD.ALIGN_LEFT, line(dashes));

  // Meta
  push(CMD.BOLD_ON);
  push(line(d.invoiceNo ? split('Invoice:', d.invoiceNo) : split('Receipt #:', String(d.saleId))));
  push(CMD.BOLD_OFF);
  if (d.tokenNo) {
    push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_HEIGHT);
    push(line('Token: ' + d.tokenNo));
    push(CMD.NORMAL_SIZE, CMD.BOLD_OFF, CMD.ALIGN_LEFT);
  }
  push(line(split('Date:', d.date)));
  push(line(split('Cashier:', d.cashierName || '')));
  if (d.customerName) push(line(split('Customer:', d.customerName)));
  push(line(dashes));

  // Items
  const nameW = W - 16;
  push(CMD.BOLD_ON);
  push(line(padR('Item', nameW) + padR('Qty', 5) + padL('Price', 11)));
  push(CMD.BOLD_OFF);
  push(line(dashes));

  for (const item of (d.items || [])) {
    const cs    = d.currencySymbol || 'Rs.';
    const name  = padR(item.name, nameW);
    const qty   = padR(item.quantity, 5);
    const price = padL(cs + Number(item.price).toFixed(2), 11);
    push(line(name + qty + price));
  }
  push(line(dashes));

  // Totals
  const cs = d.currencySymbol || 'Rs.';
  if (Number(d.discount)      > 0) push(line(split('Discount:',            `-${cs}${Number(d.discount).toFixed(2)}`)));
  if (Number(d.taxAmount)     > 0) push(line(split(`Tax (${d.taxPercent}%):`, `${cs}${Number(d.taxAmount).toFixed(2)}`)));
  if (Number(d.chargesAmount) > 0) push(line(split('Charges:',             `${cs}${Number(d.chargesAmount).toFixed(2)}`)));
  push(line(equals));
  push(CMD.BOLD_ON, CMD.DOUBLE_HEIGHT);
  push(line(split('TOTAL:', `${cs}${Number(d.totalAmount).toFixed(2)}`)));
  push(CMD.NORMAL_SIZE, CMD.BOLD_OFF);
  push(line(equals));
  push(line(split(`Paid (${d.paymentMethod || 'cash'}):`, `${cs}${Number(d.amountPaid).toFixed(2)}`)));
  if (Number(d.changeDue) > 0) push(line(split('Change Due:', `${cs}${Number(d.changeDue).toFixed(2)}`)));
  push(line(dashes));

  // Footer
  push(CMD.ALIGN_CENTER);
  push(line(d.footer || 'Thank you!'));
  push(CMD.ALIGN_LEFT);
  push(CMD.FEED_3);
  if (cfg.cut_paper)    push(CMD.CUT_PARTIAL);
  if (cfg.open_drawer)  push(CMD.OPEN_DRAWER);

  return Buffer.concat(buffers);
}

// ── Print methods ─────────────────────────────────────────────
function printNetwork(buf, ip, port) {
  return new Promise((resolve, reject) => {
    const socket  = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Printer at ${ip}:${port} not reachable (timeout 5s). Check IP and port.`));
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
  return new Promise((resolve, reject) => {
    const os      = require('os');
    const tmpFile = path.join(os.tmpdir(), `abyte_${Date.now()}.bin`);
    fs.writeFileSync(tmpFile, buf);
    exec(`copy /B "${tmpFile}" "\\\\localhost\\${printerName}"`, (err) => {
      fs.unlink(tmpFile, () => {});
      if (err) reject(new Error('Windows print failed: ' + err.message));
      else resolve();
    });
  });
}

async function doPrint(cfg, buf) {
  switch (cfg.printer_type) {
    case 'network': return printNetwork(buf, cfg.printer_ip, cfg.printer_port || 9100);
    case 'usb':     return printUSB(buf, cfg.printer_com, cfg.printer_baud);
    case 'windows': return printWindows(buf, cfg.windows_printer_name);
    default:        throw new Error(`Unknown printer_type: "${cfg.printer_type}". Use network | usb | windows`);
  }
}

// ── Routes ────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({
    status:          'ok',
    version:         '1.1.0',
    printer_type:    config.printer_type,
    printer_target:  config.printer_type === 'network'
      ? `${config.printer_ip}:${config.printer_port}`
      : config.printer_type === 'usb'
      ? config.printer_com
      : config.windows_printer_name || '(not set)',
    config_file:     CONFIG_FILE,
  });
});

app.get('/config',  (req, res) => res.json(config));

app.post('/config', (req, res) => {
  config = { ...config, ...req.body };
  saveConfig(config);
  console.log('[config] Updated via API:', req.body);
  res.json({ success: true, config });
});

app.get('/printers', async (req, res) => {
  const result = { com_ports: [], windows_printers: [] };
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    result.com_ports = ports.map(p => ({ path: p.path, manufacturer: p.manufacturer || '' }));
  } catch { /* serialport not installed */ }

  exec('wmic printer get name /format:list', (err, stdout) => {
    if (!err) {
      result.windows_printers = stdout
        .split('\n')
        .map(l => l.replace('Name=', '').trim())
        .filter(Boolean);
    }
    res.json(result);
  });
});

app.get('/test', (req, res) => {
  res.json({
    message: 'Use POST /test to send a test print. GET is not supported for printing.',
    example: 'Invoke-RestMethod -Method POST -Uri http://localhost:3001/test',
    current_config: {
      printer_type:   config.printer_type,
      printer_target: config.printer_type === 'network'
        ? `${config.printer_ip}:${config.printer_port}`
        : config.printer_com,
    },
  });
});

app.post('/test', async (req, res) => {
  const testData = {
    storeName:     'AByte POS',
    storeAddress:  'Printer Test Page',
    storePhone:    '',
    saleId:        1,
    invoiceNo:     'TEST-001',
    date:          new Date().toLocaleString(),
    cashierName:   'System',
    currencySymbol:'Rs.',
    items:         [{ name: 'Test Item', quantity: 1, price: 100 }],
    subtotal:      100, discount: 0, taxAmount: 0, taxPercent: 0,
    chargesAmount: 0,   totalAmount: 100, amountPaid: 100, changeDue: 0,
    paymentMethod: 'cash',
    footer:        'Printer working correctly!',
  };
  try {
    const buf = buildESCPOS(testData, config);
    await doPrint(config, buf);
    console.log('[test] Test print successful');
    res.json({ success: true, message: 'Test page sent to printer' });
  } catch (e) {
    console.error('[test] Failed:', e.message);
    res.status(500).json({ error: e.message, config: { printer_type: config.printer_type, printer_ip: config.printer_ip } });
  }
});

app.post('/print', async (req, res) => {
  const { receiptData, overrideConfig } = req.body;
  if (!receiptData) return res.status(400).json({ error: 'receiptData is required' });

  const printCfg = overrideConfig ? { ...config, ...overrideConfig } : config;
  try {
    const buf = buildESCPOS(receiptData, printCfg);
    await doPrint(printCfg, buf);
    res.json({ success: true, method: printCfg.printer_type });
  } catch (e) {
    console.error('[print] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Start ─────────────────────────────────────────────────────
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n========================================`);
  console.log(`  AByte Printer Agent v1.1 — RUNNING`);
  console.log(`========================================`);
  console.log(`  URL     : http://localhost:${PORT}`);
  console.log(`  Printer : ${config.printer_type.toUpperCase()} — ${
    config.printer_type === 'network' ? config.printer_ip + ':' + config.printer_port :
    config.printer_type === 'usb'     ? config.printer_com :
                                        config.windows_printer_name || '(not set)'
  }`);
  console.log(`  Config  : ${CONFIG_FILE}`);
  console.log(`----------------------------------------`);
  console.log(`  Edit config.json to change printer.`);
  console.log(`  Changes apply instantly (no restart).`);
  console.log(`========================================\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[ERROR] Port ${PORT} is already in use.`);
    console.error(`  Another instance of AByte Printer Agent is already running.`);
    console.error(`  To stop it: taskkill /F /IM node.exe`);
    console.error(`  Then run start.bat again.\n`);
  } else {
    console.error('[ERROR]', err.message);
  }
  process.exit(1);
});
