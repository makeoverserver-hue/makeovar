const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');

const getBranches = asyncHandler(async (req, res, next) => {
  const branches = await prisma.branch.findMany({
    include: {
      _count: { select: { patients: true, appointments: true, services: true, devices: true, users: true, invoices: true } },
    },
    orderBy: { name: 'asc' },
  });
  sendSuccess(res, branches, 'Branches fetched');
});

const getBranch = asyncHandler(async (req, res, next) => {
  const branch = await prisma.branch.findUnique({
    where: { id: req.params.id },
    include: {
      patients: { select: { id: true, fullName: true }, take: 10 },
      devices: { select: { id: true, name: true, type: true, status: true } },
    },
  });
  if (!branch) return next(new AppError('Branch not found', 404));
  sendSuccess(res, branch, 'Branch fetched');
});

const createBranch = asyncHandler(async (req, res, next) => {
  const { name, address, phone, email, clinicId } = req.body;
  if (!name) return next(new AppError('Name is required', 400));

  const branch = await prisma.branch.create({
    data: {
      name, address, phone, email,
      clinicId: clinicId || req.user.clinicId,
    },
  });

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_BRANCH', entityType: 'BRANCH', entityId: branch.id,
  });

  sendSuccess(res, branch, 'Branch created', 201);
});

const updateBranch = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const ALLOWED = ['name', 'address', 'phone', 'email', 'isActive'];
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  const branch = await prisma.branch.update({ where: { id }, data: updates });
  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_BRANCH', entityType: 'BRANCH', entityId: id,
  });
  sendSuccess(res, branch, 'Branch updated');
});

const deleteBranch = asyncHandler(async (req, res, next) => {
  await prisma.branch.update({
    where: { id: req.params.id },
    data: { isActive: false },
  });
  await createAuditLog({
    userId: req.user.id, action: 'DEACTIVATE_BRANCH', entityType: 'BRANCH', entityId: req.params.id,
  });
  sendSuccess(res, null, 'Branch deactivated');
});

module.exports = { getBranches, getBranch, createBranch, updateBranch, deleteBranch };
