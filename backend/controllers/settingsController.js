const { query } = require('../config/database');
const { logAction } = require('../services/auditService');
const bcrypt = require('bcrypt');

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
      receipt_paper_width
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
        receipt_paper_width=?
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
        receipt_paper_width || '80mm'
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
