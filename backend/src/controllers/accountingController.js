const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const { parseDateRange } = require('../utils/dateRange');

// ─── helpers ──────────────────────────────────────────────
function monthLabel(d) {
  const m = d.getMonth();
  const labels = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  return labels[m] + ' ' + d.getFullYear();
}

function quarterLabel(d) {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `الربع ${q} ${d.getFullYear()}`;
}

// ═══════════════════════════════════════════════════════════
// 1. MONTHLY P&L  —  revenues vs expenses per month
// ═══════════════════════════════════════════════════════════
const getMonthlyPnL = asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const branchFilter = (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN')
    ? { branchId: req.user.branchId } : {};

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: { gte: yearStart, lte: yearEnd }, ...branchFilter },
      select: { amount: true, method: true, createdAt: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: yearStart, lte: yearEnd }, ...branchFilter },
      select: { amount: true, category: true, date: true },
    }),
  ]);

  const months = Array.from({ length: 12 }, (_, i) => {
    const monthStart = new Date(year, i, 1);
    const monthEnd = new Date(year, i + 1, 0, 23, 59, 59);
    const label = monthLabel(monthStart);
    const rev = payments.filter(p => p.createdAt >= monthStart && p.createdAt <= monthEnd);
    const exp = expenses.filter(e => e.date >= monthStart && e.date <= monthEnd);
    const totalRevenue = rev.reduce((s, p) => s + p.amount, 0);
    const totalExpenses = exp.reduce((s, e) => s + e.amount, 0);
    return {
      month: i + 1,
      label,
      revenue: totalRevenue,
      expenses: totalExpenses,
      net: totalRevenue - totalExpenses,
      expensesByCategory: EXPENSE_GROUPS(exp),
      paymentCount: rev.length,
      expenseCount: exp.length,
    };
  });

  const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);

  sendSuccess(res, {
    year,
    months,
    totals: { revenue: totalRevenue, expenses: totalExpenses, net: totalRevenue - totalExpenses },
  }, 'Monthly P&L fetched');
});

// ═══════════════════════════════════════════════════════════
// 2. YEARLY P&L  —  multi-year comparison
// ═══════════════════════════════════════════════════════════
const getYearlyPnL = asyncHandler(async (req, res) => {
  const startYear = parseInt(req.query.startYear) || (new Date().getFullYear() - 2);
  const endYear = parseInt(req.query.endYear) || new Date().getFullYear();
  const branchFilter = (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN')
    ? { branchId: req.user.branchId } : {};

  const allStart = new Date(startYear, 0, 1);
  const allEnd = new Date(endYear, 11, 31, 23, 59, 59);

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: { gte: allStart, lte: allEnd }, ...branchFilter },
      select: { amount: true, createdAt: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: allStart, lte: allEnd }, ...branchFilter },
      select: { amount: true, category: true, date: true },
    }),
  ]);

  const years = [];
  for (let y = startYear; y <= endYear; y++) {
    const yStart = new Date(y, 0, 1);
    const yEnd = new Date(y, 11, 31, 23, 59, 59);
    const rev = payments.filter(p => p.createdAt >= yStart && p.createdAt <= yEnd);
    const exp = expenses.filter(e => e.date >= yStart && e.date <= yEnd);
    const totalRevenue = rev.reduce((s, p) => s + p.amount, 0);
    const totalExpenses = exp.reduce((s, e) => s + e.amount, 0);
    years.push({
      year: y,
      revenue: totalRevenue,
      expenses: totalExpenses,
      net: totalRevenue - totalExpenses,
      expensesByCategory: EXPENSE_GROUPS(exp),
      paymentCount: rev.length,
      expenseCount: exp.length,
    });
  }

  sendSuccess(res, { years }, 'Yearly P&L fetched');
});

