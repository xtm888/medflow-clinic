# MedFlow Complete Build Prompt - Part 2: Modules & Implementation

## Module Specifications

### Module 1: Authentication & User Management

#### Features
- Email/password login with bcrypt hashing (12 rounds)
- JWT access tokens (15-minute expiry) + refresh tokens (7-day expiry)
- Optional TOTP-based 2FA (speakeasy library)
- Account lockout after 5 failed attempts (15-minute lockout)
- Password policy: min 12 chars, uppercase, lowercase, number, special char
- Role-based access control (RBAC) with granular permissions
- Multi-clinic user assignment with context switching
- Session management with concurrent login limits
- Password reset via email with time-limited tokens

#### API Endpoints
```
POST   /api/auth/login           # Authenticate user
POST   /api/auth/logout          # Invalidate session
POST   /api/auth/refresh         # Refresh access token
POST   /api/auth/verify-2fa      # Verify TOTP code
POST   /api/auth/forgot-password # Request reset email
POST   /api/auth/reset-password  # Set new password
GET    /api/auth/me              # Get current user profile
PUT    /api/auth/me              # Update profile
PUT    /api/auth/change-password # Change password
POST   /api/auth/setup-2fa       # Enable 2FA
DELETE /api/auth/disable-2fa     # Disable 2FA

# User Management (admin only)
GET    /api/users                # List users (paginated)
GET    /api/users/:id            # Get user details
POST   /api/users                # Create user
PUT    /api/users/:id            # Update user
DELETE /api/users/:id            # Deactivate user
PUT    /api/users/:id/roles      # Update user roles
PUT    /api/users/:id/clinics    # Assign clinics
```

#### Roles & Permissions
```javascript
const roles = {
  admin: ['*'],  // All permissions
  doctor: [
    'patients:read', 'patients:write',
    'exams:read', 'exams:write', 'exams:sign',
    'prescriptions:write', 'prescriptions:sign',
    'surgery:read', 'surgery:write',
    'invoices:read'
  ],
  nurse: [
    'patients:read', 'patients:write:limited',
    'vitals:write', 'queue:manage',
    'appointments:read', 'appointments:write'
  ],
  orthoptist: [
    'patients:read', 'orthoptics:read', 'orthoptics:write'
  ],
  optician: [
    'patients:read', 'optical:read', 'optical:write',
    'frames:manage', 'glasses_orders:manage'
  ],
  pharmacist: [
    'patients:read', 'prescriptions:read',
    'pharmacy:manage', 'inventory:pharmacy'
  ],
  lab_tech: [
    'patients:read', 'lab:manage', 'inventory:lab'
  ],
  cashier: [
    'patients:read', 'invoices:manage', 'payments:manage'
  ],
  receptionist: [
    'patients:read', 'patients:write:basic',
    'appointments:manage', 'queue:manage'
  ]
};
```

---

### Module 2: Patient Management

#### Features
- Patient registration with required demographics
- Auto-generated patient ID: `{CLINIC_CODE}-{YYYYMMDD}-{SEQUENCE}`
- Face recognition for identification and duplicate detection
- Photo capture during registration
- Convention/insurance assignment with member number
- Medical history tracking (allergies, conditions, medications)
- VIP flag for priority handling
- Soft delete with audit trail
- Patient merge for duplicates
- Full-text search across name, phone, ID
- Patient portal access (optional)

#### API Endpoints
```
GET    /api/patients                    # List patients (paginated, searchable)
GET    /api/patients/:id                # Get patient details
POST   /api/patients                    # Create patient
PUT    /api/patients/:id                # Update patient
DELETE /api/patients/:id                # Soft delete patient
GET    /api/patients/:id/history        # Medical history summary
GET    /api/patients/:id/visits         # Visit history
GET    /api/patients/:id/prescriptions  # All prescriptions
GET    /api/patients/:id/invoices       # Billing history
GET    /api/patients/:id/documents      # All documents
POST   /api/patients/:id/photo          # Upload/update photo
POST   /api/patients/:id/face-enroll    # Enroll face for recognition
GET    /api/patients/search             # Advanced search
POST   /api/patients/check-duplicates   # Check for potential duplicates
POST   /api/patients/merge              # Merge duplicate patients
GET    /api/patients/:id/alerts         # Patient-specific alerts
```

#### Duplicate Detection Logic
```javascript
async function checkDuplicates(patientData) {
  const candidates = [];

  // 1. Exact phone match
  const phoneMatch = await Patient.find({
    phone: patientData.phone,
    isDeleted: false
  });
  candidates.push(...phoneMatch.map(p => ({ patient: p, reason: 'phone', score: 100 })));

  // 2. Name + DOB match
  const nameMatch = await Patient.find({
    firstName: new RegExp(patientData.firstName, 'i'),
    lastName: new RegExp(patientData.lastName, 'i'),
    dateOfBirth: patientData.dateOfBirth,
    isDeleted: false
  });
  candidates.push(...nameMatch.map(p => ({ patient: p, reason: 'name+dob', score: 95 })));

  // 3. Face recognition (if photo provided)
  if (patientData.photo) {
    const faceMatches = await faceRecognitionService.findSimilar(patientData.photo);
    candidates.push(...faceMatches.map(m => ({
      patient: m.patient,
      reason: 'face',
      score: m.similarity * 100
    })));
  }

  // Deduplicate and sort by score
  return deduplicateByPatientId(candidates).sort((a, b) => b.score - a.score);
}
```

