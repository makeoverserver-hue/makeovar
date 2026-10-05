const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');
const { parseDateRange } = require('../utils/dateRange');
const { hashPassword } = require('../utils/auth');

const getUsers = asyncHandler(async (req, res, next) => {
  const { role, branchId, search } = req.query;
  const where = {};
  if (role) where.role = role;
  if (search) {
    where.OR = [
      { fullName: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  } else if (branchId) {
    where.branchId = branchId;
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, fullName: true, email: true, phone: true, role: true, status: true,
      gender: true, avatar: true, branchId: true, commissionRate: true, salary: true,
      createdAt: true, lastLoginAt: true, isActive: true,
      branch: { select: { id: true, name: true } },
      _count: { select: { appointments: true, invoices: true, sessions: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  sendSuccess(res, users, 'Users fetched');
});

const getUser = asyncHandler(async (req, res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true, fullName: true, email: true, phone: true, role: true, status: true,
      gender: true, avatar: true, branchId: true, clinicId: true, commissionRate: true,
      salary: true, createdAt: true, lastLoginAt: true, isActive: true,
      branch: true,
      commissionRecords: { orderBy: { createdAt: 'desc' }, take: 50 },
      sessions: { include: { patient: { select: { id: true, fullName: true } }, service: { select: { id: true, name: true } } }, take: 20 },
    },
  });
  if (!user) return next(new AppError('User not found', 404));
  sendSuccess(res, user, 'User fetched');
});

const createUser = asyncHandler(async (req, res, next) => {
  const { fullName, email, password, role, phone, gender, branchId, commissionRate, salary } = req.body;
  if (!fullName || !email || !password) return next(new AppError('Name, email and password are required', 400));

  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (exists) return next(new AppError('Email already registered', 409));

  const hashed = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      fullName,
      email: email.toLowerCase().trim(),
      password: hashed,
      role: role || 'RECEPTIONIST',
      phone,
      gender,
      branchId: branchId || req.user.branchId,
      clinicId: req.user.clinicId,
      commissionRate: commissionRate !== undefined ? parseFloat(commissionRate) : 0,
      salary: salary !== undefined ? parseFloat(salary) : 0,
    },
  });

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_USER', entityType: 'USER', entityId: user.id, details: { role },
  });

  sendSuccess(res, user, 'User created successfully', 201);
});

const updateUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const ALLOWED = ['fullName', 'phone', 'role', 'status', 'gender', 'avatar', 'branchId', 'clinicId', 'commissionRate', 'salary', 'isActive'];
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.commissionRate !== undefined) updates.commissionRate = parseFloat(updates.commissionRate);
  if (updates.salary !== undefined) updates.salary = parseFloat(updates.salary);

  const user = await prisma.user.update({ where: { id }, data: updates });
  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_USER', entityType: 'USER', entityId: id,
  });
  sendSuccess(res, user, 'User updated');
});

const resetUserPassword = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword) return next(new AppError('New password is required', 400));
  const hashed = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id },
    data: { password: hashed, passwordChangedAt: new Date() },
  });
  await createAuditLog({
    userId: req.user.id, action: 'RESET_PASSWORD', entityType: 'USER', entityId: id,
  });
  sendSuccess(res, null, 'Password reset successfully');
});

const deleteUser = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  if (id === req.user.id) return next(new AppError('Cannot delete your own account', 400));
  await prisma.user.update({
    where: { id },
    data: { status: 'INACTIVE', isActive: false },
  });
  await createAuditLog({
    userId: req.user.id, action: 'DEACTIVATE_USER', entityType: 'USER', entityId: id,
  });
  sendSuccess(res, null, 'User deactivated');
});

const getCommissions = asyncHandler(async (req, res, next) => {
  const { userId, status, startDate, endDate } = req.query;
  const where = {};
  if (userId) where.userId = userId;
  if (status) where.status = status;
  if (startDate && endDate) {
    const { start, end } = parseDateRange(startDate, endDate);
    where.createdAt = { gte: start, lte: end };
  }

  const commissions = await prisma.commissionRecord.findMany({
    where,
    include: {
      user: { select: { id: true, fullName: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totals = await prisma.commissionRecord.aggregate({
    where,
    _sum: { amount: true },
  });

  sendSuccess(res, { commissions, totalCommissions: totals._sum.amount || 0 }, 'Commissions fetched');
});

const createCommission = asyncHandler(async (req, res, next) => {
  const { userId, invoiceId, sessionId, amountBasis, rate, notes } = req.body;
  if (!userId || amountBasis === undefined || rate === undefined) {
    return next(new AppError('User, amount and rate are required', 400));
  }

  const amount = parseFloat(amountBasis) * (parseFloat(rate) / 100);
  const commission = await prisma.commissionRecord.create({
    data: {
      userId, invoiceId, sessionId,
      amountBasis: parseFloat(amountBasis),
      rate: parseFloat(rate),
      amount,
      notes,
    },
  });

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_COMMISSION', entityType: 'COMMISSION', entityId: commission.id,
  });

  sendSuccess(res, commission, 'Commission created', 201);
});

const markCommissionPaid = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const commission = await prisma.commissionRecord.update({
    where: { id },
    data: { status: 'paid', paidDate: new Date() },
  });
  await createAuditLog({
    userId: req.user.id, action: 'MARK_COMMISSION_PAID', entityType: 'COMMISSION', entityId: id,
  });
  sendSuccess(res, commission, 'Commission marked as paid');
});

module.exports = {
  getUsers, getUser, createUser, updateUser, resetUserPassword, deleteUser,
  getCommissions, createCommission, markCommissionPaid,
};
