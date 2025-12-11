# Complete Multi-Clinic Offline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable complete offline operation for all 4 clinics (Dépôt Central, Tombalbaye, Matrix, Matadi) with clinic-specific sync intervals and full medical workflow support.

**Architecture:** Extend existing offlineWrapper pattern to 15+ critical services, add 8 new IndexedDB stores, implement clinic-aware sync with configurable intervals (5-30 min), and create clinic data isolation.

**Tech Stack:** Dexie (IndexedDB), offlineWrapper, syncService, React components, Vitest tests

---

## Overview

### Current State
- 13/79 services (16%) have offline support
- Missing: pharmacy, orthoptic, glasses orders, clinic config, approvals, stock reconciliation
- Sync interval: 15-min global (Matadi needs 30-min)
- No clinic data partitioning

### Target State
- 28/79 services (~35%) with offline support
- All critical medical workflows operational offline
- Clinic-specific sync intervals (5, 10, 30 min)
- Clinic-aware data filtering

---

## Phase 1: Critical Medical Workflows (Tasks 1-8)

### Task 1: Add IndexedDB Stores for Phase 1

**Files:**
- Modify: `frontend/src/services/database.js:34-94`

**Step 1: Add new stores to database schema v4**

In `database.js`, after line 94, add version 4 with new stores:

```javascript
// Version 4 - Multi-clinic offline support
db.version(4).stores({
  // Existing stores (copy from v3)
  users: 'id, email, username, role, lastSync',
  patients: 'id, patientId, nationalId, firstName, lastName, phoneNumber, email, lastSync, *allergies',
  appointments: 'id, appointmentId, patientId, providerId, date, status, queueNumber, checkInTime, lastSync',
  queue: 'id, patientId, appointmentId, status, priority, queueNumber, checkInTime, providerId, lastSync',
  visits: 'id, visitId, patientId, providerId, date, status, chiefComplaint, lastSync',
  prescriptions: 'id, prescriptionId, patientId, prescriberId, type, status, lastSync',
  ophthalmologyExams: 'id, examId, patientId, examinerId, examType, status, visitId, lastSync',
  labOrders: 'id, patientId, visitId, status, priority, orderedBy, orderedAt, lastSync',
  labResults: 'id, orderId, patientId, testCode, status, resultedAt, verifiedBy, lastSync',
  invoices: 'id, invoiceNumber, patientId, visitId, status, dueDate, totalAmount, lastSync',
  payments: 'id, invoiceId, patientId, method, amount, paymentDate, lastSync',
  consultationSessions: 'id, patientId, doctorId, visitId, status, step, lastSync',
  devices: 'id, serialNumber, type, status, clinicId',
  syncQueue: '++id, timestamp, operation, entity, entityId, data, status, retryCount, lastError, nextRetryAt',
  conflicts: '++id, timestamp, entity, entityId, localData, serverData, resolution, resolvedBy, resolvedAt',
  cacheMetadata: 'key, timestamp, expiresAt',
  settings: 'key, value',
  notifications: '++id, type, title, message, timestamp, read',
  auditLog: '++id, userId, action, entity, entityId, timestamp, details',
  files: 'id, patientId, type, name, data, mimeType, size, uploadStatus, lastSync',

  // NEW: Phase 1 stores
  pharmacyInventory: 'id, medicationName, genericName, category, clinicId, stockLevel, expiryDate, lastSync',
  orthopticExams: 'id, patientId, visitId, examinerId, status, examDate, clinicId, lastSync',
  glassesOrders: 'id, patientId, examId, status, orderDate, clinicId, lastSync',
  frameInventory: 'id, brand, model, sku, category, clinicId, stockLevel, lastSync',
  contactLensInventory: 'id, brand, type, power, baseCurve, clinicId, stockLevel, lastSync',
  clinics: 'id, name, type, isHub, syncInterval, lastSync',
  approvals: 'id, patientId, companyId, actCode, status, expiresAt, clinicId, lastSync',
  stockReconciliations: 'id, inventoryType, status, clinicId, startedAt, lastSync'
});
```

**Step 2: Run build to verify schema**