---

### Module 3: Appointments & Queue Management

#### Features
- Calendar-based scheduling with drag-and-drop
- Multiple appointment types with configurable durations
- Provider and room assignment
- Recurring appointments
- Conflict detection
- SMS/email reminders (1 day before, 1 hour before)
- Public booking portal (optional)
- Kiosk check-in with face recognition
- Real-time queue display
- Wait time estimation
- Room-based queue routing
- WebSocket updates for queue changes

#### API Endpoints
```
# Appointments
GET    /api/appointments                    # List appointments
GET    /api/appointments/:id                # Get appointment
POST   /api/appointments                    # Create appointment
PUT    /api/appointments/:id                # Update appointment
DELETE /api/appointments/:id                # Cancel appointment
POST   /api/appointments/:id/confirm        # Confirm appointment
POST   /api/appointments/:id/check-in       # Patient check-in
GET    /api/appointments/available-slots    # Get available slots
GET    /api/appointments/calendar           # Calendar view data

# Queue
GET    /api/queue                           # Current queue
GET    /api/queue/stats                     # Wait times, counts
POST   /api/queue/add                       # Add patient to queue
POST   /api/queue/:id/call                  # Call patient
POST   /api/queue/:id/complete              # Mark complete
POST   /api/queue/:id/transfer              # Transfer to another queue
PUT    /api/queue/reorder                   # Reorder queue
GET    /api/queue/display                   # Public display data

# Kiosk
POST   /api/kiosk/check-in/face             # Face-based check-in
POST   /api/kiosk/check-in/id               # ID-based check-in
POST   /api/kiosk/check-in/appointment      # Appointment code check-in
```

#### Queue Status Flow
```
scheduled → confirmed → checked_in → in_queue → called → in_progress → completed
                                         ↓
                                    no_show / cancelled
```

---

### Module 4: Clinical - Ophthalmology (StudioVision)

#### Features
- Comprehensive eye examination with OD/OS/OU structure
- Visual acuity recording (Monoyer distance, Parinaud near)
- Special notations: CLD, VBLM, PL+, PL-, TP (trou sténopéique)
- Autorefraction from device integration
- Subjective refraction with full sphere/cylinder/axis/add
- IOP measurement with method and time recording
- Keratometry (K readings) with device sync
- Pachymetry (corneal thickness)
- Pupil assessment
- Anterior segment slit-lamp examination
- LOCS III cataract grading
- Gonioscopy with Shaffer grading
- Posterior segment examination with dilated fundoscopy
- Diabetic retinopathy staging
- Cup-to-disc ratio
- ICD-10 diagnosis coding with laterality
- Treatment plan builder
- Device image import (OCT, fundus, visual field)
- "Renouvellement" (copy from previous exam) feature
- Clinical document generation (Fiche Ophta)
- Digital signature

#### Visual Acuity Values
```javascript
// Distance Vision - Monoyer Scale
const monoyerValues = [
  '10/10', '9/10', '8/10', '7/10', '6/10', '5/10',
  '4/10', '3/10', '2/10', '1/10', '1/20', '1/50',
  'CLD',    // Compte les doigts (counts fingers)
  'VBLM',   // Voit bouger la main (sees hand movement)
  'PL+',    // Perception lumineuse positive (light perception)
  'PL-'     // Perception lumineuse négative (no light perception)
];

// Near Vision - Parinaud Scale
const parinaudValues = [
  'P1.5', 'P2', 'P3', 'P4', 'P5', 'P6',
  'P8', 'P10', 'P14', 'P20'
];
```

#### API Endpoints
```
# Examinations
GET    /api/ophthalmology/exams                    # List exams
GET    /api/ophthalmology/exams/:id                # Get exam
POST   /api/ophthalmology/exams                    # Create exam
PUT    /api/ophthalmology/exams/:id                # Update exam
POST   /api/ophthalmology/exams/:id/sign           # Sign exam
GET    /api/ophthalmology/exams/:id/pdf            # Generate Fiche Ophta

# Patient History
GET    /api/ophthalmology/patients/:id/history     # Full ophthalmic history
GET    /api/ophthalmology/patients/:id/trends      # IOP, VA, refraction trends

# Device Data
POST   /api/ophthalmology/device-data              # Receive device measurements
GET    /api/ophthalmology/device-data/:visitId     # Get pending device data

# Templates
GET    /api/ophthalmology/templates                # Exam templates
POST   /api/ophthalmology/templates                # Create template
```

