const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');
const { parseDateRange, toLocalStart } = require('../utils/dateRange');

const EXPENSE_CATEGORIES = ['مستلزمات', 'رواتب', 'إيجار', 'فواتير وخدمات', 'تسويق', 'صيانة', 'أخرى'];

const getExpenses = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const { category, startDate, endDate, search } = req.query;

  const where = {};
  if (category) where.category = category;
  if (startDate && endDate) {
    const { start, end } = parseDateRange(startDate, endDate);
    where.date = { gte: start, lte: end };
  }
  if (search) {
    where.OR = [
      { description: { contains: search } },
      { category: { contains: search } },
    ];
  }
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  }

  const total = await prisma.expense.count({ where });
  const expenses = await prisma.expense.findMany({
    where,
    include: { branch: { select: { id: true, name: true } } },
    orderBy: { date: 'desc' },
    skip,
    take: limit,
  });
  sendSuccess(res, expenses, 'Expenses fetched', 200, {
    page, limit, total, totalPages: Math.ceil(total / limit), categories: EXPENSE_CATEGORIES,
  });
});

const getExpense = asyncHandler(async (req, res, next) => {
  const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!expense) return next(new AppError('Expense not found', 404));
  sendSuccess(res, expense, 'Expense fetched');
});

const createExpense = asyncHandler(async (req, res, next) => {
  const { category, amount, date, paymentMethod, description, branchId } = req.body;
  if (!amount || Number(amount) <= 0) return next(new AppError('المبلغ مطلوب ويجب أن يكون أكبر من صفر', 400));

  const expense = await prisma.expense.create({
    data: {
      category: category || 'مستلزمات',
      amount: Number(amount),
      date: date ? new Date(date) : new Date(),
      paymentMethod: paymentMethod || 'CASH',
      description,
      createdById: req.user.id,
      branchId: branchId || req.user.branchId || (await prisma.branch.findFirst({ select: { id: true } }))?.id,
    },
  });

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_EXPENSE', entityType: 'EXPENSE', entityId: expense.id, details: { amount },
  });
  sendSuccess(res, expense, 'تم تسجيل المصروف', 201);
});

const updateExpense = asyncHandler(async (req, res, next) => {
  const ALLOWED = ['category', 'amount', 'date', 'paymentMethod', 'description', 'branchId'];
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.amount !== undefined) updates.amount = Number(updates.amount);
  if (updates.date) updates.date = new Date(updates.date);

  const expense = await prisma.expense.update({ where: { id: req.params.id }, data: updates });
  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_EXPENSE', entityType: 'EXPENSE', entityId: req.params.id,
  });
  sendSuccess(res, expense, 'تم تحديث المصروف');
});

const deleteExpense = asyncHandler(async (req, res, next) => {
  await prisma.expense.delete({ where: { id: req.params.id } });
  await createAuditLog({
    userId: req.user.id, action: 'DELETE_EXPENSE', entityType: 'EXPENSE', entityId: req.params.id,
  });
  sendSuccess(res, null, 'تم حذف المصروف');
});

const getExpenseStats = asyncHandler(async (req, res, next) => {
  const { period = 'month' } = req.query;
  const now = new Date();
  let start;
  if (period === 'today') start = toLocalStart(new Date());
  else if (period === 'year') start = new Date(now.getFullYear(), 0, 1);
  else start = new Date(now.getFullYear(), now.getMonth(), 1);

  const branchScope = req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' ? { branchId: req.user.branchId } : {};

  const expenseAgg = await prisma.expense.aggregate({
    where: { date: { gte: start }, ...branchScope },
    _sum: { amount: true },
    _count: true,
  });
  const revenueAgg = await prisma.payment.aggregate({
    where: { createdAt: { gte: start }, ...branchScope },
    _sum: { amount: true },
    _count: true,
  });

  const byCategory = await prisma.expense.groupBy({
    by: ['category'],
    where: { date: { gte: start }, ...branchScope },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
  });

  const totalExpenses = expenseAgg._sum.amount || 0;
  const totalRevenue = revenueAgg._sum.amount || 0;
  const net = totalRevenue - totalExpenses;

  sendSuccess(res, {
    period,
    totalExpenses,
    totalRevenue,
    net,
    hasLoss: net < 0,
    expensesCount: expenseAgg._count,
    byCategory: byCategory.map((c) => ({ category: c.category, amount: c._sum.amount || 0 })),
  }, 'Expense stats fetched');
});

module.exports = { getExpenses, getExpense, createExpense, updateExpense, deleteExpense, getExpenseStats, EXPENSE_CATEGORIES };