// ═══════════════════════════════════════════════════════════
// 3. CASH FLOW  —  inflows vs outflows by payment method
// ═══════════════════════════════════════════════════════════
const getCashFlow = asyncHandler(async (req, res) => {
  const { startDate, endDate, period = 'year' } = req.query;
  const now = new Date();
  let start, end;
  if (startDate && endDate) {
    const r = parseDateRange(startDate, endDate); start = r.start; end = r.end;
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = now;
  } else {
    start = new Date(now.getFullYear(), 0, 1);
    end = now;
  }
  const branchFilter = (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN')
    ? { branchId: req.user.branchId } : {};

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: { gte: start, lte: end }, ...branchFilter },
      select: { amount: true, method: true, createdAt: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: start, lte: end }, ...branchFilter },
      select: { amount: true, category: true, paymentMethod: true, date: true },
    }),
  ]);

  const METHOD_LABELS = { CASH: 'نقداً', CARD: 'بطاقة', BANK_TRANSFER: 'تحويل بنكي', ONLINE: 'إلكتروني', OTHER: 'أخرى' };

  // Group inflows by method
  const inflowsByMethod = {};
  for (const p of payments) {
    const m = p.method || 'CASH';
    inflowsByMethod[m] = (inflowsByMethod[m] || 0) + p.amount;
  }

  // Group outflows by method
  const outflowsByMethod = {};
  for (const e of expenses) {
    const m = e.paymentMethod || 'CASH';
    outflowsByMethod[m] = (outflowsByMethod[m] || 0) + e.amount;
  }

  // Monthly cash flow
  const monthly = [];
  const startMonth = start.getMonth();
  const startYear = start.getFullYear();
  const endMonth = end.getMonth();
  const endYear = end.getFullYear();
  let current = new Date(startYear, startMonth, 1);
  while (current <= end) {
    const mStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const mEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);
    const mRev = payments.filter(p => p.createdAt >= mStart && p.createdAt <= mEnd).reduce((s, p) => s + p.amount, 0);
    const mExp = expenses.filter(e => e.date >= mStart && e.date <= mEnd).reduce((s, e) => s + e.amount, 0);
    monthly.push({
      label: monthLabel(mStart),
      inflows: mRev,
      outflows: mExp,
      net: mRev - mExp,
    });
    current.setMonth(current.getMonth() + 1);
  }

  const totalInflows = payments.reduce((s, p) => s + p.amount, 0);
  const totalOutflows = expenses.reduce((s, e) => s + e.amount, 0);

  sendSuccess(res, {
    period: { start, end },
    totals: { inflows: totalInflows, outflows: totalOutflows, net: totalInflows - totalOutflows },
    inflowsByMethod: Object.entries(inflowsByMethod).map(([method, amount]) => ({ method, label: METHOD_LABELS[method] || method, amount })),
    outflowsByMethod: Object.entries(outflowsByMethod).map(([method, amount]) => ({ method, label: METHOD_LABELS[method] || method, amount })),
    monthly,
  }, 'Cash flow fetched');
});

// ═══════════════════════════════════════════════════════════
// 4. TAX SUMMARY  —  VAT collected from invoices
// ═══════════════════════════════════════════════════════════
const getTaxSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate, period = 'year' } = req.query;
  const now = new Date();
  let start, end;
  if (startDate && endDate) {
    const r = parseDateRange(startDate, endDate); start = r.start; end = r.end;
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1); end = now;
  } else {
    start = new Date(now.getFullYear(), 0, 1); end = now;
  }
  const branchFilter = (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN')
    ? { branchId: req.user.branchId } : {};

  const invoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: start, lte: end }, ...branchFilter },
    select: { subtotal: true, discount: true, tax: true, taxRate: true, total: true, status: true, createdAt: true },
  });

  const totalSubtotal = invoices.reduce((s, i) => s + i.subtotal, 0);
  const totalDiscount = invoices.reduce((s, i) => s + i.discount, 0);
  const totalTax = invoices.reduce((s, i) => s + i.tax, 0);
  const totalTotal = invoices.reduce((s, i) => s + i.total, 0);

  // Monthly breakdown
  const monthly = [];
  const seenRates = new Set(invoices.filter(i => i.taxRate > 0).map(i => i.taxRate));
  const current = new Date(start);
  while (current <= end) {
    const mStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const mEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);
    const mInvoices = invoices.filter(i => i.createdAt >= mStart && i.createdAt <= mEnd);
    monthly.push({
      label: monthLabel(mStart),
      subtotal: mInvoices.reduce((s, i) => s + i.subtotal, 0),
      discount: mInvoices.reduce((s, i) => s + i.discount, 0),
      tax: mInvoices.reduce((s, i) => s + i.tax, 0),
      total: mInvoices.reduce((s, i) => s + i.total, 0),
      count: mInvoices.length,
    });
    current.setMonth(current.getMonth() + 1);
  }

  sendSuccess(res, {
    period: { start, end },
    totals: { subtotal: totalSubtotal, discount: totalDiscount, tax: totalTax, total: totalTotal },
    invoiceCount: invoices.length,
    taxRates: [...seenRates],
    monthly,
  }, 'Tax summary fetched');
});

