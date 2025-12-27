# Critical Error Handling Fixes - Priority Checklist

## IMMEDIATE FIXES (Do First - 8.25 hours)

### 1. EventEmitter Error Handlers (1.5 hours) - CRITICAL

**Why**: Unhandled 'error' events crash Node.js process

#### File: `/Users/xtm888/magloire/backend/services/autoSyncService.js`
**Line**: 19

```javascript
// BEFORE
class AutoSyncService extends EventEmitter {
  constructor() {
    super();
    // ... rest of constructor
  }
}

// AFTER
class AutoSyncService extends EventEmitter {
  constructor() {
    super();
    this.setupErrorHandling();
    // ... rest of constructor
  }

  setupErrorHandling() {
    this.on('error', (error) => {
      log.error('AutoSyncService error:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date()
      });
      this.stats.errors.push({
        error: error.message,
        timestamp: new Date()
      });
      // Keep only last 100 errors
      if (this.stats.errors.length > 100) {
        this.stats.errors = this.stats.errors.slice(-100);
      }
    });
  }
}
```

#### File: `/Users/xtm888/magloire/backend/services/deviceSyncQueue.js`
**Line**: 17

```javascript
// BEFORE
class DeviceSyncQueue extends EventEmitter {
  constructor() {
    super();
    // ... rest of constructor
  }
}

// AFTER
class DeviceSyncQueue extends EventEmitter {
  constructor() {
    super();
    this.setupErrorHandling();
    // ... rest of constructor
  }

  setupErrorHandling() {
    this.on('error', (error) => {
      log.error('DeviceSyncQueue error:', {
        error: error.message,
        stack: error.stack
      });
      this.stats.failed++;
    });
  }
}
```

#### File: `/Users/xtm888/magloire/backend/services/smb2ClientService.js`
**Line**: 17

```javascript
// BEFORE
class SMB2ClientService extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map();
    // ... rest of constructor
  }
}

// AFTER
class SMB2ClientService extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map();
    this.setupErrorHandling();
    // ... rest of constructor
  }

  setupErrorHandling() {
    this.on('error', (error) => {
      log.error('SMB2ClientService error:', {
        error: error.message,
        stack: error.stack,
        connectionCount: this.connections.size
      });
    });

    // Also handle connectionError events
    this.on('connectionError', ({ deviceId, error }) => {
      log.error('SMB2 connection failed:', { deviceId, error });
    });

    this.on('watchError', ({ deviceId, error }) => {
      log.error('SMB2 watch error:', { deviceId, error });
    });
  }
}
```

---

### 2. JSON.parse Safety (0.75 hours) - HIGH

#### File: `/Users/xtm888/magloire/backend/services/deviceSyncQueue.js`
**Line**: 238

```javascript
// BEFORE
const job = JSON.parse(jobData);

// AFTER
let job;
try {
  job = JSON.parse(jobData);
} catch (error) {
  log.error('Failed to parse job data:', {
    error: error.message,
    jobData: jobData?.substring(0, 100) // Log first 100 chars
  });
  this.stats.failed++;
  this.emit('jobFailed', {
    jobId: 'unknown',
    error: 'Invalid job data format'
  });
  return null;
}
```

#### File: `/Users/xtm888/magloire/backend/services/deviceSyncQueue.js`
**Line**: 377

```javascript
// BEFORE
return data ? JSON.parse(data) : null;

// AFTER
if (!data) return null;
try {
  return JSON.parse(data);
} catch (error) {
  log.error('Failed to parse cached data:', { error: error.message });
  return null;
}
```

#### File: `/Users/xtm888/magloire/backend/services/lisIntegrationService.js`
**Line**: 895

```javascript
// BEFORE (in parseHL7Message function)
parsed = JSON.parse(message);

// AFTER
try {
  parsed = JSON.parse(message);
} catch (error) {
  log.error('Failed to parse HL7 JSON message:', {
    error: error.message,
    messagePreview: message?.substring(0, 200)
  });
  return {
    success: false,
    error: 'Invalid JSON format in HL7 message'
  };
}
```

---

### 3. centralServerClient.js Error Handling (6 hours) - HIGH

**Pattern to apply to ALL 22 functions**:

