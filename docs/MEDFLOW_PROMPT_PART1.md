# MedFlow Complete Build Prompt - Part 1: Foundation & Architecture

## Project Identity & Vision

Build **MedFlow**, a production-grade, enterprise-level ophthalmology Electronic Medical Records (EMR) and practice management system for multi-location eye care practices in Congo (DRC), following French medical standards.

### Target Users
- Ophthalmologists (primary physicians)
- Orthoptists (visual therapy specialists)
- Opticians (optical shop staff)
- Pharmacists
- Nurses
- Laboratory technicians
- Administrative/reception staff
- Cashiers
- System administrators

### Core Requirements
- **Language**: French for ALL user-facing content (labels, messages, errors, documents)
- **Location**: Congo (DRC) - Francophone Africa
- **Medical Standards**: French ophthalmology conventions
- **Visual Acuity**: Monoyer scale (distance), Parinaud scale (near)
- **Currencies**: CDF (primary), USD, EUR
- **Date Format**: DD/MM/YYYY
- **Time Format**: 24-hour (e.g., 14:30)

---

## Technical Stack Specification

### Frontend Stack
```
Framework:        React 19 with Vite
Styling:          Tailwind CSS with custom medical design system
Routing:          React Router v6
State Management: Redux Toolkit + React Query (TanStack Query)
Form Validation:  Yup + React Hook Form
Icons:            Lucide React
Offline Storage:  Dexie (IndexedDB wrapper)
Real-time:        Socket.io-client
Error Tracking:   Sentry
Unit Tests:       Vitest
E2E Tests:        Playwright
Charts:           Recharts
Virtual Lists:    @tanstack/react-virtual
Notifications:    react-toastify
PDF Viewer:       react-pdf
Date Handling:    date-fns with French locale
```

### Backend Stack
```
Runtime:          Node.js 18+
Framework:        Express.js
Database:         MongoDB with Mongoose ODM
Cache/Sessions:   Redis
Authentication:   JWT (access + refresh tokens)
2FA:              speakeasy (TOTP)
WebSockets:       Socket.io
PDF Generation:   PDFKit
Image Processing: Sharp
File Storage:     Local filesystem + SMB2 for network shares
Logging:          Winston with structured logging
Testing:          Jest
Validation:       express-validator
Rate Limiting:    express-rate-limit
CORS:             cors middleware
```

### Microservices (Python)
```
Face Recognition: FastAPI + DeepFace
OCR Service:      Flask + Tesseract + Celery (async processing)
```

---

## Project Structure

