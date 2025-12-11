const express = require('express');
const router = express.Router();
const surgeryController = require('../controllers/surgeryController');
const { protect, authorize } = require('../middleware/auth');
const { optionalClinic } = require('../middleware/clinicAuth');
const { logAction, logCriticalOperation, logPatientDataAccess } = require('../middleware/auditLogger');

/**
 * Surgery Routes
 *
 * Base path: /api/surgery
 *
 * Endpoints grouped by function:
 * - Dashboard & Stats
 * - Queue Management
 * - Scheduling & Agenda
 * - Check-in Workflow
 * - Surgery Execution
 * - Reports
 * - Patient History
 */

// All routes require authentication and clinic context
router.use(protect);
router.use(optionalClinic);

// ============================================
// DASHBOARD & STATISTICS
// ============================================

// GET /api/surgery/dashboard/stats - Dashboard statistics
router.get('/dashboard/stats', logAction('SURGERY_DASHBOARD_VIEW'), surgeryController.getDashboardStats);

// GET /api/surgery/types - Get available surgery types
router.get('/types', logAction('SURGERY_TYPES_VIEW'), surgeryController.getSurgeryTypes);

// ============================================
// QUEUE MANAGEMENT
// ============================================

// GET /api/surgery/queue/awaiting - Cases awaiting scheduling
router.get('/queue/awaiting', logAction('SURGERY_QUEUE_VIEW'), surgeryController.getAwaitingScheduling);

// GET /api/surgery/queue/overdue - Overdue cases (waited too long)
router.get('/queue/overdue', logAction('SURGERY_QUEUE_OVERDUE_VIEW'), surgeryController.getOverdueCases);

// ============================================
// OR ROOM SCHEDULING
// ============================================

// GET /api/surgery/rooms - Get all OR rooms
router.get('/rooms', logAction('SURGERY_OR_ROOMS_VIEW'), surgeryController.getORRooms);

// GET /api/surgery/rooms/available - Get available OR rooms for a time slot
router.get('/rooms/available', logAction('SURGERY_OR_ROOMS_VIEW'), surgeryController.getAvailableORRooms);

// GET /api/surgery/rooms/:roomId/schedule - Get schedule for specific room
router.get('/rooms/:roomId/schedule', logAction('SURGERY_ROOM_SCHEDULE_VIEW'), surgeryController.getRoomSchedule);

// GET /api/surgery/rooms/schedule - Get schedule for all OR rooms
router.get('/rooms/schedule', logAction('SURGERY_ROOM_SCHEDULE_VIEW'), surgeryController.getRoomSchedule);

// ============================================
// SCHEDULING & AGENDA
// ============================================

// GET /api/surgery/agenda - Get agenda for date range
router.get('/agenda', logAction('SURGERY_AGENDA_VIEW'), surgeryController.getAgenda);

// POST /api/surgery/:id/schedule - Schedule a case with optional room assignment
router.post('/:id/schedule', logCriticalOperation('SURGERY_SCHEDULE'), surgeryController.scheduleCase);

// POST /api/surgery/:id/reschedule - Reschedule a case
router.post('/:id/reschedule', logCriticalOperation('SURGERY_RESCHEDULE'), surgeryController.rescheduleCase);

// POST /api/surgery/:id/cancel - Cancel a case
router.post('/:id/cancel', logCriticalOperation('SURGERY_CANCEL'), surgeryController.cancelCase);

// ============================================
// CHECK-IN WORKFLOW
// ============================================

// GET /api/surgery/checkin/ready - Cases ready for check-in today
router.get('/checkin/ready', logAction('SURGERY_QUEUE_VIEW'), surgeryController.getReadyForCheckIn);

// POST /api/surgery/:id/checkin - Check in a patient
router.post('/:id/checkin', logCriticalOperation('SURGERY_CHECKIN'), surgeryController.checkInPatient);

// GET /api/surgery/:id/clinical-background - Full clinical data for surgeon
router.get('/:id/clinical-background', logPatientDataAccess, logAction('SURGERY_CLINICAL_BACKGROUND_VIEW'), surgeryController.getClinicalBackground);

// PUT /api/surgery/:id/preop-checklist - Update pre-op checklist
router.put('/:id/preop-checklist', logAction('SURGERY_PREOP_UPDATE'), surgeryController.updatePreOpChecklist);

// ============================================
// SURGERY EXECUTION
// ============================================

// POST /api/surgery/:id/start - Start surgery
router.post('/:id/start', logCriticalOperation('SURGERY_START'), surgeryController.startSurgery);

// POST /api/surgery/:id/consumables - Add consumables/equipment used
router.post('/:id/consumables', logAction('SURGERY_CONSUMABLES_ADD'), surgeryController.addConsumables);

