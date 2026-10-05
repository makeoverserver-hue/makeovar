const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Commissions
router.get('/commissions', userController.getCommissions);
router.post('/commissions', authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), userController.createCommission);
router.patch('/commissions/:id/paid', authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), userController.markCommissionPaid);

// Staff
router.route('/')
  .get(userController.getUsers)
  .post(authorize('SUPER_ADMIN', 'ADMIN'), userController.createUser);

router.route('/:id')
  .get(userController.getUser)
  .put(authorize('SUPER_ADMIN', 'ADMIN'), userController.updateUser)
  .delete(authorize('SUPER_ADMIN', 'ADMIN'), userController.deleteUser);

router.patch('/:id/reset-password', authorize('SUPER_ADMIN', 'ADMIN'), userController.resetUserPassword);

module.exports = router;
