# External Integrations

**Analysis Date:** 2026-01-25

## APIs & External Services

**Payment Processing:**
- **Stripe** - Card/payment processing (optional)
  - SDK/Client: `stripe` (initialized in `backend/services/paymentGateway.js`)
  - Auth: `STRIPE_SECRET_KEY` environment variable
  - Circuit breaker: 15s timeout, 40% error threshold
  - Fallback: Mobile money or offline mode

- **Mobile Money Providers** - Orange Money, MTN Mobile Money, Wave, other providers
  - SDK/Client: Custom implementation in `backend/services/paymentGateway.js`
  - Auth: `MOBILE_MONEY_API_KEY`, `MOBILE_MONEY_SIMULATION_MODE`
  - Circuit breaker: 30s timeout, 50% error threshold
  - Simulation modes: 'full' (always succeed), 'realistic' (random outcomes), 'fail', 'off' (real API)

**Email & Notifications:**
- **Mailtrap** (Production Email Provider)
  - API: Sending API at `https://sandbox.api.mailtrap.io/api/send/{MAILTRAP_INBOX_ID}`
  - Auth: `MAILTRAP_API_TOKEN`
  - Inbox: `MAILTRAP_INBOX_ID` (4288728 in production)
  - Sender: `EMAIL_FROM` (hello@demomailtrap.co) / `EMAIL_FROM_NAME` (MedFlow)
  - Implementation: `backend/services/emailService.js`, `backend/services/emailQueueService.js`

- **Gmail/SMTP** (Legacy/Alternative)
  - Protocol: SMTP with TLS
  - Hostname: `EMAIL_HOST` (smtp.gmail.com typical)
  - Port: `EMAIL_PORT` (587)
  - Auth: `EMAIL_USER`, `EMAIL_PASS` (app-specific password for Gmail)
  - Implementation: `backend/services/emailService.js`

- **Twilio SMS** (Optional, for SMS notifications)
  - SDK: `twilio` (not yet in dependencies but supported)
  - Auth: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
  - Config: `TWILIO_PHONE_NUMBER`
  - Implementation: `backend/services/notificationFacade.js`, `backend/services/smsService.js`

**Calendar Integration:**
- **Google Calendar API**
  - SDK: `googleapis` v166.0.0
  - Auth: OAuth2 with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - Implementation: `backend/services/calendarIntegrationService.js`
  - Features: Appointment sync, availability updates, meeting scheduling
  - Fallback: In-app calendar only if Google unavailable

**Content Delivery/Mapping:**
- **Google Maps API** (Optional, for clinic location features)
  - Auth: `GOOGLE_MAPS_API_KEY`
  - Not actively used in current codebase but configured for future use

**AI/ML Integrations:**
- **OpenAI** (Optional, for text/clinical decision support)
  - Auth: `OPENAI_API_KEY`
  - Not yet integrated but infrastructure in place

## Data Storage

**Databases:**

**Primary:**
- **MongoDB** v7.5.0 (via Mongoose ODM)
  - Connection: `MONGODB_URI`
  - Local dev: `mongodb://127.0.0.1:27017/medflow`
  - Production: MongoDB Atlas at `mongodb+srv://aioxtm:***@cluster0.nyylqsu.mongodb.net/medflow?retryWrites=true&w=majority`
  - Client: Mongoose v7.5.0 with 84 models in `backend/models/`
  - Features: 84 collections, soft delete pattern, audit logging via pre/post hooks
  - Connection pooling, transaction support (when available)

**Legacy SQL Server Databases:**
- **CareVision** (Patient records legacy system)
  - Type: Microsoft SQL Server
  - Server: `CAREVISION_SQL_SERVER` (192.168.4.8 local network)
  - Database: `CAREVISION_SQL_DATABASE` (CareVisionBD20)
  - Auth: `CAREVISION_SQL_USER` (sa) / `CAREVISION_SQL_PASSWORD`
  - Client: `mssql` v12.2.0 driver
  - Enabled: `CAREVISION_SQL_ENABLED` flag
  - Implementation: `backend/services/careVisionSqlClient.js`, `backend/services/careVisionBridge.js`
  - Data sync: `backend/scripts/importCareVisionData.js`, migration services

- **Medicare/Bdpharma** (Pharmacy legacy system)
  - Type: Microsoft SQL Server
  - Server: `MEDICARE_SQL_SERVER` (192.168.4.8)
  - Database: `MEDICARE_SQL_DATABASE` (Bdpharma)
  - Auth: `MEDICARE_SQL_USER` (sa) / `MEDICARE_SQL_PASSWORD`
  - Client: `mssql` v12.2.0 driver
  - Enabled: `MEDICARE_SQL_ENABLED` flag
  - Implementation: `backend/services/medicareSqlClient.js`, `backend/services/medicareBridge.js`