---

### Module 5: Clinical - Orthoptics

#### Features
- Cover test (near and distance)
- Prism cover test measurements
- Motility assessment (versions and ductions)
- Convergence testing (NPC, PPC)
- Accommodation testing
- Stereopsis (TNO, Titmus, Lang)
- Fusion assessment
- Sensory testing
- Pediatric vision screening protocols
- Quick panel for common findings
- Integration with main ophthalmology exam

#### API Endpoints
```
GET    /api/orthoptics/exams                # List orthoptic exams
GET    /api/orthoptics/exams/:id            # Get exam
POST   /api/orthoptics/exams                # Create exam
PUT    /api/orthoptics/exams/:id            # Update exam
GET    /api/orthoptics/patients/:id/history # Orthoptic history
```

---

### Module 6: Clinical - Surgery

#### Features
- Surgery scheduling and OR management
- Pre-operative checklist and consent
- Surgery templates (cataract, glaucoma, strabismus, etc.)
- Equipment and supply management
- Surgeon and anesthesiologist assignment
- Surgery notes with templates
- Post-operative follow-up tracking
- Complication documentation
- Surgeon performance analytics

#### API Endpoints
```
GET    /api/surgery/cases                   # List surgeries
GET    /api/surgery/cases/:id               # Get surgery details
POST   /api/surgery/cases                   # Schedule surgery
PUT    /api/surgery/cases/:id               # Update surgery
POST   /api/surgery/cases/:id/checklist     # Complete checklist item
POST   /api/surgery/cases/:id/start         # Start surgery
POST   /api/surgery/cases/:id/complete      # Complete surgery
POST   /api/surgery/cases/:id/notes         # Add operative notes
GET    /api/surgery/schedule                # OR schedule
GET    /api/surgery/templates               # Surgery templates
GET    /api/surgery/analytics               # Surgeon stats
```

---

### Module 7: Clinical - IVT (Intravitreal Injections)

#### Features
- Protocol management (anti-VEGF, steroids)
- Consent documentation
- Pre-injection IOP and VA recording
- Injection documentation (drug, dose, eye, batch)
- Post-injection IOP monitoring
- Complication tracking
- Cumulative dose tracking per eye
- Treatment interval enforcement
- Re-treatment criteria evaluation
- Patient notification for next injection

#### API Endpoints
```
GET    /api/ivt/injections                  # List injections
GET    /api/ivt/injections/:id              # Get injection details
POST   /api/ivt/injections                  # Record injection
PUT    /api/ivt/injections/:id              # Update injection
GET    /api/ivt/patients/:id/history        # Patient IVT history
GET    /api/ivt/protocols                   # Available protocols
POST   /api/ivt/protocols                   # Create protocol
GET    /api/ivt/vials                       # Active vials
POST   /api/ivt/vials                       # Register new vial
PUT    /api/ivt/vials/:id/use               # Record vial use
```

---

### Module 8: Pharmacy

#### Features
- French drug database with ATC classification
- Inventory management with batch/lot tracking
- Expiry date monitoring with alerts
- Cold chain tracking for sensitive medications
- Controlled substance logging
- Drug interaction checking
- Prescription dispensing workflow
- Partial dispensing support
- Auto-reorder generation
- Cross-clinic stock transfers
- Patient medication history
- Adherence tracking

#### API Endpoints
```
# Inventory
GET    /api/pharmacy/inventory              # Stock list
POST   /api/pharmacy/inventory/receive      # Receive stock
POST   /api/pharmacy/inventory/adjust       # Stock adjustment
POST   /api/pharmacy/inventory/transfer     # Inter-clinic transfer
GET    /api/pharmacy/inventory/expiring     # Expiring soon
GET    /api/pharmacy/inventory/low-stock    # Below reorder level

# Dispensing
GET    /api/pharmacy/prescriptions          # Pending prescriptions
POST   /api/pharmacy/dispense               # Dispense medication
GET    /api/pharmacy/dispensing/:id         # Dispensing record

# Drug Database
GET    /api/pharmacy/drugs                  # Search drugs
GET    /api/pharmacy/drugs/:id              # Drug details
POST   /api/pharmacy/drugs/interactions     # Check interactions

# Patient
GET    /api/pharmacy/patients/:id/medications    # Active medications
GET    /api/pharmacy/patients/:id/history        # Dispensing history
```

---

### Module 9: Laboratory

#### Features
- Test catalog management
- Lab order creation from clinical workflow
- Specimen collection and tracking
- Sample barcode generation
- LIS integration (HL7 messaging)
- Result entry with reference ranges
- Critical value alerts
- Auto-verification rules (Westgard)
- Result review and validation workflow
- Result reporting to ordering physician
- Reagent inventory management
- QC log maintenance

