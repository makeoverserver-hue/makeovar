const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { parseDateRange } = require('../utils/dateRange');

const getAuditLogs = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const skip = (page - 1) * limit;
  const { userId, action, entityType, startDate, endDate } = req.query;

  const where = {};
  if (userId) where.userId = userId;
  if (action) where.action = { contains: action };
  if (entityType) where.entityType = entityType;
  if (startDate && endDate) {
    const { start, end } = parseDateRange(startDate, endDate);
    where.createdAt = { gte: start, lte: end };
  }

  const total = await prisma.auditLog.count({ where });
  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: { select: { id: true, fullName: true, email: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });

  sendSuccess(res, logs, 'Audit logs fetched', 200, {
    page, limit, total, totalPages: Math.ceil(total / limit),
  });
});

const getNotifications = asyncHandler(async (req, res, next) => {
  const { isRead } = req.query;
  const where = { userId: req.user.id };
  if (isRead !== undefined) where.isRead = isRead === 'true';

  const notifications = await prisma.notifications.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const unreadCount = await prisma.notifications.count({
    where: { userId: req.user.id, isRead: false },
  });

  sendSuccess(res, { notifications, unreadCount }, 'Notifications fetched');
});

const markAsRead = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  await prisma.notifications.update({
    where: { id },
    data: { isRead: true },
  });
  sendSuccess(res, null, 'Notification marked as read');
});

const markAllRead = asyncHandler(async (req, res, next) => {
  await prisma.notifications.updateMany({
    where: { userId: req.user.id, isRead: false },
    data: { isRead: true },
  });
  sendSuccess(res, null, 'All notifications marked as read');
});

const createNotification = async (userId, title, message = null, type = 'system') => {
  return prisma.notifications.create({
    data: { userId, title, message, type },
  });
};

module.exports = { getAuditLogs, getNotifications, markAsRead, markAllRead, createNotification };
