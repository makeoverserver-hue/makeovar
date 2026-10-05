const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');

const getPlans = asyncHandler(async (req, res, next) => {
  const { patientId, status } = req.query;
  const where = {};
  if (patientId) where.patientId = patientId;
  if (status) where.status = status;

  const plans = await prisma.treatmentPlan.findMany({
    where,
    include: {
      patient: { select: { id: true, fullName: true, phone: true } },
      items: { include: { service: { select: { id: true, name: true } } } },
      sessions: { select: { id: true, status: true, scheduledDate: true } },
      _count: { select: { sessions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  sendSuccess(res, plans, 'Treatment plans fetched');
});

const getPlan = asyncHandler(async (req, res, next) => {
  const plan = await prisma.treatmentPlan.findUnique({
    where: { id: req.params.id },
    include: {
      patient: true,
      items: { include: { service: true } },
      sessions: {
        include: {
          service: { select: { id: true, name: true } },
          doctor: { select: { id: true, fullName: true } },
        },
        orderBy: { scheduledDate: 'asc' },
      },
    },
  });
  if (!plan) return next(new AppError('Treatment plan not found', 404));
  sendSuccess(res, plan, 'Treatment plan fetched');
});

const createPlan = asyncHandler(async (req, res, next) => {
  const { patientId, title, description, startDate, endDate, status, notes, items } = req.body;
  if (!patientId || !title) return next(new AppError('Patient and title are required', 400));

  const plan = await prisma.treatmentPlan.create({
    data: {
      patientId, title, description,
      startDate: new Date(startDate || Date.now()),
      endDate: endDate ? new Date(endDate) : null,
      status: status || 'active',
      notes,
      createdById: req.user.id,
      items: items && items.length ? {
        create: items.map((item) => ({
          serviceId: item.serviceId,
          sessionsTotal: item.sessionsTotal || 1,
          intervalDays: item.intervalDays || 7,
          notes: item.notes,
          price: item.price ? parseFloat(item.price) : null,
        })),
      } : undefined,
    },
    include: { items: true },
  });

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_TREATMENT_PLAN', entityType: 'TREATMENT_PLAN', entityId: plan.id,
  });

  sendSuccess(res, plan, 'Treatment plan created', 201);
});

const updatePlan = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const ALLOWED = ['title', 'description', 'startDate', 'endDate', 'status', 'notes'];
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.startDate) updates.startDate = new Date(updates.startDate);
  if (updates.endDate) updates.endDate = new Date(updates.endDate);

  const plan = await prisma.treatmentPlan.update({ where: { id }, data: updates });
  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_TREATMENT_PLAN', entityType: 'TREATMENT_PLAN', entityId: id,
  });
  sendSuccess(res, plan, 'Treatment plan updated');
});

const addPlanItem = asyncHandler(async (req, res, next) => {
  const { planId } = req.params;
  const { serviceId, sessionsTotal, intervalDays, notes, price } = req.body;

  const item = await prisma.treatmentPlanItem.create({
    data: {
      planId, serviceId,
      sessionsTotal: sessionsTotal || 1,
      intervalDays: intervalDays || 7,
      notes,
      price: price ? parseFloat(price) : null,
    },
    include: { service: true },
  });

  await createAuditLog({
    userId: req.user.id, action: 'ADD_PLAN_ITEM', entityType: 'TREATMENT_PLAN', entityId: planId,
  });

  sendSuccess(res, item, 'Plan item added', 201);
});

const deletePlan = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const sessions = await prisma.treatmentSession.findMany({ where: { treatmentPlanId: id }, select: { id: true } });
  for (const s of sessions) {
    await prisma.sessionDevice.deleteMany({ where: { sessionId: s.id } });
  }
  await prisma.treatmentSession.deleteMany({ where: { treatmentPlanId: id } });
  await prisma.treatmentPlanItem.deleteMany({ where: { planId: id } });
  await prisma.treatmentPlan.delete({ where: { id } });
  await createAuditLog({
    userId: req.user.id, action: 'DELETE_TREATMENT_PLAN', entityType: 'TREATMENT_PLAN', entityId: id,
  });
  sendSuccess(res, null, 'Treatment plan deleted');
});

module.exports = { getPlans, getPlan, createPlan, updatePlan, addPlanItem, deletePlan };