```javascript
// BEFORE (example: getDashboard)
async function getDashboard() {
  const client = createClient();
  const response = await client.get('/api/dashboard');
  return response.data;
}

// AFTER
async function getDashboard() {
  try {
    const client = createClient();
    const response = await client.get('/api/dashboard', {
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    log.error('Failed to get dashboard from central server:', {
      error: error.message,
      code: error.code,
      status: error.response?.status
    });

    // Check if central server is down
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      throw new Error('Central server is unavailable');
    }

    throw new Error(`Central server error: ${error.message}`);
  }
}
```

**Apply to these 22 functions**:
1. getDashboard (line 46)
2. searchPatients (line 57)
3. getPatientHistory (line 66)
4. getFullPatient (line 75)
5. getPatientAllClinics (line 84)
6. checkPatientExists (line 93)
7. getConsolidatedInventory (line 104)
8. getInventorySummary (line 113)
9. getInventoryAlerts (line 122)
10. getTransferRecommendations (line 131)
11. getInventoryCategories (line 140)
12. getExpiringItems (line 149)
13. getProductStock (line 158)
14. getFinancialDashboard (line 169)
15. getConsolidatedRevenue (line 178)
16. getClinicComparison (line 187)
17. getRevenueByCategory (line 196)
18. getPaymentMethodDistribution (line 205)
19. getOutstanding (line 214)
20. getClinics (line 225)
21. getClinic (line 234)
22. getSyncStatus (line 245)

---

## HIGH PRIORITY (Week 1 - 9 hours)

### 4. External API Timeouts (3 hours)

#### calendarIntegrationService.js (lines 355, 434)

```javascript
// BEFORE
const response = await fetch(tokenUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(tokenData)
});

// AFTER
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000);

try {
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(tokenData),
    signal: controller.signal
  });
  clearTimeout(timeout);
  return response;
} catch (error) {
  clearTimeout(timeout);
  if (error.name === 'AbortError') {
    throw new Error('Calendar API request timeout (10s)');
  }
  throw error;
}
```

#### paymentGateway.js (line 242)

```javascript
// BEFORE
const response = await axios.post(`${config.apiUrl}/v1/webpayment`, {
  // ... payment data
});

// AFTER
const response = await axios.post(`${config.apiUrl}/v1/webpayment`, {
  // ... payment data
}, {
  timeout: 15000, // 15 seconds for payment operations
  headers: {
    'Content-Type': 'application/json'
  }
});
```

#### lisIntegrationService.js (lines 283, 297)

```javascript
// Add timeout to config object
const config = {
  headers: {
    'Authorization': `Bearer ${token}`
  },
  timeout: 10000 // Add this
};
```

#### drugSafetyService.js (lines 774, 884, 1002)

```javascript
// Add timeout to all RxNorm API calls
const response = await axios.get(url, {
  timeout: 5000, // 5 seconds for drug lookups
  headers: { 'Accept': 'application/json' }
});
```

---

### 5. Appointment Validation Error Handling (5 hours)

**Pattern for all validation functions**:

```javascript
// BEFORE
async function checkProviderConflicts(providerId, startTime, endTime, excludeAppointmentId = null) {
  const conflicts = await Appointment.find({
    provider: providerId,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
    _id: { $ne: excludeAppointmentId },
    status: { $nin: ['cancelled', 'no-show'] }
  });

  return conflicts.length > 0 ? conflicts : null;
}

// AFTER
async function checkProviderConflicts(providerId, startTime, endTime, excludeAppointmentId = null) {
  try {
    // Validate inputs
    if (!providerId || !startTime || !endTime) {
      throw new Error('Provider ID, start time, and end time are required');
    }

    const conflicts = await Appointment.find({
      provider: providerId,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      _id: { $ne: excludeAppointmentId },
      status: { $nin: ['cancelled', 'no-show'] }
    }).lean(); // Add .lean() for better performance

    return conflicts.length > 0 ? conflicts : null;
  } catch (error) {
    log.error('Failed to check provider conflicts:', {
      providerId,
      startTime,
      endTime,
      error: error.message
    });
    throw new Error(`Conflict check failed: ${error.message}`);
  }
}
```