```
medflow/
├── backend/
│   ├── config/
│   │   ├── database.js          # MongoDB connection
│   │   ├── redis.js             # Redis connection
│   │   ├── passport.js          # Auth strategies
│   │   └── errorMessages.js     # Centralized French error messages
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── patientController.js
│   │   ├── appointmentController.js
│   │   ├── invoiceController.js
│   │   ├── pharmacyController.js
│   │   ├── laboratoryController.js
│   │   ├── ophthalmologyController.js
│   │   ├── orthopticController.js
│   │   ├── surgeryController.js
│   │   ├── ivtController.js
│   │   ├── opticalController.js
│   │   ├── inventoryController.js
│   │   ├── deviceController.js
│   │   ├── analyticsController.js
│   │   ├── auditController.js
│   │   └── ... (80+ controllers)
│   ├── middleware/
│   │   ├── auth.js              # JWT verification
│   │   ├── clinicContext.js     # Multi-clinic isolation
│   │   ├── roleCheck.js         # RBAC enforcement
│   │   ├── validation.js        # Request validation
│   │   ├── errorHandler.js      # Global error handling
│   │   ├── auditLogger.js       # Automatic audit logging
│   │   ├── rateLimiter.js       # Rate limiting
│   │   └── csrfProtection.js    # CSRF tokens
│   ├── models/
│   │   ├── User.js
│   │   ├── Patient.js
│   │   ├── Appointment.js
│   │   ├── Visit.js
│   │   ├── OphthalmologyExam.js
│   │   ├── OrthopticExam.js
│   │   ├── Surgery.js
│   │   ├── IVTInjection.js
│   │   ├── Prescription.js
│   │   ├── Invoice.js
│   │   ├── Payment.js
│   │   ├── Clinic.js
│   │   ├── Convention.js
│   │   ├── FeeSchedule.js
│   │   ├── UnifiedInventory.js
│   │   ├── LabOrder.js
│   │   ├── LabResult.js
│   │   ├── Device.js
│   │   ├── DeviceImage.js
│   │   ├── Document.js
│   │   ├── AuditLog.js
│   │   └── ... (83+ models)
│   ├── routes/
│   │   ├── auth.js
│   │   ├── patients.js
│   │   ├── appointments.js
│   │   ├── visits.js
│   │   ├── ophthalmology.js
│   │   ├── orthoptics.js
│   │   ├── surgery.js
│   │   ├── ivt.js
│   │   ├── pharmacy.js
│   │   ├── laboratory.js
│   │   ├── optical.js
│   │   ├── inventory.js
│   │   ├── invoices.js
│   │   ├── devices.js
│   │   ├── analytics.js
│   │   ├── audit.js
│   │   └── ... (77+ route files)
│   ├── services/
│   │   ├── authService.js
│   │   ├── patientService.js
│   │   ├── appointmentService.js
│   │   ├── billingService.js
│   │   ├── conventionService.js
│   │   ├── drugInteractionService.js
│   │   ├── deviceSyncService.js
│   │   ├── pdfGenerationService.js
│   │   ├── emailService.js
│   │   ├── smsService.js
│   │   ├── auditService.js
│   │   ├── cacheService.js
│   │   └── ... (61+ services)
│   ├── utils/
│   │   ├── apiResponse.js       # Standardized responses
│   │   ├── phiEncryption.js     # PHI field encryption
│   │   ├── financialValidation.js
│   │   ├── clinicalValidation.js
│   │   ├── structuredLogger.js
│   │   ├── paginationHelper.js
│   │   └── mongoConnection.js
│   ├── scripts/
│   │   ├── setup.js             # Initial setup
│   │   ├── seedClinics.js
│   │   ├── seedUsers.js
│   │   ├── seedConventions.js
│   │   ├── seedFeeSchedules.js
│   │   ├── seedFrenchDrugs.js
│   │   └── ... (127+ scripts)
│   ├── server.js                # Entry point
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/          # Buttons, Cards, Modals, Tables
│   │   │   ├── layout/          # Header, Sidebar, Footer
│   │   │   ├── forms/           # Form components
│   │   │   ├── patients/        # Patient-related components
│   │   │   ├── appointments/    # Scheduling components
│   │   │   ├── ophthalmology/   # Clinical exam components
│   │   │   ├── orthoptics/      # Orthoptic exam components
│   │   │   ├── surgery/         # Surgery components
│   │   │   ├── ivt/             # IVT components
│   │   │   ├── pharmacy/        # Pharmacy components
│   │   │   ├── laboratory/      # Lab components
│   │   │   ├── optical/         # Optical shop components
│   │   │   ├── billing/         # Invoice/payment components
│   │   │   ├── inventory/       # Stock management
│   │   │   ├── devices/         # Device integration
│   │   │   ├── analytics/       # Charts and dashboards
│   │   │   └── ... (29+ domains)
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Patients/
│   │   │   ├── Appointments.jsx
│   │   │   ├── Queue.jsx
│   │   │   ├── ophthalmology/
│   │   │   │   └── StudioVisionConsultation.jsx
│   │   │   ├── Orthoptics.jsx
│   │   │   ├── Surgery/
│   │   │   ├── IVT/
│   │   │   ├── Pharmacy/
│   │   │   ├── Laboratory/
│   │   │   ├── Optical/
│   │   │   ├── Invoicing.jsx
│   │   │   ├── Inventory/
│   │   │   ├── Analytics/
│   │   │   ├── Settings/
│   │   │   └── ... (30+ pages)
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── usePatient.js
│   │   │   ├── useWebSocket.js
│   │   │   ├── useClinic.js
│   │   │   ├── useOffline.js
│   │   │   └── usePatientAlerts.js
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx
│   │   │   ├── ClinicContext.jsx
│   │   │   ├── StudioVisionModeContext.jsx
│   │   │   └── WebSocketContext.jsx
│   │   ├── services/
│   │   │   ├── api.js           # Axios instance
│   │   │   ├── authService.js
│   │   │   ├── patientService.js
│   │   │   ├── appointmentService.js
│   │   │   └── ... (80+ services)
│   │   ├── store/
│   │   │   ├── index.js
│   │   │   ├── authSlice.js
│   │   │   ├── patientSlice.js
│   │   │   ├── clinicSlice.js
│   │   │   └── queueSlice.js
│   │   ├── utils/
│   │   │   ├── formatters.js
│   │   │   ├── validators.js
│   │   │   ├── constants.js
│   │   │   └── offlineDb.js
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── public/
│   ├── vite.config.js
│   └── package.json
│
├── face-service/                # Python FastAPI
│   ├── main.py
│   ├── face_recognition.py
│   └── requirements.txt
│
├── ocr-service/                 # Python Flask + Celery
│   ├── app.py
│   ├── ocr_processor.py
│   ├── celery_config.py
│   └── requirements.txt
│
├── central-server/              # Multi-clinic coordination
│   ├── server.js
│   └── package.json
│
└── docker-compose.yml
```

