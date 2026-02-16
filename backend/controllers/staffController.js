const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const parsePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  return { page: Math.max(1, pageNum), limit: Math.max(1, limitNum), offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum) };
};

exports.getAll = async (req, res) => {
  try {
    const { is_active, search = '', department } = req.query;
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

    if (department) {
      sql += ' AND department = ?';
      countSql += ' AND department = ?';
      params.push(department);
      countParams.push(department);
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
    const { user_id, employee_id, full_name, phone, email, address, position, department, salary, salary_type, hire_date } = req.body;
    if (!full_name || !hire_date) return res.status(400).json({ message: 'Name and hire date required', field: !full_name ? 'full_name' : 'hire_date' });
    if (phone && !/^[\d+\-() ]{7,20}$/.test(phone)) return res.status(400).json({ message: 'Invalid phone format', field: 'phone' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Invalid email format', field: 'email' });
    if (salary !== undefined && salary !== null && Number(salary) < 0) return res.status(400).json({ message: 'Salary cannot be negative', field: 'salary' });

    const result = await query(
      'INSERT INTO staff (user_id, employee_id, full_name, phone, email, address, position, department, salary, salary_type, hire_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [user_id || null, employee_id || null, full_name, phone || null, email || null, address || null, position || null, department || null, salary || null, salary_type || 'monthly', hire_date]
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
    const { employee_id, full_name, phone, email, address, position, department, salary, salary_type, is_active, leave_balance } = req.body;
    if (!full_name) return res.status(400).json({ message: 'Name required', field: 'full_name' });
    if (phone && !/^[\d+\-() ]{7,20}$/.test(phone)) return res.status(400).json({ message: 'Invalid phone format', field: 'phone' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Invalid email format', field: 'email' });
    if (salary !== undefined && salary !== null && Number(salary) < 0) return res.status(400).json({ message: 'Salary cannot be negative', field: 'salary' });

    await query(
      'UPDATE staff SET employee_id=?, full_name=?, phone=?, email=?, address=?, position=?, department=?, salary=?, salary_type=?, is_active=?, leave_balance=?, updated_at=CURRENT_TIMESTAMP WHERE staff_id=?',
      [employee_id || null, full_name, phone || null, email || null, address || null, position || null, department || null, salary || null, salary_type || 'monthly', is_active ?? 1, leave_balance ?? 20, id]
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
    const validStatuses = ['present', 'absent', 'half_day', 'leave', 'holiday'];
    if (status && !validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status', field: 'status' });

    const newStatus = status || 'present';

    // Check existing record for leave balance tracking
    const [existing] = await query('SELECT status FROM attendance WHERE staff_id = ? AND attendance_date = ?', [staff_id, attendance_date]);
    const oldStatus = existing ? existing.status : null;

    await query(
      'INSERT INTO attendance (staff_id, attendance_date, check_in, check_out, status, notes) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE check_in=?, check_out=?, status=?, notes=?',
      [staff_id, attendance_date, check_in || null, check_out || null, newStatus, notes || null, check_in || null, check_out || null, newStatus, notes || null]
    );

    // Adjust leave balance
    if (oldStatus !== 'leave' && newStatus === 'leave') {
      await query('UPDATE staff SET leave_balance = GREATEST(leave_balance - 1, 0) WHERE staff_id = ?', [staff_id]);
    } else if (oldStatus === 'leave' && newStatus !== 'leave') {
      await query('UPDATE staff SET leave_balance = leave_balance + 1 WHERE staff_id = ?', [staff_id]);
    }

    await logAction(req.user.user_id, req.user.name, 'ATTENDANCE_MARKED', 'attendance', staff_id, { attendance_date, status: newStatus }, req.ip);
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
    let summarySql = `SELECT
      SUM(status = 'present') as present,
      SUM(status = 'absent') as absent,
      SUM(status = 'half_day') as half_day,
      SUM(status = 'leave') as on_leave,
      COUNT(*) as total
      FROM attendance WHERE 1=1`;
    const params = [], countParams = [], summaryParams = [];

    if (staff_id) {
      sql += ' AND a.staff_id = ?';
      countSql += ' AND a.staff_id = ?';
      summarySql += ' AND staff_id = ?';
      params.push(staff_id);
      countParams.push(staff_id);
      summaryParams.push(staff_id);
    }

    if (start_date && end_date) {
      sql += ' AND a.attendance_date BETWEEN ? AND ?';
      countSql += ' AND attendance_date BETWEEN ? AND ?';
      summarySql += ' AND attendance_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
      countParams.push(start_date, end_date);
      summaryParams.push(start_date, end_date);
    }

    if (status) {
      sql += ' AND a.status = ?';
      countSql += ' AND status = ?';
      params.push(status);
      countParams.push(status);
    }

    sql += ' ORDER BY a.attendance_date DESC, s.full_name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [attendance, [{total}], [summary]] = await Promise.all([
      query(sql, params),
      query(countSql, countParams),
      query(summarySql, summaryParams)
    ]);

    res.json({
      data: attendance,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      summary: {
        present: Number(summary.present || 0),
        absent: Number(summary.absent || 0),
        halfDay: Number(summary.half_day || 0),
        leave: Number(summary.on_leave || 0),
        total: Number(summary.total || 0)
      }
    });
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
      const newStatus = status || 'present';

      // Check existing for leave balance
      const [existing] = await conn.query('SELECT status FROM attendance WHERE staff_id = ? AND attendance_date = ?', [staff_id, attendance_date]);
      const oldStatus = existing ? existing.status : null;

      await conn.query(
        'INSERT INTO attendance (staff_id, attendance_date, check_in, check_out, status, notes) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE check_in=?, check_out=?, status=?, notes=?',
        [staff_id, attendance_date, check_in || null, check_out || null, newStatus, notes || null, check_in || null, check_out || null, newStatus, notes || null]
      );

      // Adjust leave balance
      if (oldStatus !== 'leave' && newStatus === 'leave') {
        await conn.query('UPDATE staff SET leave_balance = GREATEST(leave_balance - 1, 0) WHERE staff_id = ?', [staff_id]);
      } else if (oldStatus === 'leave' && newStatus !== 'leave') {
        await conn.query('UPDATE staff SET leave_balance = leave_balance + 1 WHERE staff_id = ?', [staff_id]);
      }
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
    if (new Date(from_date) > new Date(to_date)) {
      return res.status(400).json({ message: 'From date must be before to date', field: 'from_date' });
    }
    if (Number(amount) < 0) return res.status(400).json({ message: 'Amount cannot be negative', field: 'amount' });

    const expectedNet = Number(amount) - Number(deductions || 0) + Number(bonuses || 0);
    if (Math.abs(expectedNet - Number(net_amount)) > 0.01) {
      return res.status(400).json({ message: 'Net amount calculation mismatch', field: 'net_amount' });
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

// ============== EDIT/DELETE ENDPOINTS ==============

exports.updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const { check_in, check_out, status, notes } = req.body;
    const validStatuses = ['present', 'absent', 'half_day', 'leave', 'holiday'];
    if (status && !validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status', field: 'status' });

    const [record] = await query('SELECT * FROM attendance WHERE attendance_id = ?', [id]);
    if (!record) return res.status(404).json({ message: 'Attendance record not found' });

    const oldStatus = record.status;
    const newStatus = status || record.status;

    await query(
      'UPDATE attendance SET check_in=?, check_out=?, status=?, notes=? WHERE attendance_id=?',
      [check_in || null, check_out || null, newStatus, notes || null, id]
    );

    // Adjust leave balance
    if (oldStatus !== 'leave' && newStatus === 'leave') {
      await query('UPDATE staff SET leave_balance = GREATEST(leave_balance - 1, 0) WHERE staff_id = ?', [record.staff_id]);
    } else if (oldStatus === 'leave' && newStatus !== 'leave') {
      await query('UPDATE staff SET leave_balance = leave_balance + 1 WHERE staff_id = ?', [record.staff_id]);
    }

    await logAction(req.user.user_id, req.user.name, 'ATTENDANCE_UPDATED', 'attendance', id, { staff_id: record.staff_id, old_status: oldStatus, new_status: newStatus, attendance_date: record.attendance_date }, req.ip);
    res.json({ message: 'Attendance updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const [record] = await query('SELECT * FROM attendance WHERE attendance_id = ?', [id]);
    if (!record) return res.status(404).json({ message: 'Attendance record not found' });

    // Reverse leave deduction if status was leave
    if (record.status === 'leave') {
      await query('UPDATE staff SET leave_balance = leave_balance + 1 WHERE staff_id = ?', [record.staff_id]);
    }

    await query('DELETE FROM attendance WHERE attendance_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'ATTENDANCE_DELETED', 'attendance', id, { staff_id: record.staff_id, attendance_date: record.attendance_date }, req.ip);
    res.json({ message: 'Attendance deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateSalaryPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_date, from_date, to_date, amount, deductions, bonuses, net_amount, payment_method, notes } = req.body;

    const [record] = await query('SELECT * FROM salary_payments WHERE payment_id = ?', [id]);
    if (!record) return res.status(404).json({ message: 'Salary payment not found' });

    if (!payment_date || !from_date || !to_date || !amount || net_amount === undefined) {
      return res.status(400).json({ message: 'Required fields missing' });
    }
    if (new Date(from_date) > new Date(to_date)) {
      return res.status(400).json({ message: 'From date must be before to date', field: 'from_date' });
    }
    if (Number(amount) < 0) return res.status(400).json({ message: 'Amount cannot be negative', field: 'amount' });

    const expectedNet = Number(amount) - Number(deductions || 0) + Number(bonuses || 0);
    if (Math.abs(expectedNet - Number(net_amount)) > 0.01) {
      return res.status(400).json({ message: 'Net amount calculation mismatch', field: 'net_amount' });
    }

    await query(
      'UPDATE salary_payments SET payment_date=?, from_date=?, to_date=?, amount=?, deductions=?, bonuses=?, net_amount=?, payment_method=?, notes=? WHERE payment_id=?',
      [payment_date, from_date, to_date, amount, deductions || 0, bonuses || 0, net_amount, payment_method || 'bank_transfer', notes || null, id]
    );

    await logAction(req.user.user_id, req.user.name, 'SALARY_PAYMENT_UPDATED', 'salary_payment', id, { staff_id: record.staff_id, amount: net_amount }, req.ip);
    res.json({ message: 'Salary payment updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteSalaryPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const [record] = await query('SELECT * FROM salary_payments WHERE payment_id = ?', [id]);
    if (!record) return res.status(404).json({ message: 'Salary payment not found' });

    await query('DELETE FROM salary_payments WHERE payment_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'SALARY_PAYMENT_DELETED', 'salary_payment', id, { staff_id: record.staff_id, amount: record.net_amount }, req.ip);
    res.json({ message: 'Salary payment deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== REPORT ENDPOINTS ==============

exports.getMonthlyAttendanceReport = async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: 'Month required (YYYY-MM format)' });
    }

    const startDate = `${month}-01`;

    const data = await query(`
      SELECT
        s.staff_id, s.full_name, s.department, s.position, s.leave_balance,
        SUM(a.status = 'present') as days_present,
        SUM(a.status = 'absent') as days_absent,
        SUM(a.status = 'half_day') as days_half_day,
        SUM(a.status = 'leave') as days_leave,
        SUM(a.status = 'holiday') as days_holiday,
        COUNT(a.attendance_id) as total_records,
        ROUND(
          (SUM(a.status = 'present') + SUM(a.status = 'half_day') * 0.5) /
          NULLIF(SUM(a.status != 'holiday'), 0) * 100, 1
        ) as attendance_percentage
      FROM staff s
      LEFT JOIN attendance a ON s.staff_id = a.staff_id
        AND a.attendance_date BETWEEN ? AND LAST_DAY(?)
      WHERE s.is_active = 1
      GROUP BY s.staff_id
      ORDER BY s.full_name
    `, [startDate, startDate]);

    res.json({
      month,
      data: data.map(r => ({
        ...r,
        days_present: Number(r.days_present || 0),
        days_absent: Number(r.days_absent || 0),
        days_half_day: Number(r.days_half_day || 0),
        days_leave: Number(r.days_leave || 0),
        days_holiday: Number(r.days_holiday || 0),
        total_records: Number(r.total_records || 0),
        attendance_percentage: r.attendance_percentage !== null ? Number(r.attendance_percentage) : 0
      }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getSalarySummaryReport = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    if (!from_date || !to_date) {
      return res.status(400).json({ message: 'from_date and to_date required' });
    }

    const byDepartment = await query(`
      SELECT
        COALESCE(s.department, 'Unassigned') as department,
        COUNT(DISTINCT sp.staff_id) as staff_paid,
        SUM(sp.amount) as total_base,
        SUM(sp.deductions) as total_deductions,
        SUM(sp.bonuses) as total_bonuses,
        SUM(sp.net_amount) as total_net_paid
      FROM salary_payments sp
      JOIN staff s ON sp.staff_id = s.staff_id
      WHERE sp.payment_date BETWEEN ? AND ?
      GROUP BY s.department
    `, [from_date, to_date]);

    const expected = await query(`
      SELECT
        COALESCE(department, 'Unassigned') as department,
        COUNT(*) as total_staff,
        SUM(salary) as total_expected_salary
      FROM staff
      WHERE is_active = 1 AND salary IS NOT NULL
      GROUP BY department
    `);

    // Merge expected into byDepartment
    const deptMap = {};
    for (const e of expected) {
      deptMap[e.department] = { total_staff: Number(e.total_staff), total_expected: Number(e.total_expected_salary || 0) };
    }

    const departments = byDepartment.map(d => {
      const exp = deptMap[d.department] || { total_staff: 0, total_expected: 0 };
      const netPaid = Number(d.total_net_paid || 0);
      return {
        department: d.department,
        total_staff: exp.total_staff,
        staff_paid: Number(d.staff_paid || 0),
        total_base: Number(d.total_base || 0),
        total_deductions: Number(d.total_deductions || 0),
        total_bonuses: Number(d.total_bonuses || 0),
        total_net_paid: netPaid,
        total_expected: exp.total_expected,
        pending_amount: Math.max(0, exp.total_expected - netPaid)
      };
    });

    // Also include departments with staff but no payments
    for (const [dept, exp] of Object.entries(deptMap)) {
      if (!departments.find(d => d.department === dept)) {
        departments.push({
          department: dept,
          total_staff: exp.total_staff,
          staff_paid: 0,
          total_base: 0, total_deductions: 0, total_bonuses: 0,
          total_net_paid: 0,
          total_expected: exp.total_expected,
          pending_amount: exp.total_expected
        });
      }
    }

    const totals = departments.reduce((acc, d) => ({
      total_staff: acc.total_staff + d.total_staff,
      staff_paid: acc.staff_paid + d.staff_paid,
      total_net_paid: acc.total_net_paid + d.total_net_paid,
      total_expected: acc.total_expected + d.total_expected
    }), { total_staff: 0, staff_paid: 0, total_net_paid: 0, total_expected: 0 });

    res.json({
      period: { from_date, to_date },
      by_department: departments,
      totals
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== SALARY SHEET ==============

exports.getSalarySheet = async (req, res) => {
  try {
    const { department } = req.query;
    let sql = `
      SELECT s.staff_id, s.employee_id, s.full_name, s.department, s.position,
             s.salary, s.salary_type,
             COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.monthly_deduction ELSE 0 END), 0) as loan_deduction
      FROM staff s
      LEFT JOIN staff_loans l ON s.staff_id = l.staff_id AND l.status = 'active'
      WHERE s.is_active = 1
    `;
    const params = [];
    if (department) { sql += ' AND s.department = ?'; params.push(department); }
    sql += ' GROUP BY s.staff_id ORDER BY s.full_name';

    const data = await query(sql, params);
    const sheet = data.map(r => ({
      ...r,
      salary: Number(r.salary || 0),
      loan_deduction: Number(r.loan_deduction || 0),
      net_salary: Number(r.salary || 0) - Number(r.loan_deduction || 0)
    }));

    res.json({ data: sheet });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== DAILY ATTENDANCE ==============

exports.getDailyAttendance = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Date required (YYYY-MM-DD)' });

    const data = await query(`
      SELECT s.staff_id, s.employee_id, s.full_name, s.department, s.position,
             a.attendance_id, a.check_in, a.check_out, a.status, a.notes
      FROM staff s
      LEFT JOIN attendance a ON s.staff_id = a.staff_id AND a.attendance_date = ?
      WHERE s.is_active = 1
      ORDER BY s.full_name
    `, [date]);

    const summary = {
      total: data.length,
      present: data.filter(r => r.status === 'present').length,
      absent: data.filter(r => r.status === 'absent').length,
      half_day: data.filter(r => r.status === 'half_day').length,
      leave: data.filter(r => r.status === 'leave').length,
      holiday: data.filter(r => r.status === 'holiday').length,
      unmarked: data.filter(r => !r.status).length
    };

    res.json({ date, data, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== EMPLOYEE LEDGER ==============

exports.getEmployeeLedger = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { from_date, to_date } = req.query;

    const [staff] = await query('SELECT staff_id, employee_id, full_name, department, position, salary FROM staff WHERE staff_id = ?', [staffId]);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    let dateFilter = '';
    const params = [staffId];
    if (from_date && to_date) {
      dateFilter = ' AND date_col BETWEEN ? AND ?';
      params.push(from_date, to_date);
    }

    // Salary payments
    const salaryParams = [staffId];
    let salarySql = 'SELECT payment_id, payment_date as date, amount, deductions, bonuses, net_amount, payment_method, notes FROM salary_payments WHERE staff_id = ?';
    if (from_date && to_date) { salarySql += ' AND payment_date BETWEEN ? AND ?'; salaryParams.push(from_date, to_date); }
    salarySql += ' ORDER BY payment_date DESC';
    const salaryPayments = await query(salarySql, salaryParams);

    // Loans
    const loanParams = [staffId];
    let loanSql = 'SELECT l.*, (SELECT COALESCE(SUM(amount),0) FROM loan_repayments WHERE loan_id = l.loan_id) as total_repaid FROM staff_loans l WHERE l.staff_id = ?';
    if (from_date && to_date) { loanSql += ' AND l.loan_date BETWEEN ? AND ?'; loanParams.push(from_date, to_date); }
    loanSql += ' ORDER BY l.loan_date DESC';
    const loans = await query(loanSql, loanParams);

    // Loan repayments
    const repayParams = [staffId];
    let repaySql = 'SELECT r.*, l.loan_amount FROM loan_repayments r JOIN staff_loans l ON r.loan_id = l.loan_id WHERE r.staff_id = ?';
    if (from_date && to_date) { repaySql += ' AND r.repayment_date BETWEEN ? AND ?'; repayParams.push(from_date, to_date); }
    repaySql += ' ORDER BY r.repayment_date DESC';
    const repayments = await query(repaySql, repayParams);

    // Attendance summary
    const attParams = [staffId];
    let attSql = `SELECT
      SUM(status = 'present') as present,
      SUM(status = 'absent') as absent,
      SUM(status = 'half_day') as half_day,
      SUM(status = 'leave') as on_leave,
      SUM(status = 'holiday') as holiday,
      COUNT(*) as total
      FROM attendance WHERE staff_id = ?`;
    if (from_date && to_date) { attSql += ' AND attendance_date BETWEEN ? AND ?'; attParams.push(from_date, to_date); }
    const [attSummary] = await query(attSql, attParams);

    // Totals
    const totalEarned = salaryPayments.reduce((sum, p) => sum + Number(p.net_amount || 0), 0);
    const totalLoans = loans.reduce((sum, l) => sum + Number(l.loan_amount || 0), 0);
    const totalRepaid = repayments.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const outstandingLoanBalance = loans.filter(l => l.status === 'active').reduce((sum, l) => sum + Number(l.remaining_balance || 0), 0);

    res.json({
      staff,
      salary_payments: salaryPayments,
      loans,
      repayments,
      attendance_summary: {
        present: Number(attSummary.present || 0),
        absent: Number(attSummary.absent || 0),
        half_day: Number(attSummary.half_day || 0),
        leave: Number(attSummary.on_leave || 0),
        holiday: Number(attSummary.holiday || 0),
        total: Number(attSummary.total || 0)
      },
      totals: { totalEarned, totalLoans, totalRepaid, outstandingLoanBalance }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== LOAN MANAGEMENT ==============

exports.getLoans = async (req, res) => {
  try {
    const { status, staff_id } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT l.*, s.full_name, s.employee_id, s.department,
               (SELECT COALESCE(SUM(amount),0) FROM loan_repayments WHERE loan_id = l.loan_id) as total_repaid
               FROM staff_loans l JOIN staff s ON l.staff_id = s.staff_id WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM staff_loans l WHERE 1=1';
    const params = [], countParams = [];

    if (status) { sql += ' AND l.status = ?'; countSql += ' AND l.status = ?'; params.push(status); countParams.push(status); }
    if (staff_id) { sql += ' AND l.staff_id = ?'; countSql += ' AND l.staff_id = ?'; params.push(staff_id); countParams.push(staff_id); }

    sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [loans, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: loans, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createLoan = async (req, res) => {
  try {
    const { staff_id, loan_amount, monthly_deduction, loan_date, reason } = req.body;
    if (!staff_id || !loan_amount || !loan_date) return res.status(400).json({ message: 'Staff, amount and date required' });
    if (Number(loan_amount) <= 0) return res.status(400).json({ message: 'Amount must be positive', field: 'loan_amount' });

    const [staff] = await query('SELECT full_name FROM staff WHERE staff_id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    const result = await query(
      'INSERT INTO staff_loans (staff_id, loan_amount, remaining_balance, monthly_deduction, loan_date, reason, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [staff_id, loan_amount, loan_amount, monthly_deduction || 0, loan_date, reason || null, req.user.user_id]
    );

    await logAction(req.user.user_id, req.user.name, 'LOAN_ISSUED', 'staff_loans', result.insertId, { staff_id, loan_amount, staff_name: staff.full_name }, req.ip);
    res.status(201).json({ message: 'Loan issued', loan_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.repayLoan = async (req, res) => {
  const conn = await getConnection();
  try {
    const { loanId } = req.params;
    const { amount, repayment_date, payment_method, notes } = req.body;
    if (!amount || !repayment_date) return res.status(400).json({ message: 'Amount and date required' });
    if (Number(amount) <= 0) return res.status(400).json({ message: 'Amount must be positive', field: 'amount' });

    await conn.beginTransaction();

    const [loan] = await conn.query('SELECT * FROM staff_loans WHERE loan_id = ? FOR UPDATE', [loanId]);
    if (!loan) { await conn.rollback(); return res.status(404).json({ message: 'Loan not found' }); }
    if (loan.status !== 'active') { await conn.rollback(); return res.status(400).json({ message: 'Loan is not active' }); }
    if (Number(amount) > Number(loan.remaining_balance)) { await conn.rollback(); return res.status(400).json({ message: 'Amount exceeds remaining balance', field: 'amount' }); }

    const newBalance = Number(loan.remaining_balance) - Number(amount);

    await conn.query(
      'INSERT INTO loan_repayments (loan_id, staff_id, amount, repayment_date, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [loanId, loan.staff_id, amount, repayment_date, payment_method || 'cash', notes || null]
    );

    await conn.query(
      'UPDATE staff_loans SET remaining_balance = ?, status = ? WHERE loan_id = ?',
      [newBalance, newBalance <= 0 ? 'completed' : 'active', loanId]
    );

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'LOAN_REPAYMENT', 'staff_loans', loanId, { staff_id: loan.staff_id, amount, remaining: newBalance }, req.ip);
    res.json({ message: newBalance <= 0 ? 'Loan fully repaid' : 'Repayment recorded', remaining_balance: newBalance });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

exports.cancelLoan = async (req, res) => {
  try {
    const { loanId } = req.params;
    const [loan] = await query('SELECT * FROM staff_loans WHERE loan_id = ?', [loanId]);
    if (!loan) return res.status(404).json({ message: 'Loan not found' });
    if (loan.status !== 'active') return res.status(400).json({ message: 'Only active loans can be cancelled' });

    await query('UPDATE staff_loans SET status = ? WHERE loan_id = ?', ['cancelled', loanId]);
    await logAction(req.user.user_id, req.user.name, 'LOAN_CANCELLED', 'staff_loans', loanId, { staff_id: loan.staff_id }, req.ip);
    res.json({ message: 'Loan cancelled' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getLoanRepayments = async (req, res) => {
  try {
    const { loanId } = req.params;
    const repayments = await query(
      'SELECT * FROM loan_repayments WHERE loan_id = ? ORDER BY repayment_date DESC', [loanId]
    );
    res.json({ data: repayments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== SALARY INCREMENTS ==============

exports.getIncrements = async (req, res) => {
  try {
    const { staff_id } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT i.*, s.full_name, s.employee_id, s.department, u.name as approved_by_name
               FROM salary_increments i
               JOIN staff s ON i.staff_id = s.staff_id
               LEFT JOIN users u ON i.approved_by = u.user_id WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM salary_increments WHERE 1=1';
    const params = [], countParams = [];

    if (staff_id) { sql += ' AND i.staff_id = ?'; countSql += ' AND staff_id = ?'; params.push(staff_id); countParams.push(staff_id); }

    sql += ' ORDER BY i.effective_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [increments, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: increments, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createIncrement = async (req, res) => {
  const conn = await getConnection();
  try {
    const { staff_id, new_salary, effective_date, reason } = req.body;
    if (!staff_id || !new_salary || !effective_date) return res.status(400).json({ message: 'Staff, new salary and effective date required' });
    if (Number(new_salary) < 0) return res.status(400).json({ message: 'Salary cannot be negative', field: 'new_salary' });

    await conn.beginTransaction();

    const [staff] = await conn.query('SELECT staff_id, full_name, salary FROM staff WHERE staff_id = ?', [staff_id]);
    if (!staff) { await conn.rollback(); return res.status(404).json({ message: 'Staff not found' }); }

    const oldSalary = Number(staff.salary || 0);
    const newSal = Number(new_salary);
    const incrementAmount = newSal - oldSalary;
    const incrementPercentage = oldSalary > 0 ? ((incrementAmount / oldSalary) * 100) : 0;

    await conn.query(
      'INSERT INTO salary_increments (staff_id, old_salary, new_salary, increment_amount, increment_percentage, effective_date, reason, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [staff_id, oldSalary, newSal, incrementAmount, incrementPercentage.toFixed(2), effective_date, reason || null, req.user.user_id]
    );

    // Update staff salary
    await conn.query('UPDATE staff SET salary = ? WHERE staff_id = ?', [newSal, staff_id]);

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'SALARY_INCREMENT', 'salary_increments', staff_id, { old_salary: oldSalary, new_salary: newSal, staff_name: staff.full_name }, req.ip);
    res.status(201).json({ message: 'Salary increment applied', old_salary: oldSalary, new_salary: newSal, increment_amount: incrementAmount });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

// ============== PAYROLL PROCESSING ==============

exports.getPayrollPreview = async (req, res) => {
  try {
    const { from_date, to_date, payment_date, department } = req.query;
    if (!from_date || !to_date || !payment_date) {
      return res.status(400).json({ message: 'from_date, to_date, and payment_date required' });
    }

    let sql = `
      SELECT s.staff_id, s.employee_id, s.full_name, s.department, s.position,
             s.salary, s.salary_type,
             COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.monthly_deduction ELSE 0 END), 0) as loan_deduction
      FROM staff s
      LEFT JOIN staff_loans l ON s.staff_id = l.staff_id AND l.status = 'active'
      WHERE s.is_active = 1 AND s.salary IS NOT NULL AND s.salary > 0
    `;
    const params = [];
    if (department) { sql += ' AND s.department = ?'; params.push(department); }
    sql += ' GROUP BY s.staff_id ORDER BY s.full_name';

    const staff = await query(sql, params);

    const preview = staff.map(s => {
      const baseSalary = Number(s.salary || 0);
      const loanDeduction = Number(s.loan_deduction || 0);
      const netSalary = baseSalary - loanDeduction;

      return {
        staff_id: s.staff_id,
        employee_id: s.employee_id,
        full_name: s.full_name,
        department: s.department,
        position: s.position,
        salary_type: s.salary_type,
        base_salary: baseSalary,
        deductions: loanDeduction,
        bonuses: 0,
        net_amount: netSalary,
        payment_date,
        from_date,
        to_date
      };
    });

    const totals = preview.reduce((acc, p) => ({
      count: acc.count + 1,
      total_base: acc.total_base + p.base_salary,
      total_deductions: acc.total_deductions + p.deductions,
      total_net: acc.total_net + p.net_amount
    }), { count: 0, total_base: 0, total_deductions: 0, total_net: 0 });

    res.json({ preview, totals });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.processPayroll = async (req, res) => {
  const conn = await getConnection();
  try {
    const { payments } = req.body;
    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return res.status(400).json({ message: 'Payments array required' });
    }

    await conn.beginTransaction();

    let successCount = 0;
    const errors = [];

    for (const payment of payments) {
      try {
        const { staff_id, payment_date, from_date, to_date, amount, deductions, bonuses, net_amount, notes } = payment;

        if (!staff_id || !payment_date || !from_date || !to_date || amount === undefined || net_amount === undefined) {
          errors.push({ staff_id, error: 'Missing required fields' });
          continue;
        }

        const expectedNet = Number(amount) - Number(deductions || 0) + Number(bonuses || 0);
        if (Math.abs(expectedNet - Number(net_amount)) > 0.01) {
          errors.push({ staff_id, error: 'Net amount calculation mismatch' });
          continue;
        }

        await conn.query(
          'INSERT INTO salary_payments (staff_id, payment_date, from_date, to_date, amount, deductions, bonuses, net_amount, payment_method, notes, paid_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [staff_id, payment_date, from_date, to_date, amount, deductions || 0, bonuses || 0, net_amount, 'bank_transfer', notes || 'Bulk payroll processing', req.user.user_id]
        );

        successCount++;
      } catch (err) {
        errors.push({ staff_id: payment.staff_id, error: err.message });
      }
    }

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'PAYROLL_PROCESSED', 'salary_payments', null, { count: successCount }, req.ip);

    res.json({ message: `Payroll processed: ${successCount} payments recorded`, successCount, errors });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

// ============== ADVANCE SALARY ==============

exports.getAdvancePayments = async (req, res) => {
  try {
    const { staff_id } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT a.*, s.full_name, s.employee_id, s.department
               FROM advance_payments a
               JOIN staff s ON a.staff_id = s.staff_id WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM advance_payments WHERE 1=1';
    const params = [], countParams = [];

    if (staff_id) { sql += ' AND a.staff_id = ?'; countSql += ' AND staff_id = ?'; params.push(staff_id); countParams.push(staff_id); }

    sql += ' ORDER BY a.payment_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [advances, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: advances, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createAdvancePayment = async (req, res) => {
  try {
    const { staff_id, amount, payment_date, reason, payment_method } = req.body;
    if (!staff_id || !amount || !payment_date) return res.status(400).json({ message: 'Staff, amount and date required' });
    if (Number(amount) <= 0) return res.status(400).json({ message: 'Amount must be positive', field: 'amount' });

    const [staff] = await query('SELECT full_name FROM staff WHERE staff_id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    const result = await query(
      'INSERT INTO advance_payments (staff_id, amount, payment_date, payment_method, reason, paid_by) VALUES (?, ?, ?, ?, ?, ?)',
      [staff_id, amount, payment_date, payment_method || 'cash', reason || null, req.user.user_id]
    );

    await logAction(req.user.user_id, req.user.name, 'ADVANCE_PAYMENT', 'advance_payments', result.insertId, { staff_id, amount, staff_name: staff.full_name }, req.ip);
    res.status(201).json({ message: 'Advance payment recorded', advance_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== HOLIDAY CALENDAR ==============

exports.getHolidays = async (req, res) => {
  try {
    const { year } = req.query;
    let sql = 'SELECT * FROM holidays';
    const params = [];
    if (year) { sql += ' WHERE YEAR(holiday_date) = ?'; params.push(year); }
    sql += ' ORDER BY holiday_date ASC';

    const holidays = await query(sql, params);
    res.json({ data: holidays });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createHoliday = async (req, res) => {
  try {
    const { holiday_date, holiday_name, description } = req.body;
    if (!holiday_date || !holiday_name) return res.status(400).json({ message: 'Date and name required' });

    const result = await query(
      'INSERT INTO holidays (holiday_date, holiday_name, description, created_by) VALUES (?, ?, ?, ?)',
      [holiday_date, holiday_name, description || null, req.user.user_id]
    );

    await logAction(req.user.user_id, req.user.name, 'HOLIDAY_CREATED', 'holidays', result.insertId, { holiday_name, holiday_date }, req.ip);
    res.status(201).json({ message: 'Holiday created', holiday_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const { holiday_date, holiday_name, description } = req.body;
    if (!holiday_date || !holiday_name) return res.status(400).json({ message: 'Date and name required' });

    await query(
      'UPDATE holidays SET holiday_date=?, holiday_name=?, description=? WHERE holiday_id=?',
      [holiday_date, holiday_name, description || null, id]
    );

    await logAction(req.user.user_id, req.user.name, 'HOLIDAY_UPDATED', 'holidays', id, { holiday_name }, req.ip);
    res.json({ message: 'Holiday updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM holidays WHERE holiday_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'HOLIDAY_DELETED', 'holidays', id, {}, req.ip);
    res.json({ message: 'Holiday deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ============== LEAVE REQUESTS ==============

exports.getLeaveRequests = async (req, res) => {
  try {
    const { status, staff_id } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT lr.*, s.full_name, s.employee_id, s.department,
               u1.name as requested_by_name, u2.name as reviewed_by_name
               FROM leave_requests lr
               JOIN staff s ON lr.staff_id = s.staff_id
               LEFT JOIN users u1 ON lr.requested_by = u1.user_id
               LEFT JOIN users u2 ON lr.reviewed_by = u2.user_id WHERE 1=1`;
    let countSql = 'SELECT COUNT(*) as total FROM leave_requests WHERE 1=1';
    const params = [], countParams = [];

    if (status) { sql += ' AND lr.status = ?'; countSql += ' AND status = ?'; params.push(status); countParams.push(status); }
    if (staff_id) { sql += ' AND lr.staff_id = ?'; countSql += ' AND staff_id = ?'; params.push(staff_id); countParams.push(staff_id); }

    sql += ' ORDER BY lr.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [requests, [{total}]] = await Promise.all([query(sql, params), query(countSql, countParams)]);
    res.json({ data: requests, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createLeaveRequest = async (req, res) => {
  try {
    const { staff_id, leave_type, from_date, to_date, reason } = req.body;
    if (!staff_id || !leave_type || !from_date || !to_date) return res.status(400).json({ message: 'All fields required' });
    if (new Date(from_date) > new Date(to_date)) return res.status(400).json({ message: 'From date must be before to date', field: 'from_date' });

    const [staff] = await query('SELECT full_name, leave_balance FROM staff WHERE staff_id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });

    const days = Math.ceil((new Date(to_date) - new Date(from_date)) / (1000 * 60 * 60 * 24)) + 1;

    const result = await query(
      'INSERT INTO leave_requests (staff_id, leave_type, from_date, to_date, days, reason, requested_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [staff_id, leave_type, from_date, to_date, days, reason || null, req.user.user_id]
    );

    await logAction(req.user.user_id, req.user.name, 'LEAVE_REQUESTED', 'leave_requests', result.insertId, { staff_id, days, staff_name: staff.full_name }, req.ip);
    res.status(201).json({ message: 'Leave request submitted', request_id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.reviewLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, review_notes } = req.body;
    if (!status || !['approved', 'rejected'].includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const [request] = await query('SELECT * FROM leave_requests WHERE request_id = ?', [id]);
    if (!request) return res.status(404).json({ message: 'Leave request not found' });
    if (request.status !== 'pending') return res.status(400).json({ message: 'Only pending requests can be reviewed' });

    await query(
      'UPDATE leave_requests SET status=?, review_notes=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP WHERE request_id=?',
      [status, review_notes || null, req.user.user_id, id]
    );

    await logAction(req.user.user_id, req.user.name, `LEAVE_${status.toUpperCase()}`, 'leave_requests', id, { staff_id: request.staff_id, days: request.days }, req.ip);
    res.json({ message: `Leave request ${status}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
