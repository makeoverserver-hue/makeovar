const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');

const getRecords = asyncHandler(async (req, res, next) => {
  const { patientId } = req.params;
  const records = await prisma.medicalRecord.findMany({
    where: { patientId },
    include: { createdBy: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  sendSuccess(res, records, 'Medical records fetched');
});

const createRecord = asyncHandler(async (req, res, next) => {
  const { patientId } = req.params;
  const { title, diagnosis, description, prescription, notes, attachments } = req.body;

  const record = await prisma.medicalRecord.create({
    data: {
      patientId,
      title,
      diagnosis,
      description,
      prescription,
      notes,
      attachments: attachments ? JSON.stringify(attachments) : null,
      createdById: req.user.id,
    },
  });

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_MEDICAL_RECORD', entityType: 'MEDICAL_RECORD', entityId: record.id,
  });

  sendSuccess(res, record, 'Medical record created', 201);
});

const updateRecord = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const ALLOWED = ['title', 'diagnosis', 'description', 'prescription', 'notes', 'attachments'];
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.attachments && typeof updates.attachments !== 'string') {
    updates.attachments = JSON.stringify(updates.attachments);
  }

  const record = await prisma.medicalRecord.update({
    where: { id },
    data: updates,
  });

  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_MEDICAL_RECORD', entityType: 'MEDICAL_RECORD', entityId: id,
  });

  sendSuccess(res, record, 'Medical record updated');
});

const deleteRecord = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  await prisma.medicalRecord.delete({ where: { id } });
  await createAuditLog({
    userId: req.user.id, action: 'DELETE_MEDICAL_RECORD', entityType: 'MEDICAL_RECORD', entityId: id,
  });
  sendSuccess(res, null, 'Medical record deleted');
});

module.exports = { getRecords, createRecord, updateRecord, deleteRecord };
