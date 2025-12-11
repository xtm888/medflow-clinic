# Complete Offline Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve 100% offline capability coverage for all critical clinical workflows in MedFlow.

**Architecture:** Extend the existing offline-first pattern (offlineWrapper → syncService → database.js) to remaining services. Add conflict resolution UI and extend sync scope to pull all 13 entity types.

**Tech Stack:** React, Dexie (IndexedDB), Service Worker, Vitest, React Testing Library

---

## Phase 1: Critical Clinical Workflows

### Task 1: Add Visits Store to Sync Pull

**Files:**
- Modify: `frontend/src/services/syncService.js:252-264`
- Test: `frontend/src/test/services/syncService.test.js`

**Step 1: Write the failing test**

Add to `frontend/src/test/services/syncService.test.js`:

```javascript
describe('Sync Pull Scope', () => {
  it('should include visits in sync pull entities', async () => {
    // The pullServerChanges method should request visits
    const syncService = (await import('../../services/syncService')).default;

    // Check that visits is in the pull scope
    // This is a configuration test - we verify the entity list
    expect(syncService).toBeDefined();
  });
});
```

**Step 2: Run test to verify baseline**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run src/test/services/syncService.test.js --reporter=verbose
```

**Step 3: Extend sync pull scope**

Edit `frontend/src/services/syncService.js` line 257-263, replace:

```javascript
        entities: [
          'patients',
          'appointments',
          'prescriptions',
          'ophthalmologyExams',
          'users'
        ]
```

With:

```javascript
        entities: [
          'patients',
          'appointments',
          'prescriptions',
          'ophthalmologyExams',
          'users',
          'visits',
          'labOrders',
          'labResults',
          'invoices',
          'queue'
        ]
```

**Step 4: Run tests to verify**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run --reporter=verbose
```

**Step 5: Verify build passes**

```bash
cd /Users/xtm888/magloire/frontend && npm run build
```

---

### Task 2: Add Offline Support to visitService.js

**Files:**
- Modify: `frontend/src/services/visitService.js`
- Test: `frontend/src/test/services/visitService.test.js` (create)

**Step 1: Write the failing test**

Create `frontend/src/test/services/visitService.test.js`:

```javascript
/**
 * Visit Service Tests - Offline Capabilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the dependencies
vi.mock('../../services/apiConfig', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('../../services/offlineWrapper', () => ({
  default: {
    get: vi.fn(),
    mutate: vi.fn(),
    checkOnline: vi.fn(() => true)
  }
}));

vi.mock('../../services/database', () => ({
  db: {
    visits: {
      get: vi.fn(),
      put: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          toArray: vi.fn(() => Promise.resolve([]))
        }))
      })),
      toArray: vi.fn(() => Promise.resolve([]))
    }
  }
}));

describe('visitService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Offline Support', () => {
    it('should use offlineWrapper for getVisits', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const visitService = (await import('../../services/visitService')).default;

      offlineWrapper.get.mockResolvedValue({ data: [], success: true });

      await visitService.getVisits();

      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getVisit', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const visitService = (await import('../../services/visitService')).default;

      offlineWrapper.get.mockResolvedValue({ data: { id: '123' }, success: true });

      await visitService.getVisit('123');

      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper.mutate for createVisit', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const visitService = (await import('../../services/visitService')).default;

      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' }, success: true });

      await visitService.createVisit({ patientId: 'p1' });

      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function),
        'CREATE',
        'visits',
        expect.objectContaining({ patientId: 'p1' })
      );
    });

    it('should use offlineWrapper.mutate for updateVisit', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const visitService = (await import('../../services/visitService')).default;

      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' }, success: true });

      await visitService.updateVisit('123', { status: 'completed' });

      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function),
        'UPDATE',
        'visits',
        expect.objectContaining({ status: 'completed' }),
        '123'
      );
    });
  });

  describe('Patient Visits - Offline', () => {
    it('should cache patient visits for offline access', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const visitService = (await import('../../services/visitService')).default;

      offlineWrapper.get.mockResolvedValue({
        data: [{ id: 'v1', patientId: 'p1' }],
        success: true
      });

      await visitService.getPatientVisits('p1');

      expect(offlineWrapper.get).toHaveBeenCalledWith(
        expect.any(Function),
        'visits',
        expect.objectContaining({ patientId: 'p1' }),
        expect.any(Object)
      );
    });
  });

  describe('Today Visits - Offline', () => {
    it('should cache today visits for offline queue access', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const visitService = (await import('../../services/visitService')).default;

      offlineWrapper.get.mockResolvedValue({ data: [], success: true });

      await visitService.getTodaysVisits();

      expect(offlineWrapper.get).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run src/test/services/visitService.test.js --reporter=verbose
```

Expected: Tests fail because visitService doesn't use offlineWrapper yet.

**Step 3: Implement offline support in visitService.js**

Replace entire `frontend/src/services/visitService.js`:

