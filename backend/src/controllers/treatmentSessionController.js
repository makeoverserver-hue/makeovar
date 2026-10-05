const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');
const { parseDateRange } = require('../utils/dateRange');

const getSessions = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const { status, patientId, serviceId, doctorId, treatmentPlanId, startDate, endDate, search } = req.query;

  const where = {};
  if (status) where.status = status;
  if (patientId) where.patientId = patientId;
  if (serviceId) where.serviceId = serviceId;
  if (doctorId) where.doctorId = doctorId;
  if (treatmentPlanId) where.treatmentPlanId = treatmentPlanId;
  if (startDate && endDate) {
    const { start, end } = parseDateRange(startDate, endDate);
    where.scheduledDate = { gte: start, lte: end };
  }
  if (search) {
    where.patient = { fullName: { contains: search } };
  }

  const total = await prisma.treatmentSession.count({ where });
  const sessions = await prisma.treatmentSession.findMany({
    where,
    include: {
      patient: { select: { id: true, fullName: true, phone: true } },
      service: { select: { id: true, name: true } },
      doctor: { select: { id: true, fullName: true } },
      treatmentPlan: { select: { id: true, title: true } },
      sessionDevices: { include: { device: { select: { id: true, name: true, type: true } } } },
    },
    orderBy: { scheduledDate: 'desc' },
    skip,
    take: limit,
  });

  sendSuccess(res, sessions, 'Sessions fetched', 200, {
    page, limit, total, totalPages: Math.ceil(total / limit),
  });
});

const getSession = asyncHandler(async (req, res, next) => {
  const session = await prisma.treatmentSession.findUnique({
    where: { id: req.params.id },
    include: {
      patient: true,
      service: true,
      doctor: { select: { id: true, fullName: true } },
      treatmentPlan: true,
      sessionDevices: { include: { device: true } },
    },
  });
  if (!session) return next(new AppError('Session not found', 404));
  sendSuccess(res, session, 'Session fetched');
});

const createSession = asyncHandler(async (req, res, next) => {
  const { patientId, serviceId, doctorId, appointmentId, treatmentPlanId, sessionNumber, totalSessions, status, scheduledDate, deviceId, energySettings, areaTreated, notes, startPulseCounter, weightKg, waistCm, hipCm } = req.body;
  if (!patientId || !serviceId) return next(new AppError('Patient and service are required', 400));

  const session = await prisma.treatmentSession.create({
    data: {
      patientId, serviceId, doctorId, appointmentId, treatmentPlanId,
      sessionNumber: sessionNumber || 1,
      totalSessions,
      status: status || 'SCHEDULED',
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      deviceId,
      energySettings: energySettings ? JSON.stringify(energySettings) : '{}',
      areaTreated, notes,
      startPulseCounter: startPulseCounter !== undefined ? Number(startPulseCounter) : undefined,
      weightKg: weightKg !== undefined ? Number(weightKg) : undefined,
      waistCm: waistCm !== undefined ? Number(waistCm) : undefined,
      hipCm: hipCm !== undefined ? Number(hipCm) : undefined,
    },
  });

  if (treatmentPlanId) {
    const plan = await prisma.treatmentPlan.findUnique({ where: { id: treatmentPlanId } });
  }

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_SESSION', entityType: 'TREATMENT_SESSION', entityId: session.id,
  });

  sendSuccess(res, session, 'Session created successfully', 201);
});

