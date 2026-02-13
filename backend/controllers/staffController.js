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