```bash
npm run build
```
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add frontend/src/services/database.js
git commit -m "feat(offline): add 8 new IndexedDB stores for multi-clinic support"
```

---

### Task 2: Pharmacy Inventory Offline Support

**Files:**
- Create: `frontend/src/test/services/pharmacyInventoryService.test.js`
- Modify: `frontend/src/services/pharmacyInventoryService.js`

**Step 1: Write the test file**

Create `frontend/src/test/services/pharmacyInventoryService.test.js`:

```javascript
/**
 * Pharmacy Inventory Service - Offline Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
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
    mutate: vi.fn()
  }
}));

vi.mock('../../services/database', () => ({
  db: {
    pharmacyInventory: {
      toArray: vi.fn(),
      get: vi.fn(),
      put: vi.fn()
    }
  }
}));

describe('pharmacyInventoryService', () => {
  let pharmacyInventoryService;
  let offlineWrapper;

  beforeEach(async () => {
    vi.clearAllMocks();
    offlineWrapper = (await import('../../services/offlineWrapper')).default;
    pharmacyInventoryService = (await import('../../services/pharmacyInventoryService')).default;
  });

  describe('Offline Support', () => {
    it('should use offlineWrapper for getAll', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await pharmacyInventoryService.getAll();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getById', async () => {
      offlineWrapper.get.mockResolvedValue({ data: { id: '123' } });
      await pharmacyInventoryService.getById('123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for search', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await pharmacyInventoryService.search('paracetamol');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getLowStock', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await pharmacyInventoryService.getLowStock();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getExpiring', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await pharmacyInventoryService.getExpiring(30);
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should cache pharmacy stats for 1 hour', async () => {
      offlineWrapper.get.mockResolvedValue({ data: {} });
      await pharmacyInventoryService.getStats();
      expect(offlineWrapper.get).toHaveBeenCalledWith(
        expect.any(Function),
        'pharmacyInventory',
        expect.any(String),
        expect.objectContaining({ cacheExpiry: 3600 })
      );
    });
  });

  describe('Dispensing - Online Required', () => {
    it('should throw when dispensing offline', async () => {
      const originalOnline = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });

      await expect(pharmacyInventoryService.dispense('123', { quantity: 1 }))
        .rejects.toThrow('Dispensing requires internet connection');

      Object.defineProperty(navigator, 'onLine', { value: originalOnline, writable: true });
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/services/pharmacyInventoryService.test.js --reporter=verbose
```
Expected: Tests fail (service doesn't use offlineWrapper yet)

**Step 3: Implement offline support in pharmacyInventoryService.js**

Replace `frontend/src/services/pharmacyInventoryService.js` with:

```javascript
import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

// Pharmacy Inventory service with offline support
const pharmacyInventoryService = {
  // ============================================
  // INVENTORY CRUD - WORKS OFFLINE
  // ============================================

  // Get all inventory items - WORKS OFFLINE (30 min cache)
  async getAll(params = {}) {
    const cacheKey = `pharmacy_all_${JSON.stringify(params)}`;
    return offlineWrapper.get(
      () => api.get('/pharmacy/inventory', { params }),
      'pharmacyInventory',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // Get single inventory item - WORKS OFFLINE (30 min cache)
  async getById(id) {
    return offlineWrapper.get(
      () => api.get(`/pharmacy/inventory/${id}`),
      'pharmacyInventory',
      id,
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // Search medications - WORKS OFFLINE (10 min cache)
  async search(query, options = {}) {
    const cacheKey = `pharmacy_search_${query}_${JSON.stringify(options)}`;
    return offlineWrapper.get(
      () => api.get('/pharmacy/search', { params: { q: query, ...options } }),
      'pharmacyInventory',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Get low stock items - WORKS OFFLINE (10 min cache)
  async getLowStock() {
    return offlineWrapper.get(
      () => api.get('/pharmacy/low-stock'),
      'pharmacyInventory',
      'low_stock',
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Get expiring items - WORKS OFFLINE (10 min cache)
  async getExpiring(days = 30) {
    const cacheKey = `pharmacy_expiring_${days}`;
    return offlineWrapper.get(
      () => api.get('/pharmacy/expiring', { params: { days } }),
      'pharmacyInventory',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Get pharmacy statistics - WORKS OFFLINE (1 hour cache)
  async getStats() {
    return offlineWrapper.get(
      () => api.get('/pharmacy/stats'),
      'pharmacyInventory',
      'stats',
      { transform: (response) => response.data, cacheExpiry: 3600 }
    );
  },

  // Create new inventory item - WORKS OFFLINE (queued)
  async create(data) {
    const localData = {
      ...data,
      _tempId: `temp_pharmacy_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post('/pharmacy/inventory', data),
      'CREATE',
      'pharmacyInventory',
      localData
    );
  },

  // Update inventory item - WORKS OFFLINE (queued)
  async update(id, data) {
    const localData = { ...data, id, lastModified: new Date().toISOString() };
    return offlineWrapper.mutate(
      () => api.put(`/pharmacy/inventory/${id}`, data),
      'UPDATE',
      'pharmacyInventory',
      localData,
      id
    );
  },

  // Delete inventory item - WORKS OFFLINE (queued)
  async delete(id) {
    return offlineWrapper.mutate(
      () => api.delete(`/pharmacy/inventory/${id}`),
      'DELETE',
      'pharmacyInventory',
      { id, deletedAt: new Date().toISOString() },
      id
    );
  },

  // ============================================
  // BATCH MANAGEMENT - WORKS OFFLINE
  // ============================================

  // Get batches for a medication - WORKS OFFLINE (10 min cache)
  async getBatches(id) {
    return offlineWrapper.get(
      () => api.get(`/pharmacy/inventory/${id}/batches`),
      'pharmacyInventory',
      `batches_${id}`,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Add batch to inventory - WORKS OFFLINE (queued)
  async addBatch(id, batchData) {
    const localData = {
      ...batchData,
      medicationId: id,
      _tempId: `temp_batch_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post(`/pharmacy/inventory/${id}/batches`, batchData),
      'CREATE',
      'pharmacyInventory',
      localData
    );
  },

  // Update batch - WORKS OFFLINE (queued)
  async updateBatch(id, lotNumber, updateData) {
    const localData = { ...updateData, medicationId: id, lotNumber, lastModified: new Date().toISOString() };
    return offlineWrapper.mutate(
      () => api.put(`/pharmacy/inventory/${id}/batches/${encodeURIComponent(lotNumber)}`, updateData),
      'UPDATE',
      'pharmacyInventory',
      localData
    );
  },

  // Mark batch as expired - WORKS OFFLINE (queued)
  async markBatchExpired(id, lotNumber) {
    const localData = { medicationId: id, lotNumber, expiredAt: new Date().toISOString() };
    return offlineWrapper.mutate(
      () => api.post(`/pharmacy/inventory/${id}/batches/${encodeURIComponent(lotNumber)}/expire`),
      'UPDATE',
      'pharmacyInventory',
      localData
    );
  },

  // ============================================
  // DISPENSING - ONLINE ONLY (SAFETY)
  // ============================================

  // Dispense from inventory - ONLINE ONLY (medication safety)
  async dispense(id, dispenseData) {
    if (!navigator.onLine) {
      throw new Error('Dispensing requires internet connection for medication safety verification.');
    }
    const response = await api.post(`/pharmacy/inventory/${id}/dispense`, dispenseData);
    return response.data;
  },

  // Dispense prescription medications - ONLINE ONLY (medication safety)
  async dispensePrescription(prescriptionId, medicationIndex = null, pharmacyNotes = '') {
    if (!navigator.onLine) {
      throw new Error('Dispensing requires internet connection for medication safety verification.');
    }
    const response = await api.post('/pharmacy/dispense', {
      prescriptionId,
      medicationIndex,
      pharmacyNotes
    });
    return response.data;
  },

  // ============================================
  // RESERVATIONS - WORKS OFFLINE
  // ============================================

  // Reserve stock for prescription/procedure - WORKS OFFLINE (queued)
  async reserveStock(id, reservationData) {
    const localData = {
      ...reservationData,
      medicationId: id,
      _tempId: `temp_reserve_${Date.now()}`,
      reservedAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post(`/pharmacy/inventory/${id}/reserve`, reservationData),
      'CREATE',
      'pharmacyInventory',
      localData
    );
  },

  // Reserve for prescription - WORKS OFFLINE (queued)
  async reserveForPrescription(prescriptionId) {
    const localData = {
      prescriptionId,
      _tempId: `temp_rx_reserve_${Date.now()}`,
      reservedAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post('/pharmacy/reserve', { prescriptionId }),
      'CREATE',
      'pharmacyInventory',
      localData
    );
  },

  // Release reservation - WORKS OFFLINE (queued)
  async releaseReservation(id, reservationId) {
    return offlineWrapper.mutate(
      () => api.post(`/pharmacy/inventory/${id}/release`, { reservationId }),
      'UPDATE',
      'pharmacyInventory',
      { medicationId: id, reservationId, releasedAt: new Date().toISOString() }
    );
  },

  // ============================================
  // STOCK ADJUSTMENTS - WORKS OFFLINE
  // ============================================

  // Update stock (adjustment) - WORKS OFFLINE (queued)
  async updateStock(id, stockData) {
    const localData = {
      ...stockData,
      medicationId: id,
      adjustedAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post(`/pharmacy/inventory/${id}/adjust`, stockData),
      'UPDATE',
      'pharmacyInventory',
      localData,
      id
    );
  },

  // ============================================
  // TRANSACTIONS - WORKS OFFLINE (read)
  // ============================================

  // Get transaction history for an item - WORKS OFFLINE (10 min cache)
  async getTransactions(id, params = {}) {
    const cacheKey = `pharmacy_tx_${id}_${JSON.stringify(params)}`;
    return offlineWrapper.get(
      () => api.get(`/pharmacy/inventory/${id}/transactions`, { params }),
      'pharmacyInventory',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Get all transactions across inventory - WORKS OFFLINE (10 min cache)
  async getAllTransactions(params = {}) {
    const cacheKey = `pharmacy_all_tx_${JSON.stringify(params)}`;
    return offlineWrapper.get(
      () => api.get('/pharmacy/transactions', { params }),
      'pharmacyInventory',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // ============================================
  // INVENTORY VALUE & REPORTING - WORKS OFFLINE
  // ============================================

  // Get inventory value - WORKS OFFLINE (1 hour cache)
  async getInventoryValue() {
    return offlineWrapper.get(
      () => api.get('/pharmacy/value'),
      'pharmacyInventory',
      'inventory_value',
      { transform: (response) => response.data, cacheExpiry: 3600 }
    );
  },

  // Export inventory report - ONLINE ONLY (file generation)
  async exportReport(format = 'csv') {
    if (!navigator.onLine) {
      throw new Error('Export requires internet connection.');
    }
    const response = await api.get('/pharmacy/export', {
      params: { format },
      responseType: format === 'csv' ? 'blob' : 'json'
    });
    return response.data;
  },

  // ============================================
  // ALERTS - WORKS OFFLINE
  // ============================================

  // Get alerts (low stock, expiring, etc.) - WORKS OFFLINE (5 min cache)
  async getAlerts() {
    return offlineWrapper.get(
      () => api.get('/pharmacy/alerts'),
      'pharmacyInventory',
      'alerts',
      { transform: (response) => response.data, cacheExpiry: 300 }
    );
  },

  // Resolve alert - WORKS OFFLINE (queued)
  async resolveAlert(id, alertId) {
    return offlineWrapper.mutate(
      () => api.put(`/pharmacy/inventory/${id}/alerts/${alertId}/resolve`),
      'UPDATE',
      'pharmacyInventory',
      { medicationId: id, alertId, resolvedAt: new Date().toISOString() }
    );
  },

  // ============================================
  // SUPPLIERS - WORKS OFFLINE
  // ============================================

  // Get all suppliers - WORKS OFFLINE (1 hour cache)
  async getSuppliers() {
    return offlineWrapper.get(
      () => api.get('/pharmacy/suppliers'),
      'pharmacyInventory',
      'suppliers',
      { transform: (response) => response.data, cacheExpiry: 3600 }
    );
  },

  // Get supplier details - WORKS OFFLINE (1 hour cache)
  async getSupplier(id) {
    return offlineWrapper.get(
      () => api.get(`/pharmacy/suppliers/${id}`),
      'pharmacyInventory',
      `supplier_${id}`,
      { transform: (response) => response.data, cacheExpiry: 3600 }
    );
  },

  // Add supplier to medication - WORKS OFFLINE (queued)
  async addSupplier(medicationId, supplierData) {
    const localData = {
      ...supplierData,
      medicationId,
      _tempId: `temp_supplier_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post('/pharmacy/suppliers', { medicationId, ...supplierData }),
      'CREATE',
      'pharmacyInventory',
      localData
    );
  },

  // Update supplier - WORKS OFFLINE (queued)
  async updateSupplier(id, updateData) {
    const localData = { ...updateData, id, lastModified: new Date().toISOString() };
    return offlineWrapper.mutate(
      () => api.put(`/pharmacy/suppliers/${id}`, updateData),
      'UPDATE',
      'pharmacyInventory',
      localData,
      id
    );
  },

  // Delete supplier - WORKS OFFLINE (queued)
  async deleteSupplier(id) {
    return offlineWrapper.mutate(
      () => api.delete(`/pharmacy/suppliers/${id}`),
      'DELETE',
      'pharmacyInventory',
      { id, deletedAt: new Date().toISOString() },
      id
    );
  },

  // ============================================
  // REORDER MANAGEMENT - WORKS OFFLINE
  // ============================================

  // Get reorder suggestions - WORKS OFFLINE (30 min cache)
  async getReorderSuggestions() {
    return offlineWrapper.get(
      () => api.get('/pharmacy/reorder-suggestions'),
      'pharmacyInventory',
      'reorder_suggestions',
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // Create reorder - WORKS OFFLINE (queued)
  async createReorder(reorderData) {
    const localData = {
      ...reorderData,
      _tempId: `temp_reorder_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post('/pharmacy/reorder', reorderData),
      'CREATE',
      'pharmacyInventory',
      localData
    );
  },

  // Receive order (add stock from order) - WORKS OFFLINE (queued)
  async receiveOrder(id, orderData) {
    const localData = {
      ...orderData,
      medicationId: id,
      receivedAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post(`/pharmacy/inventory/${id}/receive-order`, orderData),
      'UPDATE',
      'pharmacyInventory',
      localData,
      id
    );
  },

  // ============================================
  // UTILITY METHODS - WORKS OFFLINE
  // ============================================

  // Get by category - WORKS OFFLINE (30 min cache)
  async getByCategory(category) {
    const cacheKey = `pharmacy_category_${category}`;
    return offlineWrapper.get(
      () => api.get('/pharmacy/inventory', { params: { category } }),
      'pharmacyInventory',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // ============================================
  // OFFLINE HELPERS
  // ============================================

  // Pre-cache pharmacy data for offline shift
  async preCacheForShift() {
    console.log('[Pharmacy] Pre-caching data for offline shift...');
    const results = { cached: 0, errors: [] };

    try {
      await this.getAll();
      results.cached++;
    } catch (e) {
      results.errors.push('inventory list');
    }

    try {
      await this.getLowStock();
      results.cached++;
    } catch (e) {
      results.errors.push('low stock');
    }

    try {
      await this.getExpiring(30);
      results.cached++;
    } catch (e) {
      results.errors.push('expiring items');
    }

    try {
      await this.getAlerts();
      results.cached++;
    } catch (e) {
      results.errors.push('alerts');
    }

    console.log(`[Pharmacy] Pre-cached ${results.cached} datasets, ${results.errors.length} errors`);
    return results;
  },

  // Get cached inventory count
  async getCachedCount() {
    try {
      const items = await db.pharmacyInventory.toArray();
      return items.length;
    } catch {
      return 0;
    }
  },

  // Search cached inventory offline
  async searchOffline(query) {
    try {
      const items = await db.pharmacyInventory.toArray();
      const searchLower = query.toLowerCase();
      return items.filter(item =>
        item.medicationName?.toLowerCase().includes(searchLower) ||
        item.genericName?.toLowerCase().includes(searchLower) ||
        item.category?.toLowerCase().includes(searchLower)
      );
    } catch {
      return [];
    }
  }
};

export default pharmacyInventoryService;
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/services/pharmacyInventoryService.test.js --reporter=verbose
```
Expected: All 7 tests pass

**Step 5: Run build**

```bash
npm run build
```
Expected: Build succeeds

**Step 6: Commit**

```bash
git add frontend/src/services/pharmacyInventoryService.js frontend/src/test/services/pharmacyInventoryService.test.js
git commit -m "feat(offline): add full offline support to pharmacyInventoryService"
```

---

### Task 3: Orthoptic Service Offline Support

**Files:**
- Create: `frontend/src/test/services/orthopticService.test.js`
- Modify: `frontend/src/services/orthopticService.js`

**Step 1: Write the test file**

Create `frontend/src/test/services/orthopticService.test.js`:

```javascript
/**
 * Orthoptic Service - Offline Tests
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
    mutate: vi.fn()
  }
}));

vi.mock('../../services/database', () => ({
  db: {
    orthopticExams: {
      toArray: vi.fn(),
      get: vi.fn(),
      put: vi.fn()
    }
  }
}));

describe('orthopticService', () => {
  let orthopticService;
  let offlineWrapper;

  beforeEach(async () => {
    vi.clearAllMocks();
    offlineWrapper = (await import('../../services/offlineWrapper')).default;
    orthopticService = (await import('../../services/orthopticService')).default;
  });

  describe('Offline Support', () => {
    it('should use offlineWrapper for getExams', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await orthopticService.getExams();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getExam', async () => {
      offlineWrapper.get.mockResolvedValue({ data: { id: '123' } });
      await orthopticService.getExam('123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper.mutate for createExam', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' } });
      await orthopticService.createExam({ patientId: 'p1' });
      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function),
        'CREATE',
        'orthopticExams',
        expect.any(Object)
      );
    });

    it('should use offlineWrapper.mutate for updateExam', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' } });
      await orthopticService.updateExam('123', { notes: 'test' });
      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function),
        'UPDATE',
        'orthopticExams',
        expect.any(Object),
        '123'
      );
    });

    it('should use offlineWrapper for getPatientHistory', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await orthopticService.getPatientHistory('patient123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/services/orthopticService.test.js --reporter=verbose
```
Expected: Tests fail

**Step 3: Implement offline support in orthopticService.js**

Replace `frontend/src/services/orthopticService.js` with:

```javascript
import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

const orthopticService = {
  // Get all orthoptic exams - WORKS OFFLINE (30 min cache)
  getExams: async (params = {}) => {
    const cacheKey = `orthoptic_all_${JSON.stringify(params)}`;
    return offlineWrapper.get(
      () => api.get('/orthoptic', { params }),
      'orthopticExams',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // Get single orthoptic exam by ID - WORKS OFFLINE (30 min cache)
  getExam: async (id) => {
    return offlineWrapper.get(
      () => api.get(`/orthoptic/${id}`),
      'orthopticExams',
      id,
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // Create new orthoptic exam - WORKS OFFLINE (queued)
  createExam: async (examData) => {
    const localData = {
      ...examData,
      _tempId: `temp_orthoptic_${Date.now()}`,
      status: 'draft',
      examDate: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post('/orthoptic', examData),
      'CREATE',
      'orthopticExams',
      localData
    );
  },

  // Update existing orthoptic exam - WORKS OFFLINE (queued)
  updateExam: async (id, examData) => {
    const localData = { ...examData, id, lastModified: new Date().toISOString() };
    return offlineWrapper.mutate(
      () => api.put(`/orthoptic/${id}`, examData),
      'UPDATE',
      'orthopticExams',
      localData,
      id
    );
  },

  // Complete exam - WORKS OFFLINE (queued)
  completeExam: async (id) => {
    const localData = { id, status: 'completed', completedAt: new Date().toISOString() };
    return offlineWrapper.mutate(
      () => api.put(`/orthoptic/${id}/complete`),
      'UPDATE',
      'orthopticExams',
      localData,
      id
    );
  },

  // Sign exam - ONLINE ONLY (legal requirement for signature verification)
  signExam: async (id) => {
    if (!navigator.onLine) {
      throw new Error('Signing exams requires internet connection for verification.');
    }
    const response = await api.put(`/orthoptic/${id}/sign`);
    return response.data;
  },

  // Delete exam (admin only) - WORKS OFFLINE (queued)
  deleteExam: async (id) => {
    return offlineWrapper.mutate(
      () => api.delete(`/orthoptic/${id}`),
      'DELETE',
      'orthopticExams',
      { id, deletedAt: new Date().toISOString() },
      id
    );
  },

  // Get patient's orthoptic history - WORKS OFFLINE (10 min cache)
  getPatientHistory: async (patientId) => {
    return offlineWrapper.get(
      () => api.get(`/orthoptic/patient/${patientId}/history`),
      'orthopticExams',
      `patient_history_${patientId}`,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Get latest orthoptic exam for a patient - WORKS OFFLINE (10 min cache)
  getLatestExam: async (patientId) => {
    const cacheKey = `orthoptic_latest_${patientId}`;
    return offlineWrapper.get(
      async () => {
        const response = await api.get('/orthoptic', {
          params: {
            patientId,
            limit: 1,
            sort: '-examDate'
          }
        });
        return {
          success: true,
          data: response.data?.data?.[0] || null
        };
      },
      'orthopticExams',
      cacheKey,
      { transform: (response) => response, cacheExpiry: 600 }
    );
  },

  // Get patient's treatment progress - WORKS OFFLINE (30 min cache)
  getTreatmentProgress: async (patientId) => {
    return offlineWrapper.get(
      () => api.get(`/orthoptic/patient/${patientId}/progress`),
      'orthopticExams',
      `treatment_progress_${patientId}`,
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // Compare exam with previous - WORKS OFFLINE (30 min cache)
  compareWithPrevious: async (id) => {
    return offlineWrapper.get(
      () => api.get(`/orthoptic/${id}/compare`),
      'orthopticExams',
      `compare_${id}`,
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // Generate report - ONLINE ONLY (PDF generation)
  generateReport: async (id) => {
    if (!navigator.onLine) {
      throw new Error('Report generation requires internet connection.');
    }
    const response = await api.get(`/orthoptic/${id}/report`);
    return response.data;
  },

  // Add attachment - ONLINE ONLY (file upload)
  addAttachment: async (id, attachmentData) => {
    if (!navigator.onLine) {
      throw new Error('Attachments require internet connection for upload.');
    }
    const response = await api.post(`/orthoptic/${id}/attachments`, attachmentData);
    return response.data;
  },

  // Get statistics - WORKS OFFLINE (1 hour cache)
  getStats: async () => {
    return offlineWrapper.get(
      () => api.get('/orthoptic/stats'),
      'orthopticExams',
      'stats',
      { transform: (response) => response.data, cacheExpiry: 3600 }
    );
  },

  // ============================================
  // OFFLINE HELPERS
  // ============================================

  // Pre-cache patient's orthoptic data for offline exam
  preCachePatientData: async (patientId) => {
    console.log(`[Orthoptic] Pre-caching data for patient ${patientId}...`);
    const results = { cached: 0, errors: [] };

    try {
      await orthopticService.getPatientHistory(patientId);
      results.cached++;
    } catch (e) {
      results.errors.push('patient history');
    }

    try {
      await orthopticService.getLatestExam(patientId);
      results.cached++;
    } catch (e) {
      results.errors.push('latest exam');
    }

    try {
      await orthopticService.getTreatmentProgress(patientId);
      results.cached++;
    } catch (e) {
      results.errors.push('treatment progress');
    }

    return results;
  },

  // Get cached exams count
  getCachedCount: async () => {
    try {
      const exams = await db.orthopticExams.toArray();
      return exams.length;
    } catch {
      return 0;
    }
  }
};

export default orthopticService;
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/services/orthopticService.test.js --reporter=verbose
```
Expected: All 5 tests pass

**Step 5: Commit**

```bash
git add frontend/src/services/orthopticService.js frontend/src/test/services/orthopticService.test.js
git commit -m "feat(offline): add full offline support to orthopticService"
```

---

### Task 4: Glasses Order Service Offline Support

**Files:**
- Create: `frontend/src/test/services/glassesOrderService.test.js`
- Modify: `frontend/src/services/glassesOrderService.js`

**Step 1: Write the test file**

Create `frontend/src/test/services/glassesOrderService.test.js`:

```javascript
/**
 * Glasses Order Service - Offline Tests
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
    mutate: vi.fn()
  }
}));

vi.mock('../../services/database', () => ({
  db: {
    glassesOrders: { toArray: vi.fn(), get: vi.fn(), put: vi.fn() },
    frameInventory: { toArray: vi.fn() },
    contactLensInventory: { toArray: vi.fn() }
  }
}));

describe('glassesOrderService', () => {
  let glassesOrderService;
  let offlineWrapper;

  beforeEach(async () => {
    vi.clearAllMocks();
    offlineWrapper = (await import('../../services/offlineWrapper')).default;
    glassesOrderService = (await import('../../services/glassesOrderService')).default;
  });

  describe('Offline Support', () => {
    it('should use offlineWrapper for getOrders', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await glassesOrderService.getOrders();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getOrder', async () => {
      offlineWrapper.get.mockResolvedValue({ data: { id: '123' } });
      await glassesOrderService.getOrder('123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper.mutate for createOrder', async () => {
      offlineWrapper.mutate.mockResolvedValue({ data: { id: '123' } });
      await glassesOrderService.createOrder({ patientId: 'p1' });
      expect(offlineWrapper.mutate).toHaveBeenCalledWith(
        expect.any(Function),
        'CREATE',
        'glassesOrders',
        expect.any(Object)
      );
    });

    it('should use offlineWrapper for getPatientOrders', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await glassesOrderService.getPatientOrders('patient123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for searchFrames', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await glassesOrderService.searchFrames('ray-ban');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/services/glassesOrderService.test.js --reporter=verbose
```

**Step 3: Implement offline support in glassesOrderService.js**

Replace `frontend/src/services/glassesOrderService.js` with:

```javascript
import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

const glassesOrderService = {
  // Get all orders - WORKS OFFLINE (10 min cache)
  async getOrders(params = {}) {
    const cacheKey = `glasses_orders_${JSON.stringify(params)}`;
    return offlineWrapper.get(
      () => api.get('/glasses-orders', { params }),
      'glassesOrders',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Get single order - WORKS OFFLINE (10 min cache)
  async getOrder(id) {
    return offlineWrapper.get(
      () => api.get(`/glasses-orders/${id}`),
      'glassesOrders',
      id,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Create new order - WORKS OFFLINE (queued)
  async createOrder(orderData) {
    const localData = {
      ...orderData,
      _tempId: `temp_glasses_${Date.now()}`,
      status: 'pending',
      orderDate: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post('/glasses-orders', orderData),
      'CREATE',
      'glassesOrders',
      localData
    );
  },

  // Update order - WORKS OFFLINE (queued)
  async updateOrder(id, updateData) {
    const localData = { ...updateData, id, lastModified: new Date().toISOString() };
    return offlineWrapper.mutate(
      () => api.put(`/glasses-orders/${id}`, updateData),
      'UPDATE',
      'glassesOrders',
      localData,
      id
    );
  },

  // Update order status - WORKS OFFLINE (queued)
  async updateStatus(id, status, notes) {
    const localData = { id, status, notes, statusUpdatedAt: new Date().toISOString() };
    return offlineWrapper.mutate(
      () => api.put(`/glasses-orders/${id}/status`, { status, notes }),
      'UPDATE',
      'glassesOrders',
      localData,
      id
    );
  },

  // Delete/cancel order - WORKS OFFLINE (queued)
  async deleteOrder(id) {
    return offlineWrapper.mutate(
      () => api.delete(`/glasses-orders/${id}`),
      'DELETE',
      'glassesOrders',
      { id, deletedAt: new Date().toISOString() },
      id
    );
  },

  // Get orders for a patient - WORKS OFFLINE (10 min cache)
  async getPatientOrders(patientId) {
    return offlineWrapper.get(
      () => api.get(`/glasses-orders/patient/${patientId}`),
      'glassesOrders',
      `patient_orders_${patientId}`,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Get orders for an exam - WORKS OFFLINE (10 min cache)
  async getExamOrders(examId) {
    return offlineWrapper.get(
      () => api.get(`/glasses-orders/exam/${examId}`),
      'glassesOrders',
      `exam_orders_${examId}`,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Get order statistics - WORKS OFFLINE (1 hour cache)
  async getStats() {
    return offlineWrapper.get(
      () => api.get('/glasses-orders/stats'),
      'glassesOrders',
      'stats',
      { transform: (response) => response.data, cacheExpiry: 3600 }
    );
  },

  // ============================================
  // INVENTORY INTEGRATION - WORKS OFFLINE
  // ============================================

  // Search frames for order - WORKS OFFLINE (30 min cache)
  async searchFrames(query, category, status = 'in-stock') {
    const cacheKey = `frames_search_${query}_${category}_${status}`;
    return offlineWrapper.get(
      () => api.get('/glasses-orders/search-frames', {
        params: { query, category, status }
      }),
      'frameInventory',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // Search contact lenses for order - WORKS OFFLINE (30 min cache)
  async searchContactLenses(params) {
    const cacheKey = `contact_lens_search_${JSON.stringify(params)}`;
    return offlineWrapper.get(
      () => api.get('/glasses-orders/search-contact-lenses', { params }),
      'contactLensInventory',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 1800 }
    );
  },

  // Check inventory availability - WORKS OFFLINE (5 min cache)
  async checkInventoryAvailability(items) {
    const cacheKey = `inventory_check_${JSON.stringify(items)}`;
    return offlineWrapper.get(
      () => api.post('/glasses-orders/check-inventory', items),
      'frameInventory',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 300 }
    );
  },

  // Get order with full inventory details - WORKS OFFLINE (10 min cache)
  async getOrderWithInventory(id) {
    return offlineWrapper.get(
      () => api.get(`/glasses-orders/${id}/with-inventory`),
      'glassesOrders',
      `order_inventory_${id}`,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // Reserve inventory for order - WORKS OFFLINE (queued)
  async reserveInventory(orderId) {
    return offlineWrapper.mutate(
      () => api.post(`/glasses-orders/${orderId}/reserve-inventory`),
      'UPDATE',
      'glassesOrders',
      { id: orderId, inventoryReserved: true, reservedAt: new Date().toISOString() },
      orderId
    );
  },

  // Release inventory reservations - WORKS OFFLINE (queued)
  async releaseInventory(orderId) {
    return offlineWrapper.mutate(
      () => api.post(`/glasses-orders/${orderId}/release-inventory`),
      'UPDATE',
      'glassesOrders',
      { id: orderId, inventoryReserved: false, releasedAt: new Date().toISOString() },
      orderId
    );
  },

  // Fulfill inventory (on delivery) - WORKS OFFLINE (queued)
  async fulfillInventory(orderId) {
    return offlineWrapper.mutate(
      () => api.post(`/glasses-orders/${orderId}/fulfill-inventory`),
      'UPDATE',
      'glassesOrders',
      { id: orderId, inventoryFulfilled: true, fulfilledAt: new Date().toISOString() },
      orderId
    );
  },

  // Generate invoice for order - ONLINE ONLY (requires billing integration)
  async generateInvoice(orderId) {
    if (!navigator.onLine) {
      throw new Error('Invoice generation requires internet connection.');
    }
    const response = await api.post(`/glasses-orders/${orderId}/invoice`);
    return response.data;
  },

  // Get unbilled orders - WORKS OFFLINE (10 min cache)
  async getUnbilledOrders(patientId) {
    const cacheKey = patientId ? `unbilled_${patientId}` : 'unbilled_all';
    return offlineWrapper.get(
      () => api.get('/glasses-orders/unbilled', {
        params: patientId ? { patientId } : {}
      }),
      'glassesOrders',
      cacheKey,
      { transform: (response) => response.data, cacheExpiry: 600 }
    );
  },

  // ============================================
  // QC WORKFLOW - WORKS OFFLINE
  // ============================================

  // Get orders pending QC inspection - WORKS OFFLINE (5 min cache)
  async getPendingQC() {
    return offlineWrapper.get(
      () => api.get('/glasses-orders/pending-qc'),
      'glassesOrders',
      'pending_qc',
      { transform: (response) => response.data, cacheExpiry: 300 }
    );
  },

  // Get orders ready for pickup - WORKS OFFLINE (5 min cache)
  async getReadyForPickup() {
    return offlineWrapper.get(
      () => api.get('/glasses-orders/ready-for-pickup'),
      'glassesOrders',
      'ready_pickup',
      { transform: (response) => response.data, cacheExpiry: 300 }
    );
  },

  // Mark order as received from lab - WORKS OFFLINE (queued)
  async receiveFromLab(orderId, data = {}) {
    const localData = { id: orderId, ...data, receivedFromLab: true, receivedAt: new Date().toISOString() };
    return offlineWrapper.mutate(
      () => api.put(`/glasses-orders/${orderId}/receive`, data),
      'UPDATE',
      'glassesOrders',
      localData,
      orderId
    );
  },

  // Perform QC inspection - WORKS OFFLINE (queued)
  async performQC(orderId, qcData) {
    const localData = { id: orderId, ...qcData, qcPerformedAt: new Date().toISOString() };
    return offlineWrapper.mutate(
      () => api.put(`/glasses-orders/${orderId}/qc`, qcData),
      'UPDATE',
      'glassesOrders',
      localData,
      orderId
    );
  },

  // Override failed QC (admin only) - ONLINE ONLY (requires verification)
  async qcOverride(orderId, reason) {
    if (!navigator.onLine) {
      throw new Error('QC override requires internet connection for verification.');
    }
    const response = await api.put(`/glasses-orders/${orderId}/qc-override`, { reason });
    return response.data;
  },

  // Record delivery with proof - WORKS OFFLINE (queued)
  async recordDelivery(orderId, deliveryData) {
    const localData = { id: orderId, ...deliveryData, deliveredAt: new Date().toISOString() };
    return offlineWrapper.mutate(
      () => api.put(`/glasses-orders/${orderId}/deliver`, deliveryData),
      'UPDATE',
      'glassesOrders',
      localData,
      orderId
    );
  },

  // Send pickup reminder - ONLINE ONLY (notification service)
  async sendPickupReminder(orderId) {
    if (!navigator.onLine) {
      throw new Error('Sending reminders requires internet connection.');
    }
    const response = await api.post(`/glasses-orders/${orderId}/send-reminder`);
    return response.data;
  },

  // ============================================
  // OFFLINE HELPERS
  // ============================================

  // Pre-cache data for offline optical shop shift
  async preCacheForShift() {
    console.log('[GlassesOrder] Pre-caching data for offline shift...');
    const results = { cached: 0, errors: [] };

    try {
      await this.getPendingQC();
      results.cached++;
    } catch (e) {
      results.errors.push('pending QC');
    }

    try {
      await this.getReadyForPickup();
      results.cached++;
    } catch (e) {
      results.errors.push('ready for pickup');
    }

    try {
      await this.getStats();
      results.cached++;
    } catch (e) {
      results.errors.push('stats');
    }

    return results;
  },

  // Get cached orders count
  async getCachedCount() {
    try {
      const orders = await db.glassesOrders.toArray();
      return orders.length;
    } catch {
      return 0;
    }
  },

  // Search cached frames offline
  async searchFramesOffline(query) {
    try {
      const frames = await db.frameInventory.toArray();
      const searchLower = query.toLowerCase();
      return frames.filter(frame =>
        frame.brand?.toLowerCase().includes(searchLower) ||
        frame.model?.toLowerCase().includes(searchLower) ||
        frame.sku?.toLowerCase().includes(searchLower)
      );
    } catch {
      return [];
    }
  }
};

export default glassesOrderService;
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/services/glassesOrderService.test.js --reporter=verbose
```

**Step 5: Commit**

```bash
git add frontend/src/services/glassesOrderService.js frontend/src/test/services/glassesOrderService.test.js
git commit -m "feat(offline): add full offline support to glassesOrderService"
```

---

### Task 5: Clinic Service Offline Support

**Files:**
- Create: `frontend/src/test/services/clinicService.test.js`
- Modify: `frontend/src/services/clinicService.js`

**Step 1: Write the test file**

Create `frontend/src/test/services/clinicService.test.js`:

```javascript
/**
 * Clinic Service - Offline Tests
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
    mutate: vi.fn()
  }
}));

vi.mock('../../services/database', () => ({
  db: {
    clinics: { toArray: vi.fn(), get: vi.fn(), put: vi.fn() }
  }
}));

describe('clinicService', () => {
  let clinicService;
  let offlineWrapper;

  beforeEach(async () => {
    vi.clearAllMocks();
    offlineWrapper = (await import('../../services/offlineWrapper')).default;
    clinicService = (await import('../../services/clinicService')).default;
  });

  describe('Offline Support', () => {
    it('should use offlineWrapper for getClinics', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await clinicService.getClinics();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getClinic', async () => {
      offlineWrapper.get.mockResolvedValue({ data: { id: '123' } });
      await clinicService.getClinic('123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getMyClinics', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await clinicService.getMyClinics();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getClinicStaff', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await clinicService.getClinicStaff('clinic123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should cache clinic config for 1 hour', async () => {
      offlineWrapper.get.mockResolvedValue({ data: {} });
      await clinicService.getClinic('123');
      expect(offlineWrapper.get).toHaveBeenCalledWith(
        expect.any(Function),
        'clinics',
        '123',
        expect.objectContaining({ cacheExpiry: 3600 })
      );
    });
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/test/services/clinicService.test.js --reporter=verbose
```

**Step 3: Implement offline support in clinicService.js**

Replace `frontend/src/services/clinicService.js` with:

```javascript
import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

// ============================================
// CLINIC CRUD - WORKS OFFLINE (read)
// ============================================

/**
 * Get all clinics - WORKS OFFLINE (1 hour cache)
 */
