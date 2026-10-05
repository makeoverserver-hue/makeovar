const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const expenseController = require('../controllers/expenseController');

router.use(protect);
router.route('/')
  .get(authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'), expenseController.getExpenses)
  .post(authorize('SUPER_ADMIN', 'ADMIN'), expenseController.createExpense);

router.get('/stats', authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'), expenseController.getExpenseStats);

router.route('/:id')
  .get(authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'), expenseController.getExpense)
  .put(authorize('SUPER_ADMIN', 'ADMIN'), expenseController.updateExpense)
  .delete(authorize('SUPER_ADMIN', 'ADMIN'), expenseController.deleteExpense);

module.exports = router;