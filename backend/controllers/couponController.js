const { query } = require('../config/database');
const { logAction } = require('../services/auditService');

const parsePagination = (page, limit) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(Math.max(1, parseInt(limit) || 20), 100);
  return { page: p, limit: l, offset: (p - 1) * l };
};

exports.getAll = async (req, res) => {
  try {
    const { status, search } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = 'SELECT c.*, u.name as created_by_name FROM coupons c LEFT JOIN users u ON c.created_by = u.user_id WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM coupons c WHERE 1=1';
    const params = [], countParams = [];

    if (status === 'active') {
      sql += ' AND c.is_active = 1 AND c.valid_until >= CURDATE() AND (c.usage_limit IS NULL OR c.used_count < c.usage_limit)';
      countSql += ' AND c.is_active = 1 AND c.valid_until >= CURDATE() AND (c.usage_limit IS NULL OR c.used_count < c.usage_limit)';
    } else if (status === 'expired') {
      sql += ' AND (c.valid_until < CURDATE() OR c.is_active = 0)';
      countSql += ' AND (c.valid_until < CURDATE() OR c.is_active = 0)';
    } else if (status === 'used_up') {
      sql += ' AND c.usage_limit IS NOT NULL AND c.used_count >= c.usage_limit';
      countSql += ' AND c.usage_limit IS NOT NULL AND c.used_count >= c.usage_limit';
    }

    if (search) {
      sql += ' AND (c.code LIKE ? OR c.description LIKE ?)';
      countSql += ' AND (c.code LIKE ? OR c.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [coupons, [{ total }]] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    res.json({ data: coupons, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getById = async (req, res) => {
  try {
    const [coupon] = await query(
      'SELECT c.*, u.name as created_by_name FROM coupons c LEFT JOIN users u ON c.created_by = u.user_id WHERE c.coupon_id = ?',
      [req.params.id]
    );
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

    const redemptions = await query(
      'SELECT cr.*, s.sale_date FROM coupon_redemptions cr JOIN sales s ON cr.sale_id = s.sale_id WHERE cr.coupon_id = ? ORDER BY cr.redeemed_at DESC LIMIT 20',
      [req.params.id]
    );
    res.json({ ...coupon, redemptions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { code, description, discount_type, discount_value, min_purchase, max_discount, usage_limit, valid_from, valid_until } = req.body;
    if (!code || !discount_type || !discount_value || !valid_from || !valid_until) {
      return res.status(400).json({ message: 'Code, type, value, and date range are required' });
    }
    if (discount_value <= 0) return res.status(400).json({ message: 'Discount value must be positive' });
    if (new Date(valid_from) > new Date(valid_until)) return res.status(400).json({ message: 'Valid from must be before valid until' });
    if (discount_type === 'percentage' && discount_value > 100) return res.status(400).json({ message: 'Percentage cannot exceed 100' });

    const existing = await query('SELECT coupon_id FROM coupons WHERE code = ?', [code.toUpperCase()]);
    if (existing.length > 0) return res.status(400).json({ message: 'Coupon code already exists' });

    const result = await query(
      'INSERT INTO coupons (code, description, discount_type, discount_value, min_purchase, max_discount, usage_limit, valid_from, valid_until, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [code.toUpperCase(), description || null, discount_type, discount_value, min_purchase || 0, max_discount || null, usage_limit || null, valid_from, valid_until, req.user.user_id]
    );

    await logAction(req.user.user_id, req.user.name, 'COUPON_CREATED', 'coupon', result.insertId, { code: code.toUpperCase() }, req.ip);
    res.status(201).json({ message: 'Coupon created', coupon_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const { description, discount_type, discount_value, min_purchase, max_discount, usage_limit, valid_from, valid_until, is_active } = req.body;
    const [coupon] = await query('SELECT * FROM coupons WHERE coupon_id = ?', [req.params.id]);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

    await query(
      `UPDATE coupons SET description = ?, discount_type = ?, discount_value = ?, min_purchase = ?,
       max_discount = ?, usage_limit = ?, valid_from = ?, valid_until = ?, is_active = ? WHERE coupon_id = ?`,
      [description ?? coupon.description, discount_type || coupon.discount_type, discount_value || coupon.discount_value,
       min_purchase ?? coupon.min_purchase, max_discount ?? coupon.max_discount, usage_limit ?? coupon.usage_limit,
       valid_from || coupon.valid_from, valid_until || coupon.valid_until, is_active ?? coupon.is_active, req.params.id]
    );

    await logAction(req.user.user_id, req.user.name, 'COUPON_UPDATED', 'coupon', req.params.id, { code: coupon.code }, req.ip);
    res.json({ message: 'Coupon updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.delete = async (req, res) => {
  try {
    const [coupon] = await query('SELECT * FROM coupons WHERE coupon_id = ?', [req.params.id]);
    if (!coupon) return res.status(404).json({ message: 'Coupon not found' });

    const [{ cnt }] = await query('SELECT COUNT(*) as cnt FROM coupon_redemptions WHERE coupon_id = ?', [req.params.id]);
    if (cnt > 0) {
      await query('UPDATE coupons SET is_active = 0 WHERE coupon_id = ?', [req.params.id]);
    } else {
      await query('DELETE FROM coupons WHERE coupon_id = ?', [req.params.id]);
    }

    await logAction(req.user.user_id, req.user.name, 'COUPON_DELETED', 'coupon', req.params.id, { code: coupon.code }, req.ip);
    res.json({ message: 'Coupon deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.validate = async (req, res) => {
  try {
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ message: 'Coupon code required' });

    const [coupon] = await query('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [code.toUpperCase()]);
    if (!coupon) return res.status(404).json({ message: 'Invalid coupon code' });

    const now = new Date().toISOString().split('T')[0];
    if (now < coupon.valid_from || now > coupon.valid_until) return res.status(400).json({ message: 'Coupon has expired or is not yet valid' });
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) return res.status(400).json({ message: 'Coupon usage limit reached' });
    if (subtotal && parseFloat(subtotal) < parseFloat(coupon.min_purchase)) {
      return res.status(400).json({ message: `Minimum purchase of $${coupon.min_purchase} required` });
    }

    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = (parseFloat(subtotal || 0) * coupon.discount_value) / 100;
      if (coupon.max_discount && discount > parseFloat(coupon.max_discount)) discount = parseFloat(coupon.max_discount);
    } else {
      discount = parseFloat(coupon.discount_value);
    }

    res.json({ valid: true, coupon_id: coupon.coupon_id, code: coupon.code, discount_type: coupon.discount_type, discount_value: coupon.discount_value, calculated_discount: Math.round(discount * 100) / 100 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const [stats] = await query(`
      SELECT
        SUM(is_active = 1 AND valid_until >= CURDATE() AND (usage_limit IS NULL OR used_count < usage_limit)) as active_coupons,
        (SELECT COUNT(*) FROM coupon_redemptions) as total_redemptions,
        (SELECT COALESCE(SUM(discount_applied), 0) FROM coupon_redemptions) as total_savings
      FROM coupons
    `);
    res.json({
      active_coupons: Number(stats.active_coupons) || 0,
      total_redemptions: Number(stats.total_redemptions) || 0,
      total_savings: Number(stats.total_savings) || 0
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