// ═══════════════════════════════════════════════════════════
// 5. AR AGING  —  outstanding invoices by age bracket
// ═══════════════════════════════════════════════════════════
const getARAging = asyncHandler(async (req, res) => {
  const branchFilter = (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN')
    ? { branchId: req.user.branchId } : {};

  const invoices = await prisma.invoice.findMany({
    where: { dueAmount: { gt: 0 }, status: { in: ['PENDING', 'PARTIALLY_PAID'] }, ...branchFilter },
    include: { patient: { select: { id: true, fullName: true, phone: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const now = new Date();
  const brackets = [
    { label: '0 - 30 يوم', min: 0, max: 30, items: [] },
    { label: '31 - 60 يوم', min: 31, max: 60, items: [] },
    { label: '61 - 90 يوم', min: 61, max: 90, items: [] },
    { label: 'أكثر من 90 يوم', min: 91, max: Infinity, items: [] },
  ];

  let totalOutstanding = 0;
  for (const inv of invoices) {
    const ageDays = Math.floor((now - new Date(inv.createdAt)) / (1000 * 60 * 60 * 24));
    const bracket = brackets.find(b => ageDays >= b.min && ageDays <= b.max) || brackets[3];
    bracket.items.push({
      id: inv.id,
      patient: inv.patient,
      createdAt: inv.createdAt,
      total: inv.total,
      paidAmount: inv.paidAmount,
      dueAmount: inv.dueAmount,
      ageDays,
    });
    totalOutstanding += inv.dueAmount;
  }

  sendSuccess(res, {
    totals: { outstanding: totalOutstanding, invoiceCount: invoices.length },
    brackets: brackets.map(b => ({
      label: b.label,
      count: b.items.length,
      amount: b.items.reduce((s, i) => s + i.dueAmount, 0),
      items: b.items,
    })),
  }, 'AR aging fetched');
});

// ═══════════════════════════════════════════════════════════
// 6. COMMISSION LIABILITY  —  owed to doctors
// ═══════════════════════════════════════════════════════════
const getCommissionLiability = asyncHandler(async (req, res) => {
  const branchFilter = (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN')
    ? { branchId: req.user.branchId } : {};

  const records = await prisma.commissionRecord.findMany({
    where: { status: 'pending', ...branchFilter },
    include: {
      user: { select: { id: true, fullName: true, role: true, commissionRate: true, salary: true } },
    },
  });

  // Group by doctor
  const byDoctor = {};
  for (const r of records) {
    const uid = r.userId;
    if (!byDoctor[uid]) byDoctor[uid] = { doctor: r.user, total: 0, records: [] };
    byDoctor[uid].total += r.amount;
    byDoctor[uid].records.push({ id: r.id, amount: r.amount, amountBasis: r.amountBasis, rate: r.rate, createdAt: r.createdAt });
  }

  const totalOwed = records.reduce((s, r) => s + r.amount, 0);

  sendSuccess(res, {
    totals: { owed: totalOwed, recordCount: records.length },
    byDoctor: Object.values(byDoctor).map(d => ({
      doctor: d.doctor,
      totalOwed: d.total,
      recordCount: d.records.length,
      records: d.records,
    })),
  }, 'Commission liability fetched');
});

// ═══════════════════════════════════════════════════════════
// 7. REVENUE BREAKDOWN  —  by service / doctor / branch
// ═══════════════════════════════════════════════════════════
const getRevenueBreakdown = asyncHandler(async (req, res) => {
  const { startDate, endDate, period = 'year', groupBy = 'service' } = req.query;
  const now = new Date();
  let start, end;
  if (startDate && endDate) {
    const r = parseDateRange(startDate, endDate); start = r.start; end = r.end;
  } else if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1); end = now;
  } else {
    start = new Date(now.getFullYear(), 0, 1); end = now;
  }
  const branchFilter = (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN')
    ? { branchId: req.user.branchId } : {};

  const payments = await prisma.payment.findMany({
    where: { createdAt: { gte: start, lte: end }, ...branchFilter },
    include: {
      invoice: {
        include: {
          patient: { select: { fullName: true } },
          createdBy: { select: { fullName: true } },
          branch: { select: { name: true } },
          items: { include: { service: { select: { name: true, category: true, cost: true } } } },
        },
      },
    },
  });

  const METHOD_LABELS = { CASH: 'نقداً', CARD: 'بطاقة', BANK_TRANSFER: 'تحويل بنكي', ONLINE: 'إلكتروني', OTHER: 'أخرى' };

  // Flatten to line items
  const lineItems = [];
  for (const p of payments) {
    const inv = p.invoice;
    if (!inv || !inv.items || inv.items.length === 0) {
      lineItems.push({
        amount: p.amount,
        service: 'عام',
        serviceCategory: 'عام',
        cost: 0,
        doctor: inv?.receivedBy?.fullName || '—',
        branch: inv?.branch?.name || '—',
        method: p.method,
        date: p.createdAt,
      });
      continue;
    }
    // Distribute payment proportionally across invoice items
    const ratio = inv.total > 0 ? p.amount / inv.total : 1 / inv.items.length;
    for (const item of inv.items) {
      lineItems.push({
        amount: item.total * ratio,
        service: item.service?.name || '—',
        serviceCategory: item.service?.category || '—',
        cost: (item.service?.cost || 0) * item.quantity,
        doctor: inv?.receivedBy?.fullName || '—',
        branch: inv?.branch?.name || '—',
        method: p.method,
        date: p.createdAt,
      });
    }
  }

  const totalRevenue = lineItems.reduce((s, l) => s + l.amount, 0);
  const totalCOGS = lineItems.reduce((s, l) => s + l.cost, 0);

  // Group by requested dimension
  let grouped;
  if (groupBy === 'doctor') {
    grouped = {};
    for (const l of lineItems) {
      if (!grouped[l.doctor]) grouped[l.doctor] = { revenue: 0, cogs: 0, count: 0 };
      grouped[l.doctor].revenue += l.amount;
      grouped[l.doctor].cogs += l.cost;
      grouped[l.doctor].count++;
    }
  } else if (groupBy === 'branch') {
    grouped = {};
    for (const l of lineItems) {
      if (!grouped[l.branch]) grouped[l.branch] = { revenue: 0, cogs: 0, count: 0 };
      grouped[l.branch].revenue += l.amount;
      grouped[l.branch].cogs += l.cost;
      grouped[l.branch].count++;
    }
  } else { // by service
    grouped = {};
    for (const l of lineItems) {
      if (!grouped[l.service]) grouped[l.service] = { revenue: 0, cogs: 0, category: l.serviceCategory, count: 0 };
      grouped[l.service].revenue += l.amount;
      grouped[l.service].cogs += l.cost;
      grouped[l.service].count++;
    }
  }

  const breakdown = Object.entries(grouped).map(([name, data]) => ({
    name,
    ...data,
    grossProfit: data.revenue - data.cogs,
    margin: data.revenue > 0 ? ((data.revenue - data.cogs) / data.revenue * 100).toFixed(1) : '0.0',
  })).sort((a, b) => b.revenue - a.revenue);

  sendSuccess(res, {
    period: { start, end },
    totals: { revenue: totalRevenue, cogs: totalCOGS, grossProfit: totalRevenue - totalCOGS, margin: totalRevenue > 0 ? ((totalRevenue - totalCOGS) / totalRevenue * 100).toFixed(1) : '0.0' },
    groupBy,
    breakdown,
  }, 'Revenue breakdown fetched');
});

// ═══════════════════════════════════════════════════════════
// 8. FULL ACCOUNTING SUMMARY  —  all-in-one
// ═══════════════════════════════════════════════════════════
const getAccountingSummary = asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const branchFilter = (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN')
    ? { branchId: req.user.branchId } : {};

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const [payments, expenses, invoices, commissions, installments] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: { gte: yearStart, lte: yearEnd }, ...branchFilter },
      select: { amount: true, method: true, createdAt: true },
    }),
    prisma.expense.findMany({
      where: { date: { gte: yearStart, lte: yearEnd }, ...branchFilter },
      select: { amount: true, category: true, date: true },
    }),
    prisma.invoice.findMany({
      where: { createdAt: { gte: yearStart, lte: yearEnd }, ...branchFilter },
      select: { subtotal: true, discount: true, tax: true, total: true, paidAmount: true, dueAmount: true, status: true },
    }),
    prisma.commissionRecord.findMany({
      where: { createdAt: { gte: yearStart, lte: yearEnd }, ...branchFilter },
      select: { amount: true, status: true },
    }),
    prisma.installment.findMany({
      where: { dueDate: { gte: yearStart, lte: yearEnd }, ...branchFilter },
      select: { amount: true, status: true },
    }),
  ]);

  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalTax = invoices.reduce((s, i) => s + i.tax, 0);
  const totalDiscount = invoices.reduce((s, i) => s + i.discount, 0);
  const totalInvoiced = invoices.reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.dueAmount, 0);
  const totalCommissions = commissions.reduce((s, c) => s + c.amount, 0);
  const paidCommissions = commissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0);
  const pendingCommissions = totalCommissions - paidCommissions;
  const totalInstallments = installments.reduce((s, i) => s + i.amount, 0);
  const collectedInstallments = installments.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0);

  // Expenses by category
  const expByCategory = {};
  for (const e of expenses) {
    expByCategory[e.category] = (expByCategory[e.category] || 0) + e.amount;
  }

  // Operating expenses (exclude taxes if any)
  const operatingExpenses = totalExpenses;

  sendSuccess(res, {
    year,
    income: {
      revenue: totalRevenue,
      invoiced: totalInvoiced,
      taxCollected: totalTax,
      discounts: totalDiscount,
    },
    expenses: {
      total: totalExpenses,
      byCategory: Object.entries(expByCategory).map(([cat, amt]) => ({ category: cat, amount: amt, percent: totalExpenses > 0 ? (amt / totalExpenses * 100).toFixed(1) : '0.0' })),
    },
    profit: {
      grossProfit: totalRevenue - operatingExpenses,
      netProfit: totalRevenue - operatingExpenses,
      margin: totalRevenue > 0 ? ((totalRevenue - operatingExpenses) / totalRevenue * 100).toFixed(1) : '0.0',
    },
    receivables: {
      totalInvoiced,
      totalPaid,
      totalOutstanding,
      collectionRate: totalInvoiced > 0 ? (totalPaid / totalInvoiced * 100).toFixed(1) : '0.0',
    },
    commissions: {
      total: totalCommissions,
      paid: paidCommissions,
      pending: pendingCommissions,
    },
    installments: {
      total: totalInstallments,
      collected: collectedInstallments,
      pending: totalInstallments - collectedInstallments,
    },
  }, 'Accounting summary fetched');
});

