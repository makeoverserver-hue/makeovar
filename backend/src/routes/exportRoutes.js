const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const exportController = require('../controllers/exportController');

router.use(protect);

router.get('/revenue.csv', authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'), exportController.exportRevenue);
router.get('/expenses.csv', authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'), exportController.exportExpenses);
router.get('/invoices.csv', authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'), exportController.exportInvoices);
router.get('/patients.csv', authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'), exportController.exportPatients);
router.get('/sessions.csv', authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'), exportController.exportSessions);

module.exports = router;