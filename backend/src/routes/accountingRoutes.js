const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/accountingController');

router.use(protect);

const ACCOUNTING = ['SUPER_ADMIN', 'ADMIN'];
const REPORTS = ['SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'];

router.get('/summary', authorize(...REPORTS), ctrl.getAccountingSummary);
router.get('/pnl/monthly', authorize(...ACCOUNTING), ctrl.getMonthlyPnL);
router.get('/pnl/yearly', authorize(...ACCOUNTING), ctrl.getYearlyPnL);
router.get('/pnl/daily', authorize(...ACCOUNTING), ctrl.getDailyPnL);
router.get('/cash-flow', authorize(...ACCOUNTING), ctrl.getCashFlow);
router.get('/tax', authorize(...ACCOUNTING), ctrl.getTaxSummary);
router.get('/ar-aging', authorize(...ACCOUNTING), ctrl.getARAging);
router.get('/commissions', authorize(...ACCOUNTING), ctrl.getCommissionLiability);
router.get('/installments', authorize(...ACCOUNTING), ctrl.getInstallmentsReceivable);
router.get('/receivables', authorize(...ACCOUNTING), ctrl.getCombinedReceivables);
router.get('/revenue-breakdown', authorize(...REPORTS), ctrl.getRevenueBreakdown);

module.exports = router;