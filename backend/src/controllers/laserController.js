const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');
const { parseDateRange, toLocalStart } = require('../utils/dateRange');

const TREATMENT_TYPES = ['HAIR_REMOVAL', 'TATTOO_REMOVAL', 'PIGMENTATION', 'VASCULAR', 'SKIN_TIGHTENING', 'ACNE', 'OTHER'];
const TREATMENT_LABELS = {
  HAIR_REMOVAL: 'إزالة الشعر',
  TATTOO_REMOVAL: 'إزالة الوشم',
  PIGMENTATION: 'معالجة التصبغات',
  VASCULAR: 'معالجة الأوعية',
  SKIN_TIGHTENING: 'شد البشرة',
  ACNE: 'علاج حب الشباب',
  OTHER: 'أخرى',
};
// Fitzpatrick scale
const SKIN_TYPES = ['I', 'II', 'III', 'IV', 'V', 'VI'];

const getLaserSessions = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const { treatmentType, status, search, startDate, endDate, deviceId } = req.query;

  const where = {};
  if (treatmentType) where.treatmentType = treatmentType;
  if (status) where.status = status;
  if (deviceId) where.deviceId = deviceId;
  if (startDate && endDate) {
    const { start, end } = parseDateRange(startDate, endDate);
    where.sessionDate = { gte: start, lte: end };
  }
  if (search) {
    where.patient = { fullName: { contains: search } };
  }
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  }

  const total = await prisma.laserSession.count({ where });
  const sessions = await prisma.laserSession.findMany({
    where,
    include: {
      patient: { select: { id: true, fullName: true, phone: true } },
      doctor: { select: { id: true, fullName: true } },
      device: { select: { id: true, name: true, type: true } },
    },
    orderBy: { sessionDate: 'desc' },
    skip,
    take: limit,
  });
  sendSuccess(res, sessions, 'Laser sessions fetched', 200, {
    page, limit, total, totalPages: Math.ceil(total / limit),
    treatmentTypes: TREATMENT_TYPES,
    treatmentLabels: TREATMENT_LABELS,
    skinTypes: SKIN_TYPES,
  });
});

const getLaserSession = asyncHandler(async (req, res, next) => {
  const session = await prisma.laserSession.findUnique({
    where: { id: req.params.id },
    include: {
      patient: true,
      doctor: { select: { id: true, fullName: true } },
      device: true,
    },
  });
  if (!session) return next(new AppError('Laser session not found', 404));
  sendSuccess(res, session, 'Laser session fetched');
});

async function getRunningNo() {
  const last = await prisma.laserSession.aggregate({ _max: { runningNo: true } });
  return (last._max.runningNo || 0) + 1;
}

const createLaserSession = asyncHandler(async (req, res, next) => {
  const {
    patientId, doctorId, deviceId, treatmentType, bodyArea, skinType, treatmentSite,
    preLaserProtocol, preLaserResponse, wavelengthNm, spotSizeMm, energyJcm2, pulseWidthMs,
    treatmentLevel, repetitionHZ, startPulseCounter, endPulseCounter, reaction, notes, status, sessionDate,
  } = req.body;
  if (!patientId) return next(new AppError('Patient is required', 400));
  if (startPulseCounter !== undefined && endPulseCounter !== undefined && Number(endPulseCounter) < Number(startPulseCounter)) {
    return next(new AppError('عداد النهاية يجب أن يكون أكبر من أو يساوي عداد البداية', 400));
  }
  const s = Number(startPulseCounter ?? 0);
  const e = Number(endPulseCounter ?? 0);
  const usedPulses = (startPulseCounter !== undefined && endPulseCounter !== undefined) ? (e - s) : undefined;

  const runningNo = await getRunningNo();
  const session = await prisma.laserSession.create({
    data: {
      patientId,
      createById: req.user.id,
      branchId: req.user.branchId || (await prisma.branch.findFirst({ select: { id: true } }))?.id,
      doctorId: doctorId || null,
      deviceId: deviceId || null,
      runningNo,
      treatmentType: treatmentType || 'HAIR_REMOVAL',
      bodyArea, skinType, treatmentSite,
      preLaserProtocol, preLaserResponse,
      wavelengthNm: wavelengthNm !== undefined ? Number(wavelengthNm) : undefined,
      spotSizeMm: spotSizeMm !== undefined ? Number(spotSizeMm) : undefined,
      energyJcm2: energyJcm2 !== undefined ? Number(energyJcm2) : undefined,
      pulseWidthMs: pulseWidthMs !== undefined ? Number(pulseWidthMs) : undefined,
      repetitionHZ: repetitionHZ !== undefined ? Number(repetitionHZ) : undefined,
      treatmentLevel,
      startPulseCounter: startPulseCounter !== undefined ? Number(startPulseCounter) : undefined,
      endPulseCounter: endPulseCounter !== undefined ? Number(endPulseCounter) : undefined,
      usedPulses,
      reaction, notes,
      status: status || 'COMPLETED',
      sessionDate: sessionDate ? new Date(sessionDate) : new Date(),
    },
  });

  // Update device pulse counter
  if (deviceId && startPulseCounter !== undefined && endPulseCounter !== undefined) {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (device) {
      await prisma.device.update({
        where: { id: deviceId },
        data: {
          currentPulseCounter: e,
          totalPulseUsage: (device.totalPulseUsage || 0) + usedPulses,
        },
      });
    }
  }

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_LASER_SESSION', entityType: 'LASER_SESSION', entityId: session.id, details: { runningNo, usedPulses },
  });
  sendSuccess(res, session, 'تم تسجيل جلسة الليزر', 201);
});