---

## Database Schema Definitions

### Core Models

#### User Model
```javascript
const UserSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'doctor', 'nurse', 'optician', 'pharmacist',
           'lab_tech', 'cashier', 'receptionist', 'orthoptist'],
    required: true
  },
  clinics: [{ type: Schema.Types.ObjectId, ref: 'Clinic' }],
  currentClinicId: { type: Schema.Types.ObjectId, ref: 'Clinic' },
  permissions: [String],
  specialization: String,  // For doctors
  licenseNumber: String,
  signature: String,       // Base64 signature image
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, select: false },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  refreshTokens: [{ token: String, expiresAt: Date }],
  failedLoginAttempts: { type: Number, default: 0 },
  lockUntil: Date
}, { timestamps: true });

// Indexes
UserSchema.index({ email: 1 });
UserSchema.index({ clinics: 1 });
UserSchema.index({ role: 1 });
```

#### Patient Model
```javascript
const PatientSchema = new Schema({
  // Identity
  patientId: { type: String, unique: true },  // Auto-generated: CLI-YYYYMMDD-XXXX
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ['M', 'F'], required: true },

  // Contact (PHI - encrypted at rest)
  phone: { type: String, encrypted: true },
  alternativePhone: { type: String, encrypted: true },
  email: String,
  address: {
    street: { type: String, encrypted: true },
    city: String,
    commune: String,
    country: { type: String, default: 'RDC' }
  },

  // Medical
  bloodType: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  allergies: [String],
  chronicConditions: [String],
  currentMedications: [String],

  // Professional/Insurance
  profession: String,
  employer: String,
  convention: { type: Schema.Types.ObjectId, ref: 'Convention' },
  conventionMemberNumber: String,

  // Emergency Contact (PHI - encrypted)
  emergencyContact: {
    name: { type: String, encrypted: true },
    phone: { type: String, encrypted: true },
    relationship: String
  },

  // Face Recognition
  faceEmbedding: [Number],  // 128-dimensional vector
  faceImagePath: String,

  // Referral
  referringDoctor: String,
  referringFacility: String,

  // Administrative
  clinic: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },
  isVIP: { type: Boolean, default: false },
  notes: String,
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Indexes
PatientSchema.index({ clinic: 1, lastName: 1, firstName: 1 });
PatientSchema.index({ clinic: 1, patientId: 1 });
PatientSchema.index({ clinic: 1, phone: 1 });
PatientSchema.index({ convention: 1 });
PatientSchema.index({ dateOfBirth: 1 });

// Auto-generate patientId
PatientSchema.pre('save', async function(next) {
  if (!this.patientId) {
    const clinic = await mongoose.model('Clinic').findById(this.clinic);
    const date = new Date().toISOString().slice(0,10).replace(/-/g, '');
    const count = await mongoose.model('Patient').countDocuments({
      clinic: this.clinic,
      createdAt: { $gte: new Date().setHours(0,0,0,0) }
    });
    this.patientId = `${clinic.code}-${date}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});
