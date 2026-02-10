const { query } = require('../config/database');
const { logAction } = require('../services/auditService');

const parsePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  return {
    page: Math.max(1, pageNum),
    limit: Math.max(1, limitNum),
    offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum)
  };
};

// Get all expenses with filters
exports.getAll = async (req, res) => {
  try {
    const { start_date, end_date, category_id, search = '' } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `
      SELECT e.*, ec.category_name, u.name as created_by_name
      FROM expenses e
      LEFT JOIN expense_categories ec ON e.category_id = ec.category_id
      LEFT JOIN users u ON e.created_by = u.user_id
      WHERE 1=1
    `;
    let countSql = 'SELECT COUNT(*) as total FROM expenses WHERE 1=1';
    const params = [];
    const countParams = [];

    if (start_date && end_date) {
      sql += ' AND e.expense_date BETWEEN ? AND ?';
      countSql += ' AND expense_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
      countParams.push(start_date, end_date);
    }

    if (category_id) {
      sql += ' AND e.category_id = ?';
      countSql += ' AND category_id = ?';
      params.push(category_id);
      countParams.push(category_id);
    }

    if (search) {
      sql += ' AND (e.description LIKE ? OR e.vendor_name LIKE ?)';
      countSql += ' AND (description LIKE ? OR vendor_name LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    }

    sql += ' ORDER BY e.expense_date DESC, e.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [expenses, [{ total }]] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    res.json({
      data: expenses,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Get expenses error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get expense categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await query('SELECT * FROM expense_categories ORDER BY category_name ASC');
    res.json({ data: categories });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create expense
exports.create = async (req, res) => {
  try {
    const {
      category_id,
      amount,
      expense_date,
      description,
      payment_method,
      receipt_number,
      vendor_name,
      is_recurring,
      store_id
    } = req.body;

    if (!category_id || !amount || amount <= 0 || !expense_date || !description) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    const result = await query(`
      INSERT INTO expenses (
        category_id, amount, expense_date, description, payment_method,
        receipt_number, vendor_name, is_recurring, created_by, store_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [category_id, amount, expense_date, description, payment_method || 'cash', receipt_number || null, vendor_name || null, is_recurring || 0, req.user.user_id, store_id || 1]);

    await logAction(
      req.user.user_id,
      req.user.name,
      'EXPENSE_CREATED',
      'expense',
      result.insertId,
      { category_id, amount, expense_date, description },
      req.ip
    );

    res.status(201).json({
      message: 'Expense created successfully',
      expense_id: result.insertId
    });
  } catch (err) {
    console.error('Create expense error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update expense
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category_id,
      amount,
      expense_date,
      description,
      payment_method,
      receipt_number,
      vendor_name,
      is_recurring
    } = req.body;

    if (!category_id || !amount || amount <= 0 || !expense_date || !description) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    const [existing] = await query('SELECT expense_id FROM expenses WHERE expense_id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    await query(`
      UPDATE expenses SET
        category_id = ?, amount = ?, expense_date = ?, description = ?,
        payment_method = ?, receipt_number = ?, vendor_name = ?, is_recurring = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE expense_id = ?
    `, [category_id, amount, expense_date, description, payment_method || 'cash', receipt_number || null, vendor_name || null, is_recurring || 0, id]);

    await logAction(
      req.user.user_id,
      req.user.name,
      'EXPENSE_UPDATED',
      'expense',
      id,
      { amount, expense_date },
      req.ip
    );

    res.json({ message: 'Expense updated successfully' });
  } catch (err) {
    console.error('Update expense error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete expense
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await query('SELECT expense_id, description FROM expenses WHERE expense_id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    await query('DELETE FROM expenses WHERE expense_id = ?', [id]);

    await logAction(
      req.user.user_id,
      req.user.name,
      'EXPENSE_DELETED',
      'expense',
      id,
      { description: existing.description },
      req.ip
    );

    res.json({ message: 'Expense deleted successfully' });
  } catch (err) {
    console.error('Delete expense error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get expense summary
exports.getSummary = async (req, res) => {
  try {
    const { start_date, end_date, category_id } = req.query;

    let sql = `
      SELECT
        ec.category_name,
        ec.category_id,
        COUNT(e.expense_id) as count,
        SUM(e.amount) as total
      FROM expense_categories ec
      LEFT JOIN expenses e ON ec.category_id = e.category_id
    `;
    const params = [];

    if (start_date && end_date) {
      sql += ' AND e.expense_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    if (category_id) {
      sql += ' AND e.category_id = ?';
      params.push(category_id);
    }

    sql += ' GROUP BY ec.category_id, ec.category_name ORDER BY total DESC';

    const summary = await query(sql, params);

    const [totalStats] = await query(`
      SELECT
        COUNT(*) as total_expenses,
        SUM(amount) as grand_total
      FROM expenses
      WHERE 1=1
      ${start_date && end_date ? 'AND expense_date BETWEEN ? AND ?' : ''}
      ${category_id ? 'AND category_id = ?' : ''}
    `, params);

    res.json({
      summary,
      total: totalStats || { total_expenses: 0, grand_total: 0 }
    });
  } catch (err) {
    console.error('Get summary error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
