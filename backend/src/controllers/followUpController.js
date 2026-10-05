const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');
const { parseDateRange } = require('../utils/dateRange');

const getFollowUps = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const skip = (page - 1) * limit;
  const { status, patientId, assignedToId, type, startDate, endDate } = req.query;

  const where = {};
  if (status) where.status = status;
  if (patientId) where.patientId = patientId;
  if (assignedToId) where.assignedToId = assignedToId;
  else if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') where.assignedToId = req.user.id;
  if (type) where.type = type;
  if (startDate && endDate) {
    const { start, end } = parseDateRange(startDate, endDate);
    where.date = { gte: start, lte: end };
  }

  const total = await prisma.followUp.count({ where });
  const followUps = await prisma.followUp.findMany({
    where,
    include: {
      patient: { select: { id: true, fullName: true, phone: true } },
      assignedTo: { select: { id: true, fullName: true } },
      createdBy: { select: { id: true, fullName: true } },
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
    skip,
    take: limit,
  });

  sendSuccess(res, followUps, 'Follow ups fetched', 200, {
    page, limit, total, totalPages: Math.ceil(total / limit),
  });
});

const getFollowUpStats = asyncHandler(async (req, res, next) => {
  const idWhere = {};
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
    idWhere.assignedToId = req.user.id;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [today, overdue, upcoming, completed, pending] = await Promise.all([
    prisma.followUp.count({ where: { ...idWhere, date: { gte: todayStart, lte: todayEnd }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    prisma.followUp.count({ where: { ...idWhere, date: { lt: todayStart }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    prisma.followUp.count({ where: { ...idWhere, date: { gt: todayEnd }, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
    prisma.followUp.count({ where: { ...idWhere, status: 'COMPLETED' } }),
    prisma.followUp.count({ where: { ...idWhere, status: 'PENDING' } }),
  ]);

  sendSuccess(res, { today, overdue, upcoming, completed, pending }, 'Follow up stats fetched');
});

const getFollowUp = asyncHandler(async (req, res, next) => {
  const followUp = await prisma.followUp.findUnique({
    where: { id: req.params.id },
    include: {
      patient: { select: { id: true, fullName: true, phone: true } },
      assignedTo: { select: { id: true, fullName: true } },
      createdBy: { select: { id: true, fullName: true } },
    },
  });
  if (!followUp) return next(new AppError('Follow up not found', 404));
  sendSuccess(res, followUp, 'Follow up fetched');
});

const createFollowUp = asyncHandler(async (req, res, next) => {
  const { patientId, type = 'CALL', date, assignedToId, status = 'PENDING', notes } = req.body;
  if (!patientId || !date) return next(new AppError('Patient and date are required', 400));

  const followUp = await prisma.followUp.create({
    data: {
      patientId,
      type,
      date: new Date(date),
      assignedToId: assignedToId || req.user.id,
      createdById: req.user.id,
      status,
      notes,
    },
  });

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_FOLLOW_UP', entityType: 'FOLLOW_UP', entityId: followUp.id, details: { patientId },
  });

  sendSuccess(res, followUp, 'Follow up created', 201);
});

const updateFollowUp = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const ALLOWED = ['type', 'date', 'assignedToId', 'status', 'notes', 'result'];
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.date) updates.date = new Date(updates.date);
  if (req.body.status === 'COMPLETED') {
    updates.completedAt = new Date();
  }

  const followUp = await prisma.followUp.update({ where: { id }, data: updates });
  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_FOLLOW_UP', entityType: 'FOLLOW_UP', entityId: id,
  });

  sendSuccess(res, followUp, 'Follow up updated');
});

const deleteFollowUp = asyncHandler(async (req, res, next) => {
  await prisma.followUp.delete({ where: { id: req.params.id } });
  await createAuditLog({
    userId: req.user.id, action: 'DELETE_FOLLOW_UP', entityType: 'FOLLOW_UP', entityId: req.params.id,
  });
  sendSuccess(res, null, 'Follow up deleted');
});

module.exports = { getFollowUps, getFollowUp, getFollowUpStats, createFollowUp, updateFollowUp, deleteFollowUp };