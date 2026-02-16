const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accountingController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Account Groups
router.get('/account-groups', accountingController.getAccountGroups);

// Chart of Accounts
router.get('/accounts', accountingController.getAccounts);
router.get('/accounts/:id', accountingController.getAccountById);
router.post('/accounts', authorize('Admin', 'Manager'), accountingController.createAccount);
router.put('/accounts/:id', authorize('Admin', 'Manager'), accountingController.updateAccount);
router.delete('/accounts/:id', authorize('Admin'), accountingController.deleteAccount);

// Journal Entries
router.get('/journal-entries', accountingController.getJournalEntries);
router.get('/journal-entries/:id', accountingController.getJournalEntryById);
router.post('/journal-entries', authorize('Admin', 'Manager'), accountingController.createJournalEntry);
router.post('/journal-entries/:id/post', authorize('Admin', 'Manager'), accountingController.postJournalEntry);
router.delete('/journal-entries/:id', authorize('Admin'), accountingController.deleteJournalEntry);

// General Ledger
router.get('/general-ledger', accountingController.getGeneralLedger);

// Bank Accounts
router.get('/bank-accounts', accountingController.getBankAccounts);
router.get('/bank-accounts/:id', accountingController.getBankAccountById);
router.post('/bank-accounts', authorize('Admin', 'Manager'), accountingController.createBankAccount);
router.put('/bank-accounts/:id', authorize('Admin', 'Manager'), accountingController.updateBankAccount);
router.delete('/bank-accounts/:id', authorize('Admin'), accountingController.deleteBankAccount);

// Payment Vouchers
router.get('/payment-vouchers', accountingController.getPaymentVouchers);
router.post('/payment-vouchers', authorize('Admin', 'Manager'), accountingController.createPaymentVoucher);
router.delete('/payment-vouchers/:id', authorize('Admin'), accountingController.deletePaymentVoucher);

// Receipt Vouchers
router.get('/receipt-vouchers', accountingController.getReceiptVouchers);
router.post('/receipt-vouchers', authorize('Admin', 'Manager'), accountingController.createReceiptVoucher);
router.delete('/receipt-vouchers/:id', authorize('Admin'), accountingController.deleteReceiptVoucher);

// Reports
router.get('/reports/trial-balance', accountingController.getTrialBalance);
router.get('/reports/profit-loss', accountingController.getProfitLoss);
router.get('/reports/balance-sheet', accountingController.getBalanceSheet);

module.exports = router;
