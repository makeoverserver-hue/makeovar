const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const importController = require('../controllers/importController');

router.use(protect);

const IMPORTERS = ['SUPER_ADMIN', 'ADMIN'];

// GET templates (services/patients/inventory)
router.get('/templates/:type', authorize(...IMPORTERS), importController.getTemplate);

// POST imports (xlsx/xls/csv)
router.post('/services', authorize(...IMPORTERS), importController.upload.single('file'), importController.importServices);
router.post('/patients', authorize(...IMPORTERS), importController.upload.single('file'), importController.importPatients);
router.post('/inventory', authorize(...IMPORTERS), importController.upload.single('file'), importController.importInventory);

module.exports = router;