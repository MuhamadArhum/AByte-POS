const { query } = require('../config/database');
const { logAction } = require('../services/auditService');

// --- Get Store Settings ---
// Returns the single row of store settings (store name, address, etc.)
// Used by: Settings page (Admin), POS Receipt (Cashier/All)
exports.getSettings = async (req, res) => {
  try {
    // We assume setting_id = 1 is the single record for the store
    const rows = await query('SELECT * FROM store_settings WHERE setting_id = 1');
    if (rows.length === 0) {
      // Should not happen if seed/update script ran, but just in case
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

// --- Update Store Settings ---
// Updates the store profile.
// Only Admin can perform this.
exports.updateSettings = async (req, res) => {
  try {
    const { store_name, address, phone, email, website, receipt_footer } = req.body;
    
    await query(
      `UPDATE store_settings 
       SET store_name=?, address=?, phone=?, email=?, website=?, receipt_footer=? 
       WHERE setting_id=1`,
      [store_name, address, phone, email, website, receipt_footer]
    );
    
    await logAction(req.user.user_id, req.user.name, 'SETTINGS_UPDATED', 'settings', 1, { store_name }, req.ip);

    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
