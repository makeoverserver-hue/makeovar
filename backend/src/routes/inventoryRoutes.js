const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/movements', inventoryController.getMovements);
router.get('/stock-status', inventoryController.getStockStatus);

router.route('/')
  .get(inventoryController.getInventory)
  .post(authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), inventoryController.createInventoryItem);

router.route('/:id')
  .get(inventoryController.getInventoryItem)
  .put(authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), inventoryController.updateInventoryItem)
  .delete(authorize('SUPER_ADMIN', 'ADMIN'), inventoryController.deleteInventoryItem);

router.post('/:id/adjust', authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), inventoryController.adjustStock);

module.exports = router;