#### API Endpoints
```
# Orders
GET    /api/lab/orders                      # List orders
GET    /api/lab/orders/:id                  # Order details
POST   /api/lab/orders                      # Create order
PUT    /api/lab/orders/:id/collect          # Record collection
PUT    /api/lab/orders/:id/receive          # Receive in lab

# Results
POST   /api/lab/results                     # Enter results
PUT    /api/lab/results/:id/validate        # Validate results
GET    /api/lab/results/:orderId            # Get results for order

# Catalog
GET    /api/lab/tests                       # Test catalog
POST   /api/lab/tests                       # Add test
PUT    /api/lab/tests/:id                   # Update test

# QC
POST   /api/lab/qc                          # Log QC result
GET    /api/lab/qc/report                   # QC report

# LIS
POST   /api/lab/lis/receive                 # Receive from LIS
```

---

### Module 10: Optical Shop

#### Features
- Frame inventory with consignment (depot) support
- Lens catalog with specifications
- Contact lens inventory
- Glasses order workflow
- Prescription interpretation
- Lab dispatch for external processing
- Quality control on receipt
- Try-on photo capture
- Repair management
- Warranty tracking
- Patient fitting history

#### API Endpoints
```
# Frames
GET    /api/optical/frames                  # Frame inventory
POST   /api/optical/frames                  # Add frame
PUT    /api/optical/frames/:id              # Update frame
GET    /api/optical/frames/search           # Search frames

# Lenses
GET    /api/optical/lenses                  # Lens catalog
POST   /api/optical/lenses                  # Add lens type

# Contact Lenses
GET    /api/optical/contacts                # Contact lens inventory
POST   /api/optical/contacts                # Add contacts

# Orders
GET    /api/optical/orders                  # Glasses orders
GET    /api/optical/orders/:id              # Order details
POST   /api/optical/orders                  # Create order
PUT    /api/optical/orders/:id/status       # Update status
POST   /api/optical/orders/:id/dispatch     # Send to lab
POST   /api/optical/orders/:id/receive      # Receive from lab
POST   /api/optical/orders/:id/deliver      # Mark delivered

# Repairs
GET    /api/optical/repairs                 # Repair list
POST   /api/optical/repairs                 # Create repair order
PUT    /api/optical/repairs/:id             # Update repair

# Try-on
POST   /api/optical/try-on                  # Save try-on photo
GET    /api/optical/patients/:id/try-ons    # Patient's try-on photos
```

---

### Module 11: Billing & Invoicing

#### Features
- Fee schedule management per clinic and convention
- Service-based pricing with categories
- Automatic invoice generation from visits
- Convention/insurance billing with coverage calculation
- Split billing (patient share vs company share)
- Prior authorization (approval) workflow
- Multiple payment methods including mobile money
- Multi-currency support (CDF, USD, EUR)
- Exchange rate management
- Partial payments
- Payment plans (tracking only)
- Receipt generation
- Invoice PDF export
- Revenue reporting
- Accounts receivable aging

#### API Endpoints
```
# Fee Schedules
GET    /api/fee-schedules                   # List fee schedules
POST   /api/fee-schedules                   # Create fee schedule
PUT    /api/fee-schedules/:id               # Update fee schedule
POST   /api/fee-schedules/copy-to-clinic    # Copy to another clinic

# Invoices
GET    /api/invoices                        # List invoices
GET    /api/invoices/:id                    # Invoice details
POST   /api/invoices                        # Create invoice
PUT    /api/invoices/:id                    # Update invoice
POST   /api/invoices/:id/finalize           # Finalize invoice
DELETE /api/invoices/:id                    # Cancel invoice
GET    /api/invoices/:id/pdf                # Generate PDF

# Payments
POST   /api/invoices/:id/payment            # Record payment
GET    /api/invoices/:id/payments           # Payment history

# Convention Billing
POST   /api/invoices/convention-batch       # Generate convention invoice batch
GET    /api/invoices/convention-summary     # Summary by convention

# Approvals
GET    /api/approvals                       # List approval requests
POST   /api/approvals                       # Create approval request
PUT    /api/approvals/:id/approve           # Approve request
PUT    /api/approvals/:id/reject            # Reject request

# Reports
GET    /api/billing/revenue                 # Revenue report
GET    /api/billing/aging                   # AR aging report
GET    /api/billing/collection              # Collection report
```

---

### Module 12: Device Integration

#### Features
- Network device discovery (SMB shares)
- Device configuration management
- File polling for new exports
- Automatic patient matching
- DICOM file parsing
- Multiple device adapters:
  - OCT (Zeiss, Topcon, Heidelberg)
  - Autorefractor/Keratometer
  - Tonometer (NCT, Goldmann)
  - Visual field analyzer
  - Fundus camera
  - Specular microscope
  - Biometer (IOL Master)
- Real-time sync notifications
- Manual import fallback
- Device image viewer

