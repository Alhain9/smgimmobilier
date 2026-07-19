const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads');

// Détermine le sous-dossier selon le type
const getFolder = (file) => {
  if (file.mimetype === 'application/pdf') return 'contracts';
  if (file.fieldname === 'proof') return 'payments';
  if (file.fieldname === 'photo' || file.mimetype.startsWith('image/')) return 'photos';
  return 'documents';
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = path.join(uploadDir, getFolder(file));
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp|pdf/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error('Format non autorisé. Images et PDF uniquement.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 },
});

const excelFilter = (req, file, cb) => {
  const allowed = /xlsx|xls/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  if (ext) return cb(null, true);
  cb(new Error('Format non autorisé. Fichiers Excel uniquement (.xlsx, .xls).'));
};

const uploadExcel = multer({
  storage,
  fileFilter: excelFilter,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 },
});

upload.uploadExcel = uploadExcel;

module.exports = upload;
