import api from './apiConfig';
import offlineWrapper from './offlineWrapper';
import { db } from './database';

/**
 * Surgery Service
 *
 * API calls for surgery module:
 * - Dashboard statistics
 * - Queue management
 * - Scheduling
 * - Check-in workflow
 * - Surgery reports
 *
 * OFFLINE SUPPORT:
 * - Read operations cached (10-30 min)
 * - Critical operations (scheduling, completion, cancellation) ONLINE-ONLY
 * - Reports can be drafted offline, finalized online
 */

// ============================================
// ONLINE CHECK HELPERS
// ============================================

const isOnline = () => navigator.onLine;

const requireOnline = (operation) => {
  if (!isOnline()) {
    throw new Error(`${operation} nécessite une connexion internet pour des raisons de sécurité.`);
  }
};

const surgeryService = {
  // ============================================
  // DASHBOARD & STATISTICS
  // ============================================

  /**
   * Get surgery dashboard statistics - WORKS OFFLINE (10 min cache)
   */
  getDashboardStats: async (clinicId = null) => {
    const params = clinicId ? { clinic: clinicId } : {};
    const cacheKey = `dashboard_stats_${clinicId || 'all'}`;
    return offlineWrapper.get(
      () => api.get('/surgery/dashboard/stats', { params }),
      'surgeryCases',
      cacheKey,
      { cacheTime: 10 * 60 * 1000 }
    );
  },

  /**
   * Get available surgery types - WORKS OFFLINE (30 min cache)
   */
  getSurgeryTypes: async () => {
    return offlineWrapper.get(
      () => api.get('/surgery/types'),
      'surgeryCases',
      'surgery_types',
      { cacheTime: 30 * 60 * 1000 }
    );
  },

  // ============================================
  // QUEUE MANAGEMENT
  // ============================================

  /**
   * Get cases awaiting scheduling - WORKS OFFLINE (10 min cache)
   */
  getAwaitingScheduling: async (clinicId = null) => {
    const params = clinicId ? { clinic: clinicId } : {};
    const cacheKey = `awaiting_scheduling_${clinicId || 'all'}`;
    return offlineWrapper.get(
      () => api.get('/surgery/queue/awaiting', { params }),
      'surgeryCases',
      cacheKey,
      { cacheTime: 10 * 60 * 1000 }
    );
  },

  /**
   * Get overdue cases (waiting too long) - WORKS OFFLINE (10 min cache)
   */
  getOverdueCases: async (maxDays = 30, clinicId = null) => {
    const params = { maxDays };
    if (clinicId) params.clinic = clinicId;
    const cacheKey = `overdue_cases_${maxDays}_${clinicId || 'all'}`;
    return offlineWrapper.get(
      () => api.get('/surgery/queue/overdue', { params }),
      'surgeryCases',
      cacheKey,
      { cacheTime: 10 * 60 * 1000 }
    );
  },

  // ============================================
  // SCHEDULING & AGENDA
  // ============================================

  /**
   * Get agenda for date range - WORKS OFFLINE (10 min cache)
   */
  getAgenda: async (startDate, endDate = null, clinicId = null) => {
    const params = { startDate };
    if (endDate) params.endDate = endDate;
    if (clinicId) params.clinic = clinicId;
    const cacheKey = `agenda_${startDate}_${endDate || 'open'}_${clinicId || 'all'}`;
    return offlineWrapper.get(
      () => api.get('/surgery/agenda', { params }),
      'surgeryCases',
      cacheKey,
      { cacheTime: 10 * 60 * 1000 }
    );
  },

  /**
   * Get all OR rooms - WORKS OFFLINE (30 min cache)
   */
  getORRooms: async (clinicId = null) => {
    const params = clinicId ? { clinic: clinicId } : {};
    const cacheKey = `or_rooms_${clinicId || 'all'}`;
    return offlineWrapper.get(
      () => api.get('/surgery/rooms', { params }),
      'surgeryCases',
      cacheKey,
      { cacheTime: 30 * 60 * 1000 }
    );
  },

  /**
   * Get available OR rooms for a time slot - WORKS OFFLINE (5 min cache)
   */
  getAvailableORRooms: async (startTime, duration = 60, clinicId = null) => {
    const params = { startTime, duration };
    if (clinicId) params.clinic = clinicId;
    const cacheKey = `available_rooms_${startTime}_${duration}_${clinicId || 'all'}`;
    return offlineWrapper.get(
      () => api.get('/surgery/rooms/available', { params }),
      'surgeryCases',
      cacheKey,
      { cacheTime: 5 * 60 * 1000 }
    );
  },

  /**
   * Schedule a surgery case - ONLINE ONLY (requires real-time OR availability)
   */
  scheduleCase: async (caseId, scheduledDate, roomId = null, estimatedDuration = 60, notes = '') => {
    requireOnline('Programmer une chirurgie');
    const response = await api.post(`/surgery/${caseId}/schedule`, {
      scheduledDate,
      roomId,
      estimatedDuration,
      notes
    });
    return response.data;
  },

  /**
   * Reschedule a surgery case - ONLINE ONLY (requires real-time OR availability)
   */
  rescheduleCase: async (caseId, newDate, reason) => {
    requireOnline('Reprogrammer une chirurgie');
    const response = await api.post(`/surgery/${caseId}/reschedule`, {
      newDate,
      reason
    });
    return response.data;
  },

  /**
   * Cancel a surgery case - ONLINE ONLY (requires audit)
   */
  cancelCase: async (caseId, reason, notes = '') => {
    requireOnline('Annuler une chirurgie');
    const response = await api.post(`/surgery/${caseId}/cancel`, {
      reason,
      notes
    });
    return response.data;
  },

  // ============================================
  // CHECK-IN WORKFLOW
  // ============================================

  /**
   * Get cases ready for check-in today - WORKS OFFLINE (5 min cache)
   */
  getReadyForCheckIn: async (clinicId = null) => {
    const params = clinicId ? { clinic: clinicId } : {};
    const cacheKey = `ready_checkin_${clinicId || 'all'}`;
    return offlineWrapper.get(
      () => api.get('/surgery/checkin/ready', { params }),
      'surgeryCases',
      cacheKey,
      { cacheTime: 5 * 60 * 1000 }
    );
  },

  /**
   * Check in a patient and assign surgeon - ONLINE ONLY (requires verification)
   */
  checkInPatient: async (caseId, surgeonId, assistantSurgeonId = null, preOpNotes = '') => {
    requireOnline('Enregistrer un patient en chirurgie');
    const response = await api.post(`/surgery/${caseId}/checkin`, {
      surgeonId,
      assistantSurgeonId,
      preOpNotes
    });
    return response.data;
  },

  /**
   * Get full clinical background for surgeon check-in view - WORKS OFFLINE (30 min cache)
   */
  getClinicalBackground: async (caseId) => {
    const cacheKey = `clinical_bg_${caseId}`;
    return offlineWrapper.get(
      () => api.get(`/surgery/${caseId}/clinical-background`),
      'surgeryCases',
      cacheKey,
      { cacheTime: 30 * 60 * 1000 }
    );
  },

  /**
   * Update pre-op checklist - WORKS OFFLINE (queued)
   */
  updatePreOpChecklist: async (caseId, checklistData) => {
    const localData = {
      caseId,
      ...checklistData,
      updatedAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.put(`/surgery/${caseId}/preop-checklist`, checklistData),
      'UPDATE',
      'surgeryCases',
      localData,
      caseId
    );
  },

  // ============================================
  // SURGERY EXECUTION
  // ============================================

  /**
   * Start surgery - ONLINE ONLY (requires verification and timing accuracy)
   */
  startSurgery: async (caseId) => {
    requireOnline('Commencer une chirurgie');
    const response = await api.post(`/surgery/${caseId}/start`);
    return response.data;
  },

  /**
   * Add consumables and equipment used - WORKS OFFLINE (queued)
   */
  addConsumables: async (caseId, { consumables, equipment, iolDetails }) => {
    const localData = {
      caseId,
      consumables,
      equipment,
      iolDetails,
      recordedAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.post(`/surgery/${caseId}/consumables`, {
        consumables,
        equipment,
        iolDetails
      }),
      'UPDATE',
      'surgeryCases',
      localData,
      caseId
    );
  },

  // ============================================
  // SURGERY REPORTS
  // ============================================

  /**
   * Create surgery report - WORKS OFFLINE (queued as draft)
   */
  createReport: async (caseId, reportData) => {
    const localData = {
      caseId,
      ...reportData,
      status: 'draft',
      createdAt: new Date().toISOString(),
      _tempId: `temp_report_${Date.now()}`
    };
    return offlineWrapper.mutate(
      () => api.post(`/surgery/${caseId}/report`, reportData),
      'CREATE',
      'surgeryCases',
      localData
    );
  },

  /**
   * Get report by ID - WORKS OFFLINE (10 min cache)
   */
  getReport: async (reportId) => {
    const cacheKey = `report_${reportId}`;
    return offlineWrapper.get(
      () => api.get(`/surgery/report/${reportId}`),
      'surgeryCases',
      cacheKey,
      { cacheTime: 10 * 60 * 1000 }
    );
  },

  /**
   * Update surgery report - WORKS OFFLINE (queued)
   */
  updateReport: async (reportId, reportData) => {
    const localData = {
      ...reportData,
      updatedAt: new Date().toISOString()
    };
    return offlineWrapper.mutate(
      () => api.put(`/surgery/report/${reportId}`, reportData),
      'UPDATE',
      'surgeryCases',
      localData,
      reportId
    );
  },

  /**
   * Finalize and sign report - ONLINE ONLY (requires signature verification)
   */
  finalizeReport: async (reportId) => {
    requireOnline('Finaliser un rapport de chirurgie');
    const response = await api.post(`/surgery/report/${reportId}/finalize`);
    return response.data;
  },

  // ============================================
  // SURGEON DASHBOARD
  // ============================================

  /**
   * Get surgeon's schedule for a date - WORKS OFFLINE (10 min cache)
   */
  getSurgeonSchedule: async (date, surgeonId = null) => {
    const params = { date };
    const url = surgeonId ? `/surgery/surgeon/${surgeonId}/schedule` : '/surgery/surgeon/schedule';
    const cacheKey = `surgeon_schedule_${date}_${surgeonId || 'current'}`;
    return offlineWrapper.get(
      () => api.get(url, { params }),
      'surgeryCases',
      cacheKey,
      { cacheTime: 10 * 60 * 1000 }
    );
  },

  /**
   * Get surgeon's checked-in patients - WORKS OFFLINE (5 min cache)
   */
  getSurgeonCheckedInPatients: async (surgeonId = null) => {
    const url = surgeonId ? `/surgery/surgeon/${surgeonId}/checked-in` : '/surgery/surgeon/checked-in';
    const cacheKey = `surgeon_checkedin_${surgeonId || 'current'}`;
    return offlineWrapper.get(
      () => api.get(url),
      'surgeryCases',
      cacheKey,
      { cacheTime: 5 * 60 * 1000 }
    );
  },

  /**
   * Get surgeon's draft reports - WORKS OFFLINE (10 min cache)
   */
  getSurgeonDraftReports: async (surgeonId = null) => {
    const url = surgeonId ? `/surgery/surgeon/${surgeonId}/drafts` : '/surgery/surgeon/drafts';
    const cacheKey = `surgeon_drafts_${surgeonId || 'current'}`;
    return offlineWrapper.get(
      () => api.get(url),
      'surgeryCases',
      cacheKey,
      { cacheTime: 10 * 60 * 1000 }
    );
  },

  // ============================================
  // PATIENT HISTORY
  // ============================================

  /**
   * Get all surgeries for a patient - WORKS OFFLINE (30 min cache)
   */
  getPatientSurgeries: async (patientId) => {
    const cacheKey = `patient_surgeries_${patientId}`;
    return offlineWrapper.get(
      () => api.get(`/surgery/patient/${patientId}`),
      'surgeryCases',
      cacheKey,
      { cacheTime: 30 * 60 * 1000 }
    );
  },

  // ============================================
  // CASE MANAGEMENT
  // ============================================

  /**
   * Get all cases with filters - WORKS OFFLINE (10 min cache)
   */
  getCases: async (filters = {}) => {
    const cacheKey = `cases_${JSON.stringify(filters)}`;
    return offlineWrapper.get(
      () => api.get('/surgery/cases', { params: filters }),
      'surgeryCases',
      cacheKey,
      { cacheTime: 10 * 60 * 1000 }
    );
  },

  /**
   * Create case manually - WORKS OFFLINE (queued)
   */
  createCase: async (caseData) => {
    const localData = {
      ...caseData,
      status: 'pending',
      createdAt: new Date().toISOString(),
      _tempId: `temp_case_${Date.now()}`
    };
    return offlineWrapper.mutate(
      () => api.post('/surgery/cases', caseData),
      'CREATE',
      'surgeryCases',
      localData
    );
  },

  /**
   * Get single case by ID - WORKS OFFLINE (10 min cache)
   */
  getCase: async (caseId) => {
    return offlineWrapper.get(
      () => api.get(`/surgery/${caseId}`),
      'surgeryCases',
      caseId,
      { cacheTime: 10 * 60 * 1000 }
    );
  },

  // ============================================
  // OFFLINE HELPERS
  // ============================================

  /**
   * Pre-cache today's surgeries for shift
   */
  preCacheForShift: async () => {
    if (!isOnline()) return { cached: 0 };

    try {
      const today = new Date().toISOString().split('T')[0];
      const [todayResponse, upcomingResponse] = await Promise.all([
        api.get('/surgery/agenda', { params: { startDate: today } }),
        api.get('/surgery/checkin/ready')
      ]);

      const cases = [
        ...(todayResponse.data?.data || []),
        ...(upcomingResponse.data?.data || [])
      ];

      if (cases.length > 0) {
        await db.surgeryCases.bulkPut(cases);
      }

      return { cached: cases.length };
    } catch (error) {
      console.error('[SurgeryService] Pre-cache failed:', error);
      return { cached: 0, error: error.message };
    }
  },

  /**
   * Search cached surgeries offline
   */
  searchOffline: async (query) => {
    const cases = await db.surgeryCases.toArray();
    if (!query) return cases;

    const lowerQuery = query.toLowerCase();
    return cases.filter(c =>
      c.patientName?.toLowerCase().includes(lowerQuery) ||
      c.procedureType?.toLowerCase().includes(lowerQuery) ||
      c.surgeon?.toLowerCase().includes(lowerQuery) ||
      c.status?.toLowerCase().includes(lowerQuery)
    );
  }
};

export default surgeryService;
