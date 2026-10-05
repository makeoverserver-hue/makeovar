const express = require('express');
const router = express.Router();
const branchController = require('../controllers/branchController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(branchController.getBranches)
  .post(authorize('SUPER_ADMIN', 'ADMIN'), branchController.createBranch);

router.route('/:id')
  .get(branchController.getBranch)
  .put(authorize('SUPER_ADMIN', 'ADMIN'), branchController.updateBranch)
  .delete(authorize('SUPER_ADMIN'), branchController.deleteBranch);

module.exports = router;
