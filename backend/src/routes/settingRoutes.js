const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');
const notificationController = require('../controllers/notificationController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Notifications
router.get('/notifications', notificationController.getNotifications);
router.patch('/notifications/:id/read', notificationController.markAsRead);
router.patch('/notifications/read-all', notificationController.markAllRead);

// Clinic profile
router.get('/clinic', authorize('SUPER_ADMIN', 'ADMIN'), settingController.getClinic);
router.put('/clinic', authorize('SUPER_ADMIN', 'ADMIN'), settingController.updateClinic);

// Settings (all settings - managed from admin dashboard)
router.route('/')
  .get(authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), settingController.getSettings);

router.route('/:key')
  .get(authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), settingController.getSetting)
  .put(authorize('SUPER_ADMIN', 'ADMIN'), settingController.setSetting)
  .delete(authorize('SUPER_ADMIN'), settingController.deleteSetting);

module.exports = router;
