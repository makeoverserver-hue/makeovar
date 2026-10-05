const fs = require('fs');
const path = require('path');
const prisma = require('./db');

const BACKUPS_DIR = process.env.BACKUPS_DIR
  ? path.resolve(process.env.BACKUPS_DIR)
  : path.resolve(__dirname, '..', '..', 'backups');
// resolve DB path from env (for persistent volume in production)
const DB_PATH = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:')
  ? path.resolve(process.env.DATABASE_URL.replace(/^file:/, ''))
  : path.resolve(__dirname, '..', '..', 'prisma', 'clinic.db');

function ensureBackupsDir() {
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  return BACKUPS_DIR;
}

async function createBackup() {
  ensureBackupsDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUPS_DIR, `clinic-${stamp}.db`);
  const abs = dest.replace(/\\/g, '/');
  if (fs.existsSync(dest)) fs.rmSync(dest);
  await prisma.$executeRawUnsafe(`VACUUM INTO '${abs.replace(/'/g, "''")}'`);
  const stat = fs.statSync(dest);
  return { name: path.basename(dest), path: dest, size: stat.size, createdAt: new Date() };
}

function listBackups() {
  ensureBackupsDir();
  return fs.readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith('.db') && !f.startsWith('restore_'))
    .map((f) => {
      const s = fs.statSync(path.join(BACKUPS_DIR, f));
      return { name: f, size: s.size, createdAt: s.mtime };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function backupInfo() {
  const dbStat = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH) : null;
  return {
    dbPath: DB_PATH,
    dbSize: dbStat ? dbStat.size : 0,
    lastModified: dbStat ? dbStat.mtime : null,
    backupsDir: BACKUPS_DIR,
  };
}

module.exports = { createBackup, listBackups, backupInfo, BACKUPS_DIR, DB_PATH };