```

#### Clinic Model
```javascript
const ClinicSchema = new Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },  // e.g., 'TOM', 'GOL'
  address: {
    street: String,
    city: String,
    commune: String,
    country: { type: String, default: 'RDC' }
  },
  phone: String,
  email: String,

  // Operations
  workingHours: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String }
  },
  appointmentSlotDuration: { type: Number, default: 15 },  // minutes

  // Equipment
  rooms: [{
    name: String,
    type: { type: String, enum: ['consultation', 'exam', 'surgery', 'injection'] },
    equipment: [String]
  }],

  // Billing
  defaultCurrency: { type: String, default: 'CDF' },
  taxId: String,

  // Settings
  settings: {
    requireAppointment: { type: Boolean, default: false },
    allowWalkIns: { type: Boolean, default: true },
    autoInvoice: { type: Boolean, default: true }
  },

  isActive: { type: Boolean, default: true }
}, { timestamps: true });
```

#### Appointment Model
```javascript
const AppointmentSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  clinic: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },

  // Scheduling
  scheduledDate: { type: Date, required: true },
  scheduledTime: { type: String, required: true },  // "HH:MM"
  duration: { type: Number, default: 15 },  // minutes

  // Type
  appointmentType: {
    type: String,
    enum: ['consultation', 'follow_up', 'exam', 'surgery', 'ivt',
           'orthoptics', 'optical', 'lab', 'emergency'],
    required: true
  },

  // Assignment
  provider: { type: Schema.Types.ObjectId, ref: 'User' },
  room: String,

  // Status Flow
  status: {
    type: String,
    enum: ['scheduled', 'confirmed', 'checked_in', 'in_progress',
           'completed', 'cancelled', 'no_show'],
    default: 'scheduled'
  },

  // Check-in
  checkedInAt: Date,
  checkedInBy: { type: Schema.Types.ObjectId, ref: 'User' },

  // Notes
  reason: String,
  notes: String,

  // Reminders
  remindersSent: [{
    type: { type: String, enum: ['sms', 'email'] },
    sentAt: Date
  }],

  // Recurrence
  isRecurring: { type: Boolean, default: false },
  recurrencePattern: {
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'] },
    interval: Number,
    endDate: Date
  },

  // Linked Records
  visit: { type: Schema.Types.ObjectId, ref: 'Visit' },

  createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Indexes
AppointmentSchema.index({ clinic: 1, scheduledDate: 1, status: 1 });
AppointmentSchema.index({ patient: 1, scheduledDate: 1 });
AppointmentSchema.index({ provider: 1, scheduledDate: 1 });
```

#### Visit Model
```javascript
const VisitSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  clinic: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },
  appointment: { type: Schema.Types.ObjectId, ref: 'Appointment' },

  // Visit Info
  visitNumber: String,  // Auto-generated
  visitDate: { type: Date, default: Date.now },
  visitType: {
    type: String,
    enum: ['consultation', 'follow_up', 'emergency', 'surgery',
           'injection', 'exam_only', 'optical', 'pharmacy_only'],
    required: true
  },

  // Chief Complaint
  chiefComplaint: String,

  // Vitals (optional)
  vitals: {
    bloodPressure: { systolic: Number, diastolic: Number },
    pulse: Number,
    temperature: Number,
    weight: Number,
    height: Number
  },

  // Clinical Data Links
  ophthalmologyExam: { type: Schema.Types.ObjectId, ref: 'OphthalmologyExam' },
  orthopticExam: { type: Schema.Types.ObjectId, ref: 'OrthopticExam' },
  surgery: { type: Schema.Types.ObjectId, ref: 'Surgery' },
  ivtInjection: { type: Schema.Types.ObjectId, ref: 'IVTInjection' },

  // Documents Generated
  prescriptions: [{ type: Schema.Types.ObjectId, ref: 'Prescription' }],
  documents: [{ type: Schema.Types.ObjectId, ref: 'Document' }],

  // Billing
  invoice: { type: Schema.Types.ObjectId, ref: 'Invoice' },

  // Provider
  provider: { type: Schema.Types.ObjectId, ref: 'User' },

  // Status
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'cancelled'],
    default: 'in_progress'
  },
  completedAt: Date,

  // Notes
  notes: String,
  followUpDate: Date,
  followUpNotes: String
}, { timestamps: true });

