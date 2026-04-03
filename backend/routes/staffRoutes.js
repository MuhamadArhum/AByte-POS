const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { authenticate, authorize } = require('../middleware/auth');
const { requireModule }           = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('hr_payroll')); // Professional+ plan required

// Report endpoints (most specific paths first)
router.get('/reports/attendance-monthly', staffController.getMonthlyAttendanceReport);
router.get('/reports/salary-summary', staffController.getSalarySummaryReport);
router.get('/reports/salary-sheet', staffController.getSalarySheet);
router.get('/reports/daily-attendance', staffController.getDailyAttendance);
router.get('/reports/employee-ledger/:staffId', staffController.getEmployeeLedger);

// Payroll routes
router.get('/payroll/preview', authorize('Admin', 'Manager'), staffController.getPayrollPreview);
router.post('/payroll/process', authorize('Admin'), staffController.processPayroll);

// Advance payments
router.get('/advance-payments', staffController.getAdvancePayments);
router.post('/advance-payments', authorize('Admin', 'Manager'), staffController.createAdvancePayment);

// Holidays
router.get('/holidays', staffController.getHolidays);
router.post('/holidays', authorize('Admin', 'Manager'), staffController.createHoliday);
router.put('/holidays/:id', authorize('Admin', 'Manager'), staffController.updateHoliday);
router.delete('/holidays/:id', authorize('Admin'), staffController.deleteHoliday);

// Leave requests
router.get('/leave-requests', staffController.getLeaveRequests);
router.post('/leave-requests', authorize('Admin', 'Manager'), staffController.createLeaveRequest);
router.put('/leave-requests/:id/review', authorize('Admin', 'Manager'), staffController.reviewLeaveRequest);

// Loan routes (before parameterized staff routes)
router.get('/loans', staffController.getLoans);
router.post('/loans', authorize('Admin', 'Manager'), staffController.createLoan);
router.get('/loans/:loanId/repayments', staffController.getLoanRepayments);
router.post('/loans/:loanId/repay', authorize('Admin', 'Manager'), staffController.repayLoan);
router.put('/loans/:loanId/cancel', authorize('Admin', 'Manager'), staffController.cancelLoan);

// Increment routes
router.get('/increments', staffController.getIncrements);
router.post('/increments', authorize('Admin', 'Manager'), staffController.createIncrement);

// Attendance routes
router.get('/attendance', staffController.getAttendance);
router.post('/attendance', authorize('Admin', 'Manager'), staffController.markAttendance);
router.post('/attendance/bulk', authorize('Admin', 'Manager'), staffController.markBulkAttendance);
router.put('/attendance/:id', authorize('Admin', 'Manager'), staffController.updateAttendance);
router.delete('/attendance/:id', authorize('Admin'), staffController.deleteAttendance);

// Salary payment edit/delete (before parameterized staff routes)
router.put('/salary-payment/:id', authorize('Admin'), staffController.updateSalaryPayment);
router.delete('/salary-payment/:id', authorize('Admin'), staffController.deleteSalaryPayment);

// Departments
router.get('/departments', staffController.getDepartments);
router.post('/departments', authorize('Admin'), staffController.createDepartment);
router.put('/departments/:id', authorize('Admin'), staffController.updateDepartment);
router.delete('/departments/:id', authorize('Admin'), staffController.deleteDepartment);

// Salary components
router.get('/salary-components', staffController.getSalaryComponents);
router.post('/salary-components', authorize('Admin'), staffController.createSalaryComponent);
router.put('/salary-components/:id', authorize('Admin'), staffController.updateSalaryComponent);
router.delete('/salary-components/:id', authorize('Admin'), staffController.deleteSalaryComponent);

// Staff salary components
router.get('/staff-components/:staffId', staffController.getStaffComponents);
router.post('/staff-components/:staffId', authorize('Admin'), staffController.saveStaffComponents);

// Shifts
router.get('/shifts', staffController.getShifts);
router.post('/shifts', authorize('Admin'), staffController.createShift);
router.put('/shifts/:id', authorize('Admin'), staffController.updateShift);
router.delete('/shifts/:id', authorize('Admin'), staffController.deleteShift);

// Performance Appraisals
router.get('/appraisals', staffController.getAppraisals);
router.post('/appraisals', authorize('Admin', 'Manager'), staffController.createAppraisal);
router.put('/appraisals/:id', authorize('Admin', 'Manager'), staffController.updateAppraisal);
router.delete('/appraisals/:id', authorize('Admin'), staffController.deleteAppraisal);

// Exit Management
router.get('/exit-requests', staffController.getExitRequests);
router.post('/exit-requests', authorize('Admin'), staffController.createExitRequest);
router.put('/exit-requests/:id/review', authorize('Admin'), staffController.reviewExitRequest);

// Leave Policies
router.get('/leave-policies', staffController.getLeavePolicies);
router.put('/leave-policies/:leave_type', authorize('Admin'), staffController.updateLeavePolicy);
router.post('/leave-policies/carry-forward', authorize('Admin'), staffController.processLeaveCarryForward);

// General staff routes
router.get('/', staffController.getAll);
router.post('/', authorize('Admin'), staffController.create);

// Parameterized routes last
router.get('/:id', staffController.getById);
router.get('/:id/attendance', staffController.getStaffAttendance);
router.get('/:id/salary-payments', staffController.getSalaryPayments);
router.put('/:id', authorize('Admin'), staffController.update);
router.delete('/:id', authorize('Admin'), staffController.delete);
router.post('/:id/salary-payment', authorize('Admin'), staffController.paySalary);

module.exports = router;