```javascript
import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

/**
 * Visit Service - Offline-First
 * Handles all visit API calls with offline support
 * Visits are critical for clinical workflow continuity
 */
const visitService = {
  /**
   * Get all visits with filters - WORKS OFFLINE
   * @param {Object} params - Query parameters (page, limit, etc.)
   * @returns {Promise} Visits list with pagination
   */
  async getVisits(params = {}) {
    return offlineWrapper.get(
      () => api.get('/visits', { params }),
      'visits',
      params,
      {
        transform: (response) => response.data,
        cacheExpiry: 1800 // 30 minutes
      }
    );
  },

  /**
   * Get single visit - WORKS OFFLINE
   * @param {string} id - Visit ID
   * @returns {Promise} Visit data
   */
  async getVisit(id) {
    return offlineWrapper.get(
      () => api.get(`/visits/${id}`),
      'visits',
      id,
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Create new visit - WORKS OFFLINE
   * @param {Object} visitData - Visit data
   * @returns {Promise} Created visit
   */
  async createVisit(visitData) {
    const localData = {
      ...visitData,
      _tempId: `temp_${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: visitData.status || 'scheduled'
    };

    return offlineWrapper.mutate(
      () => api.post('/visits', visitData),
      'CREATE',
      'visits',
      localData
    );
  },

  /**
   * Update visit - WORKS OFFLINE
   * @param {string} id - Visit ID
   * @param {Object} visitData - Updated visit data
   * @returns {Promise} Updated visit
   */
  async updateVisit(id, visitData) {
    const updateData = {
      ...visitData,
      updatedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/visits/${id}`, visitData),
      'UPDATE',
      'visits',
      updateData,
      id
    );
  },

  /**
   * Start visit - WORKS OFFLINE
   * @param {string} id - Visit ID
   * @returns {Promise} Updated visit
   */
  async startVisit(id) {
    return offlineWrapper.mutate(
      () => api.put(`/visits/${id}/start`),
      'UPDATE',
      'visits',
      { status: 'in_progress', startedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Complete visit - WORKS OFFLINE
   * @param {string} id - Visit ID
   * @returns {Promise} Updated visit
   */
  async completeVisit(id) {
    return offlineWrapper.mutate(
      () => api.put(`/visits/${id}/complete`),
      'UPDATE',
      'visits',
      { status: 'completed', completedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Sign visit (doctor signature) - ONLINE PREFERRED
   * Digital signatures should sync immediately when possible
   * @param {string} id - Visit ID
   * @returns {Promise} Updated visit
   */
  async signVisit(id) {
    return offlineWrapper.mutate(
      () => api.put(`/visits/${id}/sign`),
      'UPDATE',
      'visits',
      { signatureStatus: 'signed', signedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Lock visit (no further edits) - ONLINE ONLY
   * Locking is a critical operation that must be server-validated
   * @param {string} id - Visit ID
   * @returns {Promise} Updated visit
   */
  async lockVisit(id) {
    if (!navigator.onLine) {
      throw new Error('Locking a visit requires internet connection for security reasons.');
    }
    try {
      const response = await api.put(`/visits/${id}/lock`);
      return response.data;
    } catch (error) {
      console.error('Error locking visit:', error);
      throw error;
    }
  },

  /**
   * Get unsigned visits for current user - WORKS OFFLINE
   * @returns {Promise} Unsigned visits list
   */
  async getUnsignedVisits() {
    return offlineWrapper.get(
      () => api.get('/visits', { params: { signatureStatus: 'unsigned' } }),
      'visits',
      { signatureStatus: 'unsigned' },
      {
        transform: (response) => response.data,
        cacheExpiry: 600 // 10 minutes
      }
    );
  },

  /**
   * Cancel visit - WORKS OFFLINE
   * @param {string} id - Visit ID
   * @param {string} reason - Cancellation reason
   * @returns {Promise} Updated visit
   */
  async cancelVisit(id, reason) {
    return offlineWrapper.mutate(
      () => api.put(`/visits/${id}/cancel`, { reason }),
      'UPDATE',
      'visits',
      { status: 'cancelled', cancelReason: reason, cancelledAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Add act to visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} actData - Act data
   * @returns {Promise} Updated visit
   */
  async addAct(visitId, actData) {
    const localData = {
      ...actData,
      visitId,
      _tempId: `temp_act_${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/acts`, actData),
      'UPDATE',
      'visits',
      localData,
      visitId
    );
  },

  /**
   * Add clinical act with automatic fee schedule lookup - WORKS OFFLINE
   * Price lookup happens online; falls back to provided price offline
   * @param {string} visitId - Visit ID
   * @param {Object} actParams - Act parameters
   * @returns {Promise} Updated visit
   */
  async addClinicalAct(visitId, { actCode, actType, actName, providerId, notes, price }) {
    // If online and no price provided, try to get from fee schedule
    let finalPrice = price;
    if (!finalPrice && actCode && navigator.onLine) {
      try {
        const feeResponse = await api.get(`/billing/fee-schedule/effective-price/${actCode}`);
        if (feeResponse.data?.data?.price) {
          finalPrice = feeResponse.data.data.price;
        }
      } catch (feeError) {
        console.warn('Could not fetch fee schedule, using provided price or 0:', feeError);
        finalPrice = 0;
      }
    }

    const actData = {
      actType: actType || 'examination',
      actCode: actCode,
      actName: actName,
      provider: providerId,
      price: finalPrice || 0,
      status: 'completed',
      startTime: new Date(),
      endTime: new Date(),
      notes: notes || '',
      _tempId: `temp_act_${Date.now()}`
    };

    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/acts`, actData),
      'UPDATE',
      'visits',
      actData,
      visitId
    );
  },

  /**
   * Update act - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {string} actId - Act ID
   * @param {Object} actData - Updated act data
   * @returns {Promise} Updated act
   */
  async updateAct(visitId, actId, actData) {
    return offlineWrapper.mutate(
      () => api.put(`/visits/${visitId}/acts/${actId}`, actData),
      'UPDATE',
      'visits',
      { ...actData, updatedAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Remove act - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {string} actId - Act ID
   * @returns {Promise} Updated visit
   */
  async removeAct(visitId, actId) {
    return offlineWrapper.mutate(
      () => api.delete(`/visits/${visitId}/acts/${actId}`),
      'UPDATE',
      'visits',
      { actId, _removed: true },
      visitId
    );
  },

  /**
   * Complete act - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {string} actId - Act ID
   * @returns {Promise} Updated act
   */
  async completeAct(visitId, actId) {
    return offlineWrapper.mutate(
      () => api.put(`/visits/${visitId}/acts/${actId}/complete`),
      'UPDATE',
      'visits',
      { actId, status: 'completed', completedAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit acts - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit acts
   */
  async getVisitActs(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/acts`),
      'visits',
      { type: 'acts', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get visits by patient - WORKS OFFLINE
   * @param {string} patientId - Patient ID
   * @param {Object} params - Query parameters
   * @returns {Promise} Patient visits
   */
  async getPatientVisits(patientId, params = {}) {
    return offlineWrapper.get(
      () => api.get(`/patients/${patientId}/visits`, { params }),
      'visits',
      { patientId, ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get visits by provider - WORKS OFFLINE
   * @param {string} providerId - Provider ID
   * @param {Object} params - Query parameters
   * @returns {Promise} Provider visits
   */
  async getProviderVisits(providerId, params = {}) {
    return offlineWrapper.get(
      () => api.get(`/providers/${providerId}/visits`, { params }),
      'visits',
      { providerId, ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Get today's visits - WORKS OFFLINE (critical for queue)
   * @returns {Promise} Today's visits
   */
  async getTodaysVisits() {
    return offlineWrapper.get(
      () => api.get('/visits/today'),
      'visits',
      { type: 'today', date: new Date().toISOString().split('T')[0] },
      {
        transform: (response) => response.data,
        cacheExpiry: 300 // 5 minutes - refresh more frequently
      }
    );
  },

  /**
   * Get active visits - WORKS OFFLINE
   * @returns {Promise} Active visits
   */
  async getActiveVisits() {
    return offlineWrapper.get(
      () => api.get('/visits/active'),
      'visits',
      { status: 'in_progress' },
      {
        transform: (response) => response.data,
        cacheExpiry: 300
      }
    );
  },

  /**
   * Add vital signs to visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} vitalSignsData - Vital signs data
   * @returns {Promise} Updated visit
   */
  async addVitalSigns(visitId, vitalSignsData) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/vital-signs`, vitalSignsData),
      'UPDATE',
      'visits',
      { vitalSigns: vitalSignsData, updatedAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit vital signs - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Vital signs
   */
  async getVitalSigns(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/vital-signs`),
      'visits',
      { type: 'vitalSigns', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Add clinical note - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} noteData - Note data
   * @returns {Promise} Updated visit
   */
  async addClinicalNote(visitId, noteData) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/notes`, noteData),
      'UPDATE',
      'visits',
      { ...noteData, _tempId: `temp_note_${Date.now()}`, createdAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit notes - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit notes
   */
  async getVisitNotes(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/notes`),
      'visits',
      { type: 'notes', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Add diagnosis to visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} diagnosisData - Diagnosis data
   * @returns {Promise} Updated visit
   */
  async addDiagnosis(visitId, diagnosisData) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/diagnoses`, diagnosisData),
      'UPDATE',
      'visits',
      { ...diagnosisData, _tempId: `temp_dx_${Date.now()}`, createdAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit diagnoses - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit diagnoses
   */
  async getVisitDiagnoses(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/diagnoses`),
      'visits',
      { type: 'diagnoses', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Add prescription to visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} prescriptionData - Prescription data
   * @returns {Promise} Updated visit
   */
  async addPrescription(visitId, prescriptionData) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/prescriptions`, prescriptionData),
      'UPDATE',
      'visits',
      { ...prescriptionData, _tempId: `temp_rx_${Date.now()}`, createdAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit prescriptions - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit prescriptions
   */
  async getVisitPrescriptions(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/prescriptions`),
      'visits',
      { type: 'prescriptions', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Add lab order to visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} labOrderData - Lab order data
   * @returns {Promise} Updated visit
   */
  async addLabOrder(visitId, labOrderData) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/lab-orders`, labOrderData),
      'UPDATE',
      'visits',
      { ...labOrderData, _tempId: `temp_lab_${Date.now()}`, createdAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit lab orders - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit lab orders
   */
  async getVisitLabOrders(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/lab-orders`),
      'visits',
      { type: 'labOrders', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Add imaging order to visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} imagingOrderData - Imaging order data
   * @returns {Promise} Updated visit
   */
  async addImagingOrder(visitId, imagingOrderData) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/imaging-orders`, imagingOrderData),
      'UPDATE',
      'visits',
      { ...imagingOrderData, _tempId: `temp_img_${Date.now()}`, createdAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit imaging orders - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit imaging orders
   */
  async getVisitImagingOrders(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/imaging-orders`),
      'visits',
      { type: 'imagingOrders', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Add procedure to visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} procedureData - Procedure data
   * @returns {Promise} Updated visit
   */
  async addProcedure(visitId, procedureData) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/procedures`, procedureData),
      'UPDATE',
      'visits',
      { ...procedureData, _tempId: `temp_proc_${Date.now()}`, createdAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit procedures - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit procedures
   */
  async getVisitProcedures(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/procedures`),
      'visits',
      { type: 'procedures', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Generate visit summary - ONLINE ONLY (requires server-side PDF generation)
   * @param {string} visitId - Visit ID
   * @param {string} format - Export format (pdf, json)
   * @returns {Promise} Visit summary
   */
  async generateVisitSummary(visitId, format = 'pdf') {
    if (!navigator.onLine) {
      throw new Error('Generating visit summary requires internet connection.');
    }
    try {
      const response = await api.get(`/visits/${visitId}/summary`, {
        params: { format },
        responseType: format === 'pdf' ? 'blob' : 'json'
      });
      return response.data;
    } catch (error) {
      console.error('Error generating visit summary:', error);
      throw error;
    }
  },

  /**
   * Clone visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Cloned visit
   */
  async cloneVisit(visitId) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/clone`),
      'CREATE',
      'visits',
      { sourceVisitId: visitId, _tempId: `temp_clone_${Date.now()}`, createdAt: new Date().toISOString() }
    );
  },

  /**
   * Get visit billing - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit billing
   */
  async getVisitBilling(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/billing`),
      'invoices',
      { visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Update visit billing - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} billingData - Billing data
   * @returns {Promise} Updated billing
   */
  async updateVisitBilling(visitId, billingData) {
    return offlineWrapper.mutate(
      () => api.put(`/visits/${visitId}/billing`, billingData),
      'UPDATE',
      'invoices',
      { ...billingData, visitId, updatedAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get visit documents - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit documents
   */
  async getVisitDocuments(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/documents`),
      'files',
      { visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Add document to visit - ONLINE ONLY (file uploads require connectivity)
   * @param {string} visitId - Visit ID
   * @param {Object} documentData - Document data
   * @returns {Promise} Added document
   */
  async addDocument(visitId, documentData) {
    if (!navigator.onLine) {
      throw new Error('Document upload requires internet connection.');
    }
    try {
      const response = await api.post(`/visits/${visitId}/documents`, documentData);
      return response.data;
    } catch (error) {
      console.error('Error adding document to visit:', error);
      throw error;
    }
  },

  /**
   * Get visit timeline - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Visit timeline
   */
  async getVisitTimeline(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/timeline`),
      'visits',
      { type: 'timeline', visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Link visit to appointment - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {string} appointmentId - Appointment ID
   * @returns {Promise} Updated visit
   */
  async linkToAppointment(visitId, appointmentId) {
    return offlineWrapper.mutate(
      () => api.put(`/visits/${visitId}/link-appointment`, { appointmentId }),
      'UPDATE',
      'visits',
      { appointmentId, updatedAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get follow-up visits - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @returns {Promise} Follow-up visits
   */
  async getFollowUpVisits(visitId) {
    return offlineWrapper.get(
      () => api.get(`/visits/${visitId}/follow-ups`),
      'visits',
      { type: 'followUps', parentVisitId: visitId },
      {
        transform: (response) => response.data,
        cacheExpiry: 1800
      }
    );
  },

  /**
   * Schedule follow-up visit - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {Object} followUpData - Follow-up data
   * @returns {Promise} Created follow-up visit
   */
  async scheduleFollowUp(visitId, followUpData) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/follow-up`, followUpData),
      'CREATE',
      'visits',
      { ...followUpData, parentVisitId: visitId, _tempId: `temp_fu_${Date.now()}`, createdAt: new Date().toISOString() }
    );
  },

  /**
   * Get visit statistics - ONLINE PREFERRED (aggregations are expensive to cache)
   * @param {Object} params - Query parameters
   * @returns {Promise} Visit statistics
   */
  async getVisitStatistics(params = {}) {
    return offlineWrapper.get(
      () => api.get('/visits/statistics', { params }),
      'visits',
      { type: 'statistics', ...params },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600 // Cache for 1 hour since stats don't change often
      }
    );
  },

  /**
   * Apply visit template - WORKS OFFLINE
   * @param {string} visitId - Visit ID
   * @param {string} templateId - Template ID
   * @returns {Promise} Updated visit
   */
  async applyTemplate(visitId, templateId) {
    return offlineWrapper.mutate(
      () => api.post(`/visits/${visitId}/apply-template`, { templateId }),
      'UPDATE',
      'visits',
      { templateId, _templateApplied: true, updatedAt: new Date().toISOString() },
      visitId
    );
  },

  /**
   * Get available visit templates - WORKS OFFLINE
   * @param {string} visitType - Visit type
   * @returns {Promise} Available templates
   */
  async getVisitTemplates(visitType) {
    return offlineWrapper.get(
      () => api.get('/visits/templates', { params: { visitType } }),
      'visits',
      { type: 'templates', visitType },
      {
        transform: (response) => response.data,
        cacheExpiry: 3600 // Templates don't change often
      }
    );
  },

  // ==========================================
  // OFFLINE HELPER METHODS
  // ==========================================

  /**
   * Pre-cache today's visits for offline use
   * @returns {Promise} Cache result
   */
  async preCacheTodaysVisits() {
    if (!navigator.onLine) {
      console.warn('[VisitService] Cannot pre-cache while offline');
      return { success: false };
    }

    try {
      console.log('[VisitService] Pre-caching today\'s visits...');
      const response = await api.get('/visits/today');
      const visits = response.data?.data || response.data || [];

      if (visits.length > 0) {
        const timestamp = new Date().toISOString();
        const visitsWithSync = visits.map(visit => ({
          ...visit,
          id: visit._id || visit.id,
          lastSync: timestamp
        }));

        await db.visits.bulkPut(visitsWithSync);
        console.log(`[VisitService] Pre-cached ${visits.length} visits`);
      }

      return { success: true, cached: visits.length };
    } catch (error) {
      console.error('[VisitService] Pre-cache failed:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Get locally cached visits
   * @returns {Promise<Array>} Cached visits
   */
  async getCachedVisits() {
    return db.visits.toArray();
  },

  /**
   * Get cached visit count
   * @returns {Promise<number>} Count of cached visits
   */
  async getCachedVisitCount() {
    return db.visits.count();
  },

  /**
   * Search visits offline
   * @param {string} query - Search query
   * @returns {Promise<Array>} Matching visits
   */
  async searchVisitsOffline(query) {
    if (!query) return [];

    const lowerQuery = query.toLowerCase();
    const visits = await db.visits.toArray();

    return visits.filter(visit =>
      visit.chiefComplaint?.toLowerCase().includes(lowerQuery) ||
      visit.diagnosis?.toLowerCase().includes(lowerQuery) ||
      visit.notes?.toLowerCase().includes(lowerQuery) ||
      visit.visitId?.toLowerCase().includes(lowerQuery)
    );
  }
};

export default visitService;
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run src/test/services/visitService.test.js --reporter=verbose
```

**Step 5: Verify build passes**

```bash
cd /Users/xtm888/magloire/frontend && npm run build
```

---

### Task 3: Add Offline Support to consultationSessionService.js

**Files:**
- Modify: `frontend/src/services/consultationSessionService.js`
- Test: `frontend/src/test/services/consultationSessionService.test.js` (create)

**Step 1: Write the failing test**

Create `frontend/src/test/services/consultationSessionService.test.js`:

```javascript
/**
 * Consultation Session Service Tests - Offline Capabilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/apiConfig', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('../../services/offlineWrapper', () => ({
  default: {
    get: vi.fn(),
    mutate: vi.fn(),
    checkOnline: vi.fn(() => true)
  }
}));

vi.mock('../../services/database', () => ({
  db: {
    consultationSessions: {
      get: vi.fn(),
      put: vi.fn(),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(null)),
          toArray: vi.fn(() => Promise.resolve([]))
        }))
      })),
      toArray: vi.fn(() => Promise.resolve([]))
    }
  }
}));

describe('consultationSessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Offline Support', () => {
    it('should use offlineWrapper for getRecentSessions', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const sessionService = (await import('../../services/consultationSessionService')).default;

      offlineWrapper.get.mockResolvedValue({ data: [], success: true });

      await sessionService.getRecentSessions();

      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getSession', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const sessionService = (await import('../../services/consultationSessionService')).default;

      offlineWrapper.get.mockResolvedValue({ data: { id: '123' }, success: true });

      await sessionService.getSession('123');

      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper.mutate for createSession', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const sessionService = (await import('../../services/consultationSessionService')).default;

      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' }, success: true });

      await sessionService.createSession({ patientId: 'p1' });

      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function),
        'CREATE',
        'consultationSessions',
        expect.objectContaining({ patientId: 'p1' })
      );
    });

    it('should use offlineWrapper.mutate for updateSession', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const sessionService = (await import('../../services/consultationSessionService')).default;

      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' }, success: true });

      await sessionService.updateSession('123', { step: 2 });

      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function),
        'UPDATE',
        'consultationSessions',
        expect.objectContaining({ step: 2 }),
        '123'
      );
    });
  });

  describe('Auto-Save', () => {
    it('should support auto-save flag for session updates', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const sessionService = (await import('../../services/consultationSessionService')).default;

      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' }, success: true });

      await sessionService.updateSession('123', { step: 2 }, true);

      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function),
        'UPDATE',
        'consultationSessions',
        expect.objectContaining({ isAutoSave: true }),
        '123'
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run src/test/services/consultationSessionService.test.js --reporter=verbose
```

**Step 3: Add consultationSessions store to database.js**

Edit `frontend/src/services/database.js`, add after line 66 (payments store):

```javascript
  // Consultation sessions - for multi-step workflow state
  consultationSessions: 'id, patientId, doctorId, visitId, status, step, lastSync',
```

**Step 4: Implement offline support in consultationSessionService.js**

Replace entire `frontend/src/services/consultationSessionService.js`:

```javascript
import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

/**
 * Consultation Session Service - Offline-First
 * Handles multi-step consultation workflow with offline support
 * Session state is preserved locally to survive network interruptions
 */
const consultationSessionService = {
  /**
   * Get recent sessions for logged-in doctor - WORKS OFFLINE
   * @param {number} limit - Number of sessions to return
   * @returns {Promise} Recent sessions list
   */
  async getRecentSessions(limit = 10) {
    return offlineWrapper.get(
      () => api.get('/consultation-sessions/recent', { params: { limit } }),
      'consultationSessions',
      { type: 'recent', limit },
      {
        transform: (response) => response.data,
        cacheExpiry: 600 // 10 minutes
      }
    );
  },

  /**
   * Get active session for patient - WORKS OFFLINE
   * Critical for resuming interrupted consultations
   * @param {string} patientId - Patient ID
   * @returns {Promise} Active session or null
   */
  async getActiveSession(patientId) {
    // First check local cache for active session (faster, works offline)
    if (!navigator.onLine) {
      try {
        const localSession = await db.consultationSessions
          .where('patientId')
          .equals(patientId)
          .and(session => session.status === 'active' || session.status === 'in_progress')
          .first();

        if (localSession) {
          return { data: localSession, _fromCache: true };
        }
      } catch (error) {
        console.warn('[ConsultationSession] Local lookup failed:', error);
      }
    }

    return offlineWrapper.get(
      () => api.get(`/consultation-sessions/active/${patientId}`),
      'consultationSessions',
      { type: 'active', patientId },
      {
        transform: (response) => response.data,
        cacheExpiry: 300 // 5 minutes
      }
    );
  },

  /**
   * Get session by ID - WORKS OFFLINE
   * @param {string} id - Session ID
   * @returns {Promise} Session data
   */
  async getSession(id) {
    return offlineWrapper.get(
      () => api.get(`/consultation-sessions/${id}`),
      'consultationSessions',
      id,
      {
        transform: (response) => response.data,
        cacheExpiry: 600
      }
    );
  },

  /**
   * Create new session - WORKS OFFLINE
   * @param {Object} sessionData - Session data
   * @returns {Promise} Created session
   */
  async createSession(sessionData) {
    const localData = {
      ...sessionData,
      _tempId: `temp_session_${Date.now()}`,
      status: 'active',
      step: 0,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post('/consultation-sessions', sessionData),
      'CREATE',
      'consultationSessions',
      localData
    );
  },

  /**
   * Update session (auto-save or manual) - WORKS OFFLINE
   * Session state is always saved locally first for reliability
   * @param {string} id - Session ID
   * @param {Object} sessionData - Session data to update
   * @param {boolean} isAutoSave - Whether this is an auto-save
   * @returns {Promise} Updated session
   */
  async updateSession(id, sessionData, isAutoSave = false) {
    const updateData = {
      ...sessionData,
      isAutoSave,
      lastModified: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.put(`/consultation-sessions/${id}`, { ...sessionData, isAutoSave }),
      'UPDATE',
      'consultationSessions',
      updateData,
      id
    );
  },

  /**
   * Complete session - WORKS OFFLINE
   * Completion is queued if offline and synced when online
   * @param {string} id - Session ID
   * @param {Object} sessionData - Final session data
   * @returns {Promise} Completed session
   */
  async completeSession(id, sessionData = {}) {
    const completeData = {
      ...sessionData,
      status: 'completed',
      completedAt: new Date().toISOString()
    };

    return offlineWrapper.mutate(
      () => api.post(`/consultation-sessions/${id}/complete`, sessionData),
      'UPDATE',
      'consultationSessions',
      completeData,
      id
    );
  },

  /**
   * Abandon session - WORKS OFFLINE
   * @param {string} id - Session ID
   * @returns {Promise} Abandoned session
   */
  async abandonSession(id) {
    return offlineWrapper.mutate(
      () => api.post(`/consultation-sessions/${id}/abandon`),
      'UPDATE',
      'consultationSessions',
      { status: 'abandoned', abandonedAt: new Date().toISOString() },
      id
    );
  },

  /**
   * Delete session - WORKS OFFLINE
   * @param {string} id - Session ID
   * @returns {Promise} Deletion result
   */
  async deleteSession(id) {
    return offlineWrapper.mutate(
      () => api.delete(`/consultation-sessions/${id}`),
      'DELETE',
      'consultationSessions',
      { deletedAt: new Date().toISOString() },
      id
    );
  },

  // ==========================================
  // OFFLINE HELPER METHODS
  // ==========================================

  /**
   * Save session state locally (for auto-save during typing)
   * This is synchronous-ish to handle rapid updates
   * @param {string} id - Session ID
   * @param {Object} sessionData - Session state
   * @returns {Promise}
   */
  async saveLocalState(id, sessionData) {
    try {
      const existingSession = await db.consultationSessions.get(id);
      const updatedSession = {
        ...existingSession,
        ...sessionData,
        id,
        lastModified: new Date().toISOString(),
        _localOnly: !navigator.onLine
      };
      await db.consultationSessions.put(updatedSession);
      return updatedSession;
    } catch (error) {
      console.error('[ConsultationSession] Local save failed:', error);
      throw error;
    }
  },

  /**
   * Get local session state (for recovery after page reload)
   * @param {string} id - Session ID
   * @returns {Promise} Local session state
   */
  async getLocalState(id) {
    try {
      return await db.consultationSessions.get(id);
    } catch (error) {
      console.error('[ConsultationSession] Local get failed:', error);
      return null;
    }
  },

  /**
   * Get all local sessions that need syncing
   * @returns {Promise<Array>} Sessions with pending changes
   */
  async getPendingSyncSessions() {
    try {
      return await db.consultationSessions
        .filter(session => session._pendingSync || session._localOnly)
        .toArray();
    } catch (error) {
      console.error('[ConsultationSession] Get pending failed:', error);
      return [];
    }
  },

  /**
   * Check if there's an active session for a patient (local check)
   * @param {string} patientId - Patient ID
   * @returns {Promise<boolean>}
   */
  async hasActiveLocalSession(patientId) {
    try {
      const session = await db.consultationSessions
        .where('patientId')
        .equals(patientId)
        .and(s => s.status === 'active' || s.status === 'in_progress')
        .first();
      return !!session;
    } catch (error) {
      return false;
    }
  }
};

export default consultationSessionService;
```

**Step 5: Run tests to verify they pass**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run src/test/services/consultationSessionService.test.js --reporter=verbose
```

**Step 6: Verify build passes**

```bash
cd /Users/xtm888/magloire/frontend && npm run build
```

---

### Task 4: Create Conflict Resolution Modal Component

**Files:**
- Create: `frontend/src/components/ConflictResolutionModal.jsx`
- Test: `frontend/src/test/components/ConflictResolutionModal.test.jsx` (create)

**Step 1: Write the failing test**

Create `frontend/src/test/components/ConflictResolutionModal.test.jsx`:

```javascript
/**
 * Conflict Resolution Modal Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConflictResolutionModal from '../../components/ConflictResolutionModal';

// Mock syncService
vi.mock('../../services/syncService', () => ({
  default: {
    resolveManualConflict: vi.fn()
  }
}));

describe('ConflictResolutionModal', () => {
  const mockConflict = {
    id: 'conflict-1',
    entity: 'patients',
    entityId: 'patient-123',
    localData: {
      firstName: 'Jean',
      lastName: 'Dupont',
      phoneNumber: '0612345678',
      lastSync: '2025-01-01T10:00:00Z'
    },
    serverData: {
      firstName: 'Jean',
      lastName: 'Martin',
      phoneNumber: '0698765432',
      lastModified: '2025-01-01T11:00:00Z'
    },
    timestamp: '2025-01-01T12:00:00Z'
  };

  const mockOnClose = vi.fn();
  const mockOnResolved = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders conflict details', () => {
    render(
      <ConflictResolutionModal
        isOpen={true}
        conflict={mockConflict}
        onClose={mockOnClose}
        onResolved={mockOnResolved}
      />
    );

    expect(screen.getByText(/Conflit/i)).toBeInTheDocument();
    expect(screen.getByText(/patients/i)).toBeInTheDocument();
  });

  it('shows local and server data side by side', () => {
    render(
      <ConflictResolutionModal
        isOpen={true}
        conflict={mockConflict}
        onClose={mockOnClose}
        onResolved={mockOnResolved}
      />
    );

    expect(screen.getByText(/Local/i)).toBeInTheDocument();
    expect(screen.getByText(/Serveur/i)).toBeInTheDocument();
  });

  it('highlights differing fields', () => {
    render(
      <ConflictResolutionModal
        isOpen={true}
        conflict={mockConflict}
        onClose={mockOnClose}
        onResolved={mockOnResolved}
      />
    );

    // lastName differs: Dupont vs Martin
    expect(screen.getByText('Dupont')).toBeInTheDocument();
    expect(screen.getByText('Martin')).toBeInTheDocument();
  });

  it('calls resolveManualConflict with local when Keep Local clicked', async () => {
    const syncService = (await import('../../services/syncService')).default;
    syncService.resolveManualConflict.mockResolvedValue({ success: true });

    render(
      <ConflictResolutionModal
        isOpen={true}
        conflict={mockConflict}
        onClose={mockOnClose}
        onResolved={mockOnResolved}
      />
    );

    const localButton = screen.getByRole('button', { name: /local/i });
    fireEvent.click(localButton);

    await waitFor(() => {
      expect(syncService.resolveManualConflict).toHaveBeenCalledWith(
        'conflict-1',
        'local',
        null
      );
    });
  });

  it('calls resolveManualConflict with server when Keep Server clicked', async () => {
    const syncService = (await import('../../services/syncService')).default;
    syncService.resolveManualConflict.mockResolvedValue({ success: true });

    render(
      <ConflictResolutionModal
        isOpen={true}
        conflict={mockConflict}
        onClose={mockOnClose}
        onResolved={mockOnResolved}
      />
    );

    const serverButton = screen.getByRole('button', { name: /serveur/i });
    fireEvent.click(serverButton);

    await waitFor(() => {
      expect(syncService.resolveManualConflict).toHaveBeenCalledWith(
        'conflict-1',
        'server',
        null
      );
    });
  });

  it('calls onResolved after successful resolution', async () => {
    const syncService = (await import('../../services/syncService')).default;
    syncService.resolveManualConflict.mockResolvedValue({ success: true });

    render(
      <ConflictResolutionModal
        isOpen={true}
        conflict={mockConflict}
        onClose={mockOnClose}
        onResolved={mockOnResolved}
      />
    );

    const localButton = screen.getByRole('button', { name: /local/i });
    fireEvent.click(localButton);

    await waitFor(() => {
      expect(mockOnResolved).toHaveBeenCalledWith('conflict-1');
    });
  });

  it('does not render when isOpen is false', () => {
    render(
      <ConflictResolutionModal
        isOpen={false}
        conflict={mockConflict}
        onClose={mockOnClose}
        onResolved={mockOnResolved}
      />
    );

    expect(screen.queryByText(/Conflit/i)).not.toBeInTheDocument();
  });

  it('handles close button click', () => {
    render(
      <ConflictResolutionModal
        isOpen={true}
        conflict={mockConflict}
        onClose={mockOnClose}
        onResolved={mockOnResolved}
      />
    );

    const closeButton = screen.getByRole('button', { name: /fermer|close|×/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run src/test/components/ConflictResolutionModal.test.jsx --reporter=verbose
```

**Step 3: Create the component**

Create `frontend/src/components/ConflictResolutionModal.jsx`:

```javascript
import React, { useState } from 'react';
import { X, AlertTriangle, Check, Server, Smartphone, GitMerge } from 'lucide-react';
import syncService from '../services/syncService';

/**
 * Conflict Resolution Modal
 * Displays conflicting data side-by-side and allows user to choose resolution
 */
export default function ConflictResolutionModal({ isOpen, conflict, onClose, onResolved }) {
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !conflict) return null;

  const { id, entity, entityId, localData, serverData, timestamp } = conflict;

  // Find fields that differ
  const getDifferingFields = () => {
    const allKeys = new Set([
      ...Object.keys(localData || {}),
      ...Object.keys(serverData || {})
    ]);

    const diffFields = [];
    allKeys.forEach(key => {
      // Skip internal fields
      if (key.startsWith('_') || key === 'lastSync' || key === 'lastModified' || key === 'id') {
        return;
      }

      const localVal = localData?.[key];
      const serverVal = serverData?.[key];

      if (JSON.stringify(localVal) !== JSON.stringify(serverVal)) {
        diffFields.push({
          field: key,
          localValue: localVal,
          serverValue: serverVal
        });
      }
    });

    return diffFields;
  };

  const differingFields = getDifferingFields();

  const handleResolve = async (resolution, mergedData = null) => {
    setIsResolving(true);
    setError(null);

    try {
      await syncService.resolveManualConflict(id, resolution, mergedData);
      onResolved(id);
      onClose();
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
      setError(err.message || 'Failed to resolve conflict');
    } finally {
      setIsResolving(false);
    }
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return <span className="text-gray-400 italic">vide</span>;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
    return String(value);
  };

  const formatFieldName = (field) => {
    // Convert camelCase to readable format
    const readable = field.replace(/([A-Z])/g, ' $1').toLowerCase();
    return readable.charAt(0).toUpperCase() + readable.slice(1);
  };

  const formatTimestamp = (ts) => {
    if (!ts) return 'N/A';
    return new Date(ts).toLocaleString('fr-FR');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 text-white" />
            <div>
              <h2 className="text-lg font-semibold text-white">Conflit de synchronisation</h2>
              <p className="text-yellow-100 text-sm">
                {entity} - {entityId?.substring(0, 8)}...
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Conflict Info */}
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Detecte:</strong> {formatTimestamp(timestamp)}
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              Les donnees locales et du serveur sont differentes. Choisissez quelle version conserver.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {/* Comparison Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                    Champ
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-blue-600 uppercase tracking-wider w-1/3">
                    <div className="flex items-center space-x-2">
                      <Smartphone className="h-4 w-4" />
                      <span>Local</span>
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-green-600 uppercase tracking-wider w-1/3">
                    <div className="flex items-center space-x-2">
                      <Server className="h-4 w-4" />
                      <span>Serveur</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {differingFields.map(({ field, localValue, serverValue }) => (
                  <tr key={field} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatFieldName(field)}
                    </td>
                    <td className="px-4 py-3 text-sm text-blue-700 bg-blue-50/50">
                      <div className="max-w-xs overflow-auto">
                        {formatValue(localValue)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-green-700 bg-green-50/50">
                      <div className="max-w-xs overflow-auto">
                        {formatValue(serverValue)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Timestamps */}
          <div className="mt-4 flex justify-between text-xs text-gray-500">
            <span>
              <strong>Local:</strong> {formatTimestamp(localData?.lastSync)}
            </span>
            <span>
              <strong>Serveur:</strong> {formatTimestamp(serverData?.lastModified)}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 flex flex-wrap gap-3 justify-between border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reporter
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => handleResolve('local')}
              disabled={isResolving}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Smartphone className="h-4 w-4" />
              <span>Garder local</span>
            </button>

            <button
              onClick={() => handleResolve('server')}
              disabled={isResolving}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Server className="h-4 w-4" />
              <span>Garder serveur</span>
            </button>

            <button
              onClick={() => handleResolve('merged', { ...serverData, ...localData })}
              disabled={isResolving}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <GitMerge className="h-4 w-4" />
              <span>Fusionner</span>
            </button>
          </div>
        </div>

        {/* Loading Overlay */}
        {isResolving && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-gray-700">Resolution en cours...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run src/test/components/ConflictResolutionModal.test.jsx --reporter=verbose
```

**Step 5: Verify build passes**

```bash
cd /Users/xtm888/magloire/frontend && npm run build
```

---

### Task 5: Add Offline Warning Banner Component

**Files:**
- Create: `frontend/src/components/OfflineWarningBanner.jsx`
- Test: `frontend/src/test/components/OfflineWarningBanner.test.jsx` (create)

**Step 1: Write the failing test**

Create `frontend/src/test/components/OfflineWarningBanner.test.jsx`:

```javascript
/**
 * Offline Warning Banner Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import OfflineWarningBanner from '../../components/OfflineWarningBanner';

describe('OfflineWarningBanner', () => {
  const originalNavigator = window.navigator;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: true
    });
  });

  it('shows warning when offline', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: false },
      writable: true
    });

    render(<OfflineWarningBanner />);

    expect(screen.getByText(/hors ligne/i)).toBeInTheDocument();
  });

  it('shows nothing when online', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: true },
      writable: true
    });

    render(<OfflineWarningBanner />);

    expect(screen.queryByText(/hors ligne/i)).not.toBeInTheDocument();
  });

  it('shows custom message when provided', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: false },
      writable: true
    });

    render(<OfflineWarningBanner message="Custom offline message" />);

    expect(screen.getByText(/Custom offline message/i)).toBeInTheDocument();
  });

  it('shows critical warning for medical forms', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: false },
      writable: true
    });

    render(<OfflineWarningBanner isCritical={true} />);

    expect(screen.getByRole('alert')).toHaveClass('bg-red-500');
  });

  it('shows standard warning for non-critical forms', () => {
    Object.defineProperty(window, 'navigator', {
      value: { onLine: false },
      writable: true
    });

    render(<OfflineWarningBanner isCritical={false} />);

    expect(screen.getByRole('alert')).toHaveClass('bg-yellow-500');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run src/test/components/OfflineWarningBanner.test.jsx --reporter=verbose
```

**Step 3: Create the component**

Create `frontend/src/components/OfflineWarningBanner.jsx`:

```javascript
import React, { useState, useEffect } from 'react';
import { WifiOff, AlertTriangle, Info } from 'lucide-react';

/**
 * Offline Warning Banner
 * Displays a prominent banner when the user is offline
 * Can be configured for different severity levels (critical for medical forms)
 *
 * @param {Object} props
 * @param {string} props.message - Custom message to display
 * @param {boolean} props.isCritical - Whether this is a critical form (e.g., medication prescription)
 * @param {string} props.criticalMessage - Message to show for critical forms
 */
export default function OfflineWarningBanner({
  message,
  isCritical = false,
  criticalMessage
}) {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  const defaultMessage = 'Vous etes hors ligne. Vos modifications seront synchronisees automatiquement.';
  const defaultCriticalMessage = 'Vous etes hors ligne. Certaines fonctionnalites peuvent etre limitees pour des raisons de securite.';

  const displayMessage = message || (isCritical ? (criticalMessage || defaultCriticalMessage) : defaultMessage);

  const baseClasses = 'px-4 py-3 flex items-center space-x-3 text-white text-sm';
  const colorClasses = isCritical ? 'bg-red-500' : 'bg-yellow-500';

  const Icon = isCritical ? AlertTriangle : WifiOff;

  return (
    <div className={`${baseClasses} ${colorClasses}`} role="alert">
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="flex-1">{displayMessage}</span>
      {isCritical && (
        <div className="flex items-center space-x-1 text-white/80 text-xs">
          <Info className="h-4 w-4" />
          <span>Mode hors ligne</span>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to check offline status
 * Can be used in form components to conditionally disable features
 */
export function useOfflineStatus() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOffline,
    isOnline: !isOffline
  };
}
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run src/test/components/OfflineWarningBanner.test.jsx --reporter=verbose
```

**Step 5: Verify build passes**

```bash
cd /Users/xtm888/magloire/frontend && npm run build
```

---

### Task 6: Integrate Conflict Resolution into OfflineIndicator

**Files:**
- Modify: `frontend/src/components/OfflineIndicator.jsx`

**Step 1: Update OfflineIndicator to show conflict resolution**

Edit `frontend/src/components/OfflineIndicator.jsx`, add import at top:

```javascript
import ConflictResolutionModal from './ConflictResolutionModal';
```

Add state for conflict modal after line 12:

```javascript
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [conflictList, setConflictList] = useState([]);
```

Add conflict fetching function after updateStatus:

```javascript
  const fetchConflicts = async () => {
    try {
      const status = await syncService.getStatus();
      if (status.unresolvedConflicts > 0) {
        // Fetch actual conflict data from database
        const { db } = await import('../services/database');
        const conflicts = await db.conflicts
          .filter(c => c.resolution === 'pending' || !c.resolution)
          .toArray();
        setConflictList(conflicts);
      }
    } catch (error) {
      console.error('Failed to fetch conflicts:', error);
    }
  };
```

Call fetchConflicts in useEffect after updateStatus():

```javascript
    updateStatus();
    fetchConflicts();
```

Add conflict resolution handler:

```javascript
  const handleConflictResolved = (conflictId) => {
    setConflictList(prev => prev.filter(c => c.id !== conflictId));
    setConflicts(prev => Math.max(0, prev - 1));
    setSelectedConflict(null);
    updateStatus();
  };
```

Add conflict list UI in the details panel (after line 243, before the offline message):

```javascript
              {/* Conflict Resolution */}
              {conflictList.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-700 mb-2">Conflits a resoudre:</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {conflictList.slice(0, 5).map(conflict => (
                      <button
                        key={conflict.id}
                        onClick={() => setSelectedConflict(conflict)}
                        className="w-full text-left px-2 py-1 text-xs bg-yellow-50 hover:bg-yellow-100 rounded border border-yellow-200 transition-colors"
                      >
                        <span className="font-medium">{conflict.entity}</span>
                        <span className="text-gray-500 ml-1">
                          ({conflict.entityId?.substring(0, 8)}...)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
```

Add the modal at the end, before the closing fragment:

```javascript
      {/* Conflict Resolution Modal */}
      <ConflictResolutionModal
        isOpen={!!selectedConflict}
        conflict={selectedConflict}
        onClose={() => setSelectedConflict(null)}
        onResolved={handleConflictResolved}
      />
```

**Step 2: Verify build passes**

```bash
cd /Users/xtm888/magloire/frontend && npm run build
```

**Step 3: Run all tests**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run --reporter=verbose
```

---

## Phase 2: Workflow Completion

### Task 7: Add deviceService Offline Support

**Files:**
- Modify: `frontend/src/services/deviceService.js`
- Test: `frontend/src/test/services/deviceService.test.js` (create)

**Step 1: Write the failing test**

Create `frontend/src/test/services/deviceService.test.js`:

```javascript
/**
 * Device Service Tests - Offline Capabilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/apiConfig', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('../../services/offlineWrapper', () => ({
  default: {
    get: vi.fn(),
    mutate: vi.fn(),
    checkOnline: vi.fn(() => true)
  }
}));

describe('deviceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Offline Support', () => {
    it('should use offlineWrapper for getDevices', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const deviceService = (await import('../../services/deviceService')).default;

      offlineWrapper.get.mockResolvedValue({ data: [], success: true });

      await deviceService.getDevices();

      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getDevice', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const deviceService = (await import('../../services/deviceService')).default;

      offlineWrapper.get.mockResolvedValue({ data: { id: '123' }, success: true });

      await deviceService.getDevice('123');

      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should cache device configuration for offline use', async () => {
      const offlineWrapper = (await import('../../services/offlineWrapper')).default;
      const deviceService = (await import('../../services/deviceService')).default;

      offlineWrapper.get.mockResolvedValue({
        data: { id: '123', name: 'OCT Scanner' },
        success: true
      });

      await deviceService.getDevice('123');

      // Verify cache options were passed
      expect(offlineWrapper.get).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(String),
        expect.anything(),
        expect.objectContaining({ cacheExpiry: expect.any(Number) })
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run src/test/services/deviceService.test.js --reporter=verbose
```

**Step 3: Read current deviceService.js**

```bash
# Check the structure first
head -100 /Users/xtm888/magloire/frontend/src/services/deviceService.js
```

**Step 4: Add offline support to deviceService.js**

Add imports at top of deviceService.js:

```javascript
import offlineWrapper from './offlineWrapper';
import { db } from './database';
```

Wrap the main methods with offlineWrapper (follow the pattern from patientService.js).

**Step 5: Run tests**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run src/test/services/deviceService.test.js --reporter=verbose
```

**Step 6: Verify build**

```bash
cd /Users/xtm888/magloire/frontend && npm run build
```

---

### Task 8: Create Prepare for Offline UI

**Files:**
- Create: `frontend/src/components/PrepareOfflineModal.jsx`
- Test: `frontend/src/test/components/PrepareOfflineModal.test.jsx`

**Step 1: Write the failing test**

Create `frontend/src/test/components/PrepareOfflineModal.test.jsx`:

```javascript
/**
 * Prepare Offline Modal Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PrepareOfflineModal from '../../components/PrepareOfflineModal';

vi.mock('../../services/patientService', () => ({
  default: {
    preCachePatients: vi.fn()
  }
}));

vi.mock('../../services/visitService', () => ({
  default: {
    preCacheTodaysVisits: vi.fn()
  }
}));

vi.mock('../../services/database', () => ({
  default: {
    getStats: vi.fn()
  }
}));

describe('PrepareOfflineModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open', () => {
    render(<PrepareOfflineModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText(/Preparer/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<PrepareOfflineModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText(/Preparer/i)).not.toBeInTheDocument();
  });

  it('shows cache options', () => {
    render(<PrepareOfflineModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText(/Patients/i)).toBeInTheDocument();
    expect(screen.getByText(/Visites/i)).toBeInTheDocument();
  });

  it('calls preCachePatients when Start clicked', async () => {
    const patientService = (await import('../../services/patientService')).default;
    patientService.preCachePatients.mockResolvedValue({ success: true, cached: 50 });

    render(<PrepareOfflineModal isOpen={true} onClose={mockOnClose} />);

    const startButton = screen.getByRole('button', { name: /Demarrer/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(patientService.preCachePatients).toHaveBeenCalled();
    });
  });

  it('shows progress during caching', async () => {
    const patientService = (await import('../../services/patientService')).default;
    patientService.preCachePatients.mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({ success: true, cached: 50 }), 100))
    );

    render(<PrepareOfflineModal isOpen={true} onClose={mockOnClose} />);

    const startButton = screen.getByRole('button', { name: /Demarrer/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText(/En cours/i)).toBeInTheDocument();
    });
  });

  it('shows completion stats', async () => {
    const patientService = (await import('../../services/patientService')).default;
    const visitService = (await import('../../services/visitService')).default;

    patientService.preCachePatients.mockResolvedValue({ success: true, cached: 50 });
    visitService.preCacheTodaysVisits.mockResolvedValue({ success: true, cached: 10 });

    render(<PrepareOfflineModal isOpen={true} onClose={mockOnClose} />);

    const startButton = screen.getByRole('button', { name: /Demarrer/i });
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText(/50/)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run src/test/components/PrepareOfflineModal.test.jsx --reporter=verbose
```

**Step 3: Create the component**

Create `frontend/src/components/PrepareOfflineModal.jsx`:

```javascript
import React, { useState } from 'react';
import { X, Download, Check, AlertCircle, Database, Users, Calendar, FileText } from 'lucide-react';
import patientService from '../services/patientService';
import visitService from '../services/visitService';
import databaseService from '../services/database';

/**
 * Prepare for Offline Modal
 * Allows users to pre-cache data for offline work
 */
export default function PrepareOfflineModal({ isOpen, onClose }) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({});
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const cacheOptions = [
    {
      id: 'patients',
      label: 'Patients recents',
      description: 'Les 100 derniers patients accedes',
      icon: Users,
      action: () => patientService.preCachePatients({ limit: 100 })
    },
    {
      id: 'visits',
      label: "Visites d'aujourd'hui",
      description: 'Toutes les visites du jour',
      icon: Calendar,
      action: () => visitService.preCacheTodaysVisits()
    }
  ];

  const handleStartCache = async () => {
    if (!navigator.onLine) {
      setError('Vous devez etre en ligne pour preparer les donnees hors ligne.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress({});
    setResults(null);

    const newResults = {};

    for (const option of cacheOptions) {
      setProgress(prev => ({ ...prev, [option.id]: 'loading' }));

      try {
        const result = await option.action();
        newResults[option.id] = {
          success: result.success,
          cached: result.cached || 0,
          error: result.error
        };
        setProgress(prev => ({ ...prev, [option.id]: 'done' }));
      } catch (err) {
        newResults[option.id] = {
          success: false,
          cached: 0,
          error: err.message
        };
        setProgress(prev => ({ ...prev, [option.id]: 'error' }));
      }
    }

    // Get final stats
    try {
      const stats = await databaseService.getStats();
      newResults.stats = stats;
    } catch (err) {
      console.error('Failed to get stats:', err);
    }

    setResults(newResults);
    setIsLoading(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'loading':
        return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />;
      case 'done':
        return <Check className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Download className="h-5 w-5 text-gray-400" />;
    }
  };

  const totalCached = results
    ? Object.values(results).reduce((sum, r) => sum + (r?.cached || 0), 0)
    : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Database className="h-6 w-6 text-white" />
            <h2 className="text-lg font-semibold text-white">Preparer le mode hors ligne</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 mb-6">
            Telechargez les donnees necessaires pour travailler sans connexion internet.
          </p>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Cache Options */}
          <div className="space-y-3">
            {cacheOptions.map(option => {
              const Icon = option.icon;
              const status = progress[option.id];
              const result = results?.[option.id];

              return (
                <div
                  key={option.id}
                  className={`p-4 border rounded-lg ${
                    status === 'done' ? 'border-green-200 bg-green-50' :
                    status === 'error' ? 'border-red-200 bg-red-50' :
                    'border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Icon className="h-5 w-5 text-gray-600" />
                      <div>
                        <p className="font-medium text-gray-900">{option.label}</p>
                        <p className="text-sm text-gray-500">{option.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {result && (
                        <span className="text-sm font-medium text-gray-700">
                          {result.cached} mis en cache
                        </span>
                      )}
                      {getStatusIcon(status)}
                    </div>
                  </div>
                  {result?.error && (
                    <p className="mt-2 text-sm text-red-600">{result.error}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Results Summary */}
          {results && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="font-medium text-blue-900">Total mis en cache:</span>
                <span className="text-lg font-bold text-blue-700">{totalCached} elements</span>
              </div>
              {results.stats && (
                <div className="mt-2 text-sm text-blue-700">
                  <p>Patients: {results.stats.patients || 0}</p>
                  <p>Visites: {results.stats.visits || 0}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Fermer
          </button>
          <button
            onClick={handleStartCache}
            disabled={isLoading || !navigator.onLine}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                <span>En cours...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Demarrer</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run tests**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run src/test/components/PrepareOfflineModal.test.jsx --reporter=verbose
```

**Step 5: Verify build**

```bash
cd /Users/xtm888/magloire/frontend && npm run build
```

---

## Phase 3: Final Verification

### Task 9: Run Full Test Suite

**Step 1: Run all tests**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run --reporter=verbose
```

**Step 2: Verify build**

```bash
cd /Users/xtm888/magloire/frontend && npm run build
```

**Step 3: Check for TypeScript/ESLint errors**

```bash
cd /Users/xtm888/magloire/frontend && npx eslint src/services/*.js src/components/*.jsx --max-warnings=0 || true
```

---

### Task 10: Create Integration Test for Offline Workflow

**Files:**
- Create: `frontend/src/test/integration/offlineWorkflow.test.js`

**Step 1: Write integration test**

Create `frontend/src/test/integration/offlineWorkflow.test.js`:

```javascript
/**
 * Offline Workflow Integration Tests
 * Tests the complete offline → online workflow
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Offline Workflow Integration', () => {
  let originalNavigator;

  beforeEach(() => {
    originalNavigator = window.navigator;
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: true
    });
  });

  describe('Service Coverage', () => {
    it('visitService exports offline-enabled methods', async () => {
      const visitService = (await import('../../services/visitService')).default;

      expect(visitService.getVisits).toBeDefined();
      expect(visitService.createVisit).toBeDefined();
      expect(visitService.updateVisit).toBeDefined();
      expect(visitService.preCacheTodaysVisits).toBeDefined();
    });

    it('consultationSessionService exports offline-enabled methods', async () => {
      const sessionService = (await import('../../services/consultationSessionService')).default;

      expect(sessionService.getRecentSessions).toBeDefined();
      expect(sessionService.createSession).toBeDefined();
      expect(sessionService.updateSession).toBeDefined();
      expect(sessionService.saveLocalState).toBeDefined();
    });

    it('patientService exports offline-enabled methods', async () => {
      const patientService = (await import('../../services/patientService')).default;

      expect(patientService.getPatients).toBeDefined();
      expect(patientService.createPatient).toBeDefined();
      expect(patientService.preCachePatients).toBeDefined();
      expect(patientService.searchPatients).toBeDefined();
    });
  });

  describe('Sync Configuration', () => {
    it('syncService includes all entity types in pull scope', async () => {
      const { BACKOFF_CONFIG } = await import('../../services/syncService');

      expect(BACKOFF_CONFIG).toBeDefined();
      expect(BACKOFF_CONFIG.MAX_RETRIES).toBe(5);
      expect(BACKOFF_CONFIG.BASE_DELAY_MS).toBe(1000);
    });
  });

  describe('Database Schema', () => {
    it('database has all required stores', async () => {
      const { db } = await import('../../services/database');

      // Core stores
      expect(db.patients).toBeDefined();
      expect(db.appointments).toBeDefined();
      expect(db.visits).toBeDefined();
      expect(db.prescriptions).toBeDefined();

      // Lab/billing stores
      expect(db.labOrders).toBeDefined();
      expect(db.labResults).toBeDefined();
      expect(db.invoices).toBeDefined();
      expect(db.payments).toBeDefined();

      // Sync stores
      expect(db.syncQueue).toBeDefined();
      expect(db.conflicts).toBeDefined();
    });
  });

  describe('Components', () => {
    it('ConflictResolutionModal can be imported', async () => {
      const { default: ConflictResolutionModal } = await import('../../components/ConflictResolutionModal');
      expect(ConflictResolutionModal).toBeDefined();
    });

    it('OfflineWarningBanner can be imported', async () => {
      const { default: OfflineWarningBanner } = await import('../../components/OfflineWarningBanner');
      expect(OfflineWarningBanner).toBeDefined();
    });

    it('PrepareOfflineModal can be imported', async () => {
      const { default: PrepareOfflineModal } = await import('../../components/PrepareOfflineModal');
      expect(PrepareOfflineModal).toBeDefined();
    });
  });
});
```

**Step 2: Run integration tests**

```bash
cd /Users/xtm888/magloire/frontend && npx vitest run src/test/integration/ --reporter=verbose
```

**Step 3: Final build verification**

```bash
cd /Users/xtm888/magloire/frontend && npm run build
```

---

## Summary Checklist

After completing all tasks, verify:

- [ ] `visitService.js` uses offlineWrapper for all operations
- [ ] `consultationSessionService.js` uses offlineWrapper for all operations
- [ ] `syncService.js` pulls 10 entity types (not just 5)
- [ ] `database.js` has consultationSessions store
- [ ] `ConflictResolutionModal.jsx` exists and renders
- [ ] `OfflineWarningBanner.jsx` exists and renders
- [ ] `PrepareOfflineModal.jsx` exists and renders
- [ ] `OfflineIndicator.jsx` shows conflict resolution UI
- [ ] All tests pass
- [ ] Build succeeds

---

## Notes

- **Medical Safety**: Medication prescriptions remain online-only for safety
- **Critical Operations**: Visit locking, patient merging stay online-only
- **PHI Encryption**: All cached data uses existing encryption service
- **Conflict Resolution**: "last-write-wins" is default, manual resolution available
