const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');

const getPatients = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const { search, gender, branchId, source, isActive } = req.query;

  const where = {};
  if (search) {
    where.OR = [
      { fullName: { contains: search } },
      { phone: { contains: search } },
      { email: { contains: search } },
    ];
  }
  if (gender) where.gender = gender;
  if (branchId) where.branchId = branchId;
  if (source) where.source = source;
  if (isActive !== undefined) where.isActive = isActive === 'true';

  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  }

  const total = await prisma.patient.count({ where });
  const patients = await prisma.patient.findMany({
    where,
    include: {
      _count: { select: { appointments: true, invoices: true, sessions: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });

  sendSuccess(res, patients, 'Patients fetched', 200, {
    page, limit, total, totalPages: Math.ceil(total / limit),
  });
});

const getPatient = asyncHandler(async (req, res, next) => {
  const patient = await prisma.patient.findUnique({
    where: { id: req.params.id },
    include: {
      branch: { select: { id: true, name: true } },
      appointments: {
        include: { service: { select: { id: true, name: true } }, doctor: { select: { id: true, fullName: true } } },
        orderBy: { date: 'desc' },
        take: 20,
      },
      medicalRecords: { orderBy: { createdAt: 'desc' }, take: 20 },
      treatmentPlans: { orderBy: { createdAt: 'desc' }, take: 10 },
      sessions: {
        include: { service: { select: { id: true, name: true } }, doctor: { select: { id: true, fullName: true } } },
        orderBy: { scheduledDate: 'desc' },
        take: 20,
      },
      invoices: { orderBy: { createdAt: 'desc' }, take: 20 },
      photos: { orderBy: { createdAt: 'desc' }, take: 50 },
      consents: { orderBy: { createdAt: 'desc' }, take: 20 },
      _count: {
        select: {
          appointments: true, invoices: true, sessions: true, treatmentPlans: true, photos: true,
        },
      },
    },
  });

  if (!patient) return next(new AppError('Patient not found', 404));
  sendSuccess(res, patient, 'Patient fetched');
});

const createPatient = asyncHandler(async (req, res, next) => {
  const { fullName, phone, email, gender, dateOfBirth, bloodType, heightCm, weightKg, allergies, chronicDiseases, medicalHistory, emergencyContact, emergencyPhone, address, notes, source, referralSource } = req.body;

  const branchId = req.body.branchId || req.user.branchId;
  if (!branchId) return next(new AppError('Branch is required', 400));

  let age = null;
  if (dateOfBirth) {
    const dob = new Date(dateOfBirth);
    age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }

  const patient = await prisma.patient.create({
    data: {
      fullName, phone, email, gender,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      age, bloodType: bloodType || null,
      heightCm: heightCm ? parseFloat(heightCm) : null,
      weightKg: weightKg ? parseFloat(weightKg) : null,
      allergies, chronicDiseases, medicalHistory,
      emergencyContact, emergencyPhone, address, notes, source, referralSource,
      branchId,
    },
  });

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_PATIENT', entityType: 'PATIENT', entityId: patient.id, details: { name: patient.fullName },
  });

  sendSuccess(res, patient, 'Patient created successfully', 201);
});

const updatePatient = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const ALLOWED = ['fullName', 'phone', 'email', 'gender', 'dateOfBirth', 'heightCm', 'weightKg', 'bloodType', 'allergies', 'chronicDiseases', 'medicalHistory', 'emergencyContact', 'emergencyPhone', 'address', 'notes', 'profileImage', 'source', 'referralSource', 'isActive'];
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  if (updates.dateOfBirth) {
    updates.dateOfBirth = new Date(updates.dateOfBirth);
    updates.age = Math.floor((Date.now() - new Date(updates.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }

  const patient = await prisma.patient.update({
    where: { id },
    data: updates,
  });

  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_PATIENT', entityType: 'PATIENT', entityId: id,
  });

  sendSuccess(res, patient, 'Patient updated successfully');
});

const deletePatient = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const hasHistory = await prisma.patient.findUnique({
    where: { id },
    select: { _count: { select: { appointments: true, invoices: true, sessions: true, treatmentPlans: true, medicalRecords: true } } },
  });
  const count = hasHistory?._count;
  const used = count && (count.appointments + count.invoices + count.sessions + count.treatmentPlans + count.medicalRecords);
  if (used) {
    await prisma.patient.update({ where: { id }, data: { isActive: false } });
    return sendSuccess(res, null, 'المريض لديه سجلات سابقة، تم تعطيله بدلاً من حذفه');
  }
  await prisma.patient.delete({ where: { id } });
  await createAuditLog({
    userId: req.user.id, action: 'DELETE_PATIENT', entityType: 'PATIENT', entityId: id,
  });
  sendSuccess(res, null, 'Patient deleted successfully');
});

const getPatientStats = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const patient = await prisma.patient.findUnique({
    where: { id },
    select: {
      _count: { select: { appointments: true, invoices: true, sessions: true, treatmentPlans: true } },
    },
  });

  const totalSpentRaw = await prisma.payment.aggregate({
    where: { patientId: id },
    _sum: { amount: true },
  });

  sendSuccess(res, {
    counts: patient?._count,
    totalSpent: totalSpentRaw._sum.amount || 0,
  }, 'Patient stats fetched');
});

const getPatientLocationStats = asyncHandler(async (req, res, next) => {
  const where = {};
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  }

  const patients = await prisma.patient.findMany({
    where,
    select: { address: true },
  });

  const countByCity = patients.reduce((acc, p) => {
    const city = (p.address || '').trim() || 'غير محدد';
    acc[city] = (acc[city] || 0) + 1;
    return acc;
  }, {});

  const byBranch = await prisma.patient.groupBy({
    by: ['branchId'],
    where,
    _count: true,
  });

  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));

  sendSuccess(res, {
    byCity: Object.entries(countByCity).map(([city, count]) => ({ city, count })),
    byBranch: byBranch.map((b) => ({ branchId: b.branchId, branchName: branchMap[b.branchId] || '—', count: b._count })),
    total: patients.length,
  }, 'Patient location stats fetched');
});

module.exports = {
  getPatients, getPatient, createPatient, updatePatient, deletePatient, getPatientStats, getPatientLocationStats,
};