// ============================================
// SURGERY REPORTS
// ============================================

// POST /api/surgery/:id/report - Create surgery report
router.post('/:id/report', logCriticalOperation('SURGERY_REPORT_CREATE'), surgeryController.createReport);

// GET /api/surgery/report/:reportId - Get report by ID
router.get('/report/:reportId', logPatientDataAccess, logAction('SURGERY_REPORT_VIEW'), surgeryController.getReport);

// PUT /api/surgery/report/:reportId - Update report
router.put('/report/:reportId', logAction('SURGERY_REPORT_UPDATE'), surgeryController.updateReport);

// POST /api/surgery/report/:reportId/finalize - Finalize and sign report
router.post('/report/:reportId/finalize', logCriticalOperation('SURGERY_REPORT_FINALIZE'), surgeryController.finalizeReport);

// ============================================
// SURGEON DASHBOARD
// ============================================

// GET /api/surgery/surgeon/schedule - Surgeon's schedule for a date
router.get('/surgeon/schedule', logAction('SURGERY_SURGEON_SCHEDULE_VIEW'), surgeryController.getSurgeonSchedule);

// GET /api/surgery/surgeon/:surgeonId/schedule - Specific surgeon's schedule
router.get('/surgeon/:surgeonId/schedule', logAction('SURGERY_SURGEON_SCHEDULE_VIEW'), surgeryController.getSurgeonSchedule);

// GET /api/surgery/surgeon/checked-in - Surgeon's checked-in patients
router.get('/surgeon/checked-in', logAction('SURGERY_SURGEON_CHECKEDIN_VIEW'), surgeryController.getSurgeonCheckedInPatients);

// GET /api/surgery/surgeon/:surgeonId/checked-in - Specific surgeon's checked-in patients
router.get('/surgeon/:surgeonId/checked-in', logAction('SURGERY_SURGEON_CHECKEDIN_VIEW'), surgeryController.getSurgeonCheckedInPatients);

// GET /api/surgery/surgeon/drafts - Surgeon's draft reports
router.get('/surgeon/drafts', logAction('SURGERY_SURGEON_DRAFTS_VIEW'), surgeryController.getSurgeonDraftReports);

// GET /api/surgery/surgeon/:surgeonId/drafts - Specific surgeon's draft reports
router.get('/surgeon/:surgeonId/drafts', logAction('SURGERY_SURGEON_DRAFTS_VIEW'), surgeryController.getSurgeonDraftReports);

// ============================================
// PATIENT HISTORY
// ============================================

// GET /api/surgery/patient/:patientId - All surgeries for a patient
router.get('/patient/:patientId', logPatientDataAccess, logAction('SURGERY_PATIENT_HISTORY_VIEW'), surgeryController.getPatientSurgeries);

// ============================================
// CASE MANAGEMENT
// ============================================

// GET /api/surgery/cases - List all cases with filters
router.get('/cases', logAction('SURGERY_CASE_LIST'), surgeryController.getCases);

// POST /api/surgery/cases - Create case manually
router.post('/cases', logCriticalOperation('SURGERY_CASE_CREATE'), surgeryController.createCase);

// GET /api/surgery/:id - Get single case
router.get('/:id', logPatientDataAccess, logAction('SURGERY_CASE_VIEW'), surgeryController.getCase);

// ============================================
// SPECIMEN COLLECTION & PATHOLOGY
// ============================================

// POST /api/surgery/report/:reportId/specimen - Add specimen to surgery report (auto-creates LabOrder)
router.post('/report/:reportId/specimen', logCriticalOperation('SURGERY_SPECIMEN_ADD'), surgeryController.addSpecimen);

// GET /api/surgery/report/:reportId/specimens - Get specimens for a report
router.get('/report/:reportId/specimens', logPatientDataAccess, logAction('SURGERY_SPECIMEN_VIEW'), surgeryController.getSpecimens);

// PUT /api/surgery/report/:reportId/specimen/:specimenId/results - Update specimen with pathology results
router.put('/report/:reportId/specimen/:specimenId/results', logCriticalOperation('SURGERY_SPECIMEN_RESULTS_UPDATE'), surgeryController.updateSpecimenResults);

// GET /api/surgery/surgeon/pending-pathology - Surgeon's pending pathology results
router.get('/surgeon/pending-pathology', logAction('SURGERY_PENDING_PATHOLOGY_VIEW'), surgeryController.getPendingPathology);

// GET /api/surgery/surgeon/:surgeonId/pending-pathology - Specific surgeon's pending pathology
router.get('/surgeon/:surgeonId/pending-pathology', logAction('SURGERY_PENDING_PATHOLOGY_VIEW'), surgeryController.getPendingPathology);

module.exports = router;
