const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/treatmentSessionController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(sessionController.getSessions)
  .post(sessionController.createSession);

router.route('/:id')
  .get(sessionController.getSession)
  .put(sessionController.updateSession)
  .delete(authorize('SUPER_ADMIN', 'ADMIN'), sessionController.deleteSession);

router.patch('/:id/complete', sessionController.completeSession);

module.exports = router;
