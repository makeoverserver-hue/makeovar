const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const { parseDateRange } = require('../utils/dateRange');

const getDashboardStats = asyncHandler(async (req, res, next) => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const branchWhere = req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN'
    ? { branchId: req.user.branchId }
    : {};

  const [
    totalPatients,
    newPatientsThisMonth,
    todayAppointments,
    upcomingAppointments,
    totalInvoices,
    revenueToday,
    revenueMonth,
    pendingInvoices,
    activeDevices,
    lowStockItems,
  ] = await Promise.all([
    prisma.patient.count({ where: branchWhere }),
    prisma.patient.count({ where: { ...branchWhere, createdAt: { gte: monthStart } } }),
    prisma.appointment.count({ where: { ...branchWhere, date: { gte: todayStart, lte: todayEnd }, status: { not: 'CANCELLED' } } }),
    prisma.appointment.count({ where: { ...branchWhere, date: { gte: now }, status: { in: ['SCHEDULED', 'CONFIRMED'] } } }),
    prisma.invoice.count({ where: branchWhere }),
    prisma.payment.aggregate({ where: { createdAt: { gte: todayStart, lte: todayEnd } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    prisma.invoice.count({ where: { ...branchWhere, status: { in: ['PENDING', 'PARTIALLY_PAID'] } } }),
    prisma.device.count({ where: { ...branchWhere, isActive: true } }),
    prisma.inventoryItem.count({ where: { ...branchWhere } }).then((total) => total),
  ]);

  const allInventory = await prisma.inventoryItem.findMany({
    where: branchWhere,
    select: { id: true, quantity: true, minQuantity: true },
  });
  const lowStock = allInventory.filter((item) => item.quantity <= item.minQuantity).length;

  // Weekly revenue for chart
  const weekData = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    const dayStart = new Date(day);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    const dayRevenue = await prisma.payment.aggregate({
      where: { createdAt: { gte: dayStart, lte: dayEnd } },
      _sum: { amount: true },
    });
    weekData.push({
      day: day.toLocaleDateString('ar-EG', { weekday: 'short' }),
      date: day.toISOString().split('T')[0],
      revenue: dayRevenue._sum.amount || 0,
    });
  }

  // Recent appointments
  const recentAppointments = await prisma.appointment.findMany({
    where: { ...branchWhere, date: { gte: now } },
    include: {
      patient: { select: { id: true, fullName: true, phone: true } },
      doctor: { select: { id: true, fullName: true } },
    },
    orderBy: { date: 'asc' },
    take: 8,
  });

  // Device status breakdown
  const deviceStats = await prisma.device.groupBy({
    by: ['status'],
    where: { ...branchWhere, isActive: true },
    _count: true,
  });
  const deviceByStatus = deviceStats.reduce((acc, d) => {
    acc[d.status] = d._count;
    return acc;
  }, {});

  sendSuccess(res, {
    counters: {
      totalPatients,
      newPatientsThisMonth,
      todayAppointments,
      upcomingAppointments,
      totalInvoices,
      revenueToday: revenueToday._sum.amount || 0,
      revenueMonth: revenueMonth._sum.amount || 0,
      pendingInvoices,
      activeDevices,
      lowStockItems: lowStock,
    },
    revenueWeek: weekData,
    recentAppointments,
    deviceByStatus,
  }, 'Dashboard stats fetched');
});

const getRevenueReport = asyncHandler(async (req, res, next) => {
  const { startDate, endDate, branchId, groupBy = 'day' } = req.query;
  if (!startDate || !endDate) return sendSuccess(res, { error: 'Dates required' }, 'Bad request', 400);

  const { start, end } = parseDateRange(startDate, endDate);
  const where = { createdAt: { gte: start, lte: end } };
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  } else if (branchId) {
    where.branchId = branchId;
  }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      invoice: { include: { patient: { select: { fullName: true } }, branch: { select: { name: true } } } },
      receivedBy: { select: { fullName: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const totals = await prisma.payment.aggregate({
    where,
    _sum: { amount: true },
    _count: true,
  });

  const invoiceWhere = {};
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    invoiceWhere.branchId = req.user.branchId;
  } else if (branchId) {
    invoiceWhere.branchId = branchId;
  }
  const invoiceTotals = await prisma.invoice.aggregate({
    where: { ...invoiceWhere, createdAt: { gte: start, lte: end } },
    _sum: { total: true, paidAmount: true, discount: true },
    _count: true,
  });

  const byMethod = await prisma.payment.groupBy({
    by: ['method'],
    where,
    _sum: { amount: true },
    _count: true,
  });

  sendSuccess(res, {
    payments,
    totals: { amount: totals._sum.amount || 0, count: totals._count },
    byMethod,
    invoices: {
      count: invoiceTotals._count,
      billed: invoiceTotals._sum.total || 0,
      paid: invoiceTotals._sum.paidAmount || 0,
      discount: invoiceTotals._sum.discount || 0,
    },
  }, 'Revenue report generated');
});

const getTreatmentReport = asyncHandler(async (req, res, next) => {
  const { startDate, endDate, branchId } = req.query;
  const where = {};
  if (startDate && endDate) {
    const { start, end } = parseDateRange(startDate, endDate);
    where.OR = [
      { completedDate: { gte: start, lte: end } },
      { scheduledDate: { gte: start, lte: end } },
    ];
  }
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.patient = { branchId: req.user.branchId };
  } else if (branchId) {
    where.patient = { branchId };
  }

  const sessions = await prisma.treatmentSession.findMany({
    where,
    include: {
      patient: { select: { id: true, fullName: true } },
      service: { select: { id: true, name: true, category: true } },
      doctor: { select: { id: true, fullName: true } },
      sessionDevices: { include: { device: { select: { id: true, name: true, type: true } } } },
    },
    orderBy: { completedDate: 'desc' },
  });

  const byService = await prisma.treatmentSession.groupBy({
    by: ['serviceId'],
    where: where,
    _count: true,
  });

  // resolve service names
  const fruit = await prisma.service.findMany({
    where: { id: { in: byService.map((s) => s.serviceId) } },
    select: { id: true, name: true, category: true },
  });

  sendSuccess(res, {
    sessions,
    totalSessions: sessions.length,
    completedSessions: sessions.filter((s) => s.status === 'COMPLETED').length,
    byService: byService.map((bs) => {
      const svc = fruit.find((f) => f.id === bs.serviceId);
      return { serviceId: bs.serviceId, name: svc?.name || 'Unknown', category: svc?.category, count: bs._count };
    }),
  }, 'Treatment report generated');
});