const updateLaserSession = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const ALLOWED = ['doctorId', 'deviceId', 'treatmentType', 'bodyArea', 'skinType', 'treatmentSite', 'preLaserProtocol', 'preLaserResponse', 'wavelengthNm', 'spotSizeMm', 'energyJcm2', 'pulseWidthMs', 'treatmentLevel', 'repetitionHZ', 'startPulseCounter', 'endPulseCounter', 'usedPulses', 'reaction', 'notes', 'status', 'sessionDate'];
  const updates = {};
  for (const k of ALLOWED) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  for (const k of ['wavelengthNm', 'spotSizeMm', 'energyJcm2', 'pulseWidthMs', 'repetitionHZ', 'startPulseCounter', 'endPulseCounter', 'usedPulses']) {
    if (updates[k] !== undefined) updates[k] = Number(updates[k]);
  }
  if (updates.sessionDate) updates.sessionDate = new Date(updates.sessionDate);
  if (updates.startPulseCounter !== undefined && updates.endPulseCounter !== undefined && updates.endPulseCounter < updates.startPulseCounter) {
    return next(new AppError('عداد النهاية يجب أن يكون أكبر من أو يساوي عداد البداية', 400));
  }
  if (updates.usedPulses === undefined && updates.startPulseCounter !== undefined && updates.endPulseCounter !== undefined) {
    updates.usedPulses = updates.endPulseCounter - updates.startPulseCounter;
  }

  const session = await prisma.laserSession.update({ where: { id }, data: updates });
  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_LASER_SESSION', entityType: 'LASER_SESSION', entityId: id,
  });
  sendSuccess(res, session, 'تم تحديث جلسة الليزر');
});

const deleteLaserSession = asyncHandler(async (req, res, next) => {
  await prisma.laserSession.delete({ where: { id: req.params.id } });
  await createAuditLog({
    userId: req.user.id, action: 'DELETE_LASER_SESSION', entityType: 'LASER_SESSION', entityId: req.params.id,
  });
  sendSuccess(res, null, 'تم حذف جلسة الليزر');
});

const getLaserStats = asyncHandler(async (req, res, next) => {
  const { period = 'month', startDate, endDate } = req.query;
  const now = new Date();
  let start;
  let end;
  if (startDate && endDate) {
    const r = parseDateRange(startDate, endDate);
    start = r.start;
    end = r.end;
  } else if (period === 'today') {
    start = toLocalStart(new Date());
  } else if (period === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const where = { sessionDate: { gte: start, ...(end ? { lte: end } : {}) } };
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') where.branchId = req.user.branchId;

  const [total, usedPulses, byType] = await Promise.all([
    prisma.laserSession.count({ where }),
    prisma.laserSession.aggregate({ where, _sum: { usedPulses: true } }),
    prisma.laserSession.groupBy({ by: ['treatmentType'], where, _count: { _all: true }, _sum: { usedPulses: true } }),
  ]);

  sendSuccess(res, {
    totalSessions: total,
    totalPulses: usedPulses._sum.usedPulses || 0,
    byType: byType.map((t) => ({ treatmentType: t.treatmentType, label: TREATMENT_LABELS[t.treatmentType] || t.treatmentType, count: t._count._all, pulses: t._sum.usedPulses || 0 })),
  }, 'Laser stats fetched');
});

const getLaserRunningNo = asyncHandler(async (req, res, next) => {
  const runningNo = await getRunningNo();
  sendSuccess(res, { runningNo }, 'Next running number');
});

module.exports = {
  getLaserSessions, getLaserSession, createLaserSession, updateLaserSession, deleteLaserSession, getLaserStats, getLaserRunningNo,
  TREATMENT_TYPES, TREATMENT_LABELS, SKIN_TYPES,
};