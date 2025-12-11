# MedFlow Backend Services & Integrations

> Phase 4 Documentation - 52+ Service Files

## Table of Contents

1. [Service Architecture Overview](#service-architecture-overview)
2. [Real-time Services](#real-time-services)
3. [Device Integration Services](#device-integration-services)
4. [Clinical Safety Services](#clinical-safety-services)
5. [Financial Services](#financial-services)
6. [Communication Services](#communication-services)
7. [Data Management Services](#data-management-services)
8. [External API Integrations](#external-api-integrations)
9. [Scheduled Tasks & Background Jobs](#scheduled-tasks--background-jobs)
10. [Service Dependencies](#service-dependencies)

---

## Service Architecture Overview

MedFlow uses a **singleton service pattern** where most services are instantiated once and exported as module-level instances. Services communicate via:
- Direct method calls
- Event emitters (EventEmitter pattern)
- WebSocket broadcasts
- Message queues (Redis-backed where available)

### Service Directory Structure

```
backend/services/
├── adapters/                    # Device-specific data adapters
│   ├── AdapterFactory.js        # Factory pattern for adapter selection
│   ├── BaseAdapter.js           # Abstract base adapter class
│   ├── AutorefractorAdapter.js  # Autorefractor data parsing
│   ├── BiometerAdapter.js       # IOL biometry data
│   ├── NidekAdapter.js          # NIDEK device family
│   ├── OctAdapter.js            # OCT imaging data
│   ├── SpecularMicroscopeAdapter.js
│   └── TonometryAdapter.js      # IOP measurements
├── deviceParsers/               # Raw device output parsers
│   └── nidekParser.js
├── deviceIntegration/           # Core device integration
│   └── DeviceIntegrationService.js
├── *Service.js                  # Core services
└── *Scheduler.js                # Cron-based schedulers
```

---

## Real-time Services

### WebSocketService (`websocketService.js`)

**Purpose**: Real-time communication hub for all connected clients

**Key Features**:
- JWT-authenticated connections
- Room-based message routing (user, role, department, patient)
- Message replay buffer (15-minute window, 100 messages/room)
- User-specific message buffering for offline users
- Connection health monitoring with auto-disconnect

**Rooms**:
```javascript
// Automatic room assignments on connect:
`user:${userId}`           // Personal notifications
`role:${userRole}`         // Role-based alerts (admin, doctor, pharmacist, etc.)
`department:${dept}`       // Department broadcasts

// Subscribable rooms:
`queue:updates`            // Queue status changes
`patient:${patientId}`     // Patient-specific updates
`notifications:${userId}`  // User notification stream
```

**Event Types Emitted**:
| Event | Description | Recipient |
|-------|-------------|-----------|
| `queue:update` | Queue position changes | `queue:updates` room |
| `notification:new` | User notifications | `user:{id}` room |
| `patient:updated` | Patient record changes | `patient:{id}` room |
| `appointment:updated` | Appointment changes | Global broadcast |
| `prescription:new` | New prescriptions | Pharmacist role |
| `lab:results` | Lab results ready | Provider + patient |
| `alert:critical` | Emergency alerts | All users |
| `inventory:alert` | Stock warnings | Pharmacist + admin |
| `device_sync` | Device sync status | Global broadcast |
| `lab:worklist:update` | Lab queue changes | Lab technicians |
| `lab:critical` | Critical lab values | Ordering provider |

**Statistics API**:
```javascript
websocketService.getStats()
// Returns: { activeConnections, bufferedRooms, bufferedUsers, totalMessagesEmitted, ... }
```

---

## Device Integration Services

### DeviceIntegrationService (`deviceIntegration/DeviceIntegrationService.js`)

**Purpose**: Orchestrates medical device data import via folder watching

**Integration Methods**:
1. **Export to shared folder** - File system watcher (chokidar)
2. **Direct API** - Polling external APIs
3. **DICOM export** - DICOM listener (placeholder)

**File Processing Pipeline**:
```
New file detected → Determine file type → Parse with device-specific adapter
    ↓                                              ↓
Update lastSync → Save DeviceImage/DeviceMeasurement → Match to patient
```

**Supported File Types**:
- Images: `.jpg`, `.jpeg`, `.png`, `.tiff`
- Reports: `.pdf`, `.txt`, `.csv`
- DICOM: `.dcm`

**Device-Specific Parsers**:
- `parseAutorefractorData()` - Sphere, cylinder, axis for OD/OS
- `parseTonometerData()` - IOP values in mmHg
- `parseVisualFieldData()` - MD, PSD, VFI indices

---

### SMB2ClientService (`smb2ClientService.js`)

**Purpose**: Pure JavaScript SMB2 client for Windows share access without OS mounting

**Key Features**:
- Connection pooling and caching
- File-level caching (5-minute TTL)
- Recursive directory scanning
- Polling-based change detection

**API Methods**:
```javascript
// Connection management
await smb2Client.getConnection(device)
await smb2Client.testConnection(device)
await smb2Client.closeConnection(device)

// File operations
await smb2Client.listDirectory(device, path)
await smb2Client.readFile(device, filepath)
await smb2Client.writeFile(device, filepath, data)
await smb2Client.fileExists(device, filepath)

// Scanning
await smb2Client.scanDirectoryRecursive(device, basePath, options)
await smb2Client.findNewFiles(device, basePath, lastScanDate)

// Watching (polling-based)
smb2Client.startWatching(device, basePath, intervalMs)
```

**Events Emitted**:
- `connected`, `disconnected`
- `connectionError`
- `fileAdded`, `fileRemoved`
- `watchError`

---

### AutoSyncService (`autoSyncService.js`)

**Purpose**: Main orchestrator for automatic device synchronization

**Features**:
- Scheduled polling (configurable interval, default 5 minutes)
- Event-driven file processing via webhooks
- WebSocket notifications for real-time updates
- Integration with DeviceSyncQueue for background jobs

**Sync Flow**:
```
startScheduledPolling() → cronJob every N minutes
    ↓
syncAllDevices() → For each active SMB device
    ↓
syncDevice(device) → Test connection → Find new files → Queue for processing
    ↓
DeviceSyncQueue processes files → Match to patients → Save measurements
```

**Configuration**:
```javascript
{
  pollIntervalMinutes: 5,
  enableAutoSync: true,
  maxConcurrentSyncs: 3,
  syncOnStartup: true,
  watchMountedPaths: true
}
```

**Webhook Support**:
```javascript
await autoSyncService.handleWebhook(deviceId, {
  eventType: 'file_created' | 'file_modified' | 'exam_complete' | 'folder_created',
  filePath: '/path/to/file',
  patientId: 'optional-patient-id',
  metadata: {}
})
```

---

### AdapterFactory (`adapters/AdapterFactory.js`)

**Purpose**: Factory pattern for selecting device-specific data adapters

**Adapter Registry**:
| Device Type | Adapter Class |
|-------------|---------------|
| `oct`, `optical-coherence-tomography` | OctAdapter |
| `tonometer`, `tonometry`, `iop` | TonometryAdapter |
| `auto-refractor`, `autorefractor`, `keratometer`, `ark` | AutorefractorAdapter |
| `specular-microscope`, `specular`, `endothelial` | SpecularMicroscopeAdapter |
| `biometer`, `biometry`, `iol-master`, `lenstar` | BiometerAdapter |
| `nidek`, `nidek-*` | NidekAdapter |

**Usage**:
```javascript
const adapter = AdapterFactory.getAdapter(device)
const result = await adapter.process(data, patientId, examId)
```

**Generic Adapter Fallback**: Unknown device types get a pass-through GenericAdapter that stores raw data.

---

## Clinical Safety Services

### DrugSafetyService (`drugSafetyService.js`)

**Purpose**: Comprehensive drug safety checking for prescriptions

**Features**:
- Local drug interaction database (200+ interactions)
- French drug name mappings (Congo, Belgium, France)
- Allergy cross-reactivity checking
- Contraindication checking by condition
- Age-appropriate dosing verification
- External API integration (BDPM, RxNorm, OpenFDA)

**Safety Check Functions**:
```javascript
// Individual checks
checkDrugInteractions(newDrug, currentMedications)
checkAllergies(drug, patientAllergies)
checkContraindications(drug, patientConditions)
checkAgeAppropriateness(drug, patientAge)

// Comprehensive check
runComprehensiveSafetyCheck(drug, patient, currentMedications)
// Returns: { interactions, allergies, contraindications, ageAppropriateness, overallSafety }

// External API enhanced check
await checkInteractionsWithExternalAPI(drugName, currentMedications)
```

**Severity Levels**:
- `contraindicated` - NEVER combine (e.g., sildenafil + nitrates)
- `major` - Serious interaction, requires monitoring
- `moderate` - May require dose adjustment
- `minor` - Minimal clinical significance

**French Drug Mappings** (100+ entries):
```javascript
{
  'doliprane': 'paracetamol',
  'augmentin': 'amoxicillin-clavulanate',
  'kardegic': 'aspirin',
  'glucophage': 'metformin',
  'ventoline': 'salbutamol',
  // ... 95+ more
}
```

**External APIs**:
| API | Enabled | Description |
|-----|---------|-------------|
| BDPM France | Yes | Base de Données Publique des Médicaments |
| RxNorm (NIH) | Yes | Free drug interaction API |
| OpenFDA | Yes | Adverse event database |
| DrugBank | No | Requires paid subscription |

---

### ClinicalAlertService (`clinicalAlertService.js`)

**Purpose**: Rule engine for evaluating clinical data and triggering alerts

**Alert Severities**:
| Severity | UI Treatment | Dismissable |
|----------|--------------|-------------|
| `EMERGENCY` | Blocking modal | No - requires acknowledgment with reason |
| `URGENT` | Banner, non-blocking | Yes, with reason |
| `WARNING` | Banner, non-blocking | Yes, with reason |
| `INFO` | Inline notification | Yes |

**Alert Rules (30+ rules)**:

**EMERGENCY Alerts**:
- `NPL` - No light perception detected
- `ACUTE_ANGLE_CLOSURE` - IOP > 40 + shallow AC
- `ENDOPHTHALMITIS` - Hypopion or severe inflammation post-surgery
- `RETINAL_DETACHMENT` - RD signs detected
- `CENTRAL_RETINAL_ARTERY_OCCLUSION` - Cherry red spot with sudden vision loss
- `CHEMICAL_BURN` - Chemical exposure reported

**URGENT Alerts**:
- `IOP_CRITICAL` - IOP > 30 mmHg
- `SUDDEN_VISION_LOSS` - 3+ Snellen lines lost vs previous
- `VITREOUS_HEMORRHAGE` - VH detected
- `CORNEAL_ULCER` - Active ulcer/infiltrate
- `HYPHEMA` - Blood in anterior chamber
- `DRUG_INTERACTION` - Major drug interaction detected

**WARNING Alerts**:
- `IOP_ELEVATED` - IOP 21-30 mmHg
- `RAPD_DETECTED` - Relative afferent pupillary defect
- `NARROW_ANGLE` - Shaffer 0-I or Scheie III-IV
- `CUP_DISC_HIGH` - C/D ratio > 0.7
- `MYOPIA_PROGRESSION` - > 1D progression
- `DRUG_ALLERGY_CONFLICT` - Allergy/prescription conflict

**INFO Alerts**:
- `DIABETES_SCREENING_DUE` - Diabetic patient overdue for screening
- `FOLLOW_UP_OVERDUE` - Missed scheduled follow-up
- `PRESCRIPTION_EXPIRED` - Active prescription expired
- `CONTACT_LENS_REVIEW` - Annual CL review due

**API Methods**:
```javascript
// Evaluate exam and create alerts
await clinicalAlertService.evaluateAndCreateAlerts(
  examData, patientId, examId, visitId, previousExam, patientData, userId
)

// Manage alerts
await clinicalAlertService.acknowledgeAlert(alertId, userId, reason)
await clinicalAlertService.resolveAlert(alertId, userId, resolution)
await clinicalAlertService.acknowledgeEmergencyAlert(alertId, userId, {
  reason, actionsTaken, clinicalJustification
})
```

---

## Financial Services

### CurrencyService (`currencyService.js`)

**Purpose**: Multi-currency support for Congo (CDF, USD, EUR, XAF)

**Supported Currencies**:
| Code | Name | Symbol | Decimals |
|------|------|--------|----------|
| CDF | Franc Congolais | FC | 2 |
| USD | Dollar Américain | $ | 2 |
| EUR | Euro | € | 2 |
| XAF | Franc CFA | FCFA | 0 |

**Exchange Rate Sources** (priority order):
1. exchangerate-api.com (free)
2. frankfurter.app (free)
3. fixer.io (requires API key)
4. Fallback static rates

**Key Methods**:
```javascript
// Conversion
await currencyService.convert(amount, fromCurrency, toCurrency)
// Returns: { originalAmount, convertedAmount, rate, rateDisplay }

// Multi-currency payments
await currencyService.calculateMultiCurrencyTotal(payments)
// payments: [{ amount: 100, currency: 'USD' }, { amount: 50000, currency: 'CDF' }]

// Show equivalents
await currencyService.splitAmountAcrossCurrencies(totalCDF, ['CDF', 'USD', 'EUR'])

// Parse payment string
currencyService.parsePaymentString("5000 CDF + 10 USD")
// Returns: [{ amount: 5000, currency: 'CDF' }, { amount: 10, currency: 'USD' }]
```

**Rate Caching**: 15-minute cache with automatic refresh

---

### PaymentPlanAutoChargeService (`paymentPlanAutoChargeService.js`)

**Purpose**: Automatic processing of scheduled payment plan installments

**Features**:
- Hourly scheduler for due payments
- Stored payment method charging (card, mobile money)
- Retry logic (max 3 failures then auto-disable)
- Pre-charge notifications (configurable days before)
- Audit logging

**Scheduler**:
```javascript
// Runs every hour
processAutoCharges()
  → Find active plans with autoPayment.enabled
  → Find due installments
  → Skip if attempted within 24h
  → Charge stored payment method
  → Update installment status
  → Log to AuditLog
```

**Supported Payment Methods**:
- `card` / `stripe` - Stripe PaymentMethod
- `mobile-money` / `orange-money` / `mtn-money` - Phone-based

**Notification Flow**:
```javascript
// Daily at 8 AM
sendUpcomingChargeNotifications()
  → Find plans with upcoming installments within notifyBeforeDays
  → Send notification if not already sent
  → Record reminder in plan.reminders[]
```

---

### PaymentGateway (`paymentGateway.js`)

**Purpose**: Abstract payment processing interface

**Supported Providers** (configurable):
- Stripe (cards)
- Orange Money (mobile)
- MTN Money (mobile)

---

### PDFGeneratorService (`pdfGenerator.js`)

**Purpose**: Server-side PDF generation for billing documents

**Document Types**:
| Method | Description | Size |
|--------|-------------|------|
| `generateInvoicePDF(invoice)` | Full invoice with items table | A4 |
| `generateReceiptPDF(payment, invoice, patient)` | Thermal receipt | 80mm × 140mm |
| `generateStatementPDF(patient, invoices, dateRange)` | Account statement | A4 |
| `generateClaimFormPDF(claim)` | Insurance claim | A4 |
| `generatePrescriptionPDF(prescription)` | Medication prescription | A5 |
| `generateLabResultsPDF(labResult, patient)` | Lab results report | A4 |
| `generateOphthalmologyReportPDF(exam, patient)` | Eye exam report | A4 |
| `generatePatientRecordPDF(patient, options)` | Patient demographics | A4 |
| `generateCompanyStatementPDF(company, entries, summary, dateRange)` | Company account | A4 |
| `generateBatchInvoicePDF(batchData)` | Bordereau de facturation | A4 |
| `generateAgingReportPDF(reportRows, grandTotals, asOfDate)` | Aging report | A4 landscape |
| `generatePatientListPDF(patients)` | Patient export | A4 landscape |

**Localization**: French (fr-CD locale for Congo)

---

## Communication Services

### EmailService (`emailService.js`)

**Purpose**: Transactional email sending

**Features**:
- SMTP transport (configurable)
- Template-based emails
- Queue integration (emailQueueService)

---

### EmailQueueService (`emailQueueService.js`)

**Purpose**: Queued email processing to prevent blocking

**Features**:
- Redis-backed queue (if available)
- Retry logic for failed sends
- Rate limiting

---

### SMSService (`smsService.js`)

**Purpose**: SMS notifications via provider API

**Use Cases**:
- Appointment reminders
- Queue position updates
- Lab results ready

---

### NotificationService (`notificationService.js`)

**Purpose**: Unified notification dispatch

**Channels**:
- WebSocket (real-time)
- Email (async)
- SMS (async)
- Push notifications (planned)

---

### EnhancedNotificationService (`enhancedNotificationService.js`)

**Purpose**: Advanced notification features

**Features**:
- User preferences (channel opt-in/out)
- Priority levels
- Digest mode (batch notifications)
- Notification templates

---

## Data Management Services

### BackupService (`backupService.js`)

**Purpose**: Automated MongoDB backups with encryption

**Backup Types**:
| Type | Retention | Schedule |
|------|-----------|----------|
| Daily | 30 backups | Daily |
| Monthly | 12 backups | Monthly |
| Yearly | 7 backups | Yearly |

**Features**:
- `mongodump` based backup
- Tar compression
- AES-256-GCM encryption (optional)
- SHA-256 checksum verification
- Cloud upload (S3, Azure)
- Restore functionality

**Backup Flow**:
```
createBackup(type)
  → createMongoDump()
  → compressBackup() (tar.gz)
  → encryptBackup() (if BACKUP_ENCRYPTION_KEY set)
  → verifyBackup() (checksum)
  → uploadToCloud() (if BACKUP_CLOUD_ENABLED)
  → cleanOldBackups() (retention policy)
```

**API**:
```javascript
await backupService.createBackup('daily')
await backupService.restoreBackup(backupName, { force: true })
await backupService.listBackups()
backupService.getStats()
```

---

### CacheService (`cacheService.js`)

**Purpose**: Application-level caching

**Storage**: Redis (if available) or in-memory fallback

**Cache Keys**:
- Patient lookup results
- Fee schedule data
- Exchange rates
- User permissions

---

### PaginationService (`paginationService.js`)

**Purpose**: Standardized cursor-based pagination

**Features**:
- Cursor and offset pagination
- Consistent response format
- Total count optimization

---

### SessionService (`sessionService.js`)

**Purpose**: User session management

**Features**:
- Token-based sessions
- Session storage (Redis or memory)
- Concurrent session limits
- Session invalidation

---

## External API Integrations

### FHIRService (`fhirService.js`)

**Purpose**: FHIR R4 resource generation for interoperability

**Supported Resources**:
- Patient
- Observation
- DiagnosticReport
- MedicationRequest

---

### HL7ParserService (`hl7ParserService.js`)

**Purpose**: HL7 v2.x message parsing for lab interfaces

**Message Types**:
- ADT (Admit/Discharge/Transfer)
- ORM (Order Message)
- ORU (Observation Result)

---

### LISIntegrationService (`lisIntegrationService.js`)

**Purpose**: Laboratory Information System integration

**Features**:
- Order transmission to analyzer
- Result retrieval
- Two-way communication

---

### CalendarIntegrationService (`calendarIntegrationService.js`)

**Purpose**: External calendar sync (Google, Outlook)

**Features**:
- Event synchronization
- Availability lookup
- Two-way sync

---

### CentralServerClient (`centralServerClient.js`)

**Purpose**: Multi-clinic central server communication

**Features**:
- Data synchronization
- Cross-clinic patient lookup
- Inventory transfers

---

### CloudSyncService (`cloudSyncService.js`)

**Purpose**: Cloud data backup and sync

**Features**:
- Periodic sync to cloud storage
- Conflict resolution
- Offline support

---

## Scheduled Tasks & Background Jobs

### Schedulers Overview

| Scheduler | Interval | Purpose |
|-----------|----------|---------|
| `alertScheduler.js` | Configurable | Clinical alert evaluation |
| `reminderScheduler.js` | Daily | Appointment reminders |
| `invoiceReminderScheduler.js` | Daily | Payment due reminders |
| `deviceSyncScheduler.js` | 5 minutes | Device polling |
| `reservationCleanupScheduler.js` | Hourly | Release expired pharmacy reservations |
| `calendarSyncScheduler.js` | 15 minutes | External calendar sync |
| `backupScheduler.js` | Daily | Automated backups |

### DeviceSyncQueue (`deviceSyncQueue.js`)

**Purpose**: Background job queue for device file processing

**Job Types**:
- `file_process` - Parse and import device file
- `folder_index` - Scan folder structure
- `patient_match` - Match folder to patient
- `batch_import` - Bulk file import

**Features**:
- Priority-based processing
- Retry logic
- Progress tracking

---

## Service Dependencies

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           WebSocketService                               │
│  (Real-time hub - receives events from all services)                     │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
     ┌───────────────────────────┼───────────────────────────┐
     │                           │                           │
     ▼                           ▼                           ▼
┌─────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│ AutoSyncService │   │ ClinicalAlertService│   │PaymentPlanAutoCharge│
│       │         │   │         │           │   │         │           │
│       ▼         │   │         ▼           │   │         ▼           │
│ SMB2ClientService   │ DrugSafetyService   │   │ PaymentGateway      │
│       │         │   │                     │   │                     │
│       ▼         │   └─────────────────────┘   └─────────────────────┘
│ DeviceSyncQueue │
│       │         │
│       ▼         │
│ AdapterFactory  │
│  (Adapters)     │
└─────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         External Integrations                            │
├─────────────────┬─────────────────┬─────────────────┬───────────────────┤
│ FHIRService     │ HL7ParserService│ LISIntegration  │ CalendarIntegration│
│ (FHIR R4)       │ (HL7 v2.x)      │ (Lab Systems)   │ (Google/Outlook)   │
└─────────────────┴─────────────────┴─────────────────┴───────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          Support Services                                │
├─────────────────┬─────────────────┬─────────────────┬───────────────────┤
│ BackupService   │ CacheService    │ SessionService  │ PaginationService │
│ PDFGenerator    │ CurrencyService │ EmailQueueService│ SMSService        │
└─────────────────┴─────────────────┴─────────────────┴───────────────────┘
```

---

## Service Initialization

Services are typically initialized in `server.js`:

```javascript
// Core services (auto-initialize)
const websocketService = require('./services/websocketService');
websocketService.initialize(server, corsOptions);

// Device services (lazy-loaded)
const autoSyncService = require('./services/autoSyncService');
await autoSyncService.init();
autoSyncService.startScheduledPolling();

// Payment services
const paymentPlanAutoCharge = require('./services/paymentPlanAutoChargeService');
paymentPlanAutoCharge.startScheduler();

// Backup services (if configured)
if (process.env.BACKUP_ENABLED === 'true') {
  const backupScheduler = require('./services/backupScheduler');
  backupScheduler.start();
}
```

---

## Error Handling Patterns

All services follow consistent error handling:

```javascript
try {
  // Service operation
} catch (error) {
  console.error(`[ServiceName] Operation failed:`, error.message);

  // Emit error event for monitoring
  this.emit('error', { operation: 'methodName', error: error.message });

  // Update statistics
  this.stats.errors++;

  // Re-throw or return error response
  throw error;
}
```

---

## Monitoring & Health Checks

Most services expose health check methods:

```javascript
// WebSocket
websocketService.isHealthy() // true/false
websocketService.getStats()

// SMB2 Client
smb2ClientService.getStats() // { activeConnections, cachedFiles, ... }

// Auto Sync
await autoSyncService.getStatus() // { initialized, service, queue, devices, ... }

// Backup
backupService.getStats() // { totalBackups, lastBackupTime, ... }
```

---

## Environment Variables

Key service configuration via environment:

```env
# WebSocket
WEBSOCKET_PING_INTERVAL_MS=30000
WEBSOCKET_PONG_TIMEOUT_MS=10000

# Device Sync
DEVICE_POLL_INTERVAL_MINUTES=5
MAX_CONCURRENT_SYNCS=3

# Backup
BACKUP_DIR=/var/backups/medflow
BACKUP_ENCRYPTION_KEY=your-secret-key
BACKUP_CLOUD_ENABLED=true
BACKUP_CLOUD_PROVIDER=s3

# Drug Safety APIs
BDPM_API_URL=http://localhost:3000/api
OPENFDA_API_KEY=your-api-key
DRUGBANK_API_KEY=your-api-key

# Currency
BASE_CURRENCY=CDF
FIXER_API_KEY=your-api-key

# PDF
CLINIC_NAME="Cabinet Médical"
CLINIC_ADDRESS="Kinshasa, RD Congo"
CLINIC_PHONE="+243 XXX XXX XXX"
CLINIC_LOGO_PATH=/path/to/logo.png
```

---

*Documentation generated for MedFlow EMR System - Phase 4*
