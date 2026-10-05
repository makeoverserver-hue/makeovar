const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');
const { parseDateRange } = require('../utils/dateRange');

const getInvoices = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const { status, patientId, branchId, startDate, endDate, search, invoiceNumber } = req.query;

  const where = {};
  if (status) where.status = status;
  if (patientId) where.patientId = patientId;
  if (invoiceNumber) where.invoiceNumber = { contains: invoiceNumber };
  if (startDate && endDate) {
    const { start, end } = parseDateRange(startDate, endDate);
    where.createdAt = { gte: start, lte: end };
  }

  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  } else if (branchId) {
    where.branchId = branchId;
  }

  if (search) {
    where.patient = { fullName: { contains: search } };
  }

  const total = await prisma.invoice.count({ where });
  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      patient: { select: { id: true, fullName: true, phone: true } },
      branch: { select: { id: true, name: true } },
      items: true,
      payments: true,
      _count: { select: { payments: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });

  sendSuccess(res, invoices, 'Invoices fetched', 200, {
    page, limit, total, totalPages: Math.ceil(total / limit),
  });
});

const getInvoice = asyncHandler(async (req, res, next) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      patient: true,
      branch: true,
      doctor: { select: { id: true, fullName: true } },
      items: { include: { service: true } },
      payments: { include: { receivedBy: { select: { id: true, fullName: true } } } },
      packageSales: true,
    },
  });
  if (!invoice) return next(new AppError('Invoice not found', 404));
  sendSuccess(res, invoice, 'Invoice fetched');
});

const createInvoice = asyncHandler(async (req, res, next) => {
  const { patientId, items, discount = 0, taxRate = 0, notes, appointmentId, doctorId, branchId } = req.body;
  if (!patientId || !items || !items.length) {
    return next(new AppError('Patient and invoice items are required', 400));
  }

  let subtotal = 0;
  const processedItems = items.map((item) => {
    let unitPrice = parseFloat(item.unitPrice || 0);
    if (item.serviceId && (!unitPrice || unitPrice <= 0)) {
      // we'll resolve service prices below
    }
    const total = unitPrice * (item.quantity || 1);
    subtotal += total;
    return {
      serviceId: item.serviceId || null,
      description: item.description || 'خدمة',
      quantity: item.quantity || 1,
      unitPrice,
      total,
    };
  });

  // Resolve missing service prices
  for (const item of processedItems) {
    if (item.serviceId && (!item.unitPrice || item.unitPrice <= 0)) {
      const service = await prisma.service.findUnique({ where: { id: item.serviceId } });
      if (service) {
        item.unitPrice = service.price;
        item.total = service.price * item.quantity;
        subtotal = processedItems.reduce((s, i) => s + (i === item ? item.total : i.total), 0);
      }
    }
  }

  const tax = subtotal * (parseFloat(taxRate) / 100);
  const total = subtotal - parseFloat(discount) + tax;

  const count = await prisma.invoice.count();
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      patientId,
      branchId: branchId || req.user.branchId,
      doctorId: doctorId || null,
      appointmentId: appointmentId || null,
      subtotal,
      discount: parseFloat(discount),
      tax,
      taxRate: parseFloat(taxRate),
      total,
      paidAmount: 0,
      dueAmount: total,
      status: 'PENDING',
      notes,
      createdById: req.user.id,
      items: { create: processedItems },
    },
    include: { items: true, payments: true },
  });

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_INVOICE', entityType: 'INVOICE', entityId: invoice.id, details: { invoiceNumber, total },
  });

  sendSuccess(res, invoice, 'Invoice created successfully', 201);
});

const recordPayment = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { amount, method = 'CASH', reference, notes } = req.body;
  if (!amount || parseFloat(amount) <= 0) return next(new AppError('Valid amount is required', 400));

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { payments: true },
  });
  if (!invoice) return next(new AppError('Invoice not found', 404));
  if (invoice.status === 'CANCELLED') return next(new AppError('Cannot pay a cancelled invoice', 400));

  const paymentAmount = parseFloat(amount);
  const newPaid = invoice.paidAmount + paymentAmount;
  if (newPaid > invoice.total) {
    return next(new AppError('Payment amount exceeds invoice total', 400));
  }

  const payment = await prisma.payment.create({
    data: {
      invoiceId: id,
      patientId: invoice.patientId,
      amount: paymentAmount,
      method,
      reference,
      receivedById: req.user.id,
      notes,
    },
  });

  const status = newPaid >= invoice.total ? 'PAID' : newPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING';
  const updatedInvoice = await prisma.invoice.update({
    where: { id },
    data: {
      paidAmount: newPaid,
      dueAmount: invoice.total - newPaid,
      status,
    },
  });

  await createAuditLog({
    userId: req.user.id, action: 'RECORD_PAYMENT', entityType: 'INVOICE', entityId: id, details: { amount: paymentAmount, method },
  });

  sendSuccess(res, { payment, invoice: updatedInvoice }, 'Payment recorded successfully', 201);
});

const updateInvoiceStatus = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['DRAFT', 'PENDING', 'PAID', 'PARTIALLY_PAID', 'CANCELLED', 'REFUNDED'].includes(status)) {
    return next(new AppError('Invalid status', 400));
  }

  const invoice = await prisma.invoice.update({ where: { id }, data: { status } });
  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_INVOICE_STATUS', entityType: 'INVOICE', entityId: id, details: { status },
  });
  sendSuccess(res, invoice, 'Invoice status updated');
});

