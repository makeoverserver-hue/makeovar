const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/calendar', appointmentController.getCalendar);
router.get('/stats', appointmentController.getAppointmentStats);

router.route('/')
  .get(appointmentController.getAppointments)
  .post(appointmentController.createAppointment);

router.route('/:id')
  .get(appointmentController.getAppointment)
  .put(appointmentController.updateAppointment)
  .delete(appointmentController.deleteAppointment);

router.patch('/:id/status', appointmentController.changeAppointmentStatus);

module.exports = router;
