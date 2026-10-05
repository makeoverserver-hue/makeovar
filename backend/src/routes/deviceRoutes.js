const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/types', deviceController.getDeviceTypes);

router.route('/')
  .get(deviceController.getDevices)
  .post(authorize('SUPER_ADMIN', 'ADMIN'), deviceController.createDevice);

router.route('/:id')
  .get(deviceController.getDevice)
  .put(authorize('SUPER_ADMIN', 'ADMIN', 'TECHNICIAN', 'DOCTOR'), deviceController.updateDevice)
  .delete(authorize('SUPER_ADMIN', 'ADMIN'), deviceController.deleteDevice);

router.patch('/:id/maintenance', authorize('SUPER_ADMIN', 'ADMIN', 'TECHNICIAN'), deviceController.updateDeviceMaintenance);
router.get('/:id/pulses', deviceController.getDevicePulseStats);

module.exports = router;