#### API Endpoints
```
# Devices
GET    /api/devices                         # List devices
POST   /api/devices                         # Add device
PUT    /api/devices/:id                     # Update device
DELETE /api/devices/:id                     # Remove device
POST   /api/devices/:id/test                # Test connection

# Discovery
POST   /api/devices/discover                # Scan network
GET    /api/devices/discovered              # Discovered shares

# Sync
GET    /api/devices/auto-sync/status        # Sync status
POST   /api/devices/sync/:id                # Manual sync trigger
GET    /api/devices/sync-queue              # Pending syncs

# Images
GET    /api/devices/images                  # List device images
GET    /api/devices/images/:id              # Get image
POST   /api/devices/images/:id/assign       # Assign to patient
```

#### Device Adapter Interface
```javascript
class DeviceAdapter {
  constructor(config) {
    this.deviceType = config.type;
    this.connectionConfig = config.connection;
  }

  async connect() { /* Establish connection */ }
  async disconnect() { /* Close connection */ }
  async listFiles(since) { /* Get new files */ }
  async parseFile(filePath) { /* Parse device output */ }
  async extractPatientId(data) { /* Get patient identifier */ }
  async transformData(rawData) { /* Convert to standard format */ }
}
```

---

### Module 13: Documents & Prescriptions

#### Features
- Multiple document types:
  - Optical prescription (lunettes)
  - Medical prescription (médicaments)
  - Contact lens prescription
  - Fiche Ophta (exam summary)
  - Medical certificate
  - Referral letter
  - Consent forms
  - Custom letters
- Template-based generation
- Variable substitution from patient/exam data
- PDF generation with clinic branding
- Digital signature
- Document versioning
- Print and email delivery

#### API Endpoints
```
# Prescriptions
GET    /api/prescriptions                   # List prescriptions
GET    /api/prescriptions/:id               # Get prescription
POST   /api/prescriptions                   # Create prescription
PUT    /api/prescriptions/:id               # Update prescription
POST   /api/prescriptions/:id/sign          # Sign prescription
GET    /api/prescriptions/:id/pdf           # Generate PDF

# Documents
GET    /api/documents                       # List documents
GET    /api/documents/:id                   # Get document
POST   /api/documents                       # Create document
GET    /api/documents/:id/pdf               # Generate PDF
POST   /api/documents/:id/email             # Email document

# Templates
GET    /api/templates/documents             # Document templates
POST   /api/templates/documents             # Create template
PUT    /api/templates/documents/:id         # Update template
```

---

### Module 14: Analytics & Reporting

#### Features
- Dashboard with KPIs
- Patient volume trends
- Revenue analytics
- Provider productivity
- Wait time analytics
- Clinical outcome tracking:
  - IOP trends over time
  - Visual acuity progression
  - Surgical outcomes
  - IVT response rates
- Inventory turnover
- Convention billing analysis
- Custom report builder
- Data export (CSV, Excel)

#### API Endpoints
```
GET    /api/analytics/dashboard             # Dashboard KPIs
GET    /api/analytics/patients/volume       # Patient volume trends
GET    /api/analytics/revenue               # Revenue breakdown
GET    /api/analytics/providers             # Provider productivity
GET    /api/analytics/queue/wait-times      # Wait time analysis
GET    /api/analytics/clinical/iop-trends   # IOP trends
GET    /api/analytics/clinical/va-trends    # VA trends
GET    /api/analytics/clinical/surgery      # Surgery outcomes
GET    /api/analytics/inventory             # Inventory analytics
GET    /api/analytics/conventions           # Convention analysis
POST   /api/analytics/export                # Export data
```

---

## StudioVision UI System

### Color-Coded Section Design
```css
/* StudioVision Clinical Interface Colors */
:root {
  /* Refraction - Rose/Pink */
  --sv-refraction: #FCE4EC;
  --sv-refraction-border: #F48FB1;
  --sv-refraction-text: #880E4F;

  /* IOP/Tonometry - Green */
  --sv-iop: #E8F5E9;
  --sv-iop-border: #81C784;
  --sv-iop-text: #1B5E20;

  /* Diagnostics/Imaging - Yellow */
  --sv-diagnostic: #FFFDE7;
  --sv-diagnostic-border: #FFD54F;
  --sv-diagnostic-text: #F57F17;

  /* Alerts/Important - Red */
  --sv-alert: #FFEBEE;
  --sv-alert-border: #EF5350;
  --sv-alert-text: #B71C1C;

  /* Patient Info - Blue */
  --sv-patient: #E3F2FD;
  --sv-patient-border: #64B5F6;
  --sv-patient-text: #0D47A1;

  /* Prescriptions - Purple */
  --sv-prescription: #F3E5F5;
  --sv-prescription-border: #BA68C8;
  --sv-prescription-text: #4A148C;

  /* Anterior Segment - Cyan */
  --sv-anterior: #E0F7FA;
  --sv-anterior-border: #4DD0E1;
  --sv-anterior-text: #006064;

  /* Posterior Segment - Amber */
  --sv-posterior: #FFF8E1;
  --sv-posterior-border: #FFD54F;
  --sv-posterior-text: #FF6F00;
}
```

