const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accountingController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule }                   = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('accounting'));

router.get('/account-groups', accountingController.getAccountGroups);

router.get('/accounts', accountingController.getAccounts);
router.get('/accounts/next-code', accountingController.getNextCode);
router.get('/accounts/:id', accountingController.getAccountById);
router.post('/accounts', requirePermission('accounts.vouchers'), accountingController.createAccount);
router.put('/accounts/:id', requirePermission('accounts.vouchers'), accountingController.updateAccount);
router.delete('/accounts/:id', requirePermission('accounts.vouchers'), accountingController.deleteAccount);

router.get('/journal-entries', accountingController.getJournalEntries);
router.get('/journal-entries/:id', accountingController.getJournalEntryById);
router.post('/journal-entries', requirePermission('accounts.vouchers'), accountingController.createJournalEntry);
router.post('/journal-entries/:id/post', requirePermission('accounts.vouchers'), accountingController.postJournalEntry);
router.delete('/journal-entries/:id', requirePermission('accounts.vouchers'), accountingController.deleteJournalEntry);

router.get('/general-ledger', accountingController.getGeneralLedger);

router.get('/bank-accounts', accountingController.getBankAccounts);
router.get('/bank-accounts/:id', accountingController.getBankAccountById);
router.post('/bank-accounts', requirePermission('accounts.vouchers'), accountingController.createBankAccount);
router.put('/bank-accounts/:id', requirePermission('accounts.vouchers'), accountingController.updateBankAccount);
router.delete('/bank-accounts/:id', requirePermission('accounts.vouchers'), accountingController.deleteBankAccount);

router.get('/payment-vouchers/next-number', accountingController.getNextPaymentVoucherNumber);
router.get('/payment-vouchers', accountingController.getPaymentVouchers);
router.post('/payment-vouchers', requirePermission('accounts.vouchers'), accountingController.createPaymentVoucher);
router.delete('/payment-vouchers/:id', requirePermission('accounts.vouchers'), accountingController.deletePaymentVoucher);

router.get('/receipt-vouchers/next-number', accountingController.getNextReceiptVoucherNumber);
router.get('/receipt-vouchers', accountingController.getReceiptVouchers);
router.post('/receipt-vouchers', requirePermission('accounts.vouchers'), accountingController.createReceiptVoucher);
router.delete('/receipt-vouchers/:id', requirePermission('accounts.vouchers'), accountingController.deleteReceiptVoucher);

router.get('/reports/trial-balance', accountingController.getTrialBalance);
router.get('/reports/trial-balance-6col', accountingController.getTrialBalance6Col);
router.get('/reports/profit-loss', accountingController.getProfitLoss);
router.get('/reports/balance-sheet', accountingController.getBalanceSheet);
router.get('/reports/analytics', accountingController.getAccountingAnalytics);

module.exports = router;
