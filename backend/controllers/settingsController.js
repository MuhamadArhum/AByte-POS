const { query } = require('../config/database');
const { logAction } = require('../services/auditService');
const bcrypt = require('bcrypt');
const net = require('net');

// --- Get Store Settings ---
exports.getSettings = async (req, res) => {
  try {
    const rows = await query('SELECT * FROM store_settings WHERE setting_id = 1');
    if (rows.length === 0) {
      return res.json({
        store_name: 'AByte POS',
        address: '',
        phone: '',
        receipt_footer: 'Thank you!'
      });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Update Store Settings (all fields) ---
exports.updateSettings = async (req, res) => {
  try {
    const {
      store_name, address, phone, email, website,
      receipt_header, receipt_footer, receipt_logo,
      tax_rate, currency_symbol,
      low_stock_threshold, default_payment_method, auto_print_receipt,
      barcode_prefix, invoice_prefix, date_format, timezone,
      business_hours_open, business_hours_close,
      allow_negative_stock, discount_requires_approval, max_cashier_discount,
      session_timeout_minutes,
      receipt_show_store_name, receipt_show_address, receipt_show_phone, receipt_show_tax,
      receipt_paper_width,
      printer_type, printer_ip, printer_port, printer_name, printer_paper_width
    } = req.body;

    await query(
      `UPDATE store_settings SET
        store_name=?, address=?, phone=?, email=?, website=?,
        receipt_header=?, receipt_footer=?, receipt_logo=?,
        tax_rate=?, currency_symbol=?,
        low_stock_threshold=?, default_payment_method=?, auto_print_receipt=?,
        barcode_prefix=?, invoice_prefix=?, date_format=?, timezone=?,
        business_hours_open=?, business_hours_close=?,
        allow_negative_stock=?, discount_requires_approval=?, max_cashier_discount=?,
        session_timeout_minutes=?,
        receipt_show_store_name=?, receipt_show_address=?, receipt_show_phone=?, receipt_show_tax=?,
        receipt_paper_width=?,
        printer_type=?, printer_ip=?, printer_port=?, printer_name=?, printer_paper_width=?
      WHERE setting_id=1`,
      [
        store_name, address, phone, email, website,
        receipt_header || null, receipt_footer, receipt_logo || null,
        tax_rate || 0, currency_symbol || 'Rs.',
        low_stock_threshold || 10, default_payment_method || 'cash', auto_print_receipt ? 1 : 0,
        barcode_prefix || '', invoice_prefix || 'INV-', date_format || 'DD/MM/YYYY', timezone || 'Asia/Karachi',
        business_hours_open || '09:00:00', business_hours_close || '21:00:00',
        allow_negative_stock ? 1 : 0, discount_requires_approval ? 1 : 0, max_cashier_discount || 50,
        session_timeout_minutes || 480,
        receipt_show_store_name !== false ? 1 : 0, receipt_show_address !== false ? 1 : 0,
        receipt_show_phone !== false ? 1 : 0, receipt_show_tax !== false ? 1 : 0,
        receipt_paper_width || '80mm',
        printer_type || 'none', printer_ip || null, printer_port || 9100, printer_name || null, printer_paper_width || 80
      ]
    );

    await logAction(req.user.user_id, req.user.name, 'SETTINGS_UPDATED', 'settings', 1, { store_name }, req.ip);
    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Change Own Password ---
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    // Verify current password
    const [user] = await query('SELECT password FROM users WHERE user_id = ?', [req.user.user_id]);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Hash and update
    const hashedPassword = await bcrypt.hash(new_password, 10);
    await query('UPDATE users SET password = ? WHERE user_id = ?', [hashedPassword, req.user.user_id]);

    await logAction(req.user.user_id, req.user.name, 'PASSWORD_CHANGED', 'users', req.user.user_id, {}, req.ip);
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Print Receipt via configured printer ---
exports.printReceipt = async (req, res) => {
  try {
    const [settings] = await query('SELECT printer_type, printer_ip, printer_port, printer_name, printer_paper_width FROM store_settings WHERE setting_id = 1');
    if (!settings || settings.printer_type === 'none') {
      return res.status(400).json({ message: 'No printer configured. Go to Settings > Printer to configure.' });
    }

    const { receiptData } = req.body;
    if (!receiptData) {
      return res.status(400).json({ message: 'Receipt data is required' });
    }

    // Build ESC/POS commands from receiptData
    const escposBuffer = buildEscPosReceipt(receiptData, settings.printer_paper_width || 80);

    if (settings.printer_type === 'network') {
      if (!settings.printer_ip) {
        return res.status(400).json({ message: 'Printer IP address not configured' });
      }
      await sendToNetworkPrinter(settings.printer_ip, settings.printer_port || 9100, escposBuffer);
      return res.json({ success: true, message: 'Receipt sent to printer' });
    }

    if (settings.printer_type === 'usb') {
      // For USB printers on Windows, write to the shared printer via net use / raw
      if (!settings.printer_name) {
        return res.status(400).json({ message: 'USB printer name not configured' });
      }
      await sendToUsbPrinter(settings.printer_name, escposBuffer);
      return res.json({ success: true, message: 'Receipt sent to USB printer' });
    }

    return res.status(400).json({ message: 'Unknown printer type' });
  } catch (err) {
    console.error('Print error:', err);
    res.status(500).json({ message: err.message || 'Failed to print receipt' });
  }
};

// --- Test printer connection ---
exports.testPrinter = async (req, res) => {
  try {
    const { printer_type, printer_ip, printer_port, printer_name } = req.body;

    if (printer_type === 'network') {
      if (!printer_ip) return res.status(400).json({ message: 'IP address is required' });
      // Send a test page
      const ESC = '\x1B';
      const GS = '\x1D';
      const testData = Buffer.from(
        ESC + '@' +                              // Init
        ESC + 'a\x01' +                          // Center
        ESC + '!\x10' +                          // Double height
        'PRINTER TEST\n' +
        ESC + '!\x00' +                          // Normal
        'Connection OK!\n' +
        new Date().toLocaleString() + '\n' +
        '\n\n\n' +
        GS + 'V\x01',                           // Cut
        'binary'
      );
      await sendToNetworkPrinter(printer_ip, printer_port || 9100, testData);
      return res.json({ success: true, message: 'Test page sent successfully!' });
    }

    if (printer_type === 'usb') {
      if (!printer_name) return res.status(400).json({ message: 'Printer name is required' });
      const ESC = '\x1B';
      const GS = '\x1D';
      const testData = Buffer.from(
        ESC + '@' + ESC + 'a\x01' + ESC + '!\x10' +
        'PRINTER TEST\n' + ESC + '!\x00' +
        'USB Connection OK!\n' + new Date().toLocaleString() + '\n\n\n\n' +
        GS + 'V\x01',
        'binary'
      );
      await sendToUsbPrinter(printer_name, testData);
      return res.json({ success: true, message: 'Test page sent to USB printer!' });
    }

    return res.status(400).json({ message: 'Select a printer type first' });
  } catch (err) {
    console.error('Printer test error:', err);
    res.status(500).json({ message: `Printer test failed: ${err.message}` });
  }
};

// Build ESC/POS receipt from structured data
function buildEscPosReceipt(data, paperWidth) {
  const width = paperWidth === 58 ? 32 : 42; // chars per line
  const ESC = '\x1B';
  const GS = '\x1D';

  let r = '';
  r += ESC + '@';                               // Init printer

  // Header - centered, bold, double height
  r += ESC + 'a\x01';                           // Center
  r += ESC + '!\x10';                           // Double height
  r += ESC + 'E\x01';                           // Bold on
  r += (data.storeName || 'AByte POS') + '\n';
  r += ESC + '!\x00';                           // Normal size
  r += ESC + 'E\x00';                           // Bold off
  if (data.storeAddress) r += data.storeAddress + '\n';
  if (data.storePhone) r += 'Tel: ' + data.storePhone + '\n';
  if (data.storeEmail) r += data.storeEmail + '\n';
  r += '\n';

  // Receipt info - left aligned
  r += ESC + 'a\x00';                           // Left
  r += '='.repeat(width) + '\n';
  r += 'Receipt #: ' + (data.saleId || '') + '\n';
  r += 'Date: ' + (data.date || new Date().toLocaleString()) + '\n';
  r += 'Cashier: ' + (data.cashierName || '') + '\n';
  if (data.customerName) r += 'Customer: ' + data.customerName + '\n';
  r += '='.repeat(width) + '\n';

  // Column headers
  r += ESC + 'E\x01';
  r += padLine('Item', 'Amount', width) + '\n';
  r += ESC + 'E\x00';
  r += '-'.repeat(width) + '\n';

  // Items
  const cs = data.currencySymbol || 'Rs.';
  if (data.items && data.items.length > 0) {
    for (const item of data.items) {
      const name = item.name.length > (width - 2) ? item.name.substring(0, width - 5) + '...' : item.name;
      const lineTotal = (item.quantity * item.price).toFixed(2);
      r += name + '\n';
      r += `  ${item.quantity} x ${cs} ${item.price.toFixed(2)}`;
      const totalStr = `${cs} ${lineTotal}`;
      const spaces = width - `  ${item.quantity} x ${cs} ${item.price.toFixed(2)}`.length - totalStr.length;
      r += ' '.repeat(Math.max(1, spaces)) + totalStr + '\n';
    }
  }

  r += '-'.repeat(width) + '\n';

  // Totals
  if (data.discount > 0) r += padLine('Discount:', `-${cs} ${data.discount.toFixed(2)}`, width) + '\n';
  if (data.taxAmount > 0) r += padLine('Tax:', `${cs} ${data.taxAmount.toFixed(2)}`, width) + '\n';

  r += ESC + 'E\x01';
  r += padLine('TOTAL:', `${cs} ${(data.totalAmount || 0).toFixed(2)}`, width) + '\n';
  r += ESC + 'E\x00';
  r += padLine('Paid:', `${cs} ${(data.amountPaid || 0).toFixed(2)}`, width) + '\n';
  if (data.changeDue > 0) r += padLine('Change:', `${cs} ${data.changeDue.toFixed(2)}`, width) + '\n';
  r += padLine('Method:', (data.paymentMethod || '').toUpperCase(), width) + '\n';

  // Footer
  r += '\n';
  r += ESC + 'a\x01';                           // Center
  r += (data.footer || 'Thank you for shopping!') + '\n';
  r += '\n\n\n';
  r += GS + 'V\x01';                            // Paper cut

  return Buffer.from(r, 'binary');
}

function padLine(label, value, width) {
  const space = width - label.length - value.length;
  return label + ' '.repeat(Math.max(1, space)) + value;
}

// Send data to network thermal printer via TCP
function sendToNetworkPrinter(ip, port, data) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error(`Connection to ${ip}:${port} timed out`));
    }, 5000);

    client.connect(port, ip, () => {
      clearTimeout(timeout);
      client.write(data, () => {
        client.end();
        resolve();
      });
    });

    client.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Cannot connect to printer at ${ip}:${port} - ${err.message}`));
    });
  });
}

// Send data to USB printer (Windows: writes via shared printer or LPT)
function sendToUsbPrinter(printerName, data) {
  return new Promise((resolve, reject) => {
    const fs = require('fs');
    const { execSync } = require('child_process');
    const path = require('path');
    const os = require('os');

    // Write to temp file then copy to printer
    const tmpFile = path.join(os.tmpdir(), `receipt_${Date.now()}.bin`);
    fs.writeFileSync(tmpFile, data);

    try {
      if (process.platform === 'win32') {
        // Windows: use "copy /b" to send raw data to printer share
        execSync(`copy /b "${tmpFile}" "${printerName}"`, { timeout: 10000 });
      } else {
        // Linux/Mac: use lp command
        execSync(`lp -d "${printerName}" -o raw "${tmpFile}"`, { timeout: 10000 });
      }
      fs.unlinkSync(tmpFile);
      resolve();
    } catch (err) {
      fs.unlinkSync(tmpFile);
      reject(new Error(`USB print failed: ${err.message}`));
    }
  });
}

// --- Get System Info ---
exports.getSystemInfo = async (req, res) => {
  try {
    const [userCount] = await query('SELECT COUNT(*) as total FROM users');
    const [productCount] = await query('SELECT COUNT(*) as total FROM products');
    const [orderCount] = await query('SELECT COUNT(*) as total FROM sales');
    const [customerCount] = await query('SELECT COUNT(*) as total FROM customers');

    res.json({
      users: userCount.total,
      products: productCount.total,
      orders: orderCount.total,
      customers: customerCount.total,
      node_version: process.version,
      platform: process.platform,
      uptime: Math.floor(process.uptime()),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
