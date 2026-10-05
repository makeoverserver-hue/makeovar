const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const AppError = require('../utils/AppError');

const uploadDir = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.resolve(__dirname, '..', '..', '..', 'uploads');
const photosDir = path.join(uploadDir, 'photos');
const consentDir = path.join(uploadDir, 'consent-forms');

[uploadDir, photosDir, consentDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = uploadDir;
    if (file.fieldname === 'photos' || file.fieldname === 'photo' || file.fieldname === 'beforeAfter') {
      dest = photosDir;
    } else if (file.fieldname === 'consent' || file.fieldname === 'form') {
      dest = consentDir;
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const hash = crypto.randomBytes(12).toString('hex');
    cb(null, `${Date.now()}-${hash}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp|pdf/;
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;
  if (allowedImageTypes.test(ext) && allowedImageTypes.test(mime)) {
    cb(null, true);
  } else {
    cb(new AppError('File type not allowed. Only images and PDFs are accepted.', 400));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_SIZE) || 10 * 1024 * 1024,
  },
});

module.exports = upload;
