const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/issuanceController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Stock Issues
router.get('/issues',            ctrl.getIssues);
router.get('/issues/:id',        ctrl.getIssueById);
router.post('/issues',           authorize('Admin', 'Manager'), ctrl.createIssue);
router.put('/issues/:id',        authorize('Admin', 'Manager'), ctrl.updateIssue);
router.delete('/issues/:id',     authorize('Admin'), ctrl.deleteIssue);

// Stock Issue Returns
router.get('/returns',           ctrl.getReturns);
router.get('/returns/:id',       ctrl.getReturnById);
router.post('/returns',          authorize('Admin', 'Manager'), ctrl.createReturn);

// Raw Sales
router.get('/raw-sales',         ctrl.getRawSales);
router.get('/raw-sales/:id',     ctrl.getRawSaleById);
router.post('/raw-sales',        authorize('Admin', 'Manager'), ctrl.createRawSale);
router.delete('/raw-sales/:id',  authorize('Admin'), ctrl.deleteRawSale);

module.exports = router;