### Component Architecture
```
StudioVisionConsultation/
├── StudioVisionHeader.jsx           # Patient banner with photo, alerts
├── StudioVisionTabNavigation.jsx    # Color-coded tab navigation
├── PatientCompactDashboard.jsx      # 3-column patient summary
├── Tabs/
│   ├── RefracteurTab.jsx            # Refraction entry (pink)
│   ├── TonometrieTab.jsx            # IOP entry (green)
│   ├── SegmentAnteriorTab.jsx       # Anterior segment (cyan)
│   ├── SegmentPosteriorTab.jsx      # Posterior segment (amber)
│   ├── DiagnosticsTab.jsx           # Diagnoses (yellow)
│   └── TraitementTab.jsx            # Treatment plan (purple)
├── Panels/
│   ├── DeviceDataBanner.jsx         # Device sync status
│   ├── QuickActionsBar.jsx          # Common actions
│   ├── RenouvellementButtons.jsx    # Copy from previous
│   └── OrthoptieQuickPanel.jsx      # Orthoptic quick entry
├── Inputs/
│   ├── VisualAcuityInput.jsx        # Monoyer/Parinaud selector
│   ├── RefractionInput.jsx          # Sphere/cyl/axis/add
│   ├── IOPInput.jsx                 # IOP with method
│   ├── DiagnosisSelector.jsx        # ICD-10 picker
│   └── EyeSelector.jsx              # OD/OS/OU toggle
└── Outputs/
    ├── ExamSummaryCard.jsx          # Compact exam summary
    ├── TrendChart.jsx               # IOP/VA trend visualization
    └── FicheOphtaPreview.jsx        # Document preview
```

### Component Props Pattern
```jsx
// Color-coded CompactCard component
<CompactCard
  variant="refraction"  // or: iop, diagnostic, alert, patient, prescription
  title="Réfraction"
  icon={<Eye />}
  collapsible={true}
  defaultExpanded={true}
>
  <RefractionInput
    eye="OD"
    value={examData.refraction.OD}
    onChange={(val) => updateExam('refraction.OD', val)}
    showAutorefraction={true}
    autorefractionData={deviceData.autorefraction?.OD}
  />
</CompactCard>
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
1. Project setup (Vite, Express, MongoDB, Redis)
2. Authentication system with JWT + 2FA
3. User management and RBAC
4. Clinic model and multi-clinic context
5. Basic middleware (auth, error handling, validation)
6. API response standardization
7. Structured logging setup
8. Database connection with indexes

### Phase 2: Core Patient Flow (Weeks 3-4)
1. Patient model with PHI encryption
2. Patient CRUD operations
3. Patient search and filtering
4. Appointment scheduling
5. Queue management
6. Real-time WebSocket integration
7. Basic dashboard

### Phase 3: Clinical - Ophthalmology (Weeks 5-7)
1. Visit model and workflow
2. OphthalmologyExam model (complete)
3. StudioVision UI framework
4. Visual acuity components (Monoyer/Parinaud)
5. Refraction entry interface
6. IOP recording
7. Anterior/posterior segment exams
8. Diagnosis coding (ICD-10)
9. Treatment plan builder
10. Exam signing and Fiche Ophta generation

### Phase 4: Additional Clinical (Weeks 8-9)
1. Orthoptics module
2. Surgery module
3. IVT module
4. Clinical templates system

### Phase 5: Pharmacy & Inventory (Weeks 10-11)
1. UnifiedInventory model
2. Pharmacy inventory management
3. Drug database (French)
4. Prescription dispensing workflow
5. Drug interaction checking
6. Stock movements and transfers
7. Expiry tracking
8. Reorder alerts

### Phase 6: Laboratory (Week 12)
1. Test catalog
2. Lab order workflow
3. Result entry and validation
4. Critical value alerts
5. Basic LIS integration structure

### Phase 7: Optical Shop (Week 13)
1. Frame inventory (including depot)
2. Lens catalog
3. Glasses order workflow
4. External lab dispatch
5. Repair management

### Phase 8: Billing (Weeks 14-15)
1. Fee schedule management
2. Invoice generation
3. Convention billing logic
4. Prior authorization workflow
5. Payment recording (multi-method)
6. Multi-currency handling
7. Receipt/invoice PDF generation
8. Financial reporting

### Phase 9: Device Integration (Weeks 16-17)
1. Device configuration system
2. SMB2 share discovery and connection
3. File polling service
4. Device adapters (OCT, autorefractor, tonometer)
5. Patient matching logic
6. Real-time sync notifications
7. Device image viewer

### Phase 10: Documents & Analytics (Week 18)
1. Document template system
2. PDF generation for all document types
3. Analytics dashboard
4. Clinical trend charts
5. Financial reports
6. Export functionality

### Phase 11: AI Services (Week 19)
1. Face recognition service (Python/FastAPI)
2. Duplicate detection integration
3. Kiosk check-in with face ID
4. OCR service for legacy records (optional)

### Phase 12: Polish & Security (Week 20)
1. Audit logging completion
2. PHI encryption verification
3. Rate limiting tuning
4. Security audit
5. Performance optimization
6. Comprehensive testing
7. Documentation

---

## Security Implementation

### PHI Encryption
```javascript
// utils/phiEncryption.js
const crypto = require('crypto');

