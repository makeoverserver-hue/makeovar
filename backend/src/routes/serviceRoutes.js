const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(serviceController.getServices)
  .post(authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), serviceController.createService);

router.route('/:id')
  .get(serviceController.getService)
  .put(authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), serviceController.updateService)
  .delete(authorize('SUPER_ADMIN', 'ADMIN'), serviceController.deleteService);

module.exports = router;
