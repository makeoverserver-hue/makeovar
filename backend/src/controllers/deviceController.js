const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');

const getDevices = asyncHandler(async (req, res, next) => {
  const { type, status, branchId, isActive } = req.query;
  const where = {};
  if (type) where.type = type;
  if (status) where.status = status;
  if (isActive !== undefined) where.isActive = isActive === 'true';

  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  } else if (branchId) {
    where.branchId = branchId;
  }

  const devices = await prisma.device.findMany({
    where,
    include: { branch: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  sendSuccess(res, devices, 'Devices fetched');
});

const getDevice = asyncHandler(async (req, res, next) => {
  const device = await prisma.device.findUnique({
    where: { id: req.params.id },
    include: { branch: true, sessionDevices: { include: { session: true } } },
  });
  if (!device) return next(new AppError('Device not found', 404));
  sendSuccess(res, device, 'Device fetched');
});

const createDevice = asyncHandler(async (req, res, next) => {
  const { name, type, manufacturer, model, serialNumber, branchId, status, purchaseDate, warrantyUntil, lastMaintenanceDate, nextMaintenanceDate, settings, notes, currentPulseCounter, totalPulseUsage, room } = req.body;
  if (!name || !type) return next(new AppError('Name and type are required', 400));

  const device = await prisma.device.create({
    data: {
      name, type, manufacturer, model, serialNumber,
      branchId: branchId || req.user.branchId,
      status: status || 'AVAILABLE',
      purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
      warrantyUntil: warrantyUntil ? new Date(warrantyUntil) : null,
      lastMaintenanceDate: lastMaintenanceDate ? new Date(lastMaintenanceDate) : null,
      nextMaintenanceDate: nextMaintenanceDate ? new Date(nextMaintenanceDate) : null,
      settings: settings ? JSON.stringify(settings) : '{}',
      notes,
      currentPulseCounter: currentPulseCounter !== undefined ? Number(currentPulseCounter) : undefined,
      totalPulseUsage: totalPulseUsage !== undefined ? Number(totalPulseUsage) : undefined,
      room,
    },
  });

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_DEVICE', entityType: 'DEVICE', entityId: device.id,
  });

  sendSuccess(res, device, 'Device created successfully', 201);
});

const updateDevice = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const ALLOWED = ['name', 'type', 'manufacturer', 'model', 'serialNumber', 'branchId', 'status', 'purchaseDate', 'warrantyUntil', 'lastMaintenanceDate', 'nextMaintenanceDate', 'settings', 'notes', 'isActive', 'currentPulseCounter', 'totalPulseUsage', 'room'];
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.settings && typeof updates.settings === 'object') {
    updates.settings = JSON.stringify(updates.settings);
  }
  if (updates.purchaseDate) updates.purchaseDate = new Date(updates.purchaseDate);
  if (updates.warrantyUntil) updates.warrantyUntil = new Date(updates.warrantyUntil);
  if (updates.lastMaintenanceDate) updates.lastMaintenanceDate = new Date(updates.lastMaintenanceDate);
  if (updates.nextMaintenanceDate) updates.nextMaintenanceDate = new Date(updates.nextMaintenanceDate);

  const device = await prisma.device.update({ where: { id }, data: updates });
  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_DEVICE', entityType: 'DEVICE', entityId: id,
  });
  sendSuccess(res, device, 'Device updated');
});

const deleteDevice = asyncHandler(async (req, res, next) => {
  await prisma.sessionDevice.deleteMany({ where: { deviceId: req.params.id } });
  await prisma.device.delete({ where: { id: req.params.id } });
  await createAuditLog({
    userId: req.user.id, action: 'DELETE_DEVICE', entityType: 'DEVICE', entityId: req.params.id,
  });
  sendSuccess(res, null, 'Device deleted');
});

const updateDeviceMaintenance = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { lastMaintenanceDate, nextMaintenanceDate, notes } = req.body;
  const device = await prisma.device.update({
    where: { id },
    data: {
      lastMaintenanceDate: lastMaintenanceDate ? new Date(lastMaintenanceDate) : undefined,
      nextMaintenanceDate: nextMaintenanceDate ? new Date(nextMaintenanceDate) : undefined,
      notes,
      status: 'AVAILABLE',
    },
  });
  await createAuditLog({
    userId: req.user.id, action: 'DEVICE_MAINTENANCE', entityType: 'DEVICE', entityId: id,
  });
  sendSuccess(res, device, 'Maintenance recorded');
});

const getDeviceTypes = asyncHandler(async (req, res, next) => {
  const types = await prisma.device.findMany({
    distinct: ['type'],
    where: { isActive: true },
    select: { type: true },
  });
  const uniqueTypes = [...new Set(types.map((t) => t.type))];
  sendSuccess(res, uniqueTypes, 'Device types fetched');
});

const getDevicePulseStats = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) return next(new AppError('Device not found', 404));

  const days = Math.min(parseInt(req.query.days) || 30, 90);
  const cut = new Date();
  cut.setHours(0, 0, 0, 0);
  cut.setDate(cut.getDate() - (days - 1));

  const sessions = await prisma.treatmentSession.findMany({
    where: { deviceId: id, status: 'COMPLETED', completedDate: { gte: cut }, usedPulses: { not: null } },
    select: { id: true, usedPulses: true, completedDate: true, serviceId: true },
    orderBy: { completedDate: 'desc' },
  });

  const daily = {};
  let totalPulses = 0;
  let sessionCount = sessions.length;
  for (const s of sessions) {
    totalPulses += s.usedPulses;
    const d = new Date(s.completedDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    daily[key] = (daily[key] || 0) + s.usedPulses;
  }

  sendSuccess(res, {
    device: { id: device.id, name: device.name, type: device.type },
    currentPulseCounter: device.currentPulseCounter,
    totalPulseUsage: device.totalPulseUsage,
    totalPulses, sessionCount,
    daily: Object.entries(daily).map(([day, pulses]) => ({ day, pulses })).sort((a, b) => a.day.localeCompare(b.day)),
  }, 'Device pulse stats fetched');
});

module.exports = { getDevices, getDevice, createDevice, updateDevice, deleteDevice, updateDeviceMaintenance, getDeviceTypes, getDevicePulseStats };
