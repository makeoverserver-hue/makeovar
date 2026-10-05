const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { body } = require('express-validator');

router.post('/register', [
  body('fullName').notEmpty().withMessage('الاسم مطلوب'),
  body('email').isEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('password').isLength({ min: 6 }).withMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
], validate, authController.register);

router.post('/login', [
  body('email').isEmail().withMessage('البريد الإلكتروني غير صالح'),
  body('password').notEmpty().withMessage('كلمة المرور مطلوبة'),
], validate, authController.login);

router.post('/refresh', authController.refresh);
router.use(protect);
router.get('/me', authController.getMe);
router.put('/me', authController.updateMe);
router.put('/change-password', authController.changePassword);
router.post('/logout', authController.logout);

module.exports = router;