const getDoctorReport = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;
  const where = {};
  if (startDate && endDate) {
    const { start, end } = parseDateRange(startDate, endDate);
    where.date = { gte: start, lte: end };
  }
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  }

  const appointments = await prisma.appointment.findMany({
    where,
    include: {
      doctor: { select: { id: true, fullName: true } },
      patient: { select: { id: true, fullName: true } },
    },
  });

  const byDoctor = appointments.reduce((acc, a) => {
    const id = a.doctor.id;
    if (!acc[id]) {
      acc[id] = { doctorId: id, doctorName: a.doctor.fullName, total: 0, completed: 0, cancelled: 0, noShow: 0 };
    }
    acc[id].total++;
    if (a.status === 'COMPLETED') acc[id].completed++;
    if (a.status === 'CANCELLED') acc[id].cancelled++;
    if (a.status === 'NO_SHOW') acc[id].noShow++;
    return acc;
  }, {});

  sendSuccess(res, {
    doctors: Object.values(byDoctor),
    totalAppointments: appointments.length,
  }, 'Doctor report generated');
});

const getInventoryReport = asyncHandler(async (req, res, next) => {
  const { branchId } = req.query;
  const where = {};
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  } else if (branchId) {
    where.branchId = branchId;
  }

  const items = await prisma.inventoryItem.findMany({ where });
  const totalValue = items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
  const lowStock = items.filter((i) => i.quantity <= i.minQuantity);
  const outOfStock = items.filter((i) => i.quantity === 0);

  const recentMovements = await prisma.inventoryMovement.findMany({
    where,
    include: { item: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  sendSuccess(res, {
    totalItems: items.length,
    totalValue,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    lowStock,
    outOfStock,
    recentMovements,
  }, 'Inventory report generated');
});

module.exports = {
  getDashboardStats, getRevenueReport, getTreatmentReport, getDoctorReport, getInventoryReport,
};