// ─── shared helpers ───────────────────────────────────────
const EXPENSE_GROUPS = (arr) => {
  const groups = {};
  for (const e of arr) { groups[e.category] = (groups[e.category] || 0) + e.amount; }
  return Object.entries(groups).map(([category, amount]) => ({ category, amount }));
};

// ═══════════════════════════════════════════════════════════
// 9. DAILY P&L  —  per-day revenue/expenses/net
// ═══════════════════════════════════════════════════════════
const getDailyPnL = asyncHandler(async (req, res) => {
  const { date, startDate, endDate } = req.query;
  const branchFilter = (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN')
    ? { branchId: req.user.branchId } : {};

  let start, end;
  if (startDate && endDate) {
    const r = parseDateRange(startDate, endDate);
    start = r.start; end = r.end;
  } else {
    const d = date ? new Date(date + 'T12:00:00') : new Date();
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  }

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { createdAt: { gte: start, lte: end }, ...branchFilter },
      include: {
        invoice: { select: { id: true, invoiceNumber: true, patient: { select: { id: true, fullName: true } } } },
        receivedBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.expense.findMany({
      where: { date: { gte: start, lte: end }, ...branchFilter },
      include: { branch: { select: { name: true } } },
      orderBy: { date: 'desc' },
    }),
  ]);

  const METHOD_LABELS = { CASH: 'نقداً', CARD: 'بطاقة', BANK_TRANSFER: 'تحويل بنكي', ONLINE: 'إلكتروني', OTHER: 'أخرى' };
  const CAT_LABELS = EXPENSE_CATEGORY_LABELS();

  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const revenueByMethod = {};
  for (const p of payments) {
    const m = p.method || 'CASH';
    revenueByMethod[m] = (revenueByMethod[m] || 0) + p.amount;
  }
  const expensesByCategory = EXPENSE_GROUPS(expenses);

  sendSuccess(res, {
    period: { start, end, isToday: !date && !endDate },
    totals: { revenue: totalRevenue, expenses: totalExpenses, net: totalRevenue - totalExpenses },
    payments: payments.map(p => ({
      id: p.id, amount: p.amount, method: p.method, methodLabel: METHOD_LABELS[p.method] || p.method,
      patient: p.invoice?.patient?.fullName || '—', invoiceNo: p.invoice?.invoiceNumber || '—',
      receivedBy: p.receivedBy?.fullName || '—', createdAt: p.createdAt,
    })),
    expenses: expenses.map(e => ({ id: e.id, amount: e.amount, category: e.category, description: e.description, paymentMethod: METHOD_LABELS[e.paymentMethod] || e.paymentMethod, branch: e.branch?.name || '—', date: e.date })),
    revenueByMethod: Object.entries(revenueByMethod).map(([method, amount]) => ({ method, label: METHOD_LABELS[method] || method, amount })),
    expensesByCategory,
    categories: CAT_LABELS,
  }, 'Daily P&L fetched');
});