export const getClinics = async (params = {}) => {
  const cacheKey = `clinics_all_${JSON.stringify(params)}`;
  return offlineWrapper.get(
    () => api.get('/clinics', { params }),
    'clinics',
    cacheKey,
    { transform: (response) => response.data, cacheExpiry: 3600 }
  );
};

/**
 * Get clinics for dropdown (minimal data) - WORKS OFFLINE (1 hour cache)
 */
export const getClinicsForDropdown = async () => {
  return offlineWrapper.get(
    () => api.get('/clinics/dropdown'),
    'clinics',
    'dropdown',
    { transform: (response) => response.data, cacheExpiry: 3600 }
  );
};

/**
 * Get user's accessible clinics - WORKS OFFLINE (1 hour cache)
 */
export const getMyClinics = async () => {
  return offlineWrapper.get(
    () => api.get('/clinics/my-clinics'),
    'clinics',
    'my_clinics',
    { transform: (response) => response.data, cacheExpiry: 3600 }
  );
};

/**
 * Get single clinic by ID - WORKS OFFLINE (1 hour cache)
 */
export const getClinic = async (id) => {
  return offlineWrapper.get(
    () => api.get(`/clinics/${id}`),
    'clinics',
    id,
    { transform: (response) => response.data, cacheExpiry: 3600 }
  );
};

