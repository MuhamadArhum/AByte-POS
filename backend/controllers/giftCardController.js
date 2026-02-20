const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const parsePagination = (page, limit) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(Math.max(1, parseInt(limit) || 20), 100);
  return { page: p, limit: l, offset: (p - 1) * l };
};

const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// Generate unique card number: GC-XXXXXXXX
const generateCardNumber = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'GC-';
  for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

// GET /api/gift-cards
exports.getAll = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);
    const { status, search } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (status) {
      where += ' AND gc.status = ?';
      params.push(status);
    }
    if (search) {
      where += ' AND (gc.card_number LIKE ? OR c.customer_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [countResult] = await query(
      `SELECT COUNT(*) as total FROM gift_cards gc LEFT JOIN customers c ON gc.customer_id = c.customer_id ${where}`,
      params
    );

    const rows = await query(
      `SELECT gc.*, c.customer_name, c.phone_number AS customer_phone, u.name AS created_by_name
       FROM gift_cards gc
       LEFT JOIN customers c ON gc.customer_id = c.customer_id
       LEFT JOIN users u ON gc.created_by = u.user_id
       ${where}
       ORDER BY gc.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      data: rows,
      pagination: { total: countResult.total, page, limit, totalPages: Math.ceil(countResult.total / limit) }
    });
  } catch (err) {
    console.error('Get gift cards error:', err);
    res.status(500).json({ message: 'Failed to fetch gift cards' });
  }
};

// GET /api/gift-cards/stats
exports.getStats = async (req, res) => {
  try {
    const [stats] = await query(
      `SELECT
         COUNT(CASE WHEN status = 'active' THEN 1 END) AS active_count,
         COALESCE(SUM(CASE WHEN status = 'active' THEN current_balance ELSE 0 END), 0) AS total_balance,
         COUNT(*) AS total_issued
       FROM gift_cards`
    );

    const [redeemed] = await query(
      `SELECT COALESCE(SUM(amount), 0) AS redeemed_this_month
       FROM gift_card_transactions
       WHERE type = 'redeem' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())`
    );

    res.json({
      active_count: stats.active_count,
      total_balance: stats.total_balance,
      total_issued: stats.total_issued,
      redeemed_this_month: redeemed.redeemed_this_month
    });
  } catch (err) {
    console.error('Get gift card stats error:', err);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
};

// GET /api/gift-cards/:id
exports.getById = async (req, res) => {
  try {
    const cards = await query(
      `SELECT gc.*, c.customer_name, c.phone_number AS customer_phone, u.name AS created_by_name
       FROM gift_cards gc
       LEFT JOIN customers c ON gc.customer_id = c.customer_id
       LEFT JOIN users u ON gc.created_by = u.user_id
       WHERE gc.card_id = ?`,
      [req.params.id]
    );

    if (cards.length === 0) return res.status(404).json({ message: 'Gift card not found' });

    const transactions = await query(
      `SELECT gct.*, u.name AS processed_by_name
       FROM gift_card_transactions gct
       LEFT JOIN users u ON gct.processed_by = u.user_id
       WHERE gct.card_id = ?
       ORDER BY gct.created_at DESC`,
      [req.params.id]
    );

    res.json({ ...cards[0], transactions });
  } catch (err) {
    console.error('Get gift card error:', err);
    res.status(500).json({ message: 'Failed to fetch gift card' });
  }
};

// POST /api/gift-cards
exports.create = async (req, res) => {
  try {
    const { initial_balance, customer_id, expiry_date } = req.body;

    if (!initial_balance || parseFloat(initial_balance) <= 0) {
      return res.status(400).json({ message: 'Initial balance must be greater than 0' });
    }

    const balance = round2(parseFloat(initial_balance));
    let card_number;
    let attempts = 0;

    // Generate unique card number
    while (attempts < 10) {
      card_number = generateCardNumber();
      const existing = await query('SELECT card_id FROM gift_cards WHERE card_number = ?', [card_number]);
      if (existing.length === 0) break;
      attempts++;
    }

    const result = await query(
      `INSERT INTO gift_cards (card_number, initial_balance, current_balance, customer_id, expiry_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [card_number, balance, balance, customer_id || null, expiry_date || null, req.user.user_id]
    );

    const card_id = Number(result.insertId);

    // Record initial load transaction
    await query(
      `INSERT INTO gift_card_transactions (card_id, amount, balance_after, type, description, processed_by)
       VALUES (?, ?, ?, 'load', 'Initial balance', ?)`,
      [card_id, balance, balance, req.user.user_id]
    );

    await logAction(req.user.user_id, req.user.name, 'GIFT_CARD_ISSUED', 'gift_card', card_id, { card_number, initial_balance: balance }, req.ip);

    res.status(201).json({ message: 'Gift card issued', card_id, card_number, balance });
  } catch (err) {
    console.error('Create gift card error:', err);
    res.status(500).json({ message: 'Failed to create gift card' });
  }
};

