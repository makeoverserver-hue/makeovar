const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');

const getPhotos = asyncHandler(async (req, res, next) => {
  const { patientId, photoType, category, sessionId } = req.query;
  const where = {};
  if (patientId) where.patientId = patientId;
  if (photoType) where.photoType = photoType;
  if (category) where.category = category;
  if (sessionId) where.sessionId = sessionId;

  const photos = await prisma.beforeAfterPhoto.findMany({
    where,
    include: {
      patient: { select: { id: true, fullName: true } },
      takenBy: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  sendSuccess(res, photos, 'Photos fetched');
});

const uploadPhoto = asyncHandler(async (req, res, next) => {
  const { patientId, photoType, category, description, sessionId } = req.body;
  if (!req.file) return next(new AppError('No file uploaded', 400));
  if (!patientId) return next(new AppError('Patient is required', 400));

  const filePath = req.file.path.replace(/\\/g, '/');

  // Server-relative path for serving
  const relativePath = filePath.split('uploads/')[1];

  const photo = await prisma.beforeAfterPhoto.create({
    data: {
      patientId,
      photoType: photoType || 'BEFORE',
      category,
      filePath,
      description,
      sessionId,
      takenById: req.user.id,
    },
  });

  await createAuditLog({
    userId: req.user.id, action: 'UPLOAD_PHOTO', entityType: 'PHOTO', entityId: photo.id,
  });

  sendSuccess(res, photo, 'Photo uploaded successfully', 201);
});

const deletePhoto = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const photo = await prisma.beforeAfterPhoto.findUnique({ where: { id } });
  if (photo) {
    const fs = require('fs');
    const path = require('path');
    const absolute = photo.filePath;
    if (fs.existsSync(absolute)) {
      fs.unlinkSync(absolute);
    }
  }
  await prisma.beforeAfterPhoto.delete({ where: { id } });
  await createAuditLog({
    userId: req.user.id, action: 'DELETE_PHOTO', entityType: 'PHOTO', entityId: id,
  });
  sendSuccess(res, null, 'Photo deleted');
});

module.exports = { getPhotos, uploadPhoto, deletePhoto };
