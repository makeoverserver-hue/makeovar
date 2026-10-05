const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');

const getPackages = asyncHandler(async (req, res, next) => {
  const { branchId, isActive } = req.query;
  const where = {};
  if (isActive !== undefined) where.isActive = isActive === 'true';

  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  } else if (branchId) {
    where.branchId = branchId;
  }

  const packages = await prisma.package.findMany({
    where,
    include: {
      items: { include: { service: { select: { id: true, name: true, price: true } } } },
      branch: { select: { id: true, name: true } },
      _count: { select: { sales: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  sendSuccess(res, packages, 'Packages fetched');
});

const getPackageSales = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const skip = (page - 1) * limit;
  const { status, patientId, packageId } = req.query;
  const where = {};
  if (status) where.status = status;
  if (patientId) where.patientId = patientId;
  if (packageId) where.packageId = packageId;
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.package = { branchId: req.user.branchId };
  }

  const total = await prisma.packageSale.count({ where });
  const sales = await prisma.packageSale.findMany({
    where,
    include: {
      package: { select: { id: true, name: true, sessionCount: true, durationDays: true, price: true } },
      patient: { select: { id: true, fullName: true, phone: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
    orderBy: { soldAt: 'desc' },
    skip,
    take: limit,
  });

  sendSuccess(res, sales, 'Package sales fetched', 200, {
    page, limit, total, totalPages: Math.ceil(total / limit),
  });
});

const getPackage = asyncHandler(async (req, res, next) => {
  const pkg = await prisma.package.findUnique({
    where: { id: req.params.id },
    include: {
      items: { include: { service: true } },
      sales: { include: { patient: { select: { id: true, fullName: true } } } },
    },
  });
  if (!pkg) return next(new AppError('Package not found', 404));
  sendSuccess(res, pkg, 'Package fetched');
});

const createPackage = asyncHandler(async (req, res, next) => {
  const { name, description, price, branchId, items, discount, sessionCount, durationDays } = req.body;
  if (!name || price === undefined) return next(new AppError('Name and price are required', 400));

  const pkg = await prisma.package.create({
    data: {
      name, description,
      price: parseFloat(price),
      discount: discount !== undefined ? parseFloat(discount) : undefined,
      sessionCount: sessionCount !== undefined ? Number(sessionCount) : undefined,
      durationDays: durationDays !== undefined ? Number(durationDays) : undefined,
      branchId: branchId || req.user.branchId,
      items: items && items.length ? {
        create: items.map((item) => ({
          serviceId: item.serviceId,
          quantity: item.quantity || 1,
        })),
      } : undefined,
    },
    include: { items: { include: { service: true } } },
  });

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_PACKAGE', entityType: 'PACKAGE', entityId: pkg.id,
  });

  sendSuccess(res, pkg, 'Package created', 201);
});

const updatePackage = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const ALLOWED = ['name', 'description', 'price', 'branchId', 'isActive', 'discount', 'sessionCount', 'durationDays'];
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.price !== undefined) updates.price = parseFloat(updates.price);
  if (updates.discount !== undefined) updates.discount = parseFloat(updates.discount);
  if (updates.sessionCount !== undefined) updates.sessionCount = Number(updates.sessionCount);
  if (updates.durationDays !== undefined) updates.durationDays = Number(updates.durationDays);

  const pkg = await prisma.package.update({ where: { id }, data: updates });
  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_PACKAGE', entityType: 'PACKAGE', entityId: id,
  });
  sendSuccess(res, pkg, 'Package updated');
});

const sellPackage = asyncHandler(async (req, res, next) => {
  const { packageId } = req.params;
  const { patientId, quantity = 1, price, invoiceId, sessionsTotal, expiresAt } = req.body;
  if (!patientId) return next(new AppError('Patient is required', 400));

  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg) return next(new AppError('Package not found', 404));

  const saleSessions = sessionsTotal !== undefined
    ? Number(sessionsTotal)
    : Number(pkg.sessionCount || 1) * Number(quantity);
  const exp = expiresAt
    ? new Date(expiresAt)
    : (pkg.durationDays ? new Date(Date.now() + pkg.durationDays * 86400000) : null);

  const sale = await prisma.packageSale.create({
    data: {
      packageId, patientId, invoiceId,
      price: price !== undefined ? parseFloat(price) : pkg.price,
      quantity,
      sessionsTotal: saleSessions,
      expiresAt: exp,
      status: 'active',
    },
  });

  await createAuditLog({
    userId: req.user.id, action: 'SELL_PACKAGE', entityType: 'PACKAGE', entityId: packageId,
  });

  sendSuccess(res, sale, 'Package sold', 201);
});

const cancelPackageSale = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const sale = await prisma.packageSale.update({
    where: { id },
    data: { status: 'cancelled' },
  });
  await createAuditLog({
    userId: req.user.id, action: 'CANCEL_PACKAGE_SALE', entityType: 'PACKAGE_SALE', entityId: id,
  });
  sendSuccess(res, sale, 'Package sale cancelled');
});

const deletePackage = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const salesCount = await prisma.packageSale.count({ where: { packageId: id } });
  if (salesCount > 0) {
    await prisma.package.update({ where: { id }, data: { isActive: false } });
    return sendSuccess(res, null, 'الباقة لديها مبيعات، تم تعطيلها بدلاً من حذفها');
  }
  await prisma.packageItem.deleteMany({ where: { packageId: id } });
  await prisma.package.delete({ where: { id } });
  await createAuditLog({
    userId: req.user.id, action: 'DELETE_PACKAGE', entityType: 'PACKAGE', entityId: id,
  });
  sendSuccess(res, null, 'Package deleted');
});

module.exports = { getPackages, getPackage, getPackageSales, createPackage, updatePackage, sellPackage, cancelPackageSale, deletePackage };
