# External Integrations

**Analysis Date:** 2026-01-13

## Database Services

**MongoDB:**
- Purpose: Primary data store for all application data
- Version: MongoDB 6.0+
- Connection: `backend/config/db.js`
- ODM: Mongoose 7.5.0
- Features:
  - Replica set support for production
  - Connection pooling
  - Automatic reconnection
  - Soft delete patterns across all models

**Redis:**
- Purpose: Caching, sessions, rate limiting, pub/sub
- Version: Redis 7-alpine
- Connection: `backend/config/redis.js`
- Features:
  - Circuit breaker pattern for resilience
  - Graceful fallback to in-memory when Redis unavailable
  - Session storage
  - Rate limiter backend
  - 2FA code storage with replay protection
  - Pub/sub for WebSocket coordination

## Authentication & Security

**JWT (JSON Web Tokens):**
- Library: jsonwebtoken 9.0.2
- Implementation: `backend/middleware/auth.js`
- Features:
  - Access tokens (short-lived)
  - Refresh tokens (longer-lived)
  - Clinic context embedded in claims
  - Token rotation on refresh

**2FA (Two-Factor Authentication):**
- Library: speakeasy 2.0.0
- Implementation: `backend/config/redis.js` (2FA store)
- Features:
  - TOTP (Time-based One-Time Password)
  - QR code generation for authenticator apps
  - Replay attack prevention (used token tracking)

**Password Hashing:**
- Library: bcryptjs 2.4.3
- Salt rounds: 10 (configurable)

## AI/ML Microservices

**Face Recognition Service:**
- Purpose: Patient identification, duplicate detection, check-in
- Technology: Python Flask + DeepFace
- Location: `face-service/`
- Endpoint: Configured via `FACE_SERVICE_URL` environment variable
- Features:
  - Face encoding generation
  - Face matching/verification
  - Similarity scoring
  - Batch processing support

**OCR Service:**
- Purpose: Legacy record digitization, document scanning
- Technology: Python FastAPI + PaddleOCR
- Location: `ocr-service/`
- Endpoint: Configured via `OCR_SERVICE_URL` environment variable
- Features:
  - Document text extraction
  - DICOM file support (pydicom)
  - Async processing via Celery
  - Multiple language support

## Device Integration

**SMB2 Network Shares:**
- Library: @marsaud/smb2 0.18.0
- Implementation: `backend/services/smb2ClientService.js`, `backend/services/smbStreamService.js`
- Purpose: Access medical device export folders on Windows shares
- Features:
  - File reading from network shares
  - File system monitoring for new exports
  - Credential management

**File System Monitoring:**
- Library: chokidar 3.6.0
- Implementation: `backend/services/patientFolderIndexer.js`
- Purpose: Watch for new device exports and files
- Features:
  - Real-time file change detection
  - Debounced processing
  - Error recovery

**DICOM Support:**
- Python library: pydicom 2.4.4 (in ocr-service)
- Purpose: Parse medical imaging files
- Features:
  - DICOM metadata extraction
  - Image data access
  - Patient information parsing

**Device Adapters:**
- Location: `backend/services/adapters/`
- Pattern: Factory pattern via `AdapterFactory`
- Supported devices:
  - OCT (Optical Coherence Tomography)
  - Autorefractor
  - Tonometer
  - Visual Field analyzers
  - Fundus cameras
  - Specular microscopes
  - Keratometers

## Healthcare Standards

**HL7 Integration:**
- Implementation: `backend/services/hl7Service.js`
- Purpose: Laboratory Information System (LIS) connectivity
- Features:
  - HL7 message parsing
  - ORU (Observation Result) handling
  - ORM (Order) message generation

**FHIR Support:**
- Implementation: `backend/services/fhirService.js`
- Purpose: Healthcare interoperability
- Features:
  - FHIR resource generation
  - Patient data export
  - Observation resources

## Real-time Communication

