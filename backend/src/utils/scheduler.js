const prisma = require('./db');
const { createBackup } = require('./backup');

const CHECK_INTERVAL = 60 * 1000;
const notified = new Map();
let timer = null;

function markNotified(key, hours = 8) {
  notified.set(key, Date.now());
  if (notified.size > 2000) {
    for (const [k, t] of notified) {
      if (Date.now() - t > 24 * 3600 * 1000) notified.delete(k);
    }
  }
}
function isNotified(key, hours = 8) {
  const t = notified.get(key);
  return t && Date.now() - t < hours * 3600 * 1000;
}

async function getSetting(key, fallback) {
  try {
    const s = await prisma.setting.findUnique({ where: { key } });
    if (!s) return fallback;
    return s.value === 'true' ? true : s.value === 'false' ? false : s.value;
  } catch (e) {
    return fallback;
  }
}

async function notifyUsers(userIds, title, message, type) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return;
  for (const userId of unique) {
    await prisma.notifications.create({ data: { userId, title, message, type } });
  }
}

async function targetUsers(roles) {
  const users = await prisma.user.findMany({
    where: { isActive: true, status: 'ACTIVE', role: { in: roles } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

async function checkAppointmentReminders() {
  const enabled = await getSetting('appointment_reminder', true);
  if (!enabled) return;
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 3600 * 1000);
  const upcoming = await prisma.appointment.findMany({
    where: {
      reminderSent: false,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      startTime: { gte: now, lte: horizon },
    },
    include: {
      patient: { select: { fullName: true } },
      branch: { select: { name: true } },
    },
    take: 50,
  });
  if (!upcoming.length) return;
  const staff = await targetUsers(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']);
  for (const ap of upcoming) {
    if (isNotified('appt:' + ap.id)) continue;
    const when = new Date(ap.startTime).toLocaleString('ar-EG');
    await notifyUsers(staff, 'موعد قادم', `للمريض ${ap.patient.fullName} في ${ap.branch.name} — ${when}`, 'APPOINTMENT');
    await prisma.appointment.update({ where: { id: ap.id }, data: { reminderSent: true } });
    markNotified('appt:' + ap.id);
  }
}

async function checkFollowUps() {
  const now = new Date();
  const due = await prisma.followUp.findMany({
    where: { status: 'PENDING', date: { lte: new Date(now.getTime() + 2 * 3600 * 1000) } },
    include: {
      patient: { select: { fullName: true } },
      assignedTo: { select: { id: true } },
    },
    take: 50,
  });
  if (!due.length) return;
  const staff = await targetUsers(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']);
  for (const fu of due) {
    if (isNotified('followup:' + fu.id)) continue;
    const targets = [fu.assignedToId, ...staff];
    await notifyUsers(targets, 'متابعة مطلوبة', `متابعة مستحقة للمريض ${fu.patient.fullName} (${fu.type})`, 'FOLLOW_UP');
    markNotified('followup:' + fu.id);
  }
}

async function checkLowStock() {
  const enabled = await getSetting('inventory_low_stock_alert', true);
  if (!enabled) return;
  const lowItems = await prisma.inventoryItem.findMany({
    where: {},
    select: { id: true, name: true, quantity: true, minQuantity: true },
    take: 500,
  });
  const lowList = lowItems.filter((i) => i.minQuantity > 0 && i.quantity <= i.minQuantity);
  if (!lowList.length) return;
  const staff = await targetUsers(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']);
  for (const it of lowList) {
    if (isNotified('stock:' + it.id)) continue;
    await notifyUsers(staff, 'مخزون منخفض', `مخزون "${it.name}" وصل ${it.quantity} (الحد الأدنى ${it.minQuantity})`, 'INVENTORY');
    markNotified('stock:' + it.id);
  }
}

async function checkDeviceMaintenance() {
  const days = parseInt(await getSetting('device_maintenance_alert_days', 7)) || 7;
  const now = new Date();
  const horizon = new Date(now.getTime() + days * 24 * 3600 * 1000);
  const devices = await prisma.device.findMany({
    where: { nextMaintenanceDate: { gte: now, lte: horizon } },
    select: { id: true, name: true, nextMaintenanceDate: true },
  });
  if (!devices.length) return;
  const staff = await targetUsers(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST', 'DOCTOR', 'NURSE']);
  for (const d of devices) {
    if (isNotified('device:' + d.id)) continue;
    await notifyUsers(staff, 'صيانة جهاز', `جهاز "${d.name}" موعد صيانته قريب (${new Date(d.nextMaintenanceDate).toLocaleDateString('ar-EG')})`, 'DEVICE');
    markNotified('device:' + d.id);
  }
}

async function checkPackageExpiry() {
  const now = new Date();
  const horizon = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  const sales = await prisma.packageSale.findMany({
    where: { status: 'active', expiresAt: { gte: now, lte: horizon } },
    include: {
      patient: { select: { fullName: true } },
      package: { select: { name: true } },
    },
  });
  if (!sales.length) return;
  const staff = await targetUsers(['SUPER_ADMIN', 'ADMIN', 'RECEPTIONIST']);
  for (const s of sales) {
    if (isNotified('pkg:' + s.id)) continue;
    await notifyUsers(staff, 'باقة على وشك الانتهاء', `باقة "${s.package.name}" للمريض ${s.patient.fullName} تنتهي في ${new Date(s.expiresAt).toLocaleDateString('ar-EG')}`, 'PACKAGE');
    markNotified('pkg:' + s.id);
  }
}

let lastBackupDay = null;
async function runDailyBackup() {
  const d = new Date();
  if (d.getHours() === 3 && d.getMinutes() >= 30 && d.getMinutes() < 40) {
    const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (lastBackupDay !== dayKey) {
      lastBackupDay = dayKey;
      try {
        await createBackup();
        console.log('[scheduler] daily backup created at', d.toISOString());
      } catch (err) {
        console.error('[scheduler] daily backup failed:', err.message);
      }
    }
  }
}

async function runChecks() {
  try {
    await Promise.allSettled([
      checkAppointmentReminders(),
      checkFollowUps(),
      checkLowStock(),
      checkDeviceMaintenance(),
      checkPackageExpiry(),
      runDailyBackup(),
    ]);
  } catch (err) {
    console.error('[scheduler] error:', err.message);
  }
}

function startScheduler() {
  if (timer) return;
  timer = setInterval(runChecks, CHECK_INTERVAL);
  setTimeout(runChecks, 5000);
  console.log('[scheduler] started');
}

function stopScheduler() {
  if (timer) { clearInterval(timer); timer = null; }
}

module.exports = { startScheduler, stopScheduler };