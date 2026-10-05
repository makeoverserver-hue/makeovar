const express = require('express');
const router = express.Router();
const planController = require('../controllers/treatmentPlanController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(planController.getPlans)
  .post(planController.createPlan);

router.route('/:id')
  .get(planController.getPlan)
  .put(planController.updatePlan)
  .delete(authorize('SUPER_ADMIN', 'ADMIN'), planController.deletePlan);

router.post('/:planId/items', planController.addPlanItem);

module.exports = router;