**Caching & Sessions:**
- **Redis** v4.6.8 (or Upstash cloud)
  - Connection: `REDIS_URL`
  - Local dev: `redis://localhost:6379`
  - Production: Upstash at `rediss://default:ASq5AAIncDJkYWRkMTc0ZjQxNDc0ZmIyODFhM2JkY2M0NjljZTk1MHAyMTA5Mzc@glowing-horse-10937.upstash.io:6379`
  - Alternative REST API: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - Implementation: `backend/config/redis.js` with circuit breaker fallback to in-memory
  - Uses:
    - Session store: `sessionStore` (user sessions, TTL 24h default)
    - Cache: General caching with TTL
    - Rate limiting: `express-rate-limit` with Redis store
    - 2FA codes: `twoFactorStore` with replay protection
    - Token revocation: `tokenRevocationStore` for logout/password change
  - Fallback: In-memory store if Redis unavailable

**Local File Storage:**
- **Local Filesystem**
  - Upload path: `UPLOAD_PATH` (./uploads default)
  - DICOM storage: `DICOM_STORAGE_PATH` (./uploads/dicom)
  - Max image: 10 MB (10485760 bytes)
  - Max document: 20 MB
  - Max video: 100 MB
  - Supported: JPEG, PNG, GIF, BMP (images), PDF, DOC, DOCX (documents), DCM (DICOM)
  - Implementation: `backend/middleware/multer` for upload handling

**SMB2 Network Shares:**
- **SMB2 Protocol** for network file storage
  - Library: `@marsaud/smb2` v0.18.0
  - Features: File polling for device export folders, network share access
  - Implementation: `backend/services/smb2ClientService.js`, `backend/services/smbStreamService.js`
  - Use case: Device integration (OCT, visual field devices exporting to network folders)

**SQLite (Local Offline Cache):**
- **better-sqlite3** v12.6.2 - Synchronous SQLite for offline data
  - Offline sync: `frontend/src/services/database.js`
  - IndexedDB via Dexie v4.2.1 - Browser-based offline storage
  - Implementation: `frontend/src/services/syncService.js`

## Authentication & Identity

**Auth Provider:**
- **Custom JWT-based Authentication** - No external OAuth (except optional Google Calendar)
  - Access Token: `JWT_SECRET` - 15 minute expiry (configurable via `JWT_EXPIRE`)
  - Refresh Token: `REFRESH_TOKEN_SECRET` - 7-30 days (configurable via `REFRESH_TOKEN_EXPIRE`)
  - Session Secret: `SESSION_SECRET` for express-session
  - Implementation: `backend/middleware/auth.js`, `backend/controllers/authController.js`
  - Features: JWT + refresh token pattern, optional 2FA (TOTP via speakeasy), CSRF protection
  - Token revocation: Redis-backed with in-memory fallback

**Two-Factor Authentication (2FA):**
- **Speakeasy** v2.0.0 - TOTP-based 2FA
  - Code length: 6 digits
  - Code expiry: 10 minutes
  - Implementation: `backend/controllers/authController.js`, 2FA endpoints
  - Store: Redis with replay protection (marked as "used" to prevent reuse)

