// =============================================================
// AByte Printer Agent v1.0
// Runs on cashier PC — bridges AByte POS web app to local printer
//
// Supports:
//   - USB/Serial thermal printers (via COM port, e.g. COM3)
//   - Network thermal printers (via IP:9100 TCP socket)
//   - Windows shared printers (via Powershell / print command)
//
// Endpoints:
//   GET  /health  — liveness check (browser polls this)
//   GET  /printers — list available COM ports
//   POST /print   — print a receipt
//   POST /config  — update printer config at runtime
// =============================================================

const express = require('express');
const cors    = require('cors');
const net     = require('net');
const fs      = require('fs');
const path    = require('path');
const { exec } = require('child_process');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Config file (persisted to disk) ───────────────────────────
const CONFIG_FILE = path.join(
  process.env.APPDATA || path.dirname(process.execPath),
  'ABytePrinterAgent',
  'config.json'
);

const DEFAULT_CONFIG = {
  printer_type: 'network',   // 'network' | 'usb' | 'windows'
  printer_ip:   '192.168.1.100',
  printer_port: 9100,
  printer_com:  'COM3',      // for USB/Serial
  printer_baud: 9600,
  windows_printer_name: '',  // exact name from Windows "Devices & Printers"
  paper_width:  32,          // chars per line (80mm = 32, 58mm = 24)
  cut_paper:    true,
  open_drawer:  false,
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    }
  } catch { /* use defaults */ }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(cfg) {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.error('Failed to save config:', e.message);
  }
}

let config = loadConfig();

// ── Middleware ─────────────────────────────────────────────────
app.use(cors({ origin: '*' }));  // allow any origin (only localhost anyway)
app.use(express.json({ limit: '1mb' }));

// ── ESC/POS Builder ───────────────────────────────────────────

const ESC = 0x1B;
const GS  = 0x1D;

const CMD = {
  INIT:         Buffer.from([ESC, 0x40]),
  ALIGN_CENTER: Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_LEFT:   Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_RIGHT:  Buffer.from([ESC, 0x61, 0x02]),
  BOLD_ON:      Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF:     Buffer.from([ESC, 0x45, 0x00]),
  DOUBLE_HEIGHT:Buffer.from([ESC, 0x21, 0x10]),
  NORMAL_SIZE:  Buffer.from([ESC, 0x21, 0x00]),
  CUT_FULL:     Buffer.from([GS,  0x56, 0x00]),
  CUT_PARTIAL:  Buffer.from([GS,  0x56, 0x41, 0x05]),
  OPEN_DRAWER:  Buffer.from([ESC, 0x70, 0x00, 0x19, 0xFA]),
  FEED_3:       Buffer.from([ESC, 0x64, 0x03]),
  LF:           Buffer.from([0x0A]),
};

