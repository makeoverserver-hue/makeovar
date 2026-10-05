const prisma = require('../utils/db');
const { parseDateRange } = require('../utils/dateRange');

function toCsv(rows, headers) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [];
  if (headers) lines.push(headers.map(esc).join(','));
  for (const row of rows) {
    lines.push(helpers.list(row).map(esc).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
}

const helpers = {
  list: (row) => Object.values(row),
};

function sendCsv(res, csv, filename) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

const exportRevenue = async (req, res) => {
  const { startDate, endDate } = req.query;
  const now = new Date();
  const bounds = startDate && endDate ? parseDateRange(startDate, endDate) : {
    start: new Date(now.getFullYear(), 0, 1),
    end: new Date(now.getFullYear(), 11, 31, 23, 59, 59),
  };
  const payments = await prisma.payment.findMany({
    where: { createdAt: { gte: bounds.start, lte: bounds.end } },
    include: { invoice: { include: { patient: { select: { fullName: true } }, branch: { select: { name: true } } } }, receivedBy: { select: { fullName: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const rows = payments.map((p) => ({
    'التاريخ': new Date(p.createdAt).toLocaleString('ar-EG'),
    'المريض': p.invoice?.patient?.fullName || '',
    'المبلغ': p.amount,
    'طريقة الدفع': p.method,
    'الفئة': 'إيراد',
    'الفرع': p.invoice?.branch?.name || '',
    'الفاتورة': p.invoice?.invoiceNumber || '',
    'مستلم الدفع': p.receivedBy?.fullName || '',
  }));
  sendCsv(res, toCsv(rows), `revenue-${Date.now()}.csv`);
};

const exportExpenses = async (req, res) => {
  const { startDate, endDate } = req.query;
  const where = {};
  if (startDate && endDate) {
    const { start, end } = parseDateRange(startDate, endDate);
    where.date = { gte: start, lte: end };
  }
  const expenses = await prisma.expense.findMany({
    where,
    include: { branch: { select: { name: true } } },
    orderBy: { date: 'asc' },
  });
  const rows = expenses.map((e) => ({
    'التاريخ': new Date(e.date).toLocaleString('ar-EG'),
    'التصنيف': e.category,
    'الوصف': e.description || '',
    'المبلغ': e.amount,
    'طريقة الدفع': e.paymentMethod || '',
    'الفئة': 'مصروف',
    'الفرع': e.branch?.name || '',
  }));
  sendCsv(res, toCsv(rows), `expenses-${Date.now()}.csv`);
};

const exportInvoices = async (req, res) => {
  const invoices = await prisma.invoice.findMany({
    include: { patient: { select: { fullName: true, phone: true } }, branch: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });
  const rows = invoices.map((i) => ({
    'رقم الفاتورة': i.invoiceNumber,
    'التاريخ': new Date(i.createdAt).toLocaleString('ar-EG'),
    'المريض': i.patient?.fullName || '',
    'الجوال': i.patient?.phone || '',
    'الإجمالي': i.total,
    'المدفوع': i.paidAmount,
    'المتبقي': i.dueAmount,
    'الحالة': i.status,
    'الفرع': i.branch?.name || '',
  }));
  sendCsv(res, toCsv(rows), `invoices-${Date.now()}.csv`);
};

const exportPatients = async (req, res) => {
  const patients = await prisma.patient.findMany({
    include: {
      _count: { select: { appointments: true, sessions: true, invoices: true } },
      branch: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 2000,
  });
  const rows = patients.map((p) => ({
    'الاسم': p.fullName,
    'الجوال': p.phone || '',
    'الجنس': p.gender || '',
    'المصدر': p.source || '',
    'المواعيد': p._count.appointments,
    'الجلسات': p._count.sessions,
    'الفواتير': p._count.invoices,
    'الفرع': p.branch?.name || '',
    'تاريخ التسجيل': new Date(p.createdAt).toLocaleDateString('ar-EG'),
  }));
  sendCsv(res, toCsv(rows), `patients-${Date.now()}.csv`);
};

const exportSessions = async (req, res) => {
  const sessions = await prisma.treatmentSession.findMany({
    include: {
      patient: { select: { fullName: true, phone: true } },
      service: { select: { name: true } },
      doctor: { select: { fullName: true } },
    },
    orderBy: { scheduledDate: 'desc' },
    take: 2000,
  });
  const rows = sessions.map((s) => ({
    'التاريخ': s.scheduledDate ? new Date(s.scheduledDate).toLocaleString('ar-EG') : '',
    'المريض': s.patient?.fullName || '',
    'الخدمة': s.service?.name || '',
    'الطبيب': s.doctor?.fullName || '',
    'رقم الجلسة': s.sessionNumber || '',
    'المنطقة': s.areaTreated || '',
    'النبضات المستخدمة': s.usedPulses ?? '',
    'الوزن': s.weightKg ?? '',
    'الحالة': s.status,
    'ملاحظات': s.notes || '',
  }));
  sendCsv(res, toCsv(rows), `sessions-${Date.now()}.csv`);
};

module.exports = { exportRevenue, exportExpenses, exportInvoices, exportPatients, exportSessions, toCsv, sendCsv };