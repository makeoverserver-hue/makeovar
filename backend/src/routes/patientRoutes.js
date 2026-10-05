const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');
const medicalRecordController = require('../controllers/medicalRecordController');
const photoController = require('../controllers/photoController');
const consentController = require('../controllers/consentController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../utils/upload');

// All routes protected
router.use(protect);

router.route('/')
  .get(patientController.getPatients)
  .post(patientController.createPatient);

router.get('/stats/locations', patientController.getPatientLocationStats);

// Medical records
router.route('/:patientId/records')
  .get(medicalRecordController.getRecords)
  .post(authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'), medicalRecordController.createRecord);

router.route('/records/:id')
  .put(authorize('SUPER_ADMIN', 'ADMIN', 'DOCTOR', 'NURSE'), medicalRecordController.updateRecord)
  .delete(authorize('SUPER_ADMIN', 'ADMIN'), medicalRecordController.deleteRecord);

// Photos
router.get('/photos', photoController.getPhotos);
router.post('/photos', upload.single('photo'), photoController.uploadPhoto);
router.delete('/photos/:id', photoController.deletePhoto);

// Consents
router.route('/:patientId/consents')
  .get(consentController.getConsents)
  .post(consentController.createConsent);

// Patient by id (last so static sub-routes win)
router.get('/:id/stats', patientController.getPatientStats);
router.route('/:id')
  .get(patientController.getPatient)
  .put(patientController.updatePatient)
  .delete(authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), patientController.deletePatient);

module.exports = router;
