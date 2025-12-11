# MedFlow API Reference

## Base URL

```
Development: http://localhost:5001/api
Production: https://your-domain.com/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### Multi-Clinic Header

For clinic-scoped operations, include:
```
X-Clinic-ID: <clinic_id>
```

## Authentication Endpoints

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "...", "role": "doctor" },
    "token": "eyJ...",
    "refreshToken": "eyJ...",
    "requiresTwoFactor": false
  }
}
```

### Refresh Token
```http
POST /api/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}
```

### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

### Two-Factor Authentication
```http
POST /api/auth/enable-two-factor
Authorization: Bearer <token>

POST /api/auth/verify-two-factor
{
  "code": "123456"
}
```

## Patient Endpoints

### List Patients
```http
GET /api/patients
Authorization: Bearer <token>

Query Parameters:
- page (default: 1)
- limit (default: 20)
- search (string)
- clinic (ObjectId)
```

### Get Patient
```http
GET /api/patients/:id
Authorization: Bearer <token>
```

### Create Patient
```http
POST /api/patients
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-15",
  "gender": "male",
  "phoneNumber": "+243123456789",
  "email": "john@example.com",
  "address": {
    "street": "123 Main St",
    "city": "Kinshasa",
    "country": "DRC"
  }
}
```

### Update Patient
```http
PUT /api/patients/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "phoneNumber": "+243987654321"
}
```

### Delete Patient (Soft Delete)
```http
DELETE /api/patients/:id
Authorization: Bearer <token>
```

### Search Patients
```http
GET /api/patients/search?q=john&type=name
Authorization: Bearer <token>

Query Parameters:
- q (search query)
- type (name|phone|patientId|legacyId)
```

### Get Patient Visits
```http
GET /api/patients/:id/visits
Authorization: Bearer <token>
```

### Get Patient Prescriptions
```http
GET /api/patients/:id/prescriptions
Authorization: Bearer <token>
```

## Appointment Endpoints

### List Appointments
```http
GET /api/appointments
Authorization: Bearer <token>

Query Parameters:
- date (YYYY-MM-DD)
- status (scheduled|confirmed|cancelled|completed)
- provider (ObjectId)
- clinic (ObjectId)
```

### Create Appointment
```http
POST /api/appointments
Authorization: Bearer <token>
Content-Type: application/json

{
  "patient": "patient_id",
  "provider": "user_id",
  "appointmentType": "consultation",
  "scheduledDate": "2025-01-15",
  "startTime": "09:00",
  "duration": 30,
  "reason": "Annual checkup"
}
```

### Update Appointment
```http
PUT /api/appointments/:id
Authorization: Bearer <token>
```

### Cancel Appointment
```http
PUT /api/appointments/:id/cancel
Authorization: Bearer <token>

{
  "reason": "Patient requested cancellation"
}
```

### Confirm Appointment
```http
PUT /api/appointments/:id/confirm
Authorization: Bearer <token>
```

## Queue Endpoints

### Get Queue Status
```http
GET /api/queue
Authorization: Bearer <token>

Query Parameters:
- department (string)
- status (waiting|in_progress|completed)
```

### Add to Queue
```http
POST /api/queue
Authorization: Bearer <token>

{
  "patient": "patient_id",
  "department": "consultation",
  "priority": "normal",
  "reason": "Follow-up visit"
}
```

### Call Patient
```http
PUT /api/queue/:id/call
Authorization: Bearer <token>

{
  "room": "Room 1"
}
```

### Complete Queue Entry
```http
PUT /api/queue/:id/complete
Authorization: Bearer <token>
```

## Ophthalmology Endpoints

### Create Examination
```http
POST /api/ophthalmology
Authorization: Bearer <token>
Content-Type: application/json

{
  "patient": "patient_id",
  "visit": "visit_id",
  "chiefComplaint": {
    "description": "Blurred vision",
    "duration": "2 weeks",
    "severity": "moderate",
    "laterality": "OU"
  },
  "visualAcuity": {
    "OD": { "uncorrected": "20/40", "corrected": "20/20" },
    "OS": { "uncorrected": "20/50", "corrected": "20/25" }
  },
  "refraction": {
    "OD": { "sphere": -2.00, "cylinder": -0.50, "axis": 180 },
    "OS": { "sphere": -2.50, "cylinder": -0.75, "axis": 175 }
  }
}
```

### Get Examination
```http
GET /api/ophthalmology/:id
Authorization: Bearer <token>
```

### Update Examination
```http
PUT /api/ophthalmology/:id
Authorization: Bearer <token>
```

## Prescription Endpoints

### List Prescriptions
```http
GET /api/prescriptions
Authorization: Bearer <token>

Query Parameters:
- patient (ObjectId)
- status (draft|pending|ready|dispensed)
- type (medication|optical)
```