**Apply to**:
- checkProviderConflicts (line 91)
- checkRoomConflicts (line 139)
- checkEquipmentConflicts (line 188)
- checkBufferTimeViolations (line 235)
- validateAppointment (line 329)
- findNextAvailableSlot (line 413)
- getAvailableSlots (line 490)

---

### 6. Promise Chain Error Handling (1 hour)

#### invoiceReminderScheduler.js (line 351)

```javascript
// BEFORE
updateOverdueStatuses().then(() => processPaymentReminders());

// AFTER
updateOverdueStatuses()
  .then(() => processPaymentReminders())
  .catch(error => {
    log.error('Invoice reminder scheduler failed:', {
      error: error.message,
      stack: error.stack
    });
  });
```

#### networkDiscoveryService.js (line 247)

```javascript
// BEFORE
promises.push(this.checkSMBPort(ip, timeout).then(open => open ? ip : null));

// AFTER
promises.push(
  this.checkSMBPort(ip, timeout)
    .then(open => open ? ip : null)
    .catch(error => {
      log.warn(`SMB port check failed for ${ip}:`, { error: error.message });
      return null; // Return null on error, don't break the scan
    })
);
```

#### controllers/surgeryController.js (line 72)

```javascript
// BEFORE
SurgeryCase.findOverdue(30, clinicId).then(cases => cases.length)

// AFTER
async () => {
  try {
    const cases = await SurgeryCase.findOverdue(30, clinicId);
    return cases.length;
  } catch (error) {
    log.error('Failed to find overdue surgery cases:', {
      clinicId,
      error: error.message
    });
    return 0; // Return 0 on error
  }
}
```

---

## Testing After Fixes

### 1. Test EventEmitter Error Handling

```javascript
// In a test file
const autoSyncService = require('./services/autoSyncService');

// Emit error and verify it doesn't crash
autoSyncService.emit('error', new Error('Test error'));
console.log('EventEmitter error handled successfully');
```

### 2. Test JSON.parse Safety

```javascript
// Test with corrupted data
const deviceSyncQueue = require('./services/deviceSyncQueue');

// This should not crash
const result = await deviceSyncQueue.getJobById('corrupted-data');
console.log('JSON.parse safety verified');
```

### 3. Test Central Server Failure

```javascript
// Stop central server and verify graceful degradation
const centralServerClient = require('./services/centralServerClient');

try {
  const dashboard = await centralServerClient.getDashboard();
} catch (error) {
  console.log('Central server error handled:', error.message);
}
```

---

## Monitoring Setup

Add to `/Users/xtm888/magloire/backend/server.js`:

```javascript
// Add unhandled rejection monitoring
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled Promise Rejection:', {
    reason: reason,
    promise: promise,
    stack: reason?.stack
  });

  // Send to Sentry if configured
  if (sentryService.isInitialized) {
    sentryService.captureException(reason);
  }
});

process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });

  // Send to Sentry
  if (sentryService.isInitialized) {
    sentryService.captureException(error);
  }

  // Graceful shutdown
  process.exit(1);
});
```

---

## Progress Tracking

- [ ] EventEmitter error handlers (3 files) - 1.5 hours
  - [ ] autoSyncService.js
  - [ ] deviceSyncQueue.js
  - [ ] smb2ClientService.js

- [ ] JSON.parse safety (3 locations) - 0.75 hours
  - [ ] deviceSyncQueue.js:238
  - [ ] deviceSyncQueue.js:377
  - [ ] lisIntegrationService.js:895

- [ ] centralServerClient.js (22 functions) - 6 hours
  - [ ] Patient APIs (6 functions)
  - [ ] Inventory APIs (7 functions)
  - [ ] Financial APIs (6 functions)
  - [ ] Clinic APIs (2 functions)
  - [ ] Sync API (1 function)

- [ ] External API timeouts (9 locations) - 3 hours
  - [ ] calendarIntegrationService.js (2)
  - [ ] paymentGateway.js (1)
  - [ ] lisIntegrationService.js (2)
  - [ ] drugSafetyService.js (3)

- [ ] Appointment validation (7 functions) - 5 hours

- [ ] Promise chains (3 locations) - 1 hour

**Total**: 17.25 hours for immediate + high priority fixes

---

**Last Updated**: 2025-12-26
**Estimated Completion**: 2-3 days (with focused effort)
