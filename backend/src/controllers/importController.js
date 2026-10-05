const prisma = require('../utils/db');
const multer = require('multer');
const XLSX = require('xlsx');
const { createAuditLog } = require('../utils/audit');
const AppError = require('../utils/AppError');

// Accept .xlsx / .xls / .csv via memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    const allowed = ['xlsx', 'xls', 'csv'];
    if (allowed.includes(ext)) cb(null, true);
    else cb(new AppError('من فضلك ارفع ملف Excel فقط (xlsx/xls/csv)', 400));
  },
});

function workbookFromBuffer(buffer) {
  return XLSX.read(buffer, { type: 'buffer' });
}

function dateFromExcel(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? new Date(d.y, d.m - 1, d.d) : null;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T12:00:00');
  const t = new Date(s);
  return isNaN(t.getTime()) ? null : t;
}

function num(v, dflt = 0) {
  if (v === null || v === undefined || v === '') return dflt;
  const n = parseFloat(String(v).replace(/,/g, '').trim());
  return isNaN(n) ? dflt : n;
}

function str(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function bool(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  return ['true', '1', 'نعم', 'صح', 'yes', 'y'].includes(s);
}

function toJsonRows(rows) {
  // normalize keys (remove spaces, RTL marks)
  return rows.map((r) => {
    const out = {};
    for (const k of Object.keys(r)) {
      const key = k.replace(/\u200f|\u200e/g, '').replace(/\s+/g, ' ').trim();
      out[key] = r[k];
    }
    return out;
  });
}

// ───────────────────────── EXPORT helpers (xlsx) ─────────────────────────
function workbookToBuffer(aoa, sheetName) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  ws['!cols'] = aoa[0].map(() => ({ wch: 18 }));
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function sendXlsx(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

// ───────────────────────── TEMPLATES ─────────────────────────
const getTemplate = (req, res) => {
  const type = req.params.type;
  let aoa;
  let filename;

  if (type === 'services') {
    aoa = [['name', 'price', 'cost', 'category', 'durationMin', 'sessionsCount', 'requiresConsent', 'requiresMedicalAssessment', 'room'],
           ['مثال: تنظيف البشرة', '150', '50', 'تنظيف', '30', '1', 'نعم', 'لا', 'غرفة 1']];
    filename = 'services-import-template.xlsx';
  } else if (type === 'patients') {
    aoa = [['fullName', 'phone', 'email', 'gender', 'dateOfBirth', 'address', 'notes'],
           ['مثال: أحمد محمد', '05xxxxxxxx', '', 'MALE', '1990-01-01', 'الرياض', 'ملاحظة اختيارية']];
    filename = 'patients-import-template.xlsx';
  } else if (type === 'inventory') {
    aoa = [['name', 'category', 'sku', 'quantity', 'minQuantity', 'unitPrice', 'purchasePrice', 'supplier', 'expiryDate', 'notes'],
           ['مثال: كريم مرطب', 'مستحضرات', 'SKU-001', '10', '2', '50', '30', 'مورد 1', '2026-12-31', '']];
    filename = 'inventory-import-template.xlsx';
  } else {
    throw new AppError('نوع القالب غير مدعوم', 400);
  }

  sendXlsx(res, workbookToBuffer(aoa, 'Template'), filename);
};

// ───────────────────────── IMPORT: Services ─────────────────────────
const importServices = async (req, res) => {
  if (!req.file) throw new AppError('يرجى رفع ملف Excel', 400);
  const wb = workbookFromBuffer(req.file.buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const rows = toJsonRows(rawRows);
  if (rows.length === 0) throw new AppError('الملف فارغ — لا توجد بيانات', 400);

  const branchId = req.user.branchId || (await prisma.branch.findFirst({ select: { id: true } }))?.id;
  const results = { total: rows.length, created: 0, skipped: 0, errors: [] };
  const existing = new Set((await prisma.service.findMany({ select: { name: true } })).map(s => s.name.toLowerCase()));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = str(r.name);
    const rowNo = i + 2; // header is row 1
    if (!name) { results.errors.push(`سطر ${rowNo}: اسم الخدمة مطلوب`); results.skipped++; continue; }
    const lname = name.toLowerCase();
    if (existing.has(lname)) { results.errors.push(`سطر ${rowNo}: الخدمة "${name}" موجودة بالفعل`); results.skipped++; continue; }
    try {
      await prisma.service.create({
        data: {
          name,
          price: num(r.price),
          cost: num(r.cost),
          category: str(r.category) || null,
          durationMin: num(r.durationMin, 30),
          sessionsCount: num(r.sessionsCount, 1),
          requiresConsent: bool(r.requiresConsent),
          requiresMedicalAssessment: bool(r.requiresMedicalAssessment),
          room: str(r.room) || null,
          branchId: branchId || null,
        },
      });
      existing.add(lname);
      results.created++;
    } catch (e) { results.errors.push(`سطر ${rowNo}: فشل الإدراج — ${e.message}`); results.skipped++; }
  }
  await createAuditLog({ userId: req.user.id, action: 'IMPORT_SERVICES', entityType: 'SERVICE', details: JSON.stringify(results) });
  res.json({ success: true, message: `تم استيراد ${results.created} خدمة`, data: results });
};

// ───────────────────────── IMPORT: Patients ─────────────────────────
const importPatients = async (req, res) => {
  if (!req.file) throw new AppError('يرجى رفع ملف Excel', 400);
  const wb = workbookFromBuffer(req.file.buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const rows = toJsonRows(rawRows);
  if (rows.length === 0) throw new AppError('الملف فارغ — لا توجد بيانات', 400);

  const results = { total: rows.length, created: 0, skipped: 0, errors: [] };
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const fullName = str(r.fullName);
    const rowNo = i + 2;
    if (!fullName) { results.errors.push(`سطر ${rowNo}: الاسم مطلوب`); results.skipped++; continue; }
    try {
      await prisma.patient.create({
        data: {
          fullName,
          phone: str(r.phone) || null,
          email: str(r.email) || null,
          gender: str(r.gender) || null,
          dateOfBirth: r.dateOfBirth ? dateFromExcel(r.dateOfBirth) : null,
          address: str(r.address) || null,
          notes: str(r.notes) || null,
          branchId: req.user.branchId || (await prisma.branch.findFirst({ select: { id: true } }))?.id,
          createdById: req.user.id,
        },
      });
      results.created++;
    } catch (e) { results.errors.push(`سطر ${rowNo}: فشل الإدراج — ${e.message}`); results.skipped++; }
  }
  await createAuditLog({ userId: req.user.id, action: 'IMPORT_PATIENTS', entityType: 'PATIENT', details: JSON.stringify(results) });
  res.json({ success: true, message: `تم استيراد ${results.created} مريض`, data: results });
};

// ───────────────────────── IMPORT: Inventory ─────────────────────────
const importInventory = async (req, res) => {
  if (!req.file) throw new AppError('يرجى رفع ملف Excel', 400);
  const wb = workbookFromBuffer(req.file.buffer);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const rows = toJsonRows(rawRows);
  if (rows.length === 0) throw new AppError('الملف فارغ — لا توجد بيانات', 400);

  const branchId = req.user.branchId || (await prisma.branch.findFirst({ select: { id: true } }))?.id;
  const results = { total: rows.length, created: 0, skipped: 0, errors: [] };
  const existing = new Set((await prisma.inventoryItem.findMany({ select: { name: true } })).map(s => s.name.toLowerCase()));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = str(r.name);
    const rowNo = i + 2;
    if (!name) { results.errors.push(`سطر ${rowNo}: اسم المنتج مطلوب`); results.skipped++; continue; }
    const lname = name.toLowerCase();
    if (existing.has(lname)) { results.errors.push(`سطر ${rowNo}: المنتج "${name}" موجود بالفعل`); results.skipped++; continue; }
    try {
      await prisma.inventoryItem.create({
        data: {
          name,
          category: str(r.category) || null,
          sku: str(r.sku) || null,
          quantity: num(r.quantity, 0),
          minQuantity: num(r.minQuantity, 0),
          unitPrice: num(r.unitPrice),
          purchasePrice: num(r.purchasePrice),
          supplier: str(r.supplier) || null,
          expiryDate: r.expiryDate ? dateFromExcel(r.expiryDate) : null,
          notes: str(r.notes) || null,
          branchId,
        },
      });
      existing.add(lname);
      results.created++;
    } catch (e) { results.errors.push(`سطر ${rowNo}: فشل الإدراج — ${e.message}`); results.skipped++; }
  }
  await createAuditLog({ userId: req.user.id, action: 'IMPORT_INVENTORY', entityType: 'INVENTORY', details: JSON.stringify(results) });
  res.json({ success: true, message: `تم استيراد ${results.created} منتج`, data: results });
};

module.exports = {
  upload,
  getTemplate,
  importServices,
  importPatients,
  importInventory,
};