// POST /api/gift-cards/check-balance
exports.checkBalance = async (req, res) => {
  try {
    const { card_number } = req.body;
    if (!card_number) return res.status(400).json({ message: 'Card number is required' });

    const cards = await query(
      'SELECT card_id, card_number, current_balance, status, expiry_date FROM gift_cards WHERE card_number = ?',
      [card_number]
    );

    if (cards.length === 0) return res.status(404).json({ message: 'Gift card not found' });

    res.json(cards[0]);
  } catch (err) {
    console.error('Check balance error:', err);
    res.status(500).json({ message: 'Failed to check balance' });
  }
};

// POST /api/gift-cards/:id/load
exports.loadFunds = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { amount } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    const cards = await conn.query('SELECT * FROM gift_cards WHERE card_id = ? FOR UPDATE', [id]);
    if (cards.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Gift card not found' });
    }

    if (cards[0].status === 'disabled') {
      await conn.rollback();
      return res.status(400).json({ message: 'Cannot load funds to a disabled card' });
    }

    const loadAmount = round2(parseFloat(amount));
    const newBalance = round2(parseFloat(cards[0].current_balance) + loadAmount);

    await conn.query('UPDATE gift_cards SET current_balance = ?, status = ? WHERE card_id = ?',
      [newBalance, 'active', id]);

    await conn.query(
      `INSERT INTO gift_card_transactions (card_id, amount, balance_after, type, description, processed_by)
       VALUES (?, ?, ?, 'load', 'Funds loaded', ?)`,
      [id, loadAmount, newBalance, req.user.user_id]
    );

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'GIFT_CARD_LOAD', 'gift_card', parseInt(id),
      { amount: loadAmount, new_balance: newBalance }, req.ip);

    res.json({ message: 'Funds loaded', current_balance: newBalance });
  } catch (err) {
    await conn.rollback();
    console.error('Load funds error:', err);
    res.status(500).json({ message: 'Failed to load funds' });
  } finally {
    conn.release();
  }
};

// POST /api/gift-cards/:id/redeem
exports.redeem = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { amount, sale_id } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    const cards = await conn.query('SELECT * FROM gift_cards WHERE card_id = ? FOR UPDATE', [id]);
    if (cards.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Gift card not found' });
    }

    const card = cards[0];
    if (card.status !== 'active') {
      await conn.rollback();
      return res.status(400).json({ message: `Card is ${card.status}. Cannot redeem.` });
    }

    if (card.expiry_date && new Date(card.expiry_date) < new Date()) {
      await conn.query("UPDATE gift_cards SET status = 'expired' WHERE card_id = ?", [id]);
      await conn.commit();
      return res.status(400).json({ message: 'Gift card has expired' });
    }

    const redeemAmount = round2(parseFloat(amount));
    if (redeemAmount > parseFloat(card.current_balance)) {
      await conn.rollback();
      return res.status(400).json({ message: `Insufficient balance. Available: ${card.current_balance}` });
    }

    const newBalance = round2(parseFloat(card.current_balance) - redeemAmount);
    const newStatus = newBalance <= 0 ? 'depleted' : 'active';

    await conn.query('UPDATE gift_cards SET current_balance = ?, status = ? WHERE card_id = ?',
      [newBalance, newStatus, id]);

    await conn.query(
      `INSERT INTO gift_card_transactions (card_id, sale_id, amount, balance_after, type, description, processed_by)
       VALUES (?, ?, ?, ?, 'redeem', 'Redeemed at checkout', ?)`,
      [id, sale_id || null, redeemAmount, newBalance, req.user.user_id]
    );

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'GIFT_CARD_REDEEM', 'gift_card', parseInt(id),
      { amount: redeemAmount, new_balance: newBalance, sale_id }, req.ip);

    res.json({ message: 'Redeemed successfully', amount_redeemed: redeemAmount, current_balance: newBalance, status: newStatus });
  } catch (err) {
    await conn.rollback();
    console.error('Redeem error:', err);
    res.status(500).json({ message: 'Failed to redeem gift card' });
  } finally {
    conn.release();
  }
};

// PUT /api/gift-cards/:id/disable
exports.disable = async (req, res) => {
  try {
    const { id } = req.params;
    const cards = await query('SELECT * FROM gift_cards WHERE card_id = ?', [id]);
    if (cards.length === 0) return res.status(404).json({ message: 'Gift card not found' });

    await query("UPDATE gift_cards SET status = 'disabled' WHERE card_id = ?", [id]);

    await logAction(req.user.user_id, req.user.name, 'GIFT_CARD_DISABLED', 'gift_card', parseInt(id),
      { card_number: cards[0].card_number, remaining_balance: cards[0].current_balance }, req.ip);

    res.json({ message: 'Gift card disabled' });
  } catch (err) {
    console.error('Disable gift card error:', err);
    res.status(500).json({ message: 'Failed to disable gift card' });
  }
};