const getInstallments = asyncHandler(async (req, res, next) => {
  const installments = await prisma.installment.findMany({
    where: { invoiceId: req.params.id },
    orderBy: { dueDate: 'asc' },
  });
  sendSuccess(res, installments, 'Installments fetched');
});

const createInstallmentPlan = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { installments } = req.body;
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return next(new AppError('Invoice not found', 404));
  if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
    return next(new AppError('لا يمكن إنشاء أقساط لفاتورة مدفوعة أو ملغاة', 400));
  }

  const existing = await prisma.installment.count({ where: { invoiceId: id } });
  if (existing > 0) return next(new AppError('توجد خطة أقساط لهذه الفاتورة بالفعل', 400));

  let plan;
  if (Array.isArray(installments) && installments.length) {
    plan = installments.map((ins) => ({
      invoiceId: id,
      amount: Number(ins.amount),
      dueDate: new Date(ins.dueDate),
      notes: ins.notes,
    }));
  } else {
    return next(new AppError('يرجى توفير جدول الأقساط', 400));
  }
  const planTotal = plan.reduce((s, p) => s + p.amount, 0);
  if (Math.round(planTotal) > Math.round(invoice.dueAmount) + 1) {
    return next(new AppError('مجموع الأقساط يتجاوز المبلغ المتبقي', 400));
  }

  const created = await prisma.installment.createMany({ data: plan });
  sendSuccess(res, { count: created.count, installments: plan }, 'تم إنشاء خطة الأقساط', 201);
});

const payInstallment = asyncHandler(async (req, res, next) => {
  const { id, iid } = req.params;
  const { method = 'CASH', reference, notes } = req.body;
  const installment = await prisma.installment.findUnique({ where: { id: iid } });
  if (!installment || installment.invoiceId !== id) return next(new AppError('القسط غير موجود', 404));
  if (installment.status === 'PAID') return next(new AppError('هذا القسط مدفوع بالفعل', 400));

  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { payments: true } });
  if (!invoice) return next(new AppError('Invoice not found', 404));
  const newPaid = invoice.paidAmount + installment.amount;
  if (newPaid > invoice.total) {
    return next(new AppError('دفع هذا القسط سيتجاوز إجمالي الفاتورة', 400));
  }

  await prisma.installment.update({
    where: { id: iid },
    data: { status: 'PAID', paidAt: new Date(), paidById: req.user.id },
  });
  const notesRef = installment.id.slice(-4);
  await prisma.payment.create({
    data: {
      invoiceId: id,
      patientId: invoice.patientId,
      amount: installment.amount,
      method,
      reference,
      receivedById: req.user.id,
      notes: notes || `سداد قسط #${notesRef}`,
    },
  });
  const status = newPaid >= invoice.total ? 'PAID' : 'PARTIALLY_PAID';
  await prisma.invoice.update({ where: { id }, data: { paidAmount: newPaid, dueAmount: invoice.total - newPaid, status } });

  await createAuditLog({
    userId: req.user.id, action: 'PAY_INSTALLMENT', entityType: 'INVOICE', entityId: id, details: { installmentId: iid, amount: installment.amount },
  });
  const updated = await prisma.installment.findUnique({ where: { id: iid } });
  const invoiceAfter = await prisma.invoice.findUnique({ where: { id } });
  sendSuccess(res, { installment: updated, invoice: invoiceAfter }, 'تم سداد القسط', 200);
});

const deleteInvoice = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const items = await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
  const payments = await prisma.payment.deleteMany({ where: { invoiceId: id } });
  await prisma.packageSale.deleteMany({ where: { invoiceId: id } });
  await prisma.invoice.delete({ where: { id } });
  await createAuditLog({
    userId: req.user.id, action: 'DELETE_INVOICE', entityType: 'INVOICE', entityId: id, details: { items, payments },
  });
  sendSuccess(res, null, 'Invoice deleted');
});

const getInvoiceStats = asyncHandler(async (req, res, next) => {
  const { period = '30_days' } = req.query;
  const now = new Date();
  let startDate;
  if (period === '7_days') startDate = new Date(now.setDate(now.getDate() - 7));
  else if (period === 'today') startDate = new Date(now.setHours(0, 0, 0, 0));
  else if (period === 'year') startDate = new Date(now.setFullYear(now.getFullYear() - 1));
  else startDate = new Date(now.setDate(now.getDate() - 30));

  const where = { createdAt: { gte: startDate } };
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  }

  const totalRaw = await prisma.invoice.aggregate({
    where,
    _sum: { total: true, paidAmount: true, discount: true },
    _count: true,
  });

  const paidRaw = await prisma.payment.aggregate({
    where: { createdAt: { gte: startDate } },
    _sum: { amount: true },
    _count: true,
  });

  sendSuccess(res, {
    totalRevenue: paidRaw._sum.amount || 0,
    totalBilled: totalRaw._sum.total || 0,
    totalPaid: totalRaw._sum.paidAmount || 0,
    totalDiscount: totalRaw._sum.discount || 0,
    invoiceCount: totalRaw._count,
    paymentCount: paidRaw._count,
  }, 'Invoice stats fetched');
});

module.exports = { getInvoices, getInvoice, createInvoice, recordPayment, updateInvoiceStatus, deleteInvoice, getInvoiceStats, getInstallments, createInstallmentPlan, payInstallment };
