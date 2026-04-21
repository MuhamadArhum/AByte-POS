const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('Admin'));

router.post('/', backupController.createBackup);
router.get('/', backupController.listBackups);
router.post('/restore', backupController.restoreBackup);
router.get('/download/:filename', backupController.downloadBackup);
router.delete('/:filename', backupController.deleteBackup);

module.exports = router;