**OAuth/External Login (Optional):**
- **Google OAuth2** - For Google Calendar integration
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` required
  - Not for patient/user login, only calendar sync

## Monitoring & Observability

**Error Tracking:**
- **Sentry** (`@sentry/react` v10.26.0, backend integration available)
  - Frontend: Integrated in React app for error capture
  - Implementation: `frontend/src/services` - configuration available
  - Backend: `backend/services/sentryService.js` for error tracking
  - Environment variable: `SENTRY_DSN` (if configured)

**Logging:**
- **Winston** v3.11.0 - Structured logging
  - Config: `backend/config/logger.js`
  - Log level: Configurable via `LOG_LEVEL` (default: info)
  - Log path: `LOG_PATH` (./logs default)
  - Implementation: All services use Winston for structured logs
  - Audit logging: `backend/middleware/auditLogger.js`, `backend/models/AuditLog.js`

- **Morgan** v1.10.0 - HTTP request logging
  - Integration: `backend/server.js` middleware

**Metrics:**
- **Prometheus** (prom-client v15.1.0)
  - Implementation: Available in `backend/middleware/metrics.js`
  - Endpoints: Metrics exposed for Prometheus scraping
  - Supports: Request counts, latencies, errors

## CI/CD & Deployment

**Hosting:**
- **Local Windows Server** - Matrix Clinic (192.168.4.8, RDP via 100.73.34.191 mesh)
  - OS: Windows Server
  - SSH: Port 3389 (RDP) available, SSH via Tailscale
  - Backend path: E:\MedFlow\matrix-backend\backend
  - Node.js: E:\nodejs\node-v20.11.0-win-x64\node.exe
  - Auto-start: Windows Scheduled Task "MedFlow Backend"

- **Cloud Options** (configured but not active)
  - MongoDB Atlas - Cluster0 (mongodb+srv://...)
  - Upstash Redis - Serverless Redis
  - Mailtrap - Email sandbox/sending

**CI Pipeline:**
- **Not detected** - No GitHub Actions, GitLab CI, or Jenkins configured
- Manual deployment via SSH/SCP or PM2 CLI commands
- Helper script: `scripts/server-manage.sh` (bash, for local/remote server management)

**Process Management:**
- **PM2** - Production process manager
  - Config: `ecosystem.config.js` for server clustering
  - Start script: `npm start` (runs `node server.js`)
  - Dev: `npm run dev` (with nodemon auto-restart)

## Environment Configuration

**Required Environment Variables:**
- `NODE_ENV`: production/development
- `PORT`: Server port (5001 default)
- `MONGODB_URI`: Database connection
- `REDIS_URL`: Cache/session store
- `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `SESSION_SECRET`: Security keys (must be 32+ chars)
- `PHI_ENCRYPTION_KEY`: Protected health information encryption (32-byte hex)
- `ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY`, `CALENDAR_ENCRYPTION_KEY`, `LIS_ENCRYPTION_KEY`
- `CLINIC_ID`: Clinic identifier for multi-clinic context
- `CLINIC_NAME`, `CLINIC_ADDRESS`, `CLINIC_PHONE`, `CLINIC_EMAIL`, `CLINIC_TAX_ID`
- `BASE_CURRENCY`: CDF, USD, or EUR

**Secrets Location:**
- **Development**: `.env` file (git-ignored)
- **Production**: Environment variables on Windows Server, Upstash/MongoDB Atlas secrets
- **Never committed**: `.env` templates available as `.env.example`, `.env.production.template`
- Key rotation: PHI key rotation supported via `PHI_ENCRYPTION_KEY_V2`, `PHI_ENCRYPTION_KEY_V3`, `PHI_KEY_ID`

## Webhooks & Callbacks

**Incoming Webhooks:**
- **DICOM Bridge Callbacks** - Device data import notifications
  - Path: `/api/dicom/callback`
  - Auth: `DICOM_BRIDGE_CALLBACK_SECRET` (HMAC verification)
  - Implementation: `backend/routes/...` (DICOM callback handling)

- **Payment Callbacks** - Stripe, Mobile Money provider webhooks
  - Path: `/api/webhooks/payment` (route pattern)
  - Auth: Provider-specific signature verification
  - Implementation: `backend/controllers/billing/payments.js`

- **Email Service Callbacks** - Bounce, delivery status from Mailtrap (if configured)
  - Not actively implemented but supported via webhook endpoints

**Outgoing Webhooks/Events:**
- **WebSocket Events** - Real-time notifications to connected clients
  - Socket.io v4.5.4 for real-time updates
  - Implementation: `backend/services/websocketService.js`
  - Events: Appointment updates, device data arrival, system alerts
  - Broadcast: `backend/services/notificationFacade.js`

- **Email Notifications** - Patient appointments, invoices, lab results
  - Queue: Bull v4.12.2 for async email jobs
  - Implementation: `backend/services/emailQueueService.js`

- **SMS Notifications** - Via Twilio (if configured)
  - Implementation: `backend/services/smsService.js`, `backend/services/notificationFacade.js`

## Medical Device Integration

**DICOM/Medical Imaging:**
- **DICOM Protocol** - Medical image exchange standard
  - Parser: `dicom-parser` v1.8.21 for JavaScript parsing
  - Python library: `pydicom` v2.4.0 in DICOM Bridge microservice
  - Implementation: `backend/services/deviceDataIntegrationService.js`

**DICOM PACS Server Integration:**
- **Conquest DICOM Server** - Legacy imaging server
  - Server: `PACS_SERVER_HOST` (192.168.4.8)
  - Port: `PACS_SERVER_PORT` (5678)
  - AE Title: `PACS_SERVER_AE_TITLE` (CONQUESTSRV1)
  - MedFlow AE Title: `PACS_LOCAL_AE_TITLE` (MEDFLOW)
  - Local port: `PACS_LOCAL_PORT` (11112)
  - Enabled: `PACS_ENABLED` flag
  - Implementation: `backend/services/conquestPacsService.js`

