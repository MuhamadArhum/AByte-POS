const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('Admin', 'Manager'));

router.get('/actions', auditController.getActions);
router.get('/export', auditController.exportLogs);
router.get('/', auditController.getLogs);
router.get('/:id', auditController.getLogById);

module.exports = router;