function buildESCPOS(d, cfg) {
  const W = cfg.paper_width || 32;
  const buffers = [];

  const push  = (...bufs) => bufs.forEach(b => buffers.push(b));
  const text  = (s) => Buffer.from(s + '\n', 'utf8');
  const dashes = '-'.repeat(W);
  const equals = '='.repeat(W);

  const center = (s) => {
    if (s.length >= W) return s.substring(0, W);
    const pad = Math.floor((W - s.length) / 2);
    return ' '.repeat(pad) + s;
  };
  const split = (l, r) => {
    const gap = W - l.length - r.length;
    return gap > 0 ? l + ' '.repeat(gap) + r : l.substring(0, W - r.length - 1) + ' ' + r;
  };
  const pad = (s, n) => String(s).padEnd(n).substring(0, n);
  const padL = (s, n) => String(s).padStart(n).substring(String(s).length > n ? 0 : 0);

  push(CMD.INIT);

  // Header
  push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_HEIGHT);
  push(text(d.storeName.toUpperCase()));
  push(CMD.NORMAL_SIZE, CMD.BOLD_OFF);
  if (d.storeAddress) push(text(d.storeAddress));
  if (d.storePhone)   push(text('Tel: ' + d.storePhone));
  push(CMD.ALIGN_LEFT);
  push(text(dashes));

  // Meta
  push(CMD.BOLD_ON);
  if (d.invoiceNo) push(text(split('Invoice:', d.invoiceNo)));
  else             push(text(split('Receipt #:', String(d.saleId))));
  push(CMD.BOLD_OFF);
  if (d.tokenNo)   push(CMD.BOLD_ON, CMD.DOUBLE_HEIGHT, text(center('Token: ' + d.tokenNo)), CMD.NORMAL_SIZE, CMD.BOLD_OFF);
  push(text(split('Date:', d.date)));
  push(text(split('Cashier:', d.cashierName)));
  if (d.customerName) push(text(split('Customer:', d.customerName)));
  push(text(dashes));

  // Items header
  const nameW  = W - 16;
  const header = pad('Item', nameW) + pad('Qty', 5) + padL('Price', 11);
  push(CMD.BOLD_ON, text(header), CMD.BOLD_OFF);
  push(text(dashes));

  // Items
  for (const item of (d.items || [])) {
    const name  = pad(item.name, nameW);
    const qty   = pad(item.quantity, 5);
    const price = padL((d.currencySymbol || 'Rs.') + Number(item.price).toFixed(2), 11);
    push(text(name + qty + price));
  }
  push(text(dashes));

  // Totals
  const cs = d.currencySymbol || 'Rs.';
  if (d.discount > 0)      push(text(split('Discount:', `-${cs}${Number(d.discount).toFixed(2)}`)));
  if (d.taxAmount > 0)     push(text(split(`Tax (${d.taxPercent}%):`, `${cs}${Number(d.taxAmount).toFixed(2)}`)));
  if (d.chargesAmount > 0) push(text(split('Charges:', `${cs}${Number(d.chargesAmount).toFixed(2)}`)));
  push(text(equals));
  push(CMD.BOLD_ON, CMD.DOUBLE_HEIGHT);
  push(text(split('TOTAL:', `${cs}${Number(d.totalAmount).toFixed(2)}`)));
  push(CMD.NORMAL_SIZE, CMD.BOLD_OFF);
  push(text(equals));
  push(text(split(`Paid (${d.paymentMethod || 'cash'}):`, `${cs}${Number(d.amountPaid).toFixed(2)}`)));
  if (d.changeDue > 0) push(text(split('Change Due:', `${cs}${Number(d.changeDue).toFixed(2)}`)));
  push(text(dashes));

  // Footer
  push(CMD.ALIGN_CENTER);
  push(text(d.footer || 'Thank you!'));
  push(CMD.ALIGN_LEFT);
  push(CMD.FEED_3);
  if (cfg.cut_paper) push(CMD.CUT_PARTIAL);
  if (cfg.open_drawer) push(CMD.OPEN_DRAWER);

  return Buffer.concat(buffers);
}