const updateSession = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const ALLOWED = ['appointmentId', 'treatmentPlanId', 'sessionNumber', 'totalSessions', 'status', 'scheduledDate', 'completedDate', 'deviceId', 'energySettings', 'areaTreated', 'notes', 'preTreatmentPhotos', 'postTreatmentPhotos', 'complications', 'nextSessionDate', 'startPulseCounter', 'endPulseCounter', 'usedPulses', 'weightKg', 'waistCm', 'hipCm', 'reaction'];
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.scheduledDate) updates.scheduledDate = new Date(updates.scheduledDate);
  if (updates.completedDate) updates.completedDate = new Date(updates.completedDate);
  if (updates.nextSessionDate) updates.nextSessionDate = new Date(updates.nextSessionDate);
  if (updates.energySettings && typeof updates.energySettings === 'object') {
    updates.energySettings = JSON.stringify(updates.energySettings);
  }
  if (updates.preTreatmentPhotos && typeof updates.preTreatmentPhotos === 'object') {
    updates.preTreatmentPhotos = JSON.stringify(updates.preTreatmentPhotos);
  }
  if (updates.postTreatmentPhotos && typeof updates.postTreatmentPhotos === 'object') {
    updates.postTreatmentPhotos = JSON.stringify(updates.postTreatmentPhotos);
  }
  for (const k of ['startPulseCounter', 'endPulseCounter', 'usedPulses', 'weightKg', 'waistCm', 'hipCm']) {
    if (updates[k] !== undefined) updates[k] = Number(updates[k]);
  }
  if (updates.startPulseCounter !== undefined && updates.endPulseCounter !== undefined && updates.endPulseCounter < updates.startPulseCounter) {
    return next(new AppError('عداد النبضات النهائي يجب أن يكون أكبر من أو يساوي العدّاد الابتدائي', 400));
  }
  if (updates.usedPulses === undefined && updates.startPulseCounter !== undefined && updates.endPulseCounter !== undefined) {
    updates.usedPulses = updates.endPulseCounter - updates.startPulseCounter;
  }

  const wasCompleted = updates.status === 'COMPLETED';
  const session = await prisma.treatmentSession.update({ where: { id }, data: updates });

  if (wasCompleted) {
    if (session.treatmentPlanId) {
      const items = await prisma.treatmentPlanItem.findMany({
        where: { planId: session.treatmentPlanId },
      });
      const planSessions = await prisma.treatmentSession.count({
        where: { treatmentPlanId: session.treatmentPlanId, status: 'COMPLETED' },
      });
      // update the matching item sessionsDone
      if (session.serviceId) {
        const item = items.find((i) => i.serviceId === session.serviceId);
        if (item) {
          const doneForService = await prisma.treatmentSession.count({
            where: { treatmentPlanId: session.treatmentPlanId, serviceId: session.serviceId, status: 'COMPLETED' },
          });
          await prisma.treatmentPlanItem.update({
            where: { id: item.id },
            data: { sessionsDone: doneForService, isCompleted: doneForService >= item.sessionsTotal },
          });
        }
      }
    }
  }

  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_SESSION', entityType: 'TREATMENT_SESSION', entityId: id,
  });

  sendSuccess(res, session, 'Session updated');
});

