# MedFlow Microservices Documentation

## Overview

MedFlow uses three specialized microservices for computationally intensive or specialized tasks:

| Service | Technology | Port | Purpose |
|---------|------------|------|---------|
| Face Recognition | Python/Flask | 5002 | Patient identity verification |
| OCR Service | Python/FastAPI | 5003 | Medical document text extraction |
| Central Server | Node.js/Express | 5004 | Multi-clinic data synchronization |

---

## 1. Face Recognition Service

### Purpose

Prevents patient identity fraud by:
- Generating face encodings during registration
- Detecting duplicate patients via face matching
- Verifying patient identity before clinical sessions

### Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | Flask |
| ML Backend | DeepFace (Facenet model) |
| Image Processing | OpenCV, NumPy, PIL |
| Face Detection | OpenCV Haar Cascades |

### Endpoints

#### Health Check
```
GET /health

Response:
{
  "status": "healthy",
  "service": "face-recognition",
  "version": "2.0.0",
  "backend": "DeepFace",
  "timestamp": "2025-12-07T10:00:00Z"
}
```

#### Detect Faces
```
POST /api/face/detect

Request:
{
  "image": "base64-encoded-image"
}

Response:
{
  "success": true,
  "faceCount": 1,
  "faces": [
    {
      "left": 100, "top": 50,
      "right": 250, "bottom": 200,
      "width": 150, "height": 150
    }
  ]
}
```

#### Encode Face
```
POST /api/face/encode

Request:
{
  "image": "base64-encoded-image"
}

Response:
{
  "success": true,
  "encoding": [0.123, 0.456, ...],  // 128-dim Facenet vector
  "faceLocation": {
    "top": 50, "right": 250, "bottom": 200, "left": 100
  }
}
```

#### Verify Identity
```
POST /api/face/verify

Request:
{
  "liveImage": "base64-encoded-webcam-capture",
  "storedEncoding": [0.123, 0.456, ...],
  "patientId": "patient-id",
  "tolerance": 0.4  // optional, default 0.4
}

Response:
{
  "success": true,
  "verified": true,
  "confidence": 0.92,
  "distance": 0.08,
  "patientId": "patient-id",
  "message": "Identity verified successfully"
}
```

#### Batch Compare (Duplicate Detection)
```
POST /api/face/batch-compare

Request:
{
  "image": "base64-encoded-new-patient-photo",
  "tolerance": 0.4,
  "existingPatients": [
    {
      "patientId": "P001",
      "name": "Jean Dupont",
      "dateOfBirth": "1985-03-15",
      "encoding": [0.123, ...]
    }
  ]
}

Response:
{
  "success": true,
  "newEncoding": [0.789, ...],
  "potentialDuplicates": [
    {
      "patientId": "P001",
      "name": "Jean Dupont",
      "distance": 0.12,
      "confidence": 0.88,
      "isDefiniteMatch": true,
      "matchLevel": "high"
    }
  ],
  "hasDefiniteDuplicates": true,
  "duplicateCount": 1
}
```

### Configuration

```bash
# Environment Variables
FACE_SERVICE_PORT=5002
FACE_MATCH_THRESHOLD=0.4      # Lower = more strict
MAX_IMAGE_SIZE=10485760       # 10MB
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
FLASK_DEBUG=false
SKIP_MODEL_WARMUP=false       # Set true for faster dev restarts
```

### Model Details

