const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const parsePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  return { page: Math.max(1, pageNum), limit: Math.max(1, limitNum), offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum) };
};

// ============== ACCOUNT GROUPS ==============

exports.getAccountGroups = async (req, res) => {
  try {
    const { type } = req.query;
    let sql = 'SELECT * FROM account_groups';
    const params = [];
    if (type) { sql += ' WHERE group_type = ?'; params.push(type); }
    sql += ' ORDER BY group_type, group_name';

    const groups = await query(sql, params);
    res.json({ data: groups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== CHART OF ACCOUNTS ==============

exports.getAccounts = async (req, res) => {
  try {
    const { type, group_id, is_active, search } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT a.*, g.group_name, g.group_type,
               (SELECT account_name FROM accounts WHERE account_id = a.parent_account_id) as parent_account_name
               FROM accounts a
               JOIN account_groups g ON a.group_id = g.group_id WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM accounts WHERE 1=1';
    const params = [], countParams = [];

    if (type) { sql += ' AND a.account_type = ?'; countSql += ' AND account_type = ?'; params.push(type); countParams.push(type); }
    if (group_id) { sql += ' AND a.group_id = ?'; countSql += ' AND group_id = ?'; params.push(group_id); countParams.push(group_id); }
    if (is_active !== undefined) { sql += ' AND a.is_active = ?'; countSql += ' AND is_active = ?'; params.push(is_active); countParams.push(is_active); }
    if (search) {
      const pattern = `%${search}%`;
      sql += ' AND (a.account_code LIKE ? OR a.account_name LIKE ?)';
      countSql += ' AND (account_code LIKE ? OR account_name LIKE ?)';
      params.push(pattern, pattern);
      countParams.push(pattern, pattern);
    }

    sql += ' ORDER BY a.account_code LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [accounts, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: accounts, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAccountById = async (req, res) => {
  try {
    const [account] = await query(`
      SELECT a.*, g.group_name, g.group_type,
      (SELECT account_name FROM accounts WHERE account_id = a.parent_account_id) as parent_account_name
      FROM accounts a
      JOIN account_groups g ON a.group_id = g.group_id
      WHERE a.account_id = ?
    `, [req.params.id]);
    if (!account) return res.status(404).json({ message: 'Account not found' });
    res.json(account);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createAccount = async (req, res) => {
  try {
    const { account_code, account_name, group_id, parent_account_id, account_type, opening_balance, description } = req.body;
    if (!account_code || !account_name || !group_id || !account_type) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const result = await query(
      'INSERT INTO accounts (account_code, account_name, group_id, parent_account_id, account_type, opening_balance, current_balance, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [account_code, account_name, group_id, parent_account_id || null, account_type, opening_balance || 0, opening_balance || 0, description || null]
    );

    await logAction(req.user.user_id, req.user.name, 'ACCOUNT_CREATED', 'accounts', result.insertId, { account_code, account_name }, req.ip);
    res.status(201).json({ message: 'Account created', account_id: result.insertId });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Account code already exists', field: 'account_code' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { account_code, account_name, group_id, parent_account_id, is_active, description } = req.body;
    if (!account_code || !account_name || !group_id) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    await query(
      'UPDATE accounts SET account_code=?, account_name=?, group_id=?, parent_account_id=?, is_active=?, description=?, updated_at=CURRENT_TIMESTAMP WHERE account_id=?',
      [account_code, account_name, group_id, parent_account_id || null, is_active ?? 1, description || null, id]
    );

    await logAction(req.user.user_id, req.user.name, 'ACCOUNT_UPDATED', 'accounts', id, { account_code, account_name }, req.ip);
    res.json({ message: 'Account updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if account has transactions
    const [hasTransactions] = await query('SELECT COUNT(*) as count FROM journal_entry_lines WHERE account_id = ?', [id]);
    if (hasTransactions.count > 0) {
      return res.status(400).json({ message: 'Cannot delete account with existing transactions' });
    }

    await query('DELETE FROM accounts WHERE account_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'ACCOUNT_DELETED', 'accounts', id, {}, req.ip);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== JOURNAL ENTRIES ==============

exports.getJournalEntries = async (req, res) => {
  try {
    const { from_date, to_date, status } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT je.*, u.name as created_by_name FROM journal_entries je
               JOIN users u ON je.created_by = u.user_id WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM journal_entries WHERE 1=1';
    const params = [], countParams = [];

    if (from_date && to_date) {
      sql += ' AND je.entry_date BETWEEN ? AND ?';
      countSql += ' AND entry_date BETWEEN ? AND ?';
      params.push(from_date, to_date);
      countParams.push(from_date, to_date);
    }
    if (status) { sql += ' AND je.status = ?'; countSql += ' AND status = ?'; params.push(status); countParams.push(status); }

    sql += ' ORDER BY je.entry_date DESC, je.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [entries, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: entries, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getJournalEntryById = async (req, res) => {
  try {
    const [entry] = await query(`
      SELECT je.*, u.name as created_by_name
      FROM journal_entries je
      JOIN users u ON je.created_by = u.user_id
      WHERE je.entry_id = ?
    `, [req.params.id]);

    if (!entry) return res.status(404).json({ message: 'Journal entry not found' });

    const lines = await query(`
      SELECT jel.*, a.account_code, a.account_name
      FROM journal_entry_lines jel
      JOIN accounts a ON jel.account_id = a.account_id
      WHERE jel.entry_id = ?
      ORDER BY jel.line_id
    `, [req.params.id]);

    res.json({ ...entry, lines });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createJournalEntry = async (req, res) => {
  const conn = await getConnection();
  try {
    const { entry_date, description, lines } = req.body;

    if (!entry_date || !lines || !Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ message: 'Entry date and at least 2 lines required' });
    }

    // Validate debits = credits
    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ message: 'Total debits must equal total credits', field: 'lines' });
    }

    await conn.beginTransaction();

    // Generate entry number
    const [lastEntry] = await conn.query('SELECT entry_number FROM journal_entries ORDER BY entry_id DESC LIMIT 1');
    let nextNumber = 1;
    if (lastEntry && lastEntry.entry_number) {
      const match = lastEntry.entry_number.match(/JE(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const entryNumber = `JE${String(nextNumber).padStart(6, '0')}`;

    // Create journal entry
    const result = await conn.query(
      'INSERT INTO journal_entries (entry_number, entry_date, description, total_debit, total_credit, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [entryNumber, entry_date, description || null, totalDebit, totalCredit, req.user.user_id]
    );

    const entryId = result.insertId;

    // Create lines
    for (const line of lines) {
      if (!line.account_id || (Number(line.debit || 0) === 0 && Number(line.credit || 0) === 0)) continue;

      await conn.query(
        'INSERT INTO journal_entry_lines (entry_id, account_id, description, debit, credit) VALUES (?, ?, ?, ?, ?)',
        [entryId, line.account_id, line.description || null, line.debit || 0, line.credit || 0]
      );
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'JOURNAL_ENTRY_CREATED', 'journal_entries', entryId, { entry_number: entryNumber }, req.ip);
    res.status(201).json({ message: 'Journal entry created', entry_id: entryId, entry_number: entryNumber });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.postJournalEntry = async (req, res) => {
  const conn = await getConnection();
  try {
    const { id } = req.params;

    await conn.beginTransaction();

    const [entry] = await conn.query('SELECT * FROM journal_entries WHERE entry_id = ? FOR UPDATE', [id]);
    if (!entry) { await conn.rollback(); return res.status(404).json({ message: 'Entry not found' }); }
    if (entry.status !== 'draft') { await conn.rollback(); return res.status(400).json({ message: 'Only draft entries can be posted' }); }

    // Get all lines
    const lines = await conn.query('SELECT * FROM journal_entry_lines WHERE entry_id = ?', [id]);

    // Update account balances
    for (const line of lines) {
      const [account] = await conn.query('SELECT account_type FROM accounts WHERE account_id = ?', [line.account_id]);
      const debitIncrease = ['asset', 'expense'].includes(account.account_type);

      const change = debitIncrease
        ? (Number(line.debit) - Number(line.credit))
        : (Number(line.credit) - Number(line.debit));

      await conn.query('UPDATE accounts SET current_balance = current_balance + ? WHERE account_id = ?', [change, line.account_id]);
    }

    // Mark entry as posted
    await conn.query('UPDATE journal_entries SET status = ?, posted_at = CURRENT_TIMESTAMP WHERE entry_id = ?', ['posted', id]);

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'JOURNAL_ENTRY_POSTED', 'journal_entries', id, { entry_number: entry.entry_number }, req.ip);
    res.json({ message: 'Journal entry posted successfully' });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.deleteJournalEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const [entry] = await query('SELECT * FROM journal_entries WHERE entry_id = ?', [id]);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });
    if (entry.status === 'posted') return res.status(400).json({ message: 'Cannot delete posted entry' });

    await query('DELETE FROM journal_entries WHERE entry_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'JOURNAL_ENTRY_DELETED', 'journal_entries', id, { entry_number: entry.entry_number }, req.ip);
    res.json({ message: 'Journal entry deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== GENERAL LEDGER ==============

exports.getGeneralLedger = async (req, res) => {
  try {
    const { account_id, from_date, to_date } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT jel.*, je.entry_number, je.entry_date, je.description as entry_description,
               a.account_code, a.account_name, a.account_type
               FROM journal_entry_lines jel
               JOIN journal_entries je ON jel.entry_id = je.entry_id
               JOIN accounts a ON jel.account_id = a.account_id
               WHERE je.status = 'posted'`;
    let countSql = `SELECT COUNT(*) as total FROM journal_entry_lines jel
                    JOIN journal_entries je ON jel.entry_id = je.entry_id
                    WHERE je.status = 'posted'`;
    const params = [], countParams = [];

    if (account_id) { sql += ' AND jel.account_id = ?'; countSql += ' AND jel.account_id = ?'; params.push(account_id); countParams.push(account_id); }
    if (from_date && to_date) {
      sql += ' AND je.entry_date BETWEEN ? AND ?';
      countSql += ' AND je.entry_date BETWEEN ? AND ?';
      params.push(from_date, to_date);
      countParams.push(from_date, to_date);
    }

    sql += ' ORDER BY je.entry_date DESC, jel.line_id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [ledger, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: ledger, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== REPORTS ==============

exports.getTrialBalance = async (req, res) => {
  try {
    const { as_of_date } = req.query;
    const asOfDate = as_of_date || new Date().toISOString().split('T')[0];

    const accounts = await query(`
      SELECT a.account_id, a.account_code, a.account_name, a.account_type, a.opening_balance,
             COALESCE(SUM(CASE WHEN je.entry_date <= ? THEN jel.debit ELSE 0 END), 0) as total_debit,
             COALESCE(SUM(CASE WHEN je.entry_date <= ? THEN jel.credit ELSE 0 END), 0) as total_credit
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON a.account_id = jel.account_id
      LEFT JOIN journal_entries je ON jel.entry_id = je.entry_id AND je.status = 'posted'
      WHERE a.is_active = 1
      GROUP BY a.account_id
      ORDER BY a.account_code
    `, [asOfDate, asOfDate]);

    const trial = accounts.map(a => {
      const opening = Number(a.opening_balance || 0);
      const debit = Number(a.total_debit || 0);
      const credit = Number(a.total_credit || 0);
      const debitIncrease = ['asset', 'expense'].includes(a.account_type);

      const closingBalance = opening + (debitIncrease ? (debit - credit) : (credit - debit));

      return {
        account_id: a.account_id,
        account_code: a.account_code,
        account_name: a.account_name,
        account_type: a.account_type,
        debit: closingBalance > 0 ? Math.abs(closingBalance) : 0,
        credit: closingBalance < 0 ? Math.abs(closingBalance) : 0
      };
    });

    const totals = trial.reduce((acc, t) => ({
      total_debit: acc.total_debit + t.debit,
      total_credit: acc.total_credit + t.credit
    }), { total_debit: 0, total_credit: 0 });

    res.json({ as_of_date: asOfDate, trial_balance: trial, totals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getProfitLoss = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    if (!from_date || !to_date) return res.status(400).json({ message: 'Date range required' });

    const accounts = await query(`
      SELECT a.account_id, a.account_code, a.account_name, a.account_type, g.group_name,
             COALESCE(SUM(jel.credit - jel.debit), 0) as amount
      FROM accounts a
      JOIN account_groups g ON a.group_id = g.group_id
      LEFT JOIN journal_entry_lines jel ON a.account_id = jel.account_id
      LEFT JOIN journal_entries je ON jel.entry_id = je.entry_id AND je.status = 'posted' AND je.entry_date BETWEEN ? AND ?
      WHERE a.account_type IN ('revenue', 'expense') AND a.is_active = 1
      GROUP BY a.account_id
      HAVING amount != 0
      ORDER BY a.account_type, a.account_code
    `, [from_date, to_date]);

    const revenue = accounts.filter(a => a.account_type === 'revenue').map(a => ({ ...a, amount: Number(a.amount) }));
    const expenses = accounts.filter(a => a.account_type === 'expense').map(a => ({ ...a, amount: Math.abs(Number(a.amount)) }));

    const totalRevenue = revenue.reduce((sum, r) => sum + r.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    res.json({
      period: { from_date, to_date },
      revenue: { accounts: revenue, total: totalRevenue },
      expenses: { accounts: expenses, total: totalExpenses },
      net_profit: netProfit
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getBalanceSheet = async (req, res) => {
  try {
    const { as_of_date } = req.query;
    const asOfDate = as_of_date || new Date().toISOString().split('T')[0];

    const accounts = await query(`
      SELECT a.account_id, a.account_code, a.account_name, a.account_type, a.opening_balance, g.group_name,
             COALESCE(SUM(CASE WHEN je.entry_date <= ? THEN jel.debit - jel.credit ELSE 0 END), 0) as net_change
      FROM accounts a
      JOIN account_groups g ON a.group_id = g.group_id
      LEFT JOIN journal_entry_lines jel ON a.account_id = jel.account_id
      LEFT JOIN journal_entries je ON jel.entry_id = je.entry_id AND je.status = 'posted'
      WHERE a.account_type IN ('asset', 'liability', 'equity') AND a.is_active = 1
      GROUP BY a.account_id
      ORDER BY a.account_type, a.account_code
    `, [asOfDate]);

    const processAccounts = (type, debitIncrease) => {
      return accounts.filter(a => a.account_type === type).map(a => {
        const opening = Number(a.opening_balance || 0);
        const change = Number(a.net_change || 0);
        const balance = debitIncrease ? (opening + change) : (opening - change);
        return { ...a, balance: Math.abs(balance) };
      }).filter(a => a.balance !== 0);
    };

    const assets = processAccounts('asset', true);
    const liabilities = processAccounts('liability', false);
    const equity = processAccounts('equity', false);

    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, l) => sum + l.balance, 0);
    const totalEquity = equity.reduce((sum, e) => sum + e.balance, 0);

    res.json({
      as_of_date: asOfDate,
      assets: { accounts: assets, total: totalAssets },
      liabilities: { accounts: liabilities, total: totalLiabilities },
      equity: { accounts: equity, total: totalEquity },
      total_liabilities_equity: totalLiabilities + totalEquity
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== BANK ACCOUNTS ==============

exports.getBankAccounts = async (req, res) => {
  try {
    const { is_active } = req.query;
    let sql = `SELECT ba.*, a.account_code, a.account_name
               FROM bank_accounts ba
               JOIN accounts a ON ba.account_id = a.account_id WHERE 1=1`;
    const params = [];
    if (is_active !== undefined) { sql += ' AND ba.is_active = ?'; params.push(is_active); }
    sql += ' ORDER BY ba.bank_name';

    const accounts = await query(sql, params);
    res.json({ data: accounts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getBankAccountById = async (req, res) => {
  try {
    const [account] = await query(`
      SELECT ba.*, a.account_code, a.account_name
      FROM bank_accounts ba
      JOIN accounts a ON ba.account_id = a.account_id
      WHERE ba.bank_account_id = ?
    `, [req.params.id]);
    if (!account) return res.status(404).json({ message: 'Bank account not found' });
    res.json(account);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createBankAccount = async (req, res) => {
  try {
    const { account_id, bank_name, account_number, account_holder, branch, ifsc_code, opening_balance } = req.body;
    if (!account_id || !bank_name || !account_number) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const result = await query(
      'INSERT INTO bank_accounts (account_id, bank_name, account_number, account_holder, branch, ifsc_code, opening_balance, current_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [account_id, bank_name, account_number, account_holder || null, branch || null, ifsc_code || null, opening_balance || 0, opening_balance || 0]
    );

    await logAction(req.user.user_id, req.user.name, 'BANK_ACCOUNT_CREATED', 'bank_accounts', result.insertId, { bank_name, account_number }, req.ip);
    res.status(201).json({ message: 'Bank account created', bank_account_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateBankAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const { bank_name, account_number, account_holder, branch, ifsc_code, is_active } = req.body;
    if (!bank_name || !account_number) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    await query(
      'UPDATE bank_accounts SET bank_name=?, account_number=?, account_holder=?, branch=?, ifsc_code=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE bank_account_id=?',
      [bank_name, account_number, account_holder || null, branch || null, ifsc_code || null, is_active ?? 1, id]
    );

    await logAction(req.user.user_id, req.user.name, 'BANK_ACCOUNT_UPDATED', 'bank_accounts', id, { bank_name }, req.ip);
    res.json({ message: 'Bank account updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteBankAccount = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM bank_accounts WHERE bank_account_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'BANK_ACCOUNT_DELETED', 'bank_accounts', id, {}, req.ip);
    res.json({ message: 'Bank account deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== PAYMENT VOUCHERS ==============

exports.getPaymentVouchers = async (req, res) => {
  try {
    const { from_date, to_date, payment_type } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT pv.*, a.account_name, u.name as created_by_name,
               ba.bank_name, ba.account_number
               FROM payment_vouchers pv
               JOIN accounts a ON pv.account_id = a.account_id
               JOIN users u ON pv.created_by = u.user_id
               LEFT JOIN bank_accounts ba ON pv.bank_account_id = ba.bank_account_id
               WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM payment_vouchers WHERE 1=1';
    const params = [], countParams = [];

    if (from_date && to_date) {
      sql += ' AND pv.voucher_date BETWEEN ? AND ?';
      countSql += ' AND voucher_date BETWEEN ? AND ?';
      params.push(from_date, to_date);
      countParams.push(from_date, to_date);
    }
    if (payment_type) { sql += ' AND pv.payment_type = ?'; countSql += ' AND payment_type = ?'; params.push(payment_type); countParams.push(payment_type); }

    sql += ' ORDER BY pv.voucher_date DESC, pv.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [vouchers, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: vouchers, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createPaymentVoucher = async (req, res) => {
  const conn = await getConnection();
  try {
    const { voucher_date, payment_to, payment_type, account_id, amount, payment_method, cheque_number, bank_account_id, description } = req.body;

    if (!voucher_date || !payment_to || !account_id || !amount) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    await conn.beginTransaction();

    // Generate voucher number
    const [lastVoucher] = await conn.query('SELECT voucher_number FROM payment_vouchers ORDER BY voucher_id DESC LIMIT 1');
    let nextNumber = 1;
    if (lastVoucher && lastVoucher.voucher_number) {
      const match = lastVoucher.voucher_number.match(/PV(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const voucherNumber = `PV${String(nextNumber).padStart(6, '0')}`;

    // Create payment voucher
    const result = await conn.query(
      'INSERT INTO payment_vouchers (voucher_number, voucher_date, payment_to, payment_type, account_id, amount, payment_method, cheque_number, bank_account_id, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [voucherNumber, voucher_date, payment_to, payment_type || 'expense', account_id, amount, payment_method || 'cash', cheque_number || null, bank_account_id || null, description || null, req.user.user_id]
    );

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'PAYMENT_VOUCHER_CREATED', 'payment_vouchers', result.insertId, { voucher_number: voucherNumber, amount }, req.ip);
    res.status(201).json({ message: 'Payment voucher created', voucher_id: result.insertId, voucher_number: voucherNumber });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.deletePaymentVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM payment_vouchers WHERE voucher_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'PAYMENT_VOUCHER_DELETED', 'payment_vouchers', id, {}, req.ip);
    res.json({ message: 'Payment voucher deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== RECEIPT VOUCHERS ==============

exports.getReceiptVouchers = async (req, res) => {
  try {
    const { from_date, to_date, receipt_type } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT rv.*, a.account_name, u.name as created_by_name,
               ba.bank_name, ba.account_number
               FROM receipt_vouchers rv
               JOIN accounts a ON rv.account_id = a.account_id
               JOIN users u ON rv.created_by = u.user_id
               LEFT JOIN bank_accounts ba ON rv.bank_account_id = ba.bank_account_id
               WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM receipt_vouchers WHERE 1=1';
    const params = [], countParams = [];

    if (from_date && to_date) {
      sql += ' AND rv.voucher_date BETWEEN ? AND ?';
      countSql += ' AND voucher_date BETWEEN ? AND ?';
      params.push(from_date, to_date);
      countParams.push(from_date, to_date);
    }
    if (receipt_type) { sql += ' AND rv.receipt_type = ?'; countSql += ' AND receipt_type = ?'; params.push(receipt_type); countParams.push(receipt_type); }

    sql += ' ORDER BY rv.voucher_date DESC, rv.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [vouchers, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: vouchers, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createReceiptVoucher = async (req, res) => {
  const conn = await getConnection();
  try {
    const { voucher_date, received_from, receipt_type, account_id, amount, payment_method, cheque_number, bank_account_id, description } = req.body;

    if (!voucher_date || !received_from || !account_id || !amount) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    await conn.beginTransaction();

    // Generate voucher number
    const [lastVoucher] = await conn.query('SELECT voucher_number FROM receipt_vouchers ORDER BY voucher_id DESC LIMIT 1');
    let nextNumber = 1;
    if (lastVoucher && lastVoucher.voucher_number) {
      const match = lastVoucher.voucher_number.match(/RV(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const voucherNumber = `RV${String(nextNumber).padStart(6, '0')}`;

    // Create receipt voucher
    const result = await conn.query(
      'INSERT INTO receipt_vouchers (voucher_number, voucher_date, received_from, receipt_type, account_id, amount, payment_method, cheque_number, bank_account_id, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [voucherNumber, voucher_date, received_from, receipt_type || 'customer', account_id, amount, payment_method || 'cash', cheque_number || null, bank_account_id || null, description || null, req.user.user_id]
    );

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'RECEIPT_VOUCHER_CREATED', 'receipt_vouchers', result.insertId, { voucher_number: voucherNumber, amount }, req.ip);
    res.status(201).json({ message: 'Receipt voucher created', voucher_id: result.insertId, voucher_number: voucherNumber });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.deleteReceiptVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM receipt_vouchers WHERE voucher_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'RECEIPT_VOUCHER_DELETED', 'receipt_vouchers', id, {}, req.ip);
    res.json({ message: 'Receipt voucher deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = exports;