const completeSession = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { notes, complications, deviceSettings, sessionDevices, startPulseCounter, endPulseCounter, usedPulses, weightKg, waistCm, hipCm, reaction, deviceId, packageSaleId } = req.body;

  const existing = await prisma.treatmentSession.findUnique({ where: { id } });
  if (!existing) return next(new AppError('Session not found', 404));

  const startCtr = startPulseCounter !== undefined ? Number(startPulseCounter) : (existing.startPulseCounter !== undefined ? Number(existing.startPulseCounter) : null);
  const endCtr = endPulseCounter !== undefined ? Number(endPulseCounter) : (existing.endPulseCounter !== undefined ? Number(existing.endPulseCounter) : null);

  if (startCtr !== null && endCtr !== null && endCtr < startCtr) {
    return next(new AppError('عداد النبضات النهائي يجب أن يكون أكبر من أو يساوي العدّاد الابتدائي', 400));
  }

  const computedUsedPulses = usedPulses !== undefined
    ? Number(usedPulses)
    : (startCtr !== null && endCtr !== null ? endCtr - startCtr : null);

  const data = {
    status: 'COMPLETED',
    completedDate: new Date(),
    notes,
    complications,
    weightKg: weightKg !== undefined ? Number(weightKg) : undefined,
    waistCm: waistCm !== undefined ? Number(waistCm) : undefined,
    hipCm: hipCm !== undefined ? Number(hipCm) : undefined,
    reaction,
  };
  if (startCtr !== null) data.startPulseCounter = startCtr;
  if (endCtr !== null) data.endPulseCounter = endCtr;
  if (computedUsedPulses !== null) data.usedPulses = computedUsedPulses;

  const session = await prisma.treatmentSession.update({
    where: { id },
    data,
  });

  const resolvedDeviceId = deviceId || session.deviceId;
  if (resolvedDeviceId && computedUsedPulses !== null) {
    const device = await prisma.device.findUnique({ where: { id: resolvedDeviceId } });
    if (device) {
      await prisma.device.update({
        where: { id: resolvedDeviceId },
        data: {
          currentPulseCounter: endCtr !== null ? endCtr : device.currentPulseCounter,
          totalPulseUsage: (device.totalPulseUsage || 0) + computedUsedPulses,
          lastMaintenanceDate: device.lastMaintenanceDate,
        },
      });
    }
  }

  if (packageSaleId) {
    const sale = await prisma.packageSale.findUnique({ where: { id: packageSaleId }, include: { package: { include: { items: true } } } });
    if (!sale || sale.patientId !== session.patientId) return next(new AppError('باقة غير صالحة لهذا المريض', 400));
    if (sale.status !== 'active') return next(new AppError('الباقة غير نشطة', 400));
    if (sale.expiresAt && sale.expiresAt < new Date()) return next(new AppError('الباقة منتهية الصلاحية', 400));
    const total = sale.sessionsTotal || sale.quantity * (sale.package.sessionCount || 1);
    if (sale.sessionsUsed >= total) return next(new AppError('استنفدت جميع جلسات الباقة', 400));
    const nextUsed = sale.sessionsUsed + 1;
    await prisma.packageSale.update({
      where: { id: packageSaleId },
      data: { sessionsUsed: nextUsed, status: nextUsed >= total ? 'completed' : 'active' },
    });
  }

  if (session.treatmentPlanId) {
    const items = await prisma.treatmentPlanItem.findMany({
      where: { planId: session.treatmentPlanId },
    });
    if (session.serviceId) {
      const item = items.find((i) => i.serviceId === session.serviceId);
      if (item) {
        const doneForService = await prisma.treatmentSession.count({
          where: { treatmentPlanId: session.treatmentPlanId, serviceId: session.serviceId, status: 'COMPLETED' },
        });
        await prisma.treatmentPlanItem.update({
          where: { id: item.id },
          data: { sessionsDone: doneForService, isCompleted: doneForService >= item.sessionsTotal },
        });
      }
    }
  }

  if (sessionDevices && sessionDevices.length) {
    for (const sd of sessionDevices) {
      await prisma.sessionDevice.create({
        data: {
          sessionId: id,
          deviceId: sd.deviceId,
          preSettings: sd.preSettings ? JSON.stringify(sd.preSettings) : '{}',
          postSettings: sd.postSettings ? JSON.stringify(sd.postSettings) : '{}',
          energyLevel: sd.energyLevel || null,
          notes: sd.notes,
        },
      });
    }
  }

  await createAuditLog({
    userId: req.user.id, action: 'COMPLETE_SESSION', entityType: 'TREATMENT_SESSION', entityId: id,
  });

  sendSuccess(res, session, 'Session completed');
});

const deleteSession = asyncHandler(async (req, res, next) => {
  await prisma.sessionDevice.deleteMany({ where: { sessionId: req.params.id } });
  await prisma.treatmentSession.delete({ where: { id: req.params.id } });
  await createAuditLog({
    userId: req.user.id, action: 'DELETE_SESSION', entityType: 'TREATMENT_SESSION', entityId: req.params.id,
  });
  sendSuccess(res, null, 'Session deleted');
});

module.exports = { getSessions, getSession, createSession, updateSession, completeSession, deleteSession };
