const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/sales', packageController.getPackageSales);

router.route('/')
  .get(packageController.getPackages)
  .post(authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), packageController.createPackage);

router.post('/:packageId/sell', packageController.sellPackage);
router.patch('/sales/:id/cancel', authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), packageController.cancelPackageSale);

router.route('/:id')
  .get(packageController.getPackage)
  .put(authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), packageController.updatePackage)
  .delete(authorize('SUPER_ADMIN', 'ADMIN'), packageController.deletePackage);

module.exports = router;