**DICOM Bridge Microservice:**
- **pynetdicom** v2.0.2+ - DICOM network protocol
- **FastAPI** web service for DICOM operations
- Path: `/dicom-bridge/` directory
- Endpoint: `DICOM_BRIDGE_URL` (http://localhost:11112 default)
- Auth: `DICOM_BRIDGE_API_KEY` (32-char hex)
- Callback: `DICOM_BRIDGE_CALLBACK_SECRET` (HMAC verification)
- Features: Worklist retrieval, image import, DICOM validation
- Worklist config: `WORKLIST_DEFAULT_MODALITY` (OPT), `WORKLIST_ACCESSION_PREFIX` (MF)

**OCT & Device Auto-Import:**
- **Solix** OCT Device
  - File format: CSV/proprietary exports to SMB2 share
  - Auto-import: `backend/services/solixAutoImportService.js`
  - Parser: `backend/services/deviceParsers/solixOctParser.js`

- **Tomey** Devices (Refractor, Keratometer, etc.)
  - File format: CSV exports
  - Auto-import: `backend/services/tomeyAutoImportService.js`
  - Parser: `backend/services/deviceParsers/tomeyParser.js`

- **Visual Field** (HFA - Humphrey Field Analyzer)
  - Parser: `backend/services/deviceParsers/hfaVisualFieldParser.js`
  - Format: Proprietary HFA export

- **Other Devices** (Tonometry, Autorefraction, etc.)
  - Parsers: `backend/services/deviceParsers/acquisitionParser.js`, `backend/services/deviceParsers/tonorefParser.js`
  - File monitoring: `chokidar` v3.6.0 watches SMB2 device folders
  - Implementation: `backend/services/deviceDataIntegrationService.js` orchestrates imports

## Laboratory Integration

**LIS (Laboratory Information System):**
- **HL7 Protocol** - Healthcare standard for lab order/result exchange
  - Parser: `backend/services/hl7ParserService.js`
  - Implementation: `backend/services/lisIntegrationService.js`
  - Models: `backend/models/LISIntegration.js`, `backend/models/LabOrder.js`, `backend/models/LabResult.js`
  - Features: Order transmission, result parsing, QC validation (Westgard rules)

**Westgard QC Rules:**
- Implementation: `backend/services/westgardQCService.js`
- Validates laboratory results for accuracy

## Face Recognition Service

**DeepFace Microservice:**
- **Python service** using DeepFace library
- Location: `/face-service/` directory
- Endpoint: `FACE_SERVICE_URL` (http://127.0.0.1:5002 default)
- Features:
  - Patient photo enrollment during registration
  - Duplicate patient detection via face matching
  - Identity verification when accessing records
- Implementation: Flask-based REST API
- Libraries: OpenCV, PIL, DeepFace

## OCR Service

**Optical Character Recognition Microservice:**
- **Python service** for legacy record import
- Location: `/ocr-service/` directory
- Endpoint: `OCR_SERVICE_URL` (http://127.0.0.1:5003 default)
- Framework: FastAPI
- Libraries: Tesseract, PaddleOCR
- Features: Extract text from scanned documents, legacy record digitization
- Queue: Celery for async OCR job processing

## Central Server (Multi-Clinic Coordination)

**Central Aggregation Server:**
- Location: `/central-server/` directory
- Purpose: Aggregate data across clinic network
- Technology: Express.js, MongoDB (separate instance)
- API: REST endpoints for clinic registration, sync coordination
- Authentication: JWT-based clinic authentication
- Data models: `CentralInventory.js`, `CentralInvoice.js`, `CentralVisit.js`
- Sync: `backend/services/dataSyncService.js` handles clinic-to-central syncing

## Cloud Sync (Optional)

**Cloud API Integration:**
- **URL**: `CLOUD_API_URL` (https://cloud.medflow.cd/api or empty)
- **Auth**: `CLOUD_SYNC_TOKEN`
- **Enable**: `SYNC_ENABLED` flag
- **Interval**: `SYNC_INTERVAL_MS` (300000 ms = 5 minutes default)
- Implementation: `backend/services/cloudSyncService.js`
- Fallback: Local-only mode if cloud unavailable

## Backup & Data Integrity

**Backup Service:**
- **Location**: `BACKUP_DIR` (/var/backups/medflow default)
- **Enabled**: `BACKUP_ENABLED` flag
- **Cloud Backup**: `BACKUP_CLOUD_ENABLED`, `BACKUP_CLOUD_PROVIDER` (s3)
- **Encryption**: `BACKUP_ENCRYPTION_KEY` (separate from PHI key)
- Implementation: `backend/services/backupService.js`, `backend/services/backupScheduler.js`

---

*Integration audit: 2026-01-25*
