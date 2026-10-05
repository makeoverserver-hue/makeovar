const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createAuditLog } = require('../utils/audit');

const getInventory = asyncHandler(async (req, res, next) => {
  const { branchId, category, search, lowStock } = req.query;
  const where = {};
  if (category) where.category = category;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { sku: { contains: search } },
      { supplier: { contains: search } },
    ];
  }

  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  } else if (branchId) {
    where.branchId = branchId;
  }

  const items = await prisma.inventoryItem.findMany({
    where,
    include: {
      branch: { select: { id: true, name: true } },
      movements: { orderBy: { createdAt: 'desc' }, take: 10 },
      _count: { select: { movements: true } },
    },
    orderBy: { name: 'asc' },
  });

  const enriched = items.map((item) => {
    let expiryStatus = 'OK';
    if (item.expiryDate) {
      const expiry = new Date(item.expiryDate);
      const now = new Date();
      if (expiry < now) expiryStatus = 'EXPIRED';
      else if (expiry.getTime() - now.getTime() <= 30 * 86400000) expiryStatus = 'NEAR_EXPIRY';
    }
    return {
      ...item,
      isLowStock: item.quantity <= item.minQuantity,
      expiryStatus,
      stockValue: item.quantity * item.unitPrice,
    };
  });

  const result = lowStock === 'true' ? enriched.filter((item) => item.isLowStock) : enriched;

  sendSuccess(res, result, 'Inventory fetched');
});

const getStockStatus = asyncHandler(async (req, res, next) => {
  const { branchId } = req.query;
  const where = {};
  if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') {
    where.branchId = req.user.branchId;
  } else if (branchId) {
    where.branchId = branchId;
  }

  const items = await prisma.inventoryItem.findMany({ where });
  const now = new Date();
  let lowStock = 0, expired = 0, nearExpiry = 0, total = 0;
  for (const item of items) {
    total += 1;
    if (item.quantity <= item.minQuantity) lowStock += 1;
    if (item.expiryDate) {
      const expiry = new Date(item.expiryDate);
      if (expiry < now) expired += 1;
      else if (expiry.getTime() - now.getTime() <= 30 * 86400000) nearExpiry += 1;
    }
  }

  sendSuccess(res, {
    total,
    lowStock,
    expired,
    nearExpiry,
    healthy: total - lowStock - expired - nearExpiry > 0 ? total - lowStock - expired : 0,
  }, 'Stock status fetched');
});

const getInventoryItem = asyncHandler(async (req, res, next) => {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: req.params.id },
    include: { movements: { orderBy: { createdAt: 'desc' } } },
  });
  if (!item) return next(new AppError('Inventory item not found', 404));
  sendSuccess(res, item, 'Inventory item fetched');
});

const createInventoryItem = asyncHandler(async (req, res, next) => {
  const { name, category, sku, quantity = 0, minQuantity = 0, unitPrice = 0, purchasePrice = 0, supplier, expiryDate, branchId, notes } = req.body;
  if (!name) return next(new AppError('Name is required', 400));

  const item = await prisma.inventoryItem.create({
    data: {
      name, category, sku,
      quantity: parseInt(quantity),
      minQuantity: parseInt(minQuantity),
      unitPrice: parseFloat(unitPrice),
      purchasePrice: parseFloat(purchasePrice),
      supplier,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      branchId: branchId || req.user.branchId,
      notes,
    },
  });

  if (parseInt(quantity) > 0) {
    await prisma.inventoryMovement.create({
      data: {
        itemId: item.id,
        type: 'in',
        quantity: parseInt(quantity),
        reason: 'initial stock',
        performedById: req.user.id,
      },
    });
  }

  await createAuditLog({
    userId: req.user.id, action: 'CREATE_INVENTORY_ITEM', entityType: 'INVENTORY', entityId: item.id,
  });

  sendSuccess(res, item, 'Inventory item created', 201);
});

const updateInventoryItem = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const ALLOWED = ['name', 'category', 'sku', 'quantity', 'minQuantity', 'unitPrice', 'purchasePrice', 'supplier', 'expiryDate', 'notes', 'isActive'];
  const updates = {};
  for (const key of ALLOWED) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (updates.expiryDate) updates.expiryDate = new Date(updates.expiryDate);
  if (updates.quantity !== undefined) updates.quantity = parseInt(updates.quantity);
  if (updates.minQuantity !== undefined) updates.minQuantity = parseInt(updates.minQuantity);
  if (updates.unitPrice !== undefined) updates.unitPrice = parseFloat(updates.unitPrice);

  const item = await prisma.inventoryItem.update({ where: { id }, data: updates });
  await createAuditLog({
    userId: req.user.id, action: 'UPDATE_INVENTORY_ITEM', entityType: 'INVENTORY', entityId: id,
  });
  sendSuccess(res, item, 'Inventory item updated');
});

const adjustStock = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { quantity, reason, type = 'adjustment' } = req.body;
  if (!quantity) return next(new AppError('Quantity is required', 400));

  const current = await prisma.inventoryItem.findUnique({ where: { id } });
  if (!current) return next(new AppError('Item not found', 404));

  const change = parseInt(quantity);
  const newQuantity = current.quantity + change;
  if (newQuantity < 0) return next(new AppError('Cannot reduce below zero', 400));

  const updated = await prisma.inventoryItem.update({
    where: { id },
    data: { quantity: newQuantity },
  });

  await prisma.inventoryMovement.create({
    data: {
      itemId: id,
      type: change >= 0 ? 'in' : 'out',
      quantity: Math.abs(change),
      reason: reason || type,
      referenceType: 'adjustment',
      performedById: req.user.id,
    },
  });

  await createAuditLog({
    userId: req.user.id, action: 'ADJUST_STOCK', entityType: 'INVENTORY', entityId: id, details: { change, reason },
  });

  sendSuccess(res, updated, 'Stock adjusted');
});

const getMovements = asyncHandler(async (req, res, next) => {
  const { itemId, type } = req.query;
  const where = {};
  if (itemId) where.itemId = itemId;
  if (type) where.type = type;

  const movements = await prisma.inventoryMovement.findMany({
    where,
    include: {
      item: { select: { id: true, name: true, sku: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  sendSuccess(res, movements, 'Movements fetched');
});

const deleteInventoryItem = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  await prisma.inventoryMovement.deleteMany({ where: { itemId: id } });
  await prisma.inventoryItem.delete({ where: { id } });
  await createAuditLog({
    userId: req.user.id, action: 'DELETE_INVENTORY_ITEM', entityType: 'INVENTORY', entityId: id,
  });
  sendSuccess(res, null, 'Inventory item deleted');
});

module.exports = { getInventory, getInventoryItem, createInventoryItem, updateInventoryItem, adjustStock, getMovements, getStockStatus, deleteInventoryItem };
