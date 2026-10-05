const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');

const getServices = asyncHandler(async (req, res, next) => {
  const { category, isActive, branchId, search } = req.query;
  const where = {};
  if (category) where.category = category;
  if (isActive !== undefined) where.isActive = isActive === 'true';
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { nameEn: { contains: search } },
    ];
  }

  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  } else if (branchId) {
    where.branchId = branchId;
  }

  const services = await prisma.service.findMany({
    where,
    orderBy: { name: 'asc' },
  });
  sendSuccess(res, services, 'Services fetched');
});

const getService = asyncHandler(async (req, res, next) => {
  const service = await prisma.service.findUnique({
    where: { id: req.params.id },
  });
  if (!service) return next(new AppError('Service not found', 404));
  sendSuccess(res, service, 'Service fetched');
});

const createService = asyncHandler(async (req, res, next) => {
  const { name, nameEn, description, category, price, cost, durationMin, branchId, sessionsCount, requiresConsent, requiresMedicalAssessment, room } = req.body;
  if (!name || price === undefined) return next(new AppError('Name and price are required', 400));

  const service = await prisma.service.create({
    data: {
      name, nameEn, description, category,
      price: parseFloat(price),
      cost: cost ? parseFloat(cost) : 0,
      durationMin: durationMin || 30,
      sessionsCount: sessionsCount !== undefined ? Number(sessionsCount) : 1,
      requiresConsent: !!requiresConsent,
      requiresMedicalAssessment: !!requiresMedicalAssessment,
      room,
      branchId: branchId || req.user.branchId || null,
    },
  });

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_SERVICE', entityType: 'SERVICE', entityId: service.id,
  });

  sendSuccess(res, service, 'Service created successfully', 201);
});

const updateService = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const ALLOWED = ['name', 'nameEn', 'description', 'category', 'price', 'cost', 'durationMin', 'branchId', 'isActive', 'sessionsCount', 'requiresConsent', 'requiresMedicalAssessment', 'room'];
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.price !== undefined) updates.price = parseFloat(updates.price);
  if (updates.cost !== undefined) updates.cost = parseFloat(updates.cost);
  if (updates.sessionsCount !== undefined) updates.sessionsCount = Number(updates.sessionsCount);
  if (updates.requiresConsent !== undefined) updates.requiresConsent = !!updates.requiresConsent;
  if (updates.requiresMedicalAssessment !== undefined) updates.requiresMedicalAssessment = !!updates.requiresMedicalAssessment;

  const service = await prisma.service.update({ where: { id }, data: updates });
  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_SERVICE', entityType: 'SERVICE', entityId: id,
  });
  sendSuccess(res, service, 'Service updated');
});

const deleteService = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const children = [
    await prisma.appointment.count({ where: { serviceId: id } }),
    await prisma.invoiceItem.count({ where: { serviceId: id } }),
    await prisma.treatmentSession.count({ where: { serviceId: id } }),
    await prisma.packageItem.count({ where: { serviceId: id } }),
    await prisma.consentForm.count({ where: { serviceId: id } }),
  ];
  const hasChildren = children.some((c) => c > 0);
  if (hasChildren) {
    await prisma.service.update({ where: { id }, data: { isActive: false } });
    return sendSuccess(res, null, 'الخدمة مستخدمة في سجلات سابقة، تم تعطيلها بدلاً من حذفها');
  }
  await prisma.service.delete({ where: { id } });
  await createAuditLog({
    userId: req.user.id, action: 'DELETE_SERVICE', entityType: 'SERVICE', entityId: id,
  });
  sendSuccess(res, null, 'Service deleted');
});

module.exports = { getServices, getService, createService, updateService, deleteService };