**WebSocket (Socket.io):**
- Server: socket.io 4.5.4
- Client: socket.io-client 4.8.1
- Implementation: `backend/services/websocketService.js`
- Features:
  - Real-time queue updates
  - Notification delivery
  - Multi-clinic room support
  - Redis pub/sub for scaling

## Document Generation

**PDF Generation:**
- Library: pdfkit 0.17.2
- Implementation: `backend/services/pdfGenerator.js`
- Features:
  - Medical prescriptions
  - Invoices and receipts
  - Clinical reports (Fiche Ophta)
  - Letters and consent forms
  - CERFA forms (French administrative)

**QR Code Generation:**
- Library: QRCode 1.5.3
- Purpose: Document verification, quick access links

**Image Processing:**
- Library: sharp 0.34.5
- Features:
  - Image resizing and optimization
  - Format conversion
  - Thumbnail generation

## Monitoring & Error Tracking

**Sentry:**
- Frontend: @sentry/react 10.26.0
- Purpose: Error tracking and performance monitoring
- Features:
  - Automatic error capture
  - Performance tracing
  - Release tracking
  - User context

**Prometheus Metrics:**
- Library: prom-client 15.1.0
- Implementation: `backend/middleware/metrics.js`
- Features:
  - HTTP request metrics
  - Custom business metrics
  - Endpoint exposure for scraping

**Winston Logging:**
- Library: winston 3.11.0
- Implementation: `backend/config/logger.js`
- Features:
  - Structured JSON logging
  - Multiple transports (console, file)
  - Log levels (error, warn, info, debug)
  - Request correlation

## Data Import/Export

**CSV Processing:**
- Library: csv-parser 3.2.0
- Purpose: Bulk data import, report exports

**XML Processing:**
- Library: xml2js 0.6.2
- Purpose: Device data parsing, external system integration

## Central Server Sync

**Central Server:**
- Location: `central-server/`
- Purpose: Multi-clinic data aggregation
- Implementation: `backend/services/centralServerClient.js`, `backend/services/dataSyncService.js`
- Features:
  - Inventory synchronization
  - Consolidated reporting
  - Cross-clinic patient lookup
  - Real-time sync via WebSocket

## Environment Configuration

**Required Environment Variables:**
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/medflow

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-jwt-secret
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Encryption
ENCRYPTION_KEY=your-encryption-key
PHI_ENCRYPTION_KEY=your-phi-key

# Microservices
FACE_SERVICE_URL=http://localhost:5001
OCR_SERVICE_URL=http://localhost:5002

# Clinic
CLINIC_ID=clinic-id
CLINIC_NAME=Clinic Name
BASE_CURRENCY=CDF

# Central Server (if applicable)
CENTRAL_SERVER_URL=http://central:3001
```

## Integration Patterns

**Service Client Pattern:**
```javascript
// backend/services/externalServiceClient.js
const axios = require('axios');
const { logger } = require('../config/logger');

class ExternalServiceClient {
  constructor() {
    this.baseUrl = process.env.EXTERNAL_SERVICE_URL;
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000
    });
  }

  async callEndpoint(data) {
    try {
      const response = await this.client.post('/endpoint', data);
      return response.data;
    } catch (error) {
      logger.error('External service error:', error);
      throw new Error('External service unavailable');
    }
  }
}

module.exports = new ExternalServiceClient();
```

**Circuit Breaker Pattern:**
```javascript
// As implemented in backend/config/redis.js
class CircuitBreaker {
  constructor(failureThreshold = 5, resetTimeout = 30000) {
    this.failureCount = 0;
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.isOpen = false;
  }

  async execute(operation) {
    if (this.isOpen) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await operation();
      this.reset();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  recordFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.open();
    }
  }

  open() {
    this.isOpen = true;
    setTimeout(() => this.halfOpen(), this.resetTimeout);
  }

  halfOpen() {
    this.isOpen = false;
    this.failureCount = 0;
  }

  reset() {
    this.failureCount = 0;
  }
}
```

---

*Integrations analysis: 2026-01-13*
*Update when external dependencies change*