// ─── expense category labels ──────────────────────────────
function EXPENSE_CATEGORY_LABELS() {
  return ['مستلزمات','رواتب','إيجار','فواتير وخدمات','تسويق','صيانة','أخرى'];
}

// ═══════════════════════════════════════════════════════════
// 10. INSTALLMENT RECEIVABLES  —  pending/overdue payments due
// ═══════════════════════════════════════════════════════════
const getInstallmentsReceivable = asyncHandler(async (req, res) => {
  const branchFilter = (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN')
    ? { invoice: { branchId: req.user.branchId } } : {};

  const installments = await prisma.installment.findMany({
    where: { status: 'PENDING', ...branchFilter },
    include: {
      invoice: { select: { id: true, invoiceNumber: true, total: true, paidAmount: true, dueAmount: true, patient: { select: { id: true, fullName: true, phone: true } } } },
    },
    orderBy: { dueDate: 'asc' },
  });

  const now = new Date();
  const overdue = [];
  const upcoming = [];
  for (const inst of installments) {
    const overdueFlag = new Date(inst.dueDate) < now;
    const item = {
      id: inst.id,
      amount: inst.amount,
      dueDate: inst.dueDate,
      daysRemaining: Math.ceil((new Date(inst.dueDate) - now) / (1000 * 60 * 60 * 24)),
      patient: inst.invoice?.patient?.fullName || '—',
      patientPhone: inst.invoice?.patient?.phone || '—',
      invoiceNumber: inst.invoice?.invoiceNumber || '—',
      invoiceTotal: inst.invoice?.total || 0,
    };
    if (overdueFlag) overdue.push(item); else upcoming.push(item);
  }

  const totalPending = installments.reduce((s, i) => s + i.amount, 0);
  const totalOverdue = overdue.reduce((s, i) => s + i.amount, 0);
  const totalUpcoming = upcoming.reduce((s, i) => s + i.amount, 0);

  sendSuccess(res, {
    totals: { pending: totalPending, overdue: totalOverdue, upcoming: totalUpcoming, count: installments.length },
    overdue,
    upcoming,
  }, 'Installment receivables fetched');
});

// ═══════════════════════════════════════════════════════════
// 11. COMBINED RECEIVABLES  —  customer AR + installments + commissions
// ═══════════════════════════════════════════════════════════
const getCombinedReceivables = asyncHandler(async (req, res) => {
  const branchFilter = (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN')
    ? { branchId: req.user.branchId } : {};

  const [ar, installments, commissions] = await Promise.all([
    // Customer AR (unpaid invoices)
    prisma.invoice.findMany({
      where: { dueAmount: { gt: 0 }, status: { in: ['PENDING', 'PARTIALLY_PAID'] }, ...branchFilter },
      select: { id: true, invoiceNumber: true, total: true, paidAmount: true, dueAmount: true, createdAt: true, patient: { select: { fullName: true, phone: true } } },
    }),
    // Installments
    prisma.installment.findMany({
      where: { status: 'PENDING', ...(req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' ? { invoice: { branchId: req.user.branchId } } : {}) },
      select: { id: true, amount: true, dueDate: true, status: true, invoice: { select: { invoiceNumber: true, patient: { select: { fullName: true } } } } },
    }),
    // Commissions
    prisma.commissionRecord.findMany({
      where: { status: 'pending', ...(req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' ? { user: { branchId: req.user.branchId } } : {}) },
      select: { id: true, amount: true, rate: true, amountBasis: true, createdAt: true, user: { select: { fullName: true } } },
    }),
  ]);

  const now = new Date();
  const customerTotal = ar.reduce((s, i) => s + i.dueAmount, 0);
  const installmentTotal = installments.reduce((s, i) => s + i.amount, 0);
  const commissionTotal = commissions.reduce((s, i) => s + i.amount, 0);

  sendSuccess(res, {
    totals: {
      customerAR: customerTotal,
      installments: installmentTotal,
      commissions: commissionTotal,
      grandTotal: customerTotal + installmentTotal + commissionTotal,
    },
    customerAR: ar.map(i => ({
      invoiceId: i.id, invoiceNumber: i.invoiceNumber, patient: i.patient.fullName, phone: i.patient.phone,
      total: i.total, paid: i.paidAmount, due: i.dueAmount, ageDays: Math.floor((now - new Date(i.createdAt)) / (1000 * 60 * 60 * 24)),
    })),
    installments: installments.map(i => ({
      id: i.id, amount: i.amount, dueDate: i.dueDate, overdue: new Date(i.dueDate) < now,
      patient: i.invoice?.patient?.fullName || '—', invoiceNumber: i.invoice?.invoiceNumber || '—',
    })),
    commissions: commissions.map(c => ({
      id: c.id, amount: c.amount, rate: c.rate, basis: c.amountBasis, doctor: c.user?.fullName || '—', createdAt: c.createdAt,
    })),
  }, 'Combined receivables fetched');
});

module.exports = {
  getMonthlyPnL, getYearlyPnL, getCashFlow, getTaxSummary,
  getARAging, getCommissionLiability, getRevenueBreakdown, getAccountingSummary, getDailyPnL,
  getInstallmentsReceivable, getCombinedReceivables,
};