const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');

const getSettings = asyncHandler(async (req, res, next) => {
  const { group, category } = req.query;
  const where = {};
  if (group) where.group = group;
  if (category) where.category = category;

  const settings = await prisma.setting.findMany({ where, orderBy: { group: 'asc' } });

  const parsed = settings.reduce((acc, s) => {
    let value = s.value;
    try { value = JSON.parse(s.value); } catch (e) { /* keep as string */ }
    acc[s.key] = value;
    return acc;
  }, {});

  sendSuccess(res, { raw: settings, parsed }, 'Settings fetched');
});

const getSetting = asyncHandler(async (req, res, next) => {
  const setting = await prisma.setting.findUnique({ where: { key: req.params.key } });
  if (!setting) return next(new AppError('Setting not found', 404));
  let value = setting.value;
  try { value = JSON.parse(setting.value); } catch (e) {}
  sendSuccess(res, { ...setting, value }, 'Setting fetched');
});

const setSetting = asyncHandler(async (req, res, next) => {
  const { key } = req.params;
  const { value, group = 'general', category = 'general', isSecret = false } = req.body;

  const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

  const setting = await prisma.setting.upsert({
    where: { key },
    update: { value: stringValue, group, category, isSecret },
    create: { key, value: stringValue, group, category, isSecret },
  });

  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_SETTING', entityType: 'SETTING', entityId: key,
  });

  sendSuccess(res, setting, 'Setting saved');
});

const deleteSetting = asyncHandler(async (req, res, next) => {
  await prisma.setting.delete({ where: { key: req.params.key } });
  await createAuditLog({
    userId: req.user.id, action: 'DELETE_SETTING', entityType: 'SETTING', entityId: req.params.key,
  });
  sendSuccess(res, null, 'Setting deleted');
});

const getClinic = asyncHandler(async (req, res, next) => {
  const clinic = await prisma.clinic.findFirst({
    include: { branches: true },
  });
  sendSuccess(res, clinic, 'Clinic fetched');
});

const updateClinic = asyncHandler(async (req, res, next) => {
  const clinic = await prisma.clinic.findFirst();
  if (!clinic) return next(new AppError('No clinic found', 404));
  const ALLOWED = ['name', 'logo', 'phone', 'email', 'address', 'currency', 'timezone', 'settings'];
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.settings && typeof updates.settings === 'object') {
    updates.settings = JSON.stringify(updates.settings);
  }
  const updated = await prisma.clinic.update({ where: { id: clinic.id }, data: updates });
  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_CLINIC', entityType: 'CLINIC', entityId: clinic.id,
  });
  sendSuccess(res, updated, 'Clinic updated');
});

module.exports = { getSettings, getSetting, setSetting, deleteSetting, getClinic, updateClinic };
