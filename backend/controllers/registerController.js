const { getConnection, query } = require('../config/database');
const { logAction } = require('../services/auditService');

// Helper: Round to 2 decimal places for currency
const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// Helper: Validate and parse pagination params
const parsePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100 per page
  return {
    page: Math.max(1, pageNum),
    limit: Math.max(1, limitNum),
    offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum)
  };
};

exports.getCurrentRegister = async (req, res) => {
  try {
    const register = await query(
      `SELECT cr.*, u.name as opened_by_name
       FROM cash_registers cr
       JOIN users u ON cr.opened_by = u.user_id
       WHERE cr.status = 'open'
       LIMIT 1`
    );

    if (register.length === 0) {
      return res.json(null);
    }

    const movements = await query(
      `SELECT cm.*, u.name as user_name
       FROM cash_movements cm
       JOIN users u ON cm.user_id = u.user_id
       WHERE cm.register_id = ?
       ORDER BY cm.created_at DESC`,
      [register[0].register_id]
    );

    res.json({ ...register[0], movements });
  } catch (error) {
    console.error('Get current register error:', error);
    res.status(500).json({ message: 'Failed to fetch register' });
  }
};

exports.openRegister = async (req, res) => {
  try {
    const { opening_balance } = req.body;

    // Check if a register is already open
    const existing = await query("SELECT register_id FROM cash_registers WHERE status = 'open' LIMIT 1");
    if (existing.length > 0) {
      return res.status(400).json({ message: 'A register is already open. Close it before opening a new one.' });
    }

    if (opening_balance === undefined || opening_balance < 0) {
      return res.status(400).json({ message: 'Valid opening balance is required' });
    }

    const result = await query(
      'INSERT INTO cash_registers (opened_by, opening_balance) VALUES (?, ?)',
      [req.user.user_id, opening_balance]
    );

    const registerId = Number(result.insertId);

    await logAction(req.user.user_id, req.user.name, 'REGISTER_OPENED', 'cash_register', registerId, { opening_balance }, req.ip);

    const newRegister = await query('SELECT * FROM cash_registers WHERE register_id = ?', [registerId]);
    res.status(201).json(newRegister[0]);
  } catch (error) {
    console.error('Open register error:', error);
    res.status(500).json({ message: 'Failed to open register' });
  }
};

exports.closeRegister = async (req, res) => {
  let conn;
  try {
    const { closing_balance, close_note } = req.body;

    if (closing_balance === undefined || closing_balance < 0) {
      return res.status(400).json({ message: 'Valid closing balance is required' });
    }

    conn = await getConnection();
    await conn.beginTransaction();

    // Lock register row to prevent concurrent modifications
    const register = await conn.query("SELECT * FROM cash_registers WHERE status = 'open' FOR UPDATE");
    if (register.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'No open register found' });
    }

    const reg = register[0];
    // Use currency rounding for expected/difference calculations
    const expected = round2(parseFloat(reg.opening_balance) + parseFloat(reg.cash_sales_total) + parseFloat(reg.total_cash_in) - parseFloat(reg.total_cash_out));
    const difference = round2(parseFloat(closing_balance) - expected);

    await conn.query(
      `UPDATE cash_registers
       SET status = 'closed', closed_by = ?, closing_balance = ?, expected_balance = ?,
           difference = ?, closed_at = NOW(), close_note = ?
       WHERE register_id = ?`,
      [req.user.user_id, closing_balance, expected, difference, close_note || null, reg.register_id]
    );

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'REGISTER_CLOSED', 'cash_register', reg.register_id,
      { closing_balance, expected, difference }, req.ip);

    const updated = await query('SELECT * FROM cash_registers WHERE register_id = ?', [reg.register_id]);
    res.json(updated[0]);
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Close register error:', error);
    res.status(500).json({ message: 'Failed to close register' });
  } finally {
    if (conn) conn.release();
  }
};

exports.addCashMovement = async (req, res) => {
  let conn;
  try {
    const { type, amount, reason } = req.body;

    if (!type || !['cash_in', 'cash_out'].includes(type)) {
      return res.status(400).json({ message: 'Type must be cash_in or cash_out' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }
    if (!reason) {
      return res.status(400).json({ message: 'Reason is required' });
    }

    conn = await getConnection();
    await conn.beginTransaction();

    const register = await conn.query("SELECT * FROM cash_registers WHERE status = 'open' FOR UPDATE");
    if (register.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'No open register. Open a register first.' });
    }

    const registerId = register[0].register_id;

    await conn.query(
      'INSERT INTO cash_movements (register_id, type, amount, reason, user_id) VALUES (?, ?, ?, ?, ?)',
      [registerId, type, amount, reason, req.user.user_id]
    );

    if (type === 'cash_in') {
      await conn.query('UPDATE cash_registers SET total_cash_in = total_cash_in + ? WHERE register_id = ?', [amount, registerId]);
    } else {
      await conn.query('UPDATE cash_registers SET total_cash_out = total_cash_out + ? WHERE register_id = ?', [amount, registerId]);
    }

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'CASH_MOVEMENT', 'cash_register', registerId, { type, amount, reason }, req.ip);

    res.status(201).json({ message: 'Cash movement recorded' });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Cash movement error:', error);
    res.status(500).json({ message: 'Failed to record cash movement' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pg = parsePagination(page, limit);

    const countResult = await query('SELECT COUNT(*) as total FROM cash_registers');
    const total = Number(countResult[0].total);

    const registers = await query(
      `SELECT cr.*,
              u1.name as opened_by_name,
              u2.name as closed_by_name
       FROM cash_registers cr
       JOIN users u1 ON cr.opened_by = u1.user_id
       LEFT JOIN users u2 ON cr.closed_by = u2.user_id
       ORDER BY cr.opened_at DESC
       LIMIT ? OFFSET ?`,
      [pg.limit, pg.offset]
    );

    res.json({
      registers,
      pagination: { page: pg.page, limit: pg.limit, total, totalPages: Math.ceil(total / pg.limit) }
    });
  } catch (error) {
    console.error('Register history error:', error);
    res.status(500).json({ message: 'Failed to fetch register history' });
  }
};

exports.getById = async (req, res) => {
  try {
    const register = await query(
      `SELECT cr.*, u1.name as opened_by_name, u2.name as closed_by_name
       FROM cash_registers cr
       JOIN users u1 ON cr.opened_by = u1.user_id
       LEFT JOIN users u2 ON cr.closed_by = u2.user_id
       WHERE cr.register_id = ?`,
      [req.params.id]
    );

    if (register.length === 0) {
      return res.status(404).json({ message: 'Register not found' });
    }

    const movements = await query(
      `SELECT cm.*, u.name as user_name
       FROM cash_movements cm
       JOIN users u ON cm.user_id = u.user_id
       WHERE cm.register_id = ?
       ORDER BY cm.created_at DESC`,
      [req.params.id]
    );

    res.json({ ...register[0], movements });
  } catch (error) {
    console.error('Get register error:', error);
    res.status(500).json({ message: 'Failed to fetch register details' });
  }
};
