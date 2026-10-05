const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');

const getConsents = asyncHandler(async (req, res, next) => {
  const { patientId, isSigned } = req.query;
  const where = {};
  if (req.params.patientId) where.patientId = req.params.patientId;
  else if (patientId) where.patientId = patientId;
  if (isSigned !== undefined) where.isSigned = isSigned === 'true';

  const consents = await prisma.consentForm.findMany({
    where,
    include: {
      patient: { select: { id: true, fullName: true } },
      createdBy: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  sendSuccess(res, consents, 'Consent forms fetched');
});

const getConsent = asyncHandler(async (req, res, next) => {
  const consent = await prisma.consentForm.findUnique({
    where: { id: req.params.id },
    include: {
      patient: true,
      createdBy: { select: { id: true, fullName: true } },
    },
  });
  if (!consent) return next(new AppError('Consent form not found', 404));
  sendSuccess(res, consent, 'Consent form fetched');
});

const createConsent = asyncHandler(async (req, res, next) => {
  const { title, content, patientId } = req.body;
  const resolvedPatientId = req.params.patientId || patientId;
  if (!title || !content || !resolvedPatientId) {
    return next(new AppError('Title, content and patient are required', 400));
  }

  const consent = await prisma.consentForm.create({
    data: {
      title, content,
      patientId: resolvedPatientId,
      createdById: req.user.id,
    },
  });

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_CONSENT', entityType: 'CONSENT_FORM', entityId: consent.id,
  });

  sendSuccess(res, consent, 'Consent form created', 201);
});

const signConsent = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { signedBy, signaturePath } = req.body;

  const consent = await prisma.consentForm.update({
    where: { id },
    data: {
      signedBy,
      signaturePath: signaturePath || null,
      signedAt: new Date(),
      isSigned: true,
    },
  });

  await createAuditLog({
    userId: req.user.id, action: 'SIGN_CONSENT', entityType: 'CONSENT_FORM', entityId: id,
  });

  sendSuccess(res, consent, 'Consent form signed');
});

const updateConsent = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const ALLOWED = ['title', 'content', 'signedBy', 'signaturePath'];
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const consent = await prisma.consentForm.update({ where: { id }, data: updates });
  sendSuccess(res, consent, 'Consent form updated');
});

const deleteConsent = asyncHandler(async (req, res, next) => {
  await prisma.consentForm.delete({ where: { id: req.params.id } });
  await createAuditLog({
    userId: req.user.id, action: 'DELETE_CONSENT', entityType: 'CONSENT_FORM', entityId: req.params.id,
  });
  sendSuccess(res, null, 'Consent form deleted');
});

module.exports = { getConsents, getConsent, createConsent, signConsent, updateConsent, deleteConsent };
