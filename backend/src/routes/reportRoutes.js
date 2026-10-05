const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/dashboard', reportController.getDashboardStats);
router.get('/revenue', reportController.getRevenueReport);
router.get('/treatment', reportController.getTreatmentReport);
router.get('/doctors', reportController.getDoctorReport);
router.get('/inventory', reportController.getInventoryReport);

module.exports = router;
