const { query } = require('../config/database');
const { logAction } = require('../services/auditService');

exports.getConfig = async (req, res) => {
  try {
    const [config] = await query('SELECT * FROM loyalty_config LIMIT 1');
    res.json(config || { points_per_amount: 1, amount_per_point: 100, min_redeem_points: 100, is_active: 0 });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.updateConfig = async (req, res) => {
  try {
    const { points_per_amount, amount_per_point, min_redeem_points, is_active } = req.body;
    const [existing] = await query('SELECT config_id FROM loyalty_config LIMIT 1');
    if (existing) {
      await query('UPDATE loyalty_config SET points_per_amount = ?, amount_per_point = ?, min_redeem_points = ?, is_active = ? WHERE config_id = ?',
        [points_per_amount, amount_per_point, min_redeem_points, is_active ? 1 : 0, existing.config_id]);
    } else {
      await query('INSERT INTO loyalty_config (points_per_amount, amount_per_point, min_redeem_points, is_active) VALUES (?, ?, ?, ?)',
        [points_per_amount, amount_per_point, min_redeem_points, is_active ? 1 : 0]);
    }
    await logAction(req.user.user_id, req.user.name, 'LOYALTY_CONFIG_UPDATED', 'loyalty_config', 1, { is_active }, req.ip);
    res.json({ message: 'Loyalty config updated' });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getCustomerPoints = async (req, res) => {
  try {
    const { id } = req.params;
    const [customer] = await query('SELECT customer_id, customer_name, loyalty_points FROM customers WHERE customer_id = ?', [id]);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const transactions = await query(
      'SELECT * FROM loyalty_transactions WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50', [id]
    );
    res.json({ ...customer, transactions });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.adjustPoints = async (req, res) => {
  try {
    const { customer_id, points, description } = req.body;
    if (!customer_id || !points) return res.status(400).json({ message: 'Customer and points required' });

    const [customer] = await query('SELECT * FROM customers WHERE customer_id = ?', [customer_id]);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const newBalance = (customer.loyalty_points || 0) + parseInt(points);
    if (newBalance < 0) return res.status(400).json({ message: 'Insufficient points for negative adjustment' });

    await query('UPDATE customers SET loyalty_points = ? WHERE customer_id = ?', [newBalance, customer_id]);
    await query('INSERT INTO loyalty_transactions (customer_id, points, balance_after, type, description) VALUES (?, ?, ?, ?, ?)',
      [customer_id, parseInt(points), newBalance, 'adjust', description || 'Manual adjustment']);

    await logAction(req.user.user_id, req.user.name, 'LOYALTY_ADJUST', 'customer', customer_id, { points, newBalance }, req.ip);
    res.json({ message: 'Points adjusted', new_balance: newBalance });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const customers = await query(
      `SELECT c.customer_id, c.customer_name, c.loyalty_points,
        COALESCE(SUM(CASE WHEN lt.type = 'earn' THEN lt.points ELSE 0 END), 0) as total_earned
       FROM customers c
       LEFT JOIN loyalty_transactions lt ON c.customer_id = lt.customer_id
       WHERE c.customer_id != 1 AND c.loyalty_points > 0
       GROUP BY c.customer_id
       ORDER BY c.loyalty_points DESC
       LIMIT 20`
    );
    res.json({ data: customers });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getStats = async (req, res) => {
  try {
    const [stats] = await query(`
      SELECT
        COALESCE(SUM(loyalty_points), 0) as total_points_circulation,
        SUM(loyalty_points > 0) as active_members,
        (SELECT COALESCE(SUM(ABS(points)), 0) FROM loyalty_transactions WHERE type = 'redeem') as total_redeemed
      FROM customers WHERE customer_id != 1
    `);
    res.json({
      total_points_circulation: Number(stats.total_points_circulation) || 0,
      active_members: Number(stats.active_members) || 0,
      total_redeemed: Number(stats.total_redeemed) || 0
    });
  } catch (err) { console.error(err); res.status(500).json({ message: 'Server error' }); }
};
