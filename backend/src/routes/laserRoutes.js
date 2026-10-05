const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const laserController = require('../controllers/laserController');

router.use(protect);

router.get('/stats', authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'), laserController.getLaserStats);
router.get('/running-no', authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'), laserController.getLaserRunningNo);

router.route('/')
  .get(authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'), laserController.getLaserSessions)
  .post(authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'), laserController.createLaserSession);

router.route('/:id')
  .get(authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'), laserController.getLaserSession)
  .put(authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'), laserController.updateLaserSession)
  .delete(authorize('SUPER_ADMIN', 'ADMIN'), laserController.deleteLaserSession);

module.exports = router;