// Indexes
VisitSchema.index({ clinic: 1, visitDate: -1 });
VisitSchema.index({ patient: 1, visitDate: -1 });
VisitSchema.index({ provider: 1, visitDate: -1 });
```

#### OphthalmologyExam Model
```javascript
const OphthalmologyExamSchema = new Schema({
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  visit: { type: Schema.Types.ObjectId, ref: 'Visit', required: true },
  clinic: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },
  examiner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  examDate: { type: Date, default: Date.now },

  // Visual Acuity - Monoyer Scale (Distance)
  visualAcuity: {
    OD: {  // Right eye
      uncorrected: String,     // e.g., "3/10", "CLD", "VBLM", "PL+", "PL-"
      corrected: String,
      pinhole: String,         // Trou sténopéique
      method: { type: String, enum: ['monoyer', 'snellen', 'logmar'] }
    },
    OS: {  // Left eye
      uncorrected: String,
      corrected: String,
      pinhole: String,
      method: String
    }
  },

  // Near Vision - Parinaud Scale
  nearVision: {
    OD: {
      uncorrected: String,     // e.g., "P2", "P3", "P14"
      corrected: String
    },
    OS: {
      uncorrected: String,
      corrected: String
    }
  },

  // Autorefraction (from device)
  autorefraction: {
    OD: {
      sphere: Number,          // -20.00 to +20.00
      cylinder: Number,
      axis: Number,            // 0-180
      pupilDistance: Number
    },
    OS: {
      sphere: Number,
      cylinder: Number,
      axis: Number,
      pupilDistance: Number
    },
    device: String,
    deviceData: Schema.Types.Mixed
  },

  // Subjective Refraction (final prescription)
  refraction: {
    OD: {
      sphere: Number,
      cylinder: Number,
      axis: Number,
      addition: Number,        // For presbyopia
      prism: { amount: Number, base: String }
    },
    OS: {
      sphere: Number,
      cylinder: Number,
      axis: Number,
      addition: Number,
      prism: { amount: Number, base: String }
    },
    pupillaryDistance: {
      far: Number,
      near: Number
    }
  },

  // Intraocular Pressure
  iop: {
    OD: {
      value: Number,           // mmHg (0-60)
      time: String,
      method: { type: String, enum: ['goldmann', 'tonopen', 'icare', 'ncT', 'palpation'] }
    },
    OS: {
      value: Number,
      time: String,
      method: String
    },
    device: String
  },

  // Keratometry
  keratometry: {
    OD: {
      k1: { value: Number, axis: Number },
      k2: { value: Number, axis: Number },
      avgK: Number,
      astigmatism: Number
    },
    OS: {
      k1: { value: Number, axis: Number },
      k2: { value: Number, axis: Number },
      avgK: Number,
      astigmatism: Number
    },
    device: String
  },

  // Pachymetry (Corneal Thickness)
  pachymetry: {
    OD: { central: Number, thinnest: Number },
    OS: { central: Number, thinnest: Number },
    device: String
  },

  // Pupil
  pupil: {
    OD: {
      size: Number,
      reaction: { type: String, enum: ['normal', 'sluggish', 'fixed', 'RAPD'] },
      shape: { type: String, enum: ['round', 'irregular', 'oval'] }
    },
    OS: {
      size: Number,
      reaction: String,
      shape: String
    }
  },

  // Anterior Segment (Slit Lamp)
  anteriorSegment: {
    OD: {
      lids: String,
      conjunctiva: String,
      sclera: String,
      cornea: String,
      anteriorChamber: { depth: String, cells: String, flare: String },
      iris: String,
      pupil: String,
      lens: {
        status: { type: String, enum: ['phakic', 'pseudophakic', 'aphakic'] },
        clarity: String,
        locsGrade: {           // LOCS III grading
          nuclear: Number,     // 0-6
          cortical: Number,    // 0-5
          posteriorSubcapsular: Number  // 0-5
        }
      }
    },
    OS: {
      // Same structure as OD
    }
  },

  // Gonioscopy
  gonioscopy: {
    OD: {
      superior: String,
      inferior: String,
      nasal: String,
      temporal: String,
      shaffer: String,         // Shaffer grade 0-4
      pigmentation: String,
      synechiae: String
    },
    OS: {
      // Same structure
    }
  },

  // Posterior Segment (Fundus)
  posteriorSegment: {
    OD: {
      vitreous: String,
      opticDisc: {
        color: String,
        margins: String,
        cupDiscRatio: Number,  // 0.0 - 1.0
        neuroretinalRim: String,
        rnflDefect: Boolean
      },
      macula: {
        fovealReflex: String,
        appearance: String
      },
      vessels: {
        arteries: String,
        veins: String,
        avRatio: String
      },
      periphery: String,
      drStage: {               // Diabetic Retinopathy staging
        type: String,
        enum: ['no_dr', 'mild_npdr', 'moderate_npdr', 'severe_npdr', 'pdr']
      },
      dmePresent: Boolean      // Diabetic Macular Edema
    },
    OS: {
      // Same structure
    },
    method: { type: String, enum: ['direct', 'indirect', 'slit_lamp_90D', 'slit_lamp_78D'] },
    dilated: { type: Boolean, default: true },
    dilationAgent: String,
    dilationTime: String
  },

  // Diagnoses (ICD-10)
  diagnoses: [{
    code: String,              // ICD-10 code
    description: String,
    eye: { type: String, enum: ['OD', 'OS', 'OU'] },
    isPrimary: Boolean,
    isNew: Boolean,
    notes: String
  }],

  // Treatment Plan
  treatmentPlan: {
    medications: [{
      name: String,
      dosage: String,
      frequency: String,
      duration: String,
      eye: { type: String, enum: ['OD', 'OS', 'OU'] },
      instructions: String
    }],
    procedures: [String],
    surgeryRecommended: Boolean,
    surgeryType: String,
    referrals: [{
      specialty: String,
      reason: String,
      urgency: { type: String, enum: ['routine', 'urgent', 'emergency'] }
    }],
    followUp: {
      interval: String,
      reason: String
    }
  },

  // Device Images
  deviceImages: [{
    type: { type: String },    // 'oct', 'fundus', 'visual_field', etc.
    path: String,
    eye: { type: String, enum: ['OD', 'OS'] },
    capturedAt: Date,
    device: String
  }],

  // Clinical Notes
  notes: String,

  // Signature
  signedAt: Date,
  signedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Indexes
OphthalmologyExamSchema.index({ clinic: 1, examDate: -1 });
OphthalmologyExamSchema.index({ patient: 1, examDate: -1 });
OphthalmologyExamSchema.index({ visit: 1 });
```

#### Invoice Model
```javascript
const InvoiceSchema = new Schema({
  invoiceNumber: { type: String, unique: true },
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
  visit: { type: Schema.Types.ObjectId, ref: 'Visit' },
  clinic: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },

  // Convention/Insurance
  convention: { type: Schema.Types.ObjectId, ref: 'Convention' },
  approval: { type: Schema.Types.ObjectId, ref: 'Approval' },

  // Line Items
  items: [{
    itemId: Schema.Types.ObjectId,
    type: { type: String, enum: ['service', 'medication', 'product', 'procedure'] },
    code: String,
    description: String,
    quantity: Number,
    unitPrice: Number,
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: Number,
    category: String
  }],

  // Totals
  subtotal: Number,
  discountTotal: Number,
  taxTotal: Number,
  grandTotal: Number,

  // Split Billing
  patientShare: Number,
  companyShare: Number,

  // Currency
  currency: { type: String, enum: ['CDF', 'USD', 'EUR'], default: 'CDF' },
  exchangeRate: Number,       // Rate to CDF at time of invoice

  // Payments
  payments: [{
    amount: Number,
    method: {
      type: String,
      enum: ['cash', 'card', 'check', 'bank-transfer', 'insurance',
             'mobile-payment', 'orange-money', 'mtn-money', 'wave', 'other']
    },
    reference: String,
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    receivedAt: { type: Date, default: Date.now }
  }],
  amountPaid: { type: Number, default: 0 },
  amountDue: Number,

  // Status
  status: {
    type: String,
    enum: ['draft', 'pending', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'draft'
  },

  // Dates
  invoiceDate: { type: Date, default: Date.now },
  dueDate: Date,
  paidAt: Date,

  // Notes
  notes: String,
  internalNotes: String,

  // Audit
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  cancelledAt: Date,
  cancellationReason: String
}, { timestamps: true });

// Auto-calculate amounts
InvoiceSchema.pre('save', function(next) {
  this.subtotal = this.items.reduce((sum, item) => sum + item.total, 0);
  this.grandTotal = this.subtotal - this.discountTotal + this.taxTotal;
  this.amountDue = this.grandTotal - this.amountPaid;

  if (this.amountDue <= 0) {
    this.status = 'paid';
    this.paidAt = new Date();
  } else if (this.amountPaid > 0) {
    this.status = 'partial';
  }

  next();
});

// Indexes
InvoiceSchema.index({ clinic: 1, invoiceDate: -1 });
InvoiceSchema.index({ patient: 1, invoiceDate: -1 });
InvoiceSchema.index({ status: 1 });
InvoiceSchema.index({ invoiceNumber: 1 });
```

#### Convention (Insurance) Model
```javascript
const ConventionSchema = new Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  type: {
    type: String,
    enum: ['insurance', 'employer', 'government', 'mutual', 'other'],
    required: true
  },

  // Contact
  contact: {
    address: String,
    phone: String,
    email: String,
    contactPerson: String
  },

  // Coverage Rules
  defaultCoverage: {
    percentage: { type: Number, default: 80 },    // Default coverage %
    maxAnnual: Number,                            // Annual limit
    maxPerVisit: Number,                          // Per-visit limit
    categories: [{
      category: String,                           // 'consultation', 'surgery', 'medication', etc.
      coveragePercent: Number,
      maxAmount: Number,
      requiresApproval: Boolean
    }]
  },

  // Approval Requirements
  requiresPriorApproval: { type: Boolean, default: false },
  approvalCategories: [String],

  // Billing
  billingCycle: { type: String, enum: ['immediate', 'monthly', 'quarterly'] },
  paymentTerms: Number,  // Days

  // Contract
  contractStart: Date,
  contractEnd: Date,

  isActive: { type: Boolean, default: true },
  clinics: [{ type: Schema.Types.ObjectId, ref: 'Clinic' }]
}, { timestamps: true });
```

#### UnifiedInventory Model
```javascript
const UnifiedInventorySchema = new Schema({
  // Common Fields
  clinic: { type: Schema.Types.ObjectId, ref: 'Clinic', required: true },
  itemType: {
    type: String,
    enum: ['medication', 'frame', 'lens', 'contact_lens', 'reagent',
           'lab_consumable', 'surgical_supply', 'general'],
    required: true
  },

  // Identification
  sku: { type: String, required: true },
  barcode: String,
  name: { type: String, required: true },
  description: String,
  category: String,
  subcategory: String,

  // Stock
  quantity: { type: Number, default: 0 },
  reorderLevel: { type: Number, default: 10 },
  reorderQuantity: Number,
  maxStock: Number,

  // Pricing
  costPrice: Number,
  sellingPrice: Number,
  currency: { type: String, default: 'CDF' },

  // Batch/Lot Tracking
  batches: [{
    batchNumber: String,
    lotNumber: String,
    quantity: Number,
    expiryDate: Date,
    receivedDate: Date,
    supplier: String
  }],

  // Type-Specific Fields (conditional)

  // For Medications
  medication: {
    genericName: String,
    brandName: String,
    dosageForm: String,       // tablet, capsule, drops, injection
    strength: String,
    therapeuticClass: String,
    requiresPrescription: Boolean,
    isControlled: Boolean,
    controlSchedule: String,
    coldChain: Boolean,
    storageTemp: { min: Number, max: Number }
  },

  // For Frames
  frame: {
    brand: String,
    model: String,
    color: String,
    size: { bridge: Number, lens: Number, temple: Number },
    material: String,         // metal, plastic, titanium
    gender: String,           // M, F, unisex
    style: String,            // rimless, semi-rimless, full-rim
    isDepot: Boolean,         // Depot frame (consignment)
    depotSupplier: String
  },

  // For Lenses
  lens: {
    type: String,             // single_vision, bifocal, progressive, plano
    material: String,         // CR39, polycarbonate, trivex, glass
    index: Number,            // 1.5, 1.6, 1.67, 1.74
    coating: [String],        // anti_reflective, blue_light, photochromic
    sphereRange: { min: Number, max: Number },
    cylinderRange: { min: Number, max: Number }
  },

  // For Contact Lenses
  contactLens: {
    brand: String,
    type: String,             // daily, weekly, monthly, yearly
    material: String,
    baseCurve: Number,
    diameter: Number,
    power: Number,
    cylinder: Number,
    axis: Number
  },

  // For Reagents
  reagent: {
    testType: String,
    analyzer: String,
    testsPerKit: Number
  },

  // Location
  location: {
    shelf: String,
    bin: String,
    zone: String
  },

  // Status
  isActive: { type: Boolean, default: true },
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Indexes
UnifiedInventorySchema.index({ clinic: 1, itemType: 1, sku: 1 }, { unique: true });
UnifiedInventorySchema.index({ clinic: 1, name: 'text' });
UnifiedInventorySchema.index({ 'batches.expiryDate': 1 });
UnifiedInventorySchema.index({ quantity: 1, reorderLevel: 1 });
```

#### AuditLog Model
```javascript
const AuditLogSchema = new Schema({
  // Who
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  userEmail: String,
  userRole: String,

  // When
  timestamp: { type: Date, default: Date.now },

  // What
  action: {
    type: String,
    enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT',
           'EXPORT', 'PRINT', 'APPROVE', 'REJECT', 'SIGN'],
    required: true
  },
  resource: { type: String, required: true },  // 'patient', 'invoice', etc.
  resourceId: Schema.Types.ObjectId,

  // Details
  changes: {
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed
  },
  description: String,

  // Context
  clinic: { type: Schema.Types.ObjectId, ref: 'Clinic' },
  ipAddress: String,
  userAgent: String,

  // Sensitive Access
  phiAccessed: { type: Boolean, default: false },
  patientId: { type: Schema.Types.ObjectId, ref: 'Patient' }
}, { timestamps: true });

// Index with TTL (keep 6 years for HIPAA)
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 189216000 });
AuditLogSchema.index({ user: 1, timestamp: -1 });
AuditLogSchema.index({ resource: 1, resourceId: 1 });
AuditLogSchema.index({ clinic: 1, timestamp: -1 });
```

---

## API Response Pattern

```javascript
// utils/apiResponse.js
const success = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

