const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/stats', invoiceController.getInvoiceStats);

router.route('/')
  .get(invoiceController.getInvoices)
  .post(invoiceController.createInvoice);

router.route('/:id')
  .get(invoiceController.getInvoice)
  .delete(authorize('SUPER_ADMIN', 'ADMIN'), invoiceController.deleteInvoice);

router.post('/:id/payments', invoiceController.recordPayment);
router.patch('/:id/status', invoiceController.updateInvoiceStatus);
router.get('/:id/installments', invoiceController.getInstallments);
router.post('/:id/installments', invoiceController.createInstallmentPlan);
router.post('/:id/installments/:iid/pay', invoiceController.payInstallment);

module.exports = router;
