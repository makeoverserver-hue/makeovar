const fs = require('fs');
const path = require('path');
const multer = require('multer');
const prisma = require('../utils/db');
const { sendSuccess } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { createBackup, listBackups, backupInfo, BACKUPS_DIR, DB_PATH } = require('../utils/backup');

const restoreUpload = multer({
  storage: multer.diskStorage({}),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.db' || file.mimetype === 'application/x-sqlite3' || file.mimetype === 'application/octet-stream' || file.mimetype === 'application/vnd.sqlite3') {
      cb(null, true);
    } else {
      cb(new AppError('يجب أن يكون ملف النسخة بصيغة .db', 400));
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 },
});

const backupNow = asyncHandler(async (req, res, next) => {
  try {
    const backup = await createBackup();
    sendSuccess(res, backup, 'تم إنشاء النسخة الاحتياطية');
  } catch (err) {
    return next(new AppError(err.message, 500));
  }
});

const getBackups = asyncHandler(async (req, res, next) => {
  sendSuccess(res, { backups: listBackups(), info: backupInfo() }, 'Backups listed');
});

const downloadBackup = asyncHandler(async (req, res, next) => {
  const { name } = req.params;
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return next(new AppError('Invalid backup name', 400));
  }
  const file = path.resolve(require('../utils/backup').BACKUPS_DIR, name);
  if (!fs.existsSync(file)) return next(new AppError('Backup not found', 404));
  res.download(file, name);
});

const restoreBackup = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new AppError('يرجى رفع ملف النسخة الاحتياطية', 400));
  if (!req.file.originalname.endsWith('.db')) {
    return next(new AppError('يجب أن يكون الملف بصيغة .db', 400));
  }

  const uploads = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.resolve(__dirname, '..', '..', '..', 'uploads');
  const restoreDir = path.join(uploads, 'backups');
  if (!fs.existsSync(restoreDir)) fs.mkdirSync(restoreDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(restoreDir, `restore_${stamp}.db`);
  fs.copyFileSync(req.file.path, dest);

  // Cross-platform restore: a portable Node script replaces the DB and restarts the app.
  // It must run detached so the current process can be replaced after responding.
  const spawn = require('child_process').spawn;
  const { BACKUPS_DIR } = require('../utils/backup');
  const scriptTarget = path.join(BACKUPS_DIR, `restore_run_${stamp}.js`);
  fs.mkdirSync(path.dirname(scriptTarget), { recursive: true });
  const src = dest;
  const target = DB_PATH;
  const appMain = require.main && require.main.filename;

  const jsContent = [
    'const fs = require("fs");',
    'const path = require("path");',
    `const src = ${JSON.stringify(src)};`,
    `const target = ${JSON.stringify(target)};`,
    `const appEntry = ${JSON.stringify(appMain)};`,
    'const port = process.env.PORT || 5000;',
    '',
    'setTimeout(() => {',
    '  try {',
    '    // attempt to close the active server if it exposes a handle',
    '  } catch (e) {}',
    '  if (process.platform === "win32") {',
    '    try { require("child_process").execSync(`netstat -ano | findstr :${port} | findstr LISTENING`); } catch (e) {}',
    '  }',
    '  fs.copyFileSync(src, target);',
    '  const child = require("child_process").spawn(process.execPath, [appEntry], {',
    '    detached: true, stdio: "ignore", env: process.env, shell: false',
    '  });',
    '  child.unref();',
    '  setTimeout(() => process.exit(0), 600);',
    '}, 800);',
  ].join('\n');
  fs.writeFileSync(scriptTarget, jsContent, 'utf8');

  const child = spawn(process.execPath, [scriptTarget], { detached: true, stdio: 'ignore', env: { ...process.env } });
  child.unref();

  sendSuccess(res, { restoreFile: path.basename(dest) }, 'تم رفع النسخة، سيتم الاستعادة وإعادة تشغيل الخادم خلال ثوانٍ');
});

module.exports = { backupNow, getBackups, downloadBackup, restoreBackup, restoreUpload };