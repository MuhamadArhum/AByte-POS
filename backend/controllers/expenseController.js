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
    const { start_date, end_date, category, search = '' } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `
      SELECT e.*, u.name as created_by_name
      FROM expenses e
      LEFT JOIN users u ON e.user_id = u.user_id
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

    if (category) {
      sql += ' AND e.category = ?';
      countSql += ' AND category = ?';
      params.push(category);
      countParams.push(category);
    }

    if (search) {
      sql += ' AND (e.title LIKE ? OR e.description LIKE ?)';
      countSql += ' AND (title LIKE ? OR description LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    }

    sql += ' ORDER BY e.expense_date DESC LIMIT ? OFFSET ?';
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
    const { title, amount, category, expense_date, description } = req.body;

    if (!title || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Title and amount are required' });
    }

    const result = await query(
      'INSERT INTO expenses (title, amount, category, expense_date, description, user_id) VALUES (?, ?, ?, ?, ?, ?)',
      [title, amount, category || null, expense_date || new Date(), description || null, req.user.user_id]
    );

    await logAction(
      req.user.user_id,
      req.user.name,
      'EXPENSE_CREATED',
      'expense',
      result.insertId,
      { title, amount, category },
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
    const { title, amount, category, expense_date, description } = req.body;

    if (!title || !amount || amount <= 0) {
      return res.status(400).json({ message: 'Title and amount are required' });
    }

    const [existing] = await query('SELECT expense_id FROM expenses WHERE expense_id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    await query(
      'UPDATE expenses SET title = ?, amount = ?, category = ?, expense_date = ?, description = ? WHERE expense_id = ?',
      [title, amount, category || null, expense_date || new Date(), description || null, id]
    );

    await logAction(
      req.user.user_id,
      req.user.name,
      'EXPENSE_UPDATED',
      'expense',
      id,
      { title, amount },
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

    const [existing] = await query('SELECT expense_id, title FROM expenses WHERE expense_id = ?', [id]);
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
      { title: existing.title },
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
    const { start_date, end_date } = req.query;

    let dateSql = '';
    const params = [];

    if (start_date && end_date) {
      dateSql = ' AND expense_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    const summary = await query(`
      SELECT
        COALESCE(category, 'Uncategorized') as category_name,
        COUNT(*) as count,
        SUM(amount) as total
      FROM expenses
      WHERE 1=1 ${dateSql}
      GROUP BY category
      ORDER BY total DESC
    `, params);

    const [totalStats] = await query(`
      SELECT
        COUNT(*) as total_expenses,
        COALESCE(SUM(amount), 0) as grand_total
      FROM expenses
      WHERE 1=1 ${dateSql}
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
