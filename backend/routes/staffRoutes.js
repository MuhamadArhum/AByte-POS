const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Specific routes first (before parameterized routes)
router.get('/attendance', staffController.getAttendance);
router.post('/attendance', authorize('Admin', 'Manager'), staffController.markAttendance);
router.post('/attendance/bulk', authorize('Admin', 'Manager'), staffController.markBulkAttendance);

// General routes
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