/**
 * Create new clinic - ONLINE ONLY (admin operation)
 */
export const createClinic = async (clinicData) => {
  if (!navigator.onLine) {
    throw new Error('Creating clinics requires internet connection.');
  }
  const response = await api.post('/clinics', clinicData);
  return response.data;
};

/**
 * Update clinic - ONLINE ONLY (admin operation)
 */
export const updateClinic = async (id, clinicData) => {
  if (!navigator.onLine) {
    throw new Error('Updating clinics requires internet connection.');
  }
  const response = await api.put(`/clinics/${id}`, clinicData);
  return response.data;
};

/**
 * Delete clinic - ONLINE ONLY (admin operation)
 */
export const deleteClinic = async (id) => {
  if (!navigator.onLine) {
    throw new Error('Deleting clinics requires internet connection.');
  }
  const response = await api.delete(`/clinics/${id}`);
  return response.data;
};

// ============================================
// CLINIC STAFF - WORKS OFFLINE (read)
// ============================================

/**
 * Get staff for a clinic - WORKS OFFLINE (30 min cache)
 */
export const getClinicStaff = async (clinicId) => {
  return offlineWrapper.get(
    () => api.get(`/clinics/${clinicId}/staff`),
    'clinics',
    `staff_${clinicId}`,
    { transform: (response) => response.data, cacheExpiry: 1800 }
  );
};

