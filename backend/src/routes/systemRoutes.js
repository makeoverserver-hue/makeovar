const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { getAuditLogs } = notificationController;
const consentController = require('../controllers/consentController');
const photoController = require('../controllers/photoController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../utils/upload');
const backupController = require('../controllers/backupController');

router.use(protect);

// Audit logs
router.get('/audit-logs', authorize('SUPER_ADMIN', 'ADMIN'), getAuditLogs);

// Backups
router.get('/backups', authorize('SUPER_ADMIN', 'ADMIN'), backupController.getBackups);
router.post('/backups', authorize('SUPER_ADMIN', 'ADMIN'), backupController.backupNow);
router.get('/backups/:name/download', authorize('SUPER_ADMIN', 'ADMIN'), backupController.downloadBackup);
router.post('/backups/restore', authorize('SUPER_ADMIN', 'ADMIN'), backupController.restoreUpload.single('backup'), backupController.restoreBackup);

// Consent forms (global)
router.get('/consents', consentController.getConsents);
router.route('/consents/:id')
  .get(consentController.getConsent)
  .put(authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR'), consentController.updateConsent)
  .delete(authorize('SUPER_ADMIN', 'ADMIN'), consentController.deleteConsent);
router.post('/consents', authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'), consentController.createConsent);
router.patch('/consents/:id/sign', consentController.signConsent);

// Photos (global)
router.get('/photos', photoController.getPhotos);

module.exports = router;
