const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getFollowUps, getFollowUp, getFollowUpStats,
  createFollowUp, updateFollowUp, deleteFollowUp,
} = require('../controllers/followUpController');

router.use(protect);

router.get('/', getFollowUps);
router.get('/stats', getFollowUpStats);
router.post('/', authorize('ADMIN', 'MANAGER', 'DOCTOR', 'RECEPTIONIST', 'SUPER_ADMIN'), createFollowUp);
router.get('/:id', getFollowUp);
router.patch('/:id', authorize('ADMIN', 'MANAGER', 'DOCTOR', 'RECEPTIONIST', 'SUPER_ADMIN'), updateFollowUp);
router.delete('/:id', authorize('ADMIN', 'MANAGER', 'SUPER_ADMIN'), deleteFollowUp);

module.exports = router;