### Create Prescription
```http
POST /api/prescriptions
Authorization: Bearer <token>
Content-Type: application/json

{
  "patient": "patient_id",
  "type": "medication",
  "medications": [
    {
      "name": "Timolol 0.5%",
      "dosage": "1 drop",
      "frequency": "BID",
      "duration": "30 days",
      "route": "ophthalmic",
      "eye": "OU",
      "quantity": 1
    }
  ],
  "notes": "Apply in morning and evening"
}
```

### Dispense Prescription
```http
PUT /api/prescriptions/:id/dispense
Authorization: Bearer <token>

{
  "dispensedItems": [
    { "medication": "med_id", "quantity": 1 }
  ]
}
```

## Invoice Endpoints

### List Invoices
```http
GET /api/invoices
Authorization: Bearer <token>

Query Parameters:
- patient (ObjectId)
- status (draft|pending|paid|partial)
- dateFrom, dateTo (YYYY-MM-DD)
```

### Create Invoice
```http
POST /api/invoices
Authorization: Bearer <token>
Content-Type: application/json

{
  "patient": "patient_id",
  "items": [
    {
      "description": "Consultation",
      "category": "consultation",
      "unitPrice": 50000,
      "quantity": 1,
      "currency": "CDF"
    }
  ],
  "currency": "CDF"
}
```

### Record Payment
```http
POST /api/invoices/:id/payments
Authorization: Bearer <token>

{
  "amount": 25000,
  "method": "cash",
  "currency": "CDF"
}
```

### Generate PDF
```http
GET /api/invoices/:id/pdf
Authorization: Bearer <token>
```

## Device Endpoints

### List Devices
```http
GET /api/devices
Authorization: Bearer <token>
```

### Sync Device Data
```http
POST /api/devices/:id/sync
Authorization: Bearer <token>
```

### Browse Device Folders
```http
GET /api/devices/:id/folders
Authorization: Bearer <token>
```

### Import Patient Data from Device
```http
POST /api/devices/:id/import
Authorization: Bearer <token>

{
  "patient": "patient_id",
  "filePath": "/path/to/file.xml"
}
```

## Laboratory Endpoints

### Create Lab Order
```http
POST /api/lab-orders
Authorization: Bearer <token>

{
  "patient": "patient_id",
  "tests": [
    { "testCode": "CBC", "priority": "routine" },
    { "testCode": "BMP", "priority": "stat" }
  ],
  "clinicalInfo": "Suspected anemia"
}
```

### Get Lab Order
```http
GET /api/lab-orders/:id
Authorization: Bearer <token>
```

### Enter Results
```http
PUT /api/lab-orders/:id/results
Authorization: Bearer <token>

{
  "results": [
    { "testCode": "HGB", "value": 12.5, "unit": "g/dL" }
  ]
}
```

### Verify Results
```http
PUT /api/lab-orders/:id/verify
Authorization: Bearer <token>
```

## Pharmacy Endpoints

### Get Inventory
```http
GET /api/pharmacy/inventory
Authorization: Bearer <token>

Query Parameters:
- search (string)
- category (string)
- lowStock (boolean)
```

### Dispense Medication
```http
POST /api/pharmacy/dispense
Authorization: Bearer <token>

{
  "prescription": "prescription_id",
  "items": [
    { "inventoryItem": "item_id", "quantity": 1 }
  ]
}
```

### Adjust Stock
```http
POST /api/pharmacy/inventory/:id/adjust
Authorization: Bearer <token>

{
  "quantity": -5,
  "reason": "Expired",
  "notes": "Batch #12345"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation failed",
  "errors": [
    { "field": "email", "message": "Email is required" }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Not authorized to access this resource"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Permission denied"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Resource not found"
}
```

### 429 Rate Limited
```json
{
  "success": false,
  "error": "Too many requests, please try again later"
}
```

### 500 Server Error
```json
{
  "success": false,
  "error": "Internal server error"
}
```

## Rate Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| General API | 100 requests | 15 minutes |
| Authentication | 10 requests | 15 minutes |
| Sensitive (billing, pharmacy) | 50 requests | 15 minutes |
| File uploads | 20 requests | 15 minutes |
| Reports/exports | 10 requests | 15 minutes |

## Pagination

All list endpoints support pagination:

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

## WebSocket Events

Connect to: `ws://localhost:5001`

### Events
- `queue:update` - Queue status changed
- `notification:new` - New notification
- `patient:update` - Patient data updated
- `device:sync` - Device sync progress

### Subscribe
```javascript
socket.on('queue:update', (data) => {
  console.log('Queue updated:', data);
});
```
