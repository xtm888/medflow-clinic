const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Create upload directories if they don't exist
const uploadDirs = {
  patients: 'uploads/patients',
  documents: 'uploads/documents',
  lab: 'uploads/lab',
  imaging: 'uploads/imaging',
  prescriptions: 'uploads/prescriptions',
  temp: 'uploads/temp',
  opticalTryons: 'uploads/optical-tryons'
};

// Ensure all directories exist
Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure storage for different file types
const createStorage = (category) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = uploadDirs[category] || uploadDirs.temp;
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename
      const uniqueSuffix = crypto.randomBytes(6).toString('hex');
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const basename = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 30);

      cb(null, `${basename}_${timestamp}_${uniqueSuffix}${ext}`);
    }
  });
};

// File filter for different upload types
const fileFilters = {
  images: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp, svg)'));
    }
  },

  documents: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|xls|xlsx|txt|rtf|odt|ods/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/rtf',
      'application/vnd.oasis.opendocument.text',
      'application/vnd.oasis.opendocument.spreadsheet'
    ];

    if (extname && allowedMimes.includes(file.mimetype)) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid document format'));
    }
  },

  medical: (req, file, cb) => {
    // Allow both images and documents for medical files
    const allowedTypes = /jpeg|jpg|png|pdf|dicom|dcm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid medical file format'));
    }
  },

  any: (req, file, cb) => {
    // Block potentially dangerous files
    const blockedTypes = /exe|bat|sh|cmd|com|jar|app|deb|rpm/;
    const extname = blockedTypes.test(path.extname(file.originalname).toLowerCase());

    if (!extname) {
      return cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  }
};

// Size limits for different file types
const sizeLimits = {
  avatar: 5 * 1024 * 1024, // 5MB
  document: 10 * 1024 * 1024, // 10MB
  medical: 50 * 1024 * 1024, // 50MB
  default: 10 * 1024 * 1024 // 10MB
};

// Create multer upload instances for different purposes
const uploads = {
  // Patient profile photo
  patientPhoto: multer({
    storage: createStorage('patients'),
    fileFilter: fileFilters.images,
    limits: { fileSize: sizeLimits.avatar }
  }).single('photo'),

  // Multiple patient documents
  patientDocuments: multer({
    storage: createStorage('documents'),
    fileFilter: fileFilters.documents,
    limits: { fileSize: sizeLimits.document }
  }).array('documents', 10),

  // Lab results upload
  labResults: multer({
    storage: createStorage('lab'),
    fileFilter: fileFilters.medical,
    limits: { fileSize: sizeLimits.medical }
  }).array('results', 5),

  // Medical imaging upload
  medicalImaging: multer({
    storage: createStorage('imaging'),
    fileFilter: fileFilters.medical,
    limits: { fileSize: sizeLimits.medical }
  }).array('images', 10),

  // Prescription upload
  prescription: multer({
    storage: createStorage('prescriptions'),
    fileFilter: fileFilters.documents,
    limits: { fileSize: sizeLimits.document }
  }).single('prescription'),

  // Generic file upload
  genericFile: multer({
    storage: createStorage('temp'),
    fileFilter: fileFilters.any,
    limits: { fileSize: sizeLimits.default }
  }).single('file'),

  // Multiple generic files
  multipleFiles: multer({
    storage: createStorage('temp'),
    fileFilter: fileFilters.any,
    limits: { fileSize: sizeLimits.default }
  }).array('files', 20),

  // Optical shop try-on photos (exactly 2 photos: front + side)
  tryOnPhotos: multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        const orderId = req.params.orderId || 'temp';
        const orderDir = path.join(uploadDirs.opticalTryons, orderId);
        if (!fs.existsSync(orderDir)) {
          fs.mkdirSync(orderDir, { recursive: true });
        }
        cb(null, orderDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = crypto.randomBytes(4).toString('hex');
        const timestamp = Date.now();
        const photoType = file.fieldname;
        const ext = path.extname(file.originalname);
        cb(null, `${photoType}_${timestamp}_${uniqueSuffix}${ext}`);
      }
    }),
    fileFilter: fileFilters.images,
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 2
    }
  }).fields([
    { name: 'frontPhoto', maxCount: 1 },
    { name: 'sidePhoto', maxCount: 1 }
  ])
};

// Middleware to handle upload errors
const handleUploadError = (uploadFunction) => {
  return (req, res, next) => {
    uploadFunction(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: 'File size too large'
          });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            error: 'Too many files'
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            success: false,
            error: 'Unexpected file field'
          });
        }
        return res.status(400).json({
          success: false,
          error: err.message
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
      next();
    });
  };
};

// File management utilities
const fileUtils = {
  // Delete file
  deleteFile: (filepath) => {
    return new Promise((resolve, reject) => {
      fs.unlink(filepath, (err) => {
        if (err && err.code !== 'ENOENT') {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  },

  // Move file from temp to permanent location
  moveFile: (oldPath, newPath) => {
    return new Promise((resolve, reject) => {
      // Ensure destination directory exists
      const dir = path.dirname(newPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.rename(oldPath, newPath, (err) => {
        if (err) {
          // If cross-device link error, copy then delete
          if (err.code === 'EXDEV') {
            fs.copyFile(oldPath, newPath, (copyErr) => {
              if (copyErr) {
                reject(copyErr);
              } else {
                fs.unlink(oldPath, (unlinkErr) => {
                  if (unlinkErr) {
                    reject(unlinkErr);
                  } else {
                    resolve(newPath);
                  }
                });
              }
            });
          } else {
            reject(err);
          }
        } else {
          resolve(newPath);
        }
      });
    });
  },

  // Get file info
  getFileInfo: (filepath) => {
    return new Promise((resolve, reject) => {
      fs.stat(filepath, (err, stats) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            isFile: stats.isFile(),
            extension: path.extname(filepath),
            filename: path.basename(filepath)
          });
        }
      });
    });
  },

  // Clean old temp files (run periodically)
  cleanTempFiles: async (maxAgeHours = 24) => {
    const tempDir = uploadDirs.temp;
    const maxAge = maxAgeHours * 60 * 60 * 1000;
    const now = Date.now();

    try {
      const files = await fs.promises.readdir(tempDir);

      for (const file of files) {
        const filepath = path.join(tempDir, file);
        const stats = await fs.promises.stat(filepath);

        if (now - stats.mtimeMs > maxAge) {
          await fs.promises.unlink(filepath);
        }
      }
    } catch (error) {
      console.error('Error cleaning temp files:', error);
    }
  },

  // Validate file exists
  fileExists: (filepath) => {
    return fs.existsSync(filepath);
  },

  // Get file URL path for frontend
  getFileUrl: (filepath, baseUrl = '') => {
    // Remove 'uploads/' from path and prepend base URL
    const relativePath = filepath.replace(/^uploads\//, '');
    return `${baseUrl}/uploads/${relativePath}`;
  }
};

// Scheduled cleanup - run every 6 hours
setInterval(() => {
  fileUtils.cleanTempFiles(24);
}, 6 * 60 * 60 * 1000);

module.exports = {
  uploads,
  handleUploadError,
  fileUtils,
  uploadDirs
};