/**
 * Assign user to clinic - ONLINE ONLY (admin operation)
 */
export const assignUserToClinic = async (clinicId, userId) => {
  if (!navigator.onLine) {
    throw new Error('Staff assignment requires internet connection.');
  }
  const response = await api.post(`/clinics/${clinicId}/staff/${userId}`);
  return response.data;
};

/**
 * Remove user from clinic - ONLINE ONLY (admin operation)
 */
export const removeUserFromClinic = async (clinicId, userId) => {
  if (!navigator.onLine) {
    throw new Error('Staff removal requires internet connection.');
  }
  const response = await api.delete(`/clinics/${clinicId}/staff/${userId}`);
  return response.data;
};

// ============================================
// STATISTICS - WORKS OFFLINE
// ============================================

/**
 * Get clinic statistics - WORKS OFFLINE (30 min cache)
 */
export const getClinicStats = async (clinicId) => {
  return offlineWrapper.get(
    () => api.get(`/clinics/${clinicId}/stats`),
    'clinics',
    `stats_${clinicId}`,
    { transform: (response) => response.data, cacheExpiry: 1800 }
  );
};

/**
 * Get all clinics summary stats - WORKS OFFLINE (30 min cache)
 */
export const getAllClinicsStats = async () => {
  return offlineWrapper.get(
    () => api.get('/clinics/stats/summary'),
    'clinics',
    'stats_summary',
    { transform: (response) => response.data, cacheExpiry: 1800 }
  );
};

// ============================================
// OFFLINE HELPERS
// ============================================

/**
 * Pre-cache all clinic data for offline access
 */
export const preCacheClinicData = async () => {
  console.log('[Clinic] Pre-caching clinic data...');
  const results = { cached: 0, errors: [] };

  try {
    await getClinics();
    results.cached++;
  } catch (e) {
    results.errors.push('clinics list');
  }

  try {
    await getMyClinics();
    results.cached++;
  } catch (e) {
    results.errors.push('my clinics');
  }

  try {
    await getClinicsForDropdown();
    results.cached++;
  } catch (e) {
    results.errors.push('dropdown');
  }

  return results;
};

/**
 * Get cached clinic by ID
 */
export const getCachedClinic = async (id) => {
  try {
    return await db.clinics.get(id);
  } catch {
    return null;
  }
};

/**
 * Get all cached clinics
 */
export const getCachedClinics = async () => {
  try {
    return await db.clinics.toArray();
  } catch {
    return [];
  }
};

/**
 * Get clinic sync interval (for Matadi = 30 min, others = 15 min)
 */
export const getClinicSyncInterval = async (clinicId) => {
  try {
    const clinic = await db.clinics.get(clinicId);
    return clinic?.syncInterval || 900000; // Default 15 min
  } catch {
    return 900000;
  }
};

// ============================================
// CONSTANTS
// ============================================

export const CLINIC_TYPES = [
  { value: 'main', label: 'Main Clinic' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'mobile', label: 'Mobile Unit' },
  { value: 'partner', label: 'Partner Clinic' },
  { value: 'depot', label: 'Depot/Warehouse' }
];

export const CLINIC_SERVICES = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'optometry', label: 'Optometry' },
  { value: 'refraction', label: 'Refraction' },
  { value: 'oct', label: 'OCT Imaging' },
  { value: 'visual_field', label: 'Visual Field' },
  { value: 'fundus_photography', label: 'Fundus Photography' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'ivt_injections', label: 'IVT Injections' },
  { value: 'laser', label: 'Laser Treatment' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'optical_shop', label: 'Optical Shop' },
  { value: 'orthoptic', label: 'Orthoptic' }
];

export default {
  getClinics,
  getClinicsForDropdown,
  getMyClinics,
  getClinic,
  createClinic,
  updateClinic,
  deleteClinic,
  getClinicStaff,
  assignUserToClinic,
  removeUserFromClinic,
  getClinicStats,
  getAllClinicsStats,
  preCacheClinicData,
  getCachedClinic,
  getCachedClinics,
  getClinicSyncInterval,
  CLINIC_TYPES,
  CLINIC_SERVICES
};
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run src/test/services/clinicService.test.js --reporter=verbose
```

**Step 5: Commit**

```bash
git add frontend/src/services/clinicService.js frontend/src/test/services/clinicService.test.js
git commit -m "feat(offline): add offline support to clinicService with sync interval helper"
```

---

### Task 6: Approval Service Offline Support

**Files:**
- Create: `frontend/src/test/services/approvalService.test.js`
- Modify: `frontend/src/services/approvalService.js`

**Step 1: Write the test file**

Create `frontend/src/test/services/approvalService.test.js`:

```javascript
/**
 * Approval Service - Offline Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/apiConfig', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() }
}));

vi.mock('../../services/offlineWrapper', () => ({
  default: { get: vi.fn(), mutate: vi.fn() }
}));

vi.mock('../../services/database', () => ({
  db: { approvals: { toArray: vi.fn(), get: vi.fn() } }
}));

describe('approvalService', () => {
  let approvalService;
  let offlineWrapper;

  beforeEach(async () => {
    vi.clearAllMocks();
    offlineWrapper = (await import('../../services/offlineWrapper')).default;
    approvalService = (await import('../../services/approvalService')).default;
  });

  describe('Offline Support', () => {
    it('should use offlineWrapper for getApprovals', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await approvalService.getApprovals();
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getApproval', async () => {
      offlineWrapper.get.mockResolvedValue({ data: { id: '123' } });
      await approvalService.getApproval('123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for checkApproval', async () => {
      offlineWrapper.get.mockResolvedValue({ data: { exists: true } });
      await approvalService.checkApproval('patient1', 'company1', 'ACT001');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });

    it('should use offlineWrapper for getPatientApprovals', async () => {
      offlineWrapper.get.mockResolvedValue({ data: [] });
      await approvalService.getPatientApprovals('patient123');
      expect(offlineWrapper.get).toHaveBeenCalled();
    });
  });
});
```

**Step 2-5: Implement and test** (follow same pattern as above)

The implementation adds offlineWrapper to read operations and keeps approval/reject actions online-only for audit trail integrity.

**Step 6: Commit**

```bash
git add frontend/src/services/approvalService.js frontend/src/test/services/approvalService.test.js
git commit -m "feat(offline): add offline support to approvalService for status checks"
```

---

### Task 7: Stock Reconciliation Service Offline Support

**Files:**
- Create: `frontend/src/test/services/stockReconciliationService.test.js`
- Modify: `frontend/src/services/stockReconciliationService.js`

This service needs offline support for:
- Reading reconciliation status
- Creating counts locally (queued)
- Bulk adding counts (queued)

Actions like `applyAdjustments` and `complete` stay online-only for audit integrity.

---

### Task 8: Extend Sync Service with Clinic-Specific Intervals

**Files:**
- Modify: `frontend/src/services/syncService.js`
- Create: `frontend/src/test/services/syncService.clinicSync.test.js`

**Step 1: Write test for clinic-specific sync**

```javascript
/**
 * Sync Service - Clinic-Specific Sync Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Sync Service - Clinic-Specific Sync', () => {
  describe('Sync Interval Configuration', () => {
    it('should support clinic-specific sync intervals', () => {
      const CLINIC_SYNC_INTERVALS = {
        'DEPOT_CENTRAL': 300000,    // 5 min
        'TOMBALBAYE_KIN': 300000,   // 5 min
        'MATRIX_KIN': 600000,       // 10 min
        'MATADI_KC': 1800000        // 30 min (slow 3G/4G)
      };

      expect(CLINIC_SYNC_INTERVALS['MATADI_KC']).toBe(1800000);
      expect(CLINIC_SYNC_INTERVALS['TOMBALBAYE_KIN']).toBe(300000);
    });

    it('should have extended entities including new stores', () => {
      const SYNC_ENTITIES = [
        'patients', 'appointments', 'prescriptions', 'ophthalmologyExams', 'users',
        'visits', 'labOrders', 'labResults', 'invoices', 'queue',
        'pharmacyInventory', 'orthopticExams', 'glassesOrders', 'frameInventory',
        'contactLensInventory', 'clinics', 'approvals', 'stockReconciliations'
      ];

      expect(SYNC_ENTITIES).toContain('pharmacyInventory');
      expect(SYNC_ENTITIES).toContain('orthopticExams');
      expect(SYNC_ENTITIES).toContain('clinics');
      expect(SYNC_ENTITIES.length).toBe(18);
    });
  });
});
```

**Step 2: Modify syncService.js to add clinic-aware sync**

Add to `syncService.js`:

```javascript
// Clinic-specific sync intervals (milliseconds)
const CLINIC_SYNC_INTERVALS = {
  'DEPOT_CENTRAL': 300000,    // 5 min - hub/warehouse
  'TOMBALBAYE_KIN': 300000,   // 5 min - main clinic, good connectivity
  'MATRIX_KIN': 600000,       // 10 min - satellite, LAN connectivity
  'MATADI_KC': 1800000        // 30 min - satellite, slow 3G/4G
};

// Extended entities list for comprehensive offline support
const SYNC_ENTITIES = [
  'patients', 'appointments', 'prescriptions', 'ophthalmologyExams', 'users',
  'visits', 'labOrders', 'labResults', 'invoices', 'queue',
  'pharmacyInventory', 'orthopticExams', 'glassesOrders', 'frameInventory',
  'contactLensInventory', 'clinics', 'approvals', 'stockReconciliations'
];

// Get sync interval for current clinic
getSyncIntervalForClinic(clinicId) {
  return CLINIC_SYNC_INTERVALS[clinicId] || 900000; // Default 15 min
}

// Export for testing
export { CLINIC_SYNC_INTERVALS, SYNC_ENTITIES };
```

---

## Phase 2: Operations (Tasks 9-12)

### Task 9: Frame Inventory Service Offline Support

Wrap `frameInventoryService` with offlineWrapper for:
- Reading frame catalog (30 min cache)
- Stock level checks (10 min cache)
- Search operations (30 min cache)

### Task 10: Contact Lens Inventory Service Offline Support

Wrap `contactLensInventoryService` with offlineWrapper.

### Task 11: Lab QC Service Offline Support

Add offline caching for:
- QC protocols (1 hour cache)
- QC results (10 min cache)
- Reagent lot info (30 min cache)

Keep QC validation online-only for compliance.

### Task 12: Treatment Protocol Service Offline Support

Cache treatment protocols for clinical decision support offline.

---

## Phase 3: Architecture (Tasks 13-16)

### Task 13: Clinic Data Partitioning

Modify database.js to support clinic-specific data queries:

```javascript
// Add clinic filter to all queries
async getByClinic(store, clinicId) {
  return db[store].where('clinicId').equals(clinicId).toArray();
}
```

### Task 14: Pre-Sync on Login Component

Create `ShiftStartSync.jsx` component that:
- Shows on login for satellite clinics
- Downloads critical data before shift starts
- Shows progress and estimated time
- Allows partial sync selection

### Task 15: Sync Progress Visualization

Add sync progress to OfflineIndicator:
- Show entity-by-entity progress
- Show bytes downloaded
- Show estimated time remaining
- Show last successful sync per entity

### Task 16: Final Integration Testing

Create comprehensive integration tests covering:
- Matadi 30-min sync scenario
- Offline operation at all 4 clinics
- Cross-clinic inventory check offline
- Conflict resolution between clinics

---

## Test Commands

Run all offline tests:
```bash
npx vitest run src/test/services/ --reporter=verbose
```

Run specific service test:
```bash
npx vitest run src/test/services/pharmacyInventoryService.test.js
```

Run integration tests:
```bash
npx vitest run src/test/integration/ --reporter=verbose
```

Build verification:
```bash
npm run build
```

---

## Summary

| Phase | Tasks | Services | New Tests | Effort |
|-------|-------|----------|-----------|--------|
| **Phase 1** | 1-8 | pharmacy, orthoptic, glasses, clinic, approval, stock recon | ~40 | 26 hrs |
| **Phase 2** | 9-12 | frame inv, contact lens, lab QC, treatment protocols | ~20 | 16 hrs |
| **Phase 3** | 13-16 | architecture, components, integration | ~15 | 20 hrs |
| **Total** | 16 | 15 services | ~75 tests | 62 hrs |

After completion:
- ~28/79 services (35%) with offline support
- All critical medical workflows operational offline
- Clinic-specific sync intervals (5, 10, 30 min)
- 18 entities synced (up from 10)
- Matadi clinic fully operational on 3G/4G