- **Model**: Facenet (Google's facial recognition)
- **Embedding Dimension**: 128
- **Distance Metric**: Cosine distance
- **Default Threshold**: 0.4 (60% similarity required)

### Match Levels

| Distance | Level | Action |
|----------|-------|--------|
| 0 - 0.28 | High | Very likely duplicate |
| 0.28 - 0.4 | Medium | Probable duplicate |
| 0.4 - 0.6 | Low | Review recommended |
| > 0.6 | None | Different person |

### Startup Process

```python
# On startup (production):
1. Initialize Flask app
2. Load DeepFace module (lazy)
3. Warm up Facenet model (10-30 seconds)
4. Ready to accept requests

# On startup (development with SKIP_MODEL_WARMUP=true):
1. Initialize Flask app
2. Skip model warmup
3. First request triggers model load
```

### Error Handling

| Error | Response |
|-------|----------|
| No face detected | 400 - "No face detected in the image" |
| Multiple faces | 400 - "Multiple faces detected" |
| Invalid image | 400 - "Invalid image data" |
| Image too large | 413 - "Image too large" |

---

## 2. OCR Service

### Purpose

Extracts text and patient information from medical imaging files:
- Device export files (ZEISS, Solix, TOMEY)
- DICOM files
- PDF reports
- Scanned documents

### Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | FastAPI (Python) |
| OCR Engine | PaddleOCR |
| PDF Processing | PyMuPDF (fitz) |
| DICOM Parsing | pydicom |
| Task Queue | Celery + Redis |

### Endpoints

#### Health Check
```
GET /health

Response:
{
  "status": "healthy",
  "version": "1.0.0",
  "redis_connected": true,
  "ocr_ready": true,
  "network_shares": {
    "zeiss_retino": true,
    "solix_oct": false
  }
}
```

#### List Network Shares
```
GET /api/shares

Response:
{
  "shares": [
    {
      "name": "zeiss_retino",
      "path": "//192.168.1.100/zeiss",
      "available": true
    }
  ]
}
```

#### Process Single File
```
POST /api/ocr/process

Request:
{
  "file_path": "/path/to/image.jpg",
  "device_type": "zeiss",
  "extract_thumbnail": true
}

Response:
{
  "file_path": "/path/to/image.jpg",
  "file_name": "image.jpg",
  "file_type": "image",
  "file_size": 1048576,
  "device_type": "zeiss",
  "ocr_text": "Patient: DUPONT Jean\nID: P12345...",
  "ocr_confidence": 0.92,
  "extracted_info": {
    "first_name": "Jean",
    "last_name": "DUPONT",
    "patient_id": "P12345",
    "date_of_birth": "1985-03-15",
    "laterality": "OD",
    "exam_date": "2025-12-07",
    "source": "ocr+filename"
  },
  "thumbnail_path": "/cache/thumb_abc123.jpg",
  "processing_time_ms": 450
}
```

#### Scan Folder
```
POST /api/ocr/scan-folder

Request:
{
  "folder_path": "//192.168.1.100/zeiss/exports",
  "device_type": "zeiss",
  "recursive": true,
  "since": "2025-12-01T00:00:00Z"
}

Response:
{
  "task_id": "celery-task-uuid",
  "status": "queued",
  "folder": "//192.168.1.100/zeiss/exports"
}
```

#### Get Task Status
```
GET /api/ocr/task/{task_id}

Response:
{
  "task_id": "celery-task-uuid",
  "status": "completed",
  "progress": 100,
  "total_files": 150,
  "processed_files": 150,
  "results": [...]
}
```

### Supported File Types

| Type | Extensions | Processing Method |
|------|------------|-------------------|
| Image | .jpg, .jpeg, .png, .bmp, .tiff | PaddleOCR |
| PDF | .pdf | PyMuPDF + OCR fallback |
| DICOM | .dcm, .dicom | pydicom (metadata only) |

### Device-Specific Patterns

#### ZEISS Format
```
Filename: LastName_FirstName_PatientID_DOB_Gender_Type_DateTime_Eye.jpg
Example:  DUPONT_JEAN_P12345_19850315_M_Fundus_20251207_143022_OD.jpg
```

#### Solix Format
```
Folder structure often contains patient info
Filename: PatientName_ExamType_Date.jpg
```

#### TOMEY Format
```
Filename: LastName_FirstName_*.jpg
```

### DICOM Metadata Extraction

| DICOM Tag | Extracted Field |
|-----------|-----------------|
| PatientName | first_name, last_name |
| PatientID | patient_id |
| PatientBirthDate | date_of_birth |
| PatientSex | gender |
| StudyDate | exam_date |
| Modality | exam_type |
| Laterality | laterality |

### OCR Text Patterns

```python
# Name extraction
r"(?:Patient|Nom|Name)[:\s]+([A-Z][a-z]+)\s+([A-Z][a-z]+)"

# Patient ID extraction
r"(?:ID|N°|Numéro)[:\s]*([A-Z0-9]{5,15})"

# Date extraction
r"(\d{2})/(\d{2})/(\d{4})"   # French format
r"(\d{4})-(\d{2})-(\d{2})"   # ISO format

# Laterality
r"\b(OD|OS|OU|O\.D\.|O\.S\.|O\.U\.)\b"
```

### Configuration

```bash
# Environment Variables
OCR_SERVICE_PORT=5003
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
OCR_LANG=fr               # French
OCR_USE_GPU=false
THUMBNAIL_CACHE_DIR=/tmp/ocr_thumbnails
```

### Thumbnail Sizes

```python
THUMBNAIL_SIZES = {
    "small": 320,
    "medium": 720,
    "large": 1080
}
```

---

## 3. Central Server

### Purpose

Multi-clinic data synchronization hub:
- Aggregates data from multiple clinic locations
- Cross-clinic patient search
- Consolidated inventory management
- Financial reporting across clinics
- Inventory transfer recommendations

### Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | Express.js |
| Database | MongoDB |
| Security | Helmet, CORS |
| Authentication | Clinic API tokens |

### Data Models

#### ClinicRegistry
```javascript
{
  clinicId: "KIN001",           // Unique clinic identifier
  name: "Centre Médical Kinshasa",
  shortName: "CMK",
  type: "primary",             // primary, satellite, mobile
  location: {
    city: "Kinshasa",
    province: "Kinshasa",
    country: "CD"
  },
  services: ["ophthalmology", "pharmacy", "laboratory"],
  connection: {
    lastSeenAt: Date,
    ipAddress: "203.0.113.1"
  },
  syncConfig: {
    syncEnabled: true,
    syncCollections: ["patients", "visits", "invoices", "inventory"],
    lastPushAt: Date,
    lastPullAt: Date
  },
  stats: {
    totalPatients: 5000,
    totalVisits: 15000,
    totalInvoices: 8000
  }
}
```

#### CentralPatient
```javascript
{
  _originalId: "ObjectId",     // ID from source clinic
  _sourceClinic: "KIN001",
  _syncedAt: Date,
  _deleted: false,
  firstName: "Jean",
  lastName: "DUPONT",
  nationalId: "1234567890",
  dateOfBirth: Date,
  phoneNumber: "+243123456789"
}
```

### Endpoints

#### Dashboard Summary
```
GET /api/dashboard

Response:
{
  "success": true,
  "dashboard": {
    "clinics": {
      "total": 3,
      "online": 2,
      "list": [...]
    },
    "patients": { "total": 15000 },
    "inventory": {
      "alerts": 12,
      "transferRecommendations": [...]
    },
    "financial": {
      "totalRevenue": 50000000,
      "totalPaid": 45000000,
      "invoiceCount": 8000
    }
  }
}
```

#### Sync Push (Clinic → Central)
```
POST /api/sync/push
Headers:
  Authorization: Bearer <clinic-token>
  X-Clinic-ID: KIN001

Request:
{
  "changes": [
    {
      "syncId": "uuid",
      "collection": "patients",
      "operation": "update",
      "documentId": "ObjectId",
      "data": { ... },
      "changedAt": "2025-12-07T10:00:00Z"
    }
  ]
}

Response:
{
  "success": true,
  "synced": ["uuid1", "uuid2"],
  "conflicts": [],
  "failed": []
}
```

#### Sync Pull (Central → Clinic)
```
GET /api/sync/pull?since=2025-12-01T00:00:00Z&collections=patients,visits

Response:
{
  "success": true,
  "changes": [
    {
      "collection": "patients",
      "operation": "update",
      "documentId": "ObjectId",
      "sourceClinic": "GOM001",
      "data": { ... },
      "timestamp": "2025-12-07T10:00:00Z"
    }
  ]
}
```

#### Sync Status
```
GET /api/sync/status

Response:
{
  "success": true,
  "clinic": {
    "clinicId": "KIN001",
    "name": "Centre Médical Kinshasa",
    "isOnline": true
  },
  "sync": {
    "enabled": true,
    "lastPushAt": "2025-12-07T09:55:00Z",
    "lastPullAt": "2025-12-07T09:50:00Z",
    "pendingChanges": { "patients": 5, "visits": 12 },
    "totalPending": 17
  }
}
```

#### Cross-Clinic Patient Search
```
GET /api/patients/search?q=Dupont&clinic=all

Response:
{
  "success": true,
  "patients": [
    {
      "_id": "central-id",
      "_sourceClinic": "KIN001",
      "firstName": "Jean",
      "lastName": "DUPONT",
      "clinic": { "name": "Centre Médical Kinshasa" }
    }
  ]
}
```

#### Consolidated Inventory
```
GET /api/inventory/overview

Response:
{
  "success": true,
  "inventory": {
    "pharmacy": {
      "totalItems": 500,
      "lowStock": 15,
      "outOfStock": 3
    },
    "frames": { ... },
    "contactLenses": { ... }
  }
}
```

#### Transfer Recommendations
```
GET /api/inventory/transfers

Response:
{
  "success": true,
  "recommendations": [
    {
      "item": "Latanoprost 0.005%",
      "from": { "clinic": "GOM001", "quantity": 150 },
      "to": { "clinic": "KIN001", "quantity": 5 },
      "suggestedTransfer": 50,
      "priority": "high"
    }
  ]
}
```

### Synced Collections

| Collection | Fields Synced |
|------------|---------------|
| patients | All except biometric data |
| visits | Summary data only |
| invoices | Financial totals |
| pharmacyInventory | Stock levels, alerts |
| frameInventory | Stock levels |
| contactLensInventory | Stock levels |
| reagentInventory | Stock levels |
| labConsumableInventory | Stock levels |

### Conflict Resolution

```javascript
// Conflict detected when:
// 1. Same _originalId from different clinics
// 2. Same nationalId
// 3. Same firstName + lastName + dateOfBirth

// Conflict response:
{
  "conflicts": [
    {
      "syncId": "uuid",
      "documentId": "ObjectId",
      "collection": "patients",
      "localVersion": { ... },
      "centralVersion": { ... },
      "conflictType": "cross-clinic-duplicate"
    }
  ]
}
```

### Authentication

```javascript
// Headers required for sync operations:
{
  "Authorization": "Bearer <clinic-api-token>",
  "X-Clinic-ID": "KIN001",
  "X-Sync-Token": "<per-sync-token>"  // optional
}

// Master token for admin operations:
{
  "X-Master-Token": "<admin-token>"
}
```

### Configuration

```bash
# Environment Variables
PORT=5004
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/medflow_central
ALLOWED_ORIGINS=http://localhost:5001,http://clinic1.example.com
```

### Clinic Registration Script

```bash
cd central-server
node scripts/registerClinic.js

# Interactive prompts:
# - Clinic ID (e.g., KIN001)
# - Clinic Name
# - Location
# - Services
# - API Token generation
```

---

## Service Communication

### From Main Backend

```javascript
// backend/routes/faceRecognition.js
const FACE_SERVICE = process.env.FACE_SERVICE_URL || 'http://localhost:5002';

// Verify identity
const response = await axios.post(`${FACE_SERVICE}/api/face/verify`, {
  liveImage: base64Image,
  storedEncoding: patient.biometric.faceEncoding,
  patientId: patient._id
});

// backend/controllers/ocrImportController.js
const OCR_SERVICE = process.env.OCR_SERVICE_URL || 'http://localhost:5003';

// Process file
const result = await axios.post(`${OCR_SERVICE}/api/ocr/process`, {
  file_path: filePath,
  device_type: deviceType
});
```

### To Central Server

```javascript
// backend/services/cloudSyncService.js
const CENTRAL_URL = process.env.CENTRAL_SERVER_URL;

// Push changes
await axios.post(`${CENTRAL_URL}/api/sync/push`, {
  changes: pendingChanges
}, {
  headers: {
    'Authorization': `Bearer ${clinicToken}`,
    'X-Clinic-ID': clinicId
  }
});
```

---

## Deployment

### Docker Compose (Development)

```yaml
version: '3.8'

services:
  face-service:
    build: ./face-service
    ports:
      - "5002:5002"
    environment:
      - FACE_MATCH_THRESHOLD=0.4
      - SKIP_MODEL_WARMUP=true

  ocr-service:
    build: ./ocr-service
    ports:
      - "5003:5003"
    depends_on:
      - redis
    environment:
      - REDIS_HOST=redis

  central-server:
    build: ./central-server
    ports:
      - "5004:5004"
    depends_on:
      - mongodb
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/medflow_central

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### PM2 (Production)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'face-service',
      cwd: './face-service',
      script: 'app.py',
      interpreter: './venv/bin/python',
      env: {
        FACE_SERVICE_PORT: 5002
      }
    },
    {
      name: 'ocr-service',
      cwd: './ocr-service',
      script: 'uvicorn',
      args: 'app.main:app --host 0.0.0.0 --port 5003',
      interpreter: './venv/bin/python'
    },
    {
      name: 'central-server',
      cwd: './central-server',
      script: 'server.js',
      env: {
        PORT: 5004
      }
    }
  ]
};
```

### Startup Script

```bash
#!/bin/bash
# start-all.sh

echo "Starting MedFlow services..."

# Start Face Service
cd face-service
source venv/bin/activate
python app.py &

# Start OCR Service
cd ../ocr-service
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 5003 &

# Start Central Server
cd ../central-server
npm start &

# Start Main Backend
cd ../backend
npm start &

# Start Frontend
cd ../frontend
npm run dev &

echo "All services started!"
```

---

## Monitoring

### Health Check Script

```bash
#!/bin/bash
# check-health.sh

echo "=== MedFlow Health Check ==="

# Face Service
curl -s http://localhost:5002/health | jq '.'

# OCR Service
curl -s http://localhost:5003/health | jq '.'

# Central Server
curl -s http://localhost:5004/health | jq '.'

# Main Backend
curl -s http://localhost:5001/api/health | jq '.'
```

### Logging

```bash
# View logs
pm2 logs face-service
pm2 logs ocr-service
pm2 logs central-server

# JSON logging for production
pm2 logs --json
```
