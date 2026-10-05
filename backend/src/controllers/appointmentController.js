const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');
const { parseDateRange } = require('../utils/dateRange');

const getAppointments = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const skip = (page - 1) * limit;
  const { date, startDate, endDate, status, doctorId, patientId, branchId, type, search } = req.query;

  const where = {};
  if (status) where.status = status;
  if (doctorId) where.doctorId = doctorId;
  if (patientId) where.patientId = patientId;
  if (type) where.type = type;

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    where.date = { gte: start, lte: end };
  } else if (startDate && endDate) {
    const { start, end } = parseDateRange(startDate, endDate);
    where.date = { gte: start, lte: end };
  }

  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  } else if (branchId) {
    where.branchId = branchId;
  }

  if (search) {
    where.patient = { fullName: { contains: search } };
  }

  const total = await prisma.appointment.count({ where });
  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      patient: { select: { id: true, fullName: true, phone: true } },
      doctor: { select: { id: true, fullName: true } },
      branch: { select: { id: true, name: true } },
      service: { select: { id: true, name: true, price: true } },
    },
    orderBy: { date: 'asc' },
    skip,
    take: limit,
  });

  sendSuccess(res, appointments, 'Appointments fetched', 200, {
    page, limit, total, totalPages: Math.ceil(total / limit),
  });
});

const getAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: req.params.id },
    include: {
      patient: true,
      doctor: { select: { id: true, fullName: true, phone: true } },
      branch: true,
      service: true,
    },
  });
  if (!appointment) return next(new AppError('Appointment not found', 404));
  sendSuccess(res, appointment, 'Appointment fetched');
});

const createAppointment = asyncHandler(async (req, res, next) => {
  const { patientId, doctorId, serviceId, date, startTime, endTime, duration, type, notes, reason, branchId, status, room, deviceId } = req.body;

  if (!patientId || !doctorId || !date || !startTime) {
    return next(new AppError('Patient, doctor, date and start time are required', 400));
  }

  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date(start.getTime() + (duration || 30) * 60000);
  const branch = branchId || req.user.branchId;

  const conflict = await findBookingConflict(branch, start, end, { doctorId, patientId, room, deviceId });
  if (conflict) {
    return next(new AppError(
      `تعارض في المواعيد: ${conflict.patient.fullName} (${conflict.startTime ? new Date(conflict.startTime).toLocaleString('ar-SA') : ''}) - ${conflict.doctor.fullName}`,
      409
    ));
  }

  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      doctorId,
      branchId: branch,
      serviceId: serviceId || null,
      date: new Date(date),
      startTime: start,
      endTime: end,
      duration: duration || 30,
      type: type || 'CONSULTATION',
      status: status || 'SCHEDULED',
      notes,
      reason,
      room: room || null,
      deviceId: deviceId || null,
    },
  });

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_APPOINTMENT', entityType: 'APPOINTMENT', entityId: appointment.id,
  });

  sendSuccess(res, appointment, 'Appointment created successfully', 201);
});

const updateAppointment = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const ALLOWED = ['patientId', 'doctorId', 'serviceId', 'date', 'startTime', 'endTime', 'duration', 'type', 'status', 'notes', 'reason', 'treatCategory', 'branchId', 'reminderSent', 'room', 'deviceId'];
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.date) updates.date = new Date(updates.date);
  if (updates.startTime) updates.startTime = new Date(updates.startTime);
  if (updates.endTime) updates.endTime = new Date(updates.endTime);

  const existing = await prisma.appointment.findUnique({ where: { id } });
  if (!existing) return next(new AppError('Appointment not found', 404));

  const hasTimeBlock = updates.startTime || updates.endTime || updates.duration || updates.patientId || updates.doctorId || updates.branchId || updates.room || updates.deviceId;
  if (hasTimeBlock) {
    const branchId = updates.branchId || existing.branchId;
    const start = updates.startTime || existing.startTime;
    let end = updates.endTime || existing.endTime;
    if (updates.duration && !updates.endTime) end = new Date(new Date(start).getTime() + updates.duration * 60000);

    const conflict = await findBookingConflict(branchId, new Date(start), new Date(end), {
      doctorId: updates.doctorId || existing.doctorId,
      patientId: updates.patientId || existing.patientId,
      room: updates.room !== undefined ? updates.room : existing.room,
      deviceId: updates.deviceId !== undefined ? updates.deviceId : existing.deviceId,
    }, id);
    if (conflict) {
      return next(new AppError(
        `تعارض في المواعيد: ${conflict.patient.fullName} (${conflict.startTime ? new Date(conflict.startTime).toLocaleString('ar-SA') : ''}) - ${conflict.doctor.fullName}`,
        409
      ));
    }
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: updates,
  });

  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_APPOINTMENT', entityType: 'APPOINTMENT', entityId: id, details: { status: updates.status },
  });

  sendSuccess(res, appointment, 'Appointment updated successfully');
});

const changeAppointmentStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  const appointment = await prisma.appointment.update({
    where: { id },
    data: { status },
  });

  if (['NO_SHOW'].includes(status)) {
    await createAuditLog({
      userId: req.user.id, action: 'APPOINTMENT_CANCELLED', entityType: 'APPOINTMENT', entityId: id,
    });
  }

  sendSuccess(res, appointment, 'Appointment status updated');
});

const deleteAppointment = asyncHandler(async (req, res, next) => {
  await prisma.appointment.delete({ where: { id: req.params.id } });
  await createAuditLog({
    userId: req.user.id, action: 'DELETE_APPOINTMENT', entityType: 'APPOINTMENT', entityId: req.params.id,
  });
  sendSuccess(res, null, 'Appointment deleted');
});

const getCalendar = asyncHandler(async (req, res, next) => {
  const { startDate, endDate, doctorId } = req.query;
  if (!startDate || !endDate) return next(new AppError('startDate and endDate are required', 400));

  const { start, end } = parseDateRange(startDate, endDate);
  const where = {
    date: { gte: start, lte: end },
  };
  if (doctorId) where.doctorId = doctorId;
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      patient: { select: { id: true, fullName: true, phone: true } },
      doctor: { select: { id: true, fullName: true } },
      service: { select: { id: true, name: true } },
    },
    orderBy: { startTime: 'asc' },
  });

  const grouped = appointments.reduce((acc, appt) => {
    const d = appt.date || appt.startTime;
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!acc[dayKey]) acc[dayKey] = [];
    acc[dayKey].push(appt);
    return acc;
  }, {});

  sendSuccess(res, grouped, 'Calendar fetched');
});

const getAppointmentStats = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  const where = {};
  if (startDate && endDate) {
    const { start, end } = parseDateRange(startDate, endDate);
    where.date = { gte: start, lte: end };
  }
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  }

  const todayLocal = new Date();
  const todayStr = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;
  const { start: todayStart, end: todayEnd } = parseDateRange(todayStr, todayStr);

  const [total, today, upcoming, grouped] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.count({ where: { ...where, date: { gte: todayStart, lte: todayEnd }, status: { not: 'CANCELLED' } } }),
    prisma.appointment.count({ where: { ...where, date: { gte: todayStart }, status: { in: ['SCHEDULED', 'CONFIRMED'] } } }),
    prisma.appointment.groupBy({ by: ['status'], where, _count: true }),
  ]);

  sendSuccess(res, { total, upcoming, today, byStatus: grouped }, 'Appointment stats fetched');
});

const findBookingConflict = async (branchId, start, end, { doctorId, patientId, room, deviceId }, excludeId) => {
  const timeOverlap = {
    startTime: { lt: end },
    endTime: { gt: start },
  };
  const base = {
    branchId,
    status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    ...timeOverlap,
  };
  if (excludeId) base.id = { not: excludeId };

  const or = [];
  if (doctorId) or.push({ doctorId });
  if (patientId) or.push({ patientId });
  if (room) or.push({ room });
  if (deviceId) or.push({ deviceId });

  if (or.length === 0) return null;
  base.OR = or;

  return prisma.appointment.findFirst({
    where: base,
    include: {
      patient: { select: { id: true, fullName: true } },
      doctor: { select: { id: true, fullName: true } },
    },
  });
};

module.exports = {
  getAppointments, getAppointment, createAppointment, updateAppointment, changeAppointmentStatus, deleteAppointment, getCalendar, getAppointmentStats,
};