const algorithm = 'aes-256-gcm';
const keyId = process.env.PHI_KEY_ID || 'v1';

function getKey() {
  const key = process.env[`PHI_ENCRYPTION_KEY_${keyId}`];
  if (!key) throw new Error('PHI encryption key not configured');
  return Buffer.from(key, 'hex');
}

function encrypt(text) {
  if (!text) return text;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${keyId}:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText) {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
  const [storedKeyId, ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const key = process.env[`PHI_ENCRYPTION_KEY_${storedKeyId}`];
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key, 'hex'), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Mongoose plugin for automatic encryption
function phiEncryptionPlugin(schema, options) {
  const encryptedFields = options.fields || [];

  schema.pre('save', function(next) {
    encryptedFields.forEach(field => {
      if (this.isModified(field) && this[field]) {
        this[field] = encrypt(this[field]);
      }
    });
    next();
  });

  encryptedFields.forEach(field => {
    schema.post('init', function() {
      if (this[field]) {
        this[field] = decrypt(this[field]);
      }
    });
  });
}

module.exports = { encrypt, decrypt, phiEncryptionPlugin };
```

### Audit Middleware
```javascript
// middleware/auditLogger.js
const AuditLog = require('../models/AuditLog');

const auditMiddleware = (options = {}) => {
  return async (req, res, next) => {
    const originalSend = res.send;

    res.send = async function(body) {
      // Log after response
      if (res.statusCode < 400 && options.action) {
        await AuditLog.create({
          user: req.user?._id,
          userEmail: req.user?.email,
          userRole: req.user?.role,
          action: options.action,
          resource: options.resource,
          resourceId: req.params.id || JSON.parse(body)?.data?._id,
          clinic: req.user?.currentClinicId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          phiAccessed: options.phiAccessed || false,
          patientId: req.params.patientId || req.body?.patient
        });
      }
      return originalSend.call(this, body);
    };

    next();
  };
};

// Usage in routes
router.get('/patients/:id',
  auth,
  auditMiddleware({ action: 'READ', resource: 'patient', phiAccessed: true }),
  patientController.getPatient
);
```

### Rate Limiting Configuration
```javascript
// middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

const createLimiter = (options) => rateLimit({
  store: new RedisStore({ client: redisClient }),
  ...options,
  message: { success: false, message: 'Trop de requêtes. Veuillez patienter.' }
});

const limiters = {
  // Strict for auth endpoints
  auth: createLimiter({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 10,                   // 10 attempts
    skipSuccessfulRequests: true
  }),

  // Standard for API
  api: createLimiter({
    windowMs: 60 * 1000,       // 1 minute
    max: 100                   // 100 requests
  }),

  // Relaxed for static
  static: createLimiter({
    windowMs: 60 * 1000,
    max: 500
  })
};

module.exports = limiters;
```

---

## Testing Strategy

### Backend Unit Tests (Jest)
```javascript
// tests/unit/services/patientService.test.js
describe('PatientService', () => {
  describe('createPatient', () => {
    it('should generate unique patient ID', async () => {
      const patient = await patientService.create({
        firstName: 'Jean',
        lastName: 'Dupont',
        dateOfBirth: new Date('1980-01-15'),
        gender: 'M',
        phone: '+243123456789',
        clinic: clinicId
      });

      expect(patient.patientId).toMatch(/^TOM-\d{8}-\d{4}$/);
    });

    it('should encrypt PHI fields', async () => {
      const patient = await Patient.findById(patientId).lean();
      expect(patient.phone).toMatch(/^v1:/);  // Encrypted format
    });

    it('should detect duplicate by phone', async () => {
      await expect(patientService.create({
        ...validPatientData,
        phone: existingPhone
      })).rejects.toThrow('DUPLICATE_PATIENT');
    });
  });
});
```

### API Integration Tests
```javascript
// tests/integration/api/patients.test.js
describe('Patient API', () => {
  beforeAll(async () => {
    token = await getAuthToken('doctor');
  });

  describe('GET /api/patients', () => {
    it('should return paginated patients', async () => {
      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.pagination).toHaveProperty('total');
    });

    it('should filter by clinic context', async () => {
      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${token}`);

      // All patients should belong to user's clinic
      res.body.data.forEach(patient => {
        expect(patient.clinic.toString()).toBe(userClinicId);
      });
    });
  });
});
```

### E2E Tests (Playwright)
```javascript
// tests/e2e/patient-registration.spec.js
import { test, expect } from '@playwright/test';

test.describe('Patient Registration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsReceptionist(page);
  });

  test('should register new patient', async ({ page }) => {
    await page.click('[data-testid="new-patient-btn"]');

    await page.fill('[name="firstName"]', 'Marie');
    await page.fill('[name="lastName"]', 'Mukendi');
    await page.fill('[name="dateOfBirth"]', '1985-03-20');
    await page.selectOption('[name="gender"]', 'F');
    await page.fill('[name="phone"]', '+243812345678');

    await page.click('[data-testid="submit-patient"]');

    await expect(page.locator('.toast-success')).toContainText('Patient enregistré');
    await expect(page.locator('[data-testid="patient-id"]')).toContainText(/TOM-\d{8}-\d{4}/);
  });

  test('should detect duplicate patient', async ({ page }) => {
    await page.click('[data-testid="new-patient-btn"]');

    // Enter existing patient's phone
    await page.fill('[name="phone"]', existingPatientPhone);
    await page.blur('[name="phone"]');

    await expect(page.locator('.duplicate-warning')).toBeVisible();
    await expect(page.locator('.duplicate-warning')).toContainText('Patient similaire trouvé');
  });
});
```

---

## Environment Configuration

### Backend .env
```env
# Server
NODE_ENV=development
PORT=5001

# MongoDB
MONGODB_URI=mongodb://localhost:27017/medflow

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-256-bit-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# PHI Encryption (generate with: openssl rand -hex 32)
PHI_KEY_ID=v1
PHI_ENCRYPTION_KEY_v1=your-256-bit-encryption-key

# 2FA
TWO_FACTOR_ISSUER=MedFlow

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@example.com
SMTP_PASS=your-smtp-password

# SMS (optional)
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Face Recognition Service
FACE_SERVICE_URL=http://localhost:8000

# File Storage
UPLOAD_PATH=/var/medflow/uploads
MAX_FILE_SIZE=10485760

# Exchange Rates API (for multi-currency)
EXCHANGE_API_KEY=your-api-key
```

### Frontend .env
```env
VITE_API_URL=http://localhost:5001/api
VITE_WS_URL=http://localhost:5001
VITE_SENTRY_DSN=your-sentry-dsn
VITE_APP_VERSION=1.0.0
```

---

## Deployment Configuration

### Docker Compose
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "5001:5001"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/medflow
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis
    volumes:
      - uploads:/var/medflow/uploads

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

  mongo:
    image: mongo:6
    volumes:
      - mongodb_data:/data/db
    ports:
      - "27017:27017"

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  face-service:
    build: ./face-service
    ports:
      - "8000:8000"
    volumes:
      - face_data:/app/data

volumes:
  mongodb_data:
  redis_data:
  uploads:
  face_data:
```

---

## Key French Medical Terms Reference

```
Acuité visuelle = Visual acuity
Réfraction = Refraction
Tension oculaire / PIO = Intraocular pressure (IOP)
Segment antérieur = Anterior segment
Segment postérieur = Posterior segment
Fond d'oeil = Fundus examination
Lampe à fente = Slit lamp
Cornée = Cornea
Conjonctive = Conjunctiva
Iris = Iris
Cristallin = Lens (crystalline)
Rétine = Retina
Nerf optique = Optic nerve
Macula = Macula
Papille = Optic disc
Vitré = Vitreous
Paupières = Eyelids
Cataracte = Cataract
Glaucome = Glaucoma
DMLA = AMD (Age-related macular degeneration)
Rétinopathie diabétique = Diabetic retinopathy
Ordonnance = Prescription
Lunettes = Glasses/Spectacles
Lentilles = Contact lenses
Collyre = Eye drops
Pommade = Ointment
Œil droit (OD) = Right eye
Œil gauche (OS) = Left eye
Les deux yeux (OU) = Both eyes
Trou sténopéique = Pinhole
Compte les doigts (CLD) = Counts fingers
Voit bouger la main (VBLM) = Hand motion
Perception lumineuse (PL) = Light perception
```

---

## Summary

This prompt defines the complete MedFlow ophthalmology EMR system with:

1. **Technical Stack**: React 19 + Vite frontend, Node.js/Express backend, MongoDB, Redis
2. **83+ Database Models** with comprehensive schemas
3. **77+ API Route Groups** with full CRUD operations
4. **14 Major Modules**: Auth, Patients, Appointments, Queue, Ophthalmology, Orthoptics, Surgery, IVT, Pharmacy, Lab, Optical, Billing, Devices, Analytics
5. **StudioVision UI System** with color-coded clinical interface
6. **Multi-clinic Architecture** with complete data isolation
7. **Security**: JWT auth, 2FA, PHI encryption, audit logging, RBAC
8. **French Medical Standards**: Monoyer/Parinaud scales, French terminology
9. **Congo/DRC Context**: CDF/USD/EUR currencies, French language
10. **AI Services**: Face recognition, OCR
11. **Device Integration**: SMB2, DICOM, device adapters
12. **20-Week Implementation Plan**

Build this system following the patterns, schemas, and specifications provided, ensuring all user-facing content is in French and medical data follows French ophthalmology conventions.
