const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const parsePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  return { page: Math.max(1, pageNum), limit: Math.max(1, limitNum), offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum) };
};

exports.getAll = async (req, res) => {
  try {
    const { is_active, search = '' } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = 'SELECT * FROM staff WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM staff WHERE 1=1';
    const params = [], countParams = [];

    if (is_active !== undefined) {
      sql += ' AND is_active = ?';
      countSql += ' AND is_active = ?';
      params.push(is_active);
      countParams.push(is_active);
    }

    if (search) {
      const pattern = `%${search}%`;
      sql += ' AND (full_name LIKE ? OR email LIKE ? OR position LIKE ?)';
      countSql += ' AND (full_name LIKE ? OR email LIKE ? OR position LIKE ?)';
      params.push(pattern, pattern, pattern);
      countParams.push(pattern, pattern, pattern);
    }

    sql += ' ORDER BY full_name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [staff, [{total}]] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    res.json({ data: staff, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getById = async (req, res) => {
  try {
    const [staff] = await query('SELECT * FROM staff WHERE staff_id = ?', [req.params.id]);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    res.json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { user_id, full_name, phone, email, address, position, department, salary, salary_type, hire_date } = req.body;
    if (!full_name || !hire_date) return res.status(400).json({ message: 'Name and hire date required' });

    const result = await query(
      'INSERT INTO staff (user_id, full_name, phone, email, address, position, department, salary, salary_type, hire_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [user_id || null, full_name, phone || null, email || null, address || null, position || null, department || null, salary || null, salary_type || 'monthly', hire_date]
    );

    await logAction(req.user.user_id, req.user.name, 'STAFF_CREATED', 'staff', result.insertId, { full_name }, req.ip);
    res.status(201).json({ message: 'Staff created', staff_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone, email, address, position, department, salary, salary_type, is_active } = req.body;
    if (!full_name) return res.status(400).json({ message: 'Name required' });

    await query(
      'UPDATE staff SET full_name=?, phone=?, email=?, address=?, position=?, department=?, salary=?, salary_type=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE staff_id=?',
      [full_name, phone || null, email || null, address || null, position || null, department || null, salary || null, salary_type || 'monthly', is_active ?? 1, id]
    );

    await logAction(req.user.user_id, req.user.name, 'STAFF_UPDATED', 'staff', id, { full_name }, req.ip);
    res.json({ message: 'Staff updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markAttendance = async (req, res) => {
  try {
    const { staff_id, attendance_date, check_in, check_out, status, notes } = req.body;
    if (!staff_id || !attendance_date) return res.status(400).json({ message: 'Staff and date required' });

    await query(
      'INSERT INTO attendance (staff_id, attendance_date, check_in, check_out, status, notes) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE check_in=?, check_out=?, status=?, notes=?',
      [staff_id, attendance_date, check_in || null, check_out || null, status || 'present', notes || null, check_in || null, check_out || null, status || 'present', notes || null]
    );

    await logAction(req.user.user_id, req.user.name, 'ATTENDANCE_MARKED', 'attendance', staff_id, { attendance_date, status }, req.ip);
    res.json({ message: 'Attendance marked' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAttendance = async (req, res) => {
  try {
    const { staff_id, start_date, end_date, status } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = 'SELECT a.*, s.full_name, s.position FROM attendance a JOIN staff s ON a.staff_id = s.staff_id WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM attendance a WHERE 1=1';
    const params = [], countParams = [];

    if (staff_id) {
      sql += ' AND a.staff_id = ?';
      countSql += ' AND a.staff_id = ?';
      params.push(staff_id);
      countParams.push(staff_id);
    }

    if (start_date && end_date) {
      sql += ' AND a.attendance_date BETWEEN ? AND ?';
      countSql += ' AND attendance_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
      countParams.push(start_date, end_date);
    }

    if (status) {
      sql += ' AND a.status = ?';
      countSql += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }

    sql += ' ORDER BY a.attendance_date DESC, s.full_name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [attendance, [{total}]] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    res.json({ data: attendance, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markBulkAttendance = async (req, res) => {
  const conn = await getConnection();
  try {
    const { records } = req.body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: 'Records array required' });
    }

    await conn.beginTransaction();

    for (const record of records) {
      const { staff_id, attendance_date, check_in, check_out, status, notes } = record;

      await conn.query(
        'INSERT INTO attendance (staff_id, attendance_date, check_in, check_out, status, notes) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE check_in=?, check_out=?, status=?, notes=?',
        [staff_id, attendance_date, check_in || null, check_out || null, status || 'present', notes || null, check_in || null, check_out || null, status || 'present', notes || null]
      );
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'BULK_ATTENDANCE_MARKED', 'attendance', null, { count: records.length }, req.ip);
    res.json({ message: `Attendance marked for ${records.length} staff members` });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE staff SET is_active = 0 WHERE staff_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'STAFF_DEACTIVATED', 'staff', id, {}, req.ip);
    res.json({ message: 'Staff deactivated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStaffAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 30 } = req.query;
    const attendance = await query(
      'SELECT * FROM attendance WHERE staff_id = ? ORDER BY attendance_date DESC LIMIT ?',
      [id, parseInt(limit)]
    );
    res.json({ data: attendance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSalaryPayments = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;
    const payments = await query(
      'SELECT * FROM salary_payments WHERE staff_id = ? ORDER BY payment_date DESC LIMIT ?',
      [id, parseInt(limit)]
    );
    res.json({ data: payments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.paySalary = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_date, from_date, to_date, amount, deductions, bonuses, net_amount, payment_method, notes } = req.body;

    if (!payment_date || !from_date || !to_date || !amount || net_amount === undefined) {
      return res.status(400).json({ message: 'Required fields missing' });
    }

    const result = await query(
      'INSERT INTO salary_payments (staff_id, payment_date, from_date, to_date, amount, deductions, bonuses, net_amount, payment_method, notes, paid_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, payment_date, from_date, to_date, amount, deductions || 0, bonuses || 0, net_amount, payment_method || 'bank_transfer', notes || null, req.user.user_id]
    );

    await logAction(req.user.user_id, req.user.name, 'SALARY_PAID', 'salary_payment', result.insertId, { staff_id: id, amount: net_amount }, req.ip);
    res.status(201).json({ message: 'Salary payment recorded' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