const error = (res, message, statusCode = 500, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString()
  });
};

const paginated = (res, items, pagination, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data: items,
    pagination,
    timestamp: new Date().toISOString()
  });
};

module.exports = { success, error, paginated };
```

---

## Authentication Flow

```
1. Login Request (POST /api/auth/login)
   - Validate credentials
   - Check account status (active, not locked)
   - If 2FA enabled, return { requires2FA: true }
   - Generate access token (15min) + refresh token (7 days)
   - Store refresh token in Redis/DB
   - Return tokens + user data

2. 2FA Verification (POST /api/auth/verify-2fa)
   - Validate TOTP code
   - Return tokens on success

3. Token Refresh (POST /api/auth/refresh)
   - Validate refresh token
   - Generate new access token
   - Optionally rotate refresh token

4. Protected Route Access
   - Extract Bearer token
   - Verify JWT signature and expiry
   - Check user still active
   - Check user has required role/permission
   - Verify clinic context

5. Logout (POST /api/auth/logout)
   - Invalidate refresh token
   - Clear client tokens
```

---

## Real-time WebSocket Events

```javascript
// Socket.io event structure
const socketEvents = {
  // Queue Management
  'queue:patient-added': { patientId, clinicId, position },
  'queue:patient-called': { patientId, clinicId, room, provider },
  'queue:patient-completed': { patientId, clinicId },
  'queue:updated': { clinicId, queue: [] },

  // Appointments
  'appointment:created': { appointment },
  'appointment:updated': { appointment },
  'appointment:cancelled': { appointmentId },

  // Device Integration
  'device:measurement-received': { patientId, deviceType, data },
  'device:image-received': { patientId, imageType, path },

  // Notifications
  'notification:new': { userId, notification },

  // Inventory
  'inventory:low-stock': { clinicId, item },
  'inventory:expiring-soon': { clinicId, items },

  // Lab
  'lab:result-ready': { orderId, patientId },
  'lab:critical-value': { orderId, patientId, value }
};
```

---

## Error Messages (French)

```javascript
// config/errorMessages.js
module.exports = {
  // Authentication
  INVALID_CREDENTIALS: 'Identifiants invalides',
  ACCOUNT_LOCKED: 'Compte verrouillé. Réessayez dans {minutes} minutes',
  SESSION_EXPIRED: 'Session expirée. Veuillez vous reconnecter',
  UNAUTHORIZED: 'Non autorisé',
  FORBIDDEN: 'Accès refusé',

  // Validation
  REQUIRED_FIELD: 'Ce champ est obligatoire',
  INVALID_EMAIL: 'Adresse email invalide',
  INVALID_PHONE: 'Numéro de téléphone invalide',
  INVALID_DATE: 'Date invalide',
  INVALID_AMOUNT: 'Montant invalide',

  // Patient
  PATIENT_NOT_FOUND: 'Patient non trouvé',
  DUPLICATE_PATIENT: 'Un patient avec ces informations existe déjà',

  // Appointment
  SLOT_UNAVAILABLE: 'Ce créneau n\'est plus disponible',
  APPOINTMENT_NOT_FOUND: 'Rendez-vous non trouvé',
  PAST_APPOINTMENT: 'Impossible de modifier un rendez-vous passé',

  // Clinical
  EXAM_NOT_FOUND: 'Examen non trouvé',
  ALREADY_SIGNED: 'Ce document est déjà signé',

  // Inventory
  INSUFFICIENT_STOCK: 'Stock insuffisant',
  EXPIRED_ITEM: 'Produit expiré',

  // Billing
  INVOICE_NOT_FOUND: 'Facture non trouvée',
  INVOICE_ALREADY_PAID: 'Cette facture est déjà payée',
  INVALID_PAYMENT_AMOUNT: 'Montant de paiement invalide',

  // General
  NOT_FOUND: 'Ressource non trouvée',
  SERVER_ERROR: 'Erreur serveur. Veuillez réessayer',
  RATE_LIMITED: 'Trop de requêtes. Veuillez patienter'
};
```

---

## Continue to Part 2 for:
- Module-by-module detailed specifications
- Implementation phases and order
- Security implementation details
- Testing strategy
- Deployment configuration
- StudioVision UI system
- Device integration patterns
- AI/ML services integration
