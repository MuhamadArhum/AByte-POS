const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Report endpoints (most specific paths first)
router.get('/reports/attendance-monthly', staffController.getMonthlyAttendanceReport);
router.get('/reports/salary-summary', staffController.getSalarySummaryReport);
router.get('/reports/salary-sheet', staffController.getSalarySheet);
router.get('/reports/daily-attendance', staffController.getDailyAttendance);
router.get('/reports/employee-ledger/:staffId', staffController.getEmployeeLedger);

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