// ── Print via Network TCP ──────────────────────────────────────
function printNetwork(escposBuffer, ip, port) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Printer at ${ip}:${port} not reachable (timeout)`));
    }, 5000);

    socket.connect(port, ip, () => {
      socket.write(escposBuffer, (err) => {
        clearTimeout(timeout);
        socket.destroy();
        if (err) reject(err);
        else resolve();
      });
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

// ── Print via USB/Serial COM port ─────────────────────────────
function printUSB(escposBuffer, comPort, baudRate) {
  return new Promise((resolve, reject) => {
    try {
      const { SerialPort } = require('serialport');
      const port = new SerialPort({ path: comPort, baudRate: baudRate || 9600 });
      port.on('open', () => {
        port.write(escposBuffer, (err) => {
          port.close();
          if (err) reject(err);
          else resolve();
        });
      });
      port.on('error', reject);
    } catch (e) {
      reject(new Error('serialport not available: ' + e.message));
    }
  });
}

// ── Print via Windows print command ───────────────────────────
function printWindows(escposBuffer, printerName) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(require('os').tmpdir(), `abyte_print_${Date.now()}.bin`);
    fs.writeFileSync(tmpFile, escposBuffer);
    const cmd = `copy /B "${tmpFile}" "\\\\localhost\\${printerName}"`;
    exec(cmd, (err) => {
      fs.unlink(tmpFile, () => {});
      if (err) reject(new Error('Windows print failed: ' + err.message));
      else resolve();
    });
  });
}

// ── Route: health check ────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    printer_type: config.printer_type,
    printer_target: config.printer_type === 'network'
      ? `${config.printer_ip}:${config.printer_port}`
      : config.printer_type === 'usb'
      ? config.printer_com
      : config.windows_printer_name || '(not set)',
  });
});

// ── Route: list COM ports ──────────────────────────────────────
app.get('/printers', async (req, res) => {
  const result = { com_ports: [], windows_printers: [] };

  // COM ports via SerialPort
  try {
    const { SerialPort } = require('serialport');
    const ports = await SerialPort.list();
    result.com_ports = ports.map(p => ({ path: p.path, manufacturer: p.manufacturer || '' }));
  } catch { /* serialport may not be available */ }

  // Windows printers via wmic
  exec('wmic printer get name /format:list', (err, stdout) => {
    if (!err) {
      result.windows_printers = stdout
        .split('\n')
        .map(l => l.replace('Name=', '').trim())
        .filter(l => l.length > 0);
    }
    res.json(result);
  });
});

// ── Route: update config ───────────────────────────────────────
app.post('/config', (req, res) => {
  config = { ...config, ...req.body };
  saveConfig(config);
  res.json({ success: true, config });
});

app.get('/config', (req, res) => {
  res.json(config);
});

// ── Route: print receipt ───────────────────────────────────────
app.post('/print', async (req, res) => {
  const { receiptData, overrideConfig } = req.body;
  if (!receiptData) return res.status(400).json({ error: 'receiptData required' });

  const printCfg = overrideConfig ? { ...config, ...overrideConfig } : config;

  let escposBuffer;
  try {
    escposBuffer = buildESCPOS(receiptData, printCfg);
  } catch (e) {
    return res.status(500).json({ error: 'ESC/POS build failed: ' + e.message });
  }

  try {
    switch (printCfg.printer_type) {
      case 'network':
        await printNetwork(escposBuffer, printCfg.printer_ip, printCfg.printer_port || 9100);
        break;
      case 'usb':
        await printUSB(escposBuffer, printCfg.printer_com, printCfg.printer_baud);
        break;
      case 'windows':
        await printWindows(escposBuffer, printCfg.windows_printer_name);
        break;
      default:
        return res.status(400).json({ error: `Unknown printer_type: ${printCfg.printer_type}` });
    }
    res.json({ success: true, method: printCfg.printer_type });
  } catch (e) {
    console.error('Print error:', e.message);
    res.status(500).json({ error: e.message, printer_type: printCfg.printer_type });
  }
});

// ── Route: test print (prints a test page) ────────────────────
app.post('/test', async (req, res) => {
  const testData = {
    storeName:     'AByte POS',
    storeAddress:  'Test Print',
    storePhone:    '',
    saleId:        1,
    invoiceNo:     'TEST-001',
    date:          new Date().toLocaleString(),
    cashierName:   'System Test',
    currencySymbol:'Rs.',
    items:         [{ name: 'Test Item', quantity: 1, price: 100 }],
    subtotal:      100,
    discount:      0,
    taxAmount:     0,
    taxPercent:    0,
    chargesAmount: 0,
    totalAmount:   100,
    amountPaid:    100,
    changeDue:     0,
    paymentMethod: 'cash',
    footer:        'Printer working correctly!',
  };

  const escposBuffer = buildESCPOS(testData, config);

  try {
    switch (config.printer_type) {
      case 'network':
        await printNetwork(escposBuffer, config.printer_ip, config.printer_port || 9100);
        break;
      case 'usb':
        await printUSB(escposBuffer, config.printer_com, config.printer_baud);
        break;
      case 'windows':
        await printWindows(escposBuffer, config.windows_printer_name);
        break;
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✓ AByte Printer Agent running on http://localhost:${PORT}`);
  console.log(`  Printer type : ${config.printer_type}`);
  if (config.printer_type === 'network') {
    console.log(`  Printer IP   : ${config.printer_ip}:${config.printer_port}`);
  } else if (config.printer_type === 'usb') {
    console.log(`  COM Port     : ${config.printer_com}`);
  } else {
    console.log(`  Windows Name : ${config.windows_printer_name}`);
  }
  console.log(`\n  Config file  : ${CONFIG_FILE}`);
  console.log(`  Health check : http://localhost:${PORT}/health`);
  console.log(`  Test print   : POST http://localhost:${PORT}/test\n`);
});
