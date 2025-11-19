/**
 * Services Index - Central export for all API services
 *
 * Usage:
 * import { patientService, appointmentService } from '@services';
 * // or
 * import services from '@services';
 * services.patient.getPatient(id);
 */

// API Configuration
export { default as api } from './apiConfig';
export { default as apiConfig } from './apiConfig';

// ============================================
// CORE SERVICES
// ============================================

// Authentication & Users
export { default as authService } from './authService';
export { default as userService } from './userService';

// Patient Management
export { default as patientService } from './patientService';

// Appointments & Queue
export { default as appointmentService } from './appointmentService';
export { default as queueService } from './queueService';

// Visits & Clinical
export { default as visitService } from './visitService';
export { default as consultationSessionService } from './consultationSessionService';

// ============================================
// OPHTHALMOLOGY SERVICES
// ============================================

export { default as ophthalmologyService } from './ophthalmologyService';

// ============================================
// PRESCRIPTION & PHARMACY SERVICES
// ============================================

export { default as prescriptionService } from './prescriptionService';
export { default as medicationService } from './medicationService';
export { default as pharmacyInventoryService } from './pharmacyInventoryService';
export { default as glassesOrderService } from './glassesOrderService';

// ============================================
// TEMPLATE SERVICES
// ============================================

export { default as templateCatalogService } from './templateCatalogService';
export { default as commentTemplateService } from './commentTemplateService';
export { default as doseTemplateService } from './doseTemplateService';
export { default as treatmentProtocolService } from './treatmentProtocolService';
export { default as examinationTemplateService } from './examinationTemplateService';

// ============================================
// CLINICAL PROCEDURE SERVICES
// ============================================

export { default as clinicalProcedureService } from './clinicalProcedureService';
export { default as laboratoryService } from './laboratoryService';

// ============================================
// DOCUMENT SERVICES
// ============================================

export { default as documentService } from './documentService';
export { default as documentGenerationService } from './documentGenerationService';

// ============================================
// DEVICE & INTEGRATION SERVICES
// ============================================

export { default as deviceService } from './deviceService';

// ============================================
// BILLING & FINANCIAL SERVICES
// ============================================

export { default as billingService } from './billingService';

// ============================================
// DASHBOARD & REPORTING SERVICES
// ============================================

export { default as dashboardService } from './dashboardService';
export { default as auditService } from './auditService';

// ============================================
// NOTIFICATION & ALERT SERVICES
// ============================================

export { default as notificationService } from './notificationService';
export { default as alertService } from './alertService';

// ============================================
// SETTINGS & CONFIGURATION SERVICES
// ============================================

export { default as settingsService } from './settingsService';

// ============================================
// PORTAL SERVICES
// ============================================

export { default as portalService } from './portalService';

// ============================================
// SYNC & DATABASE SERVICES
// ============================================

export { default as database } from './database';
export { default as syncService } from './syncService';
export { default as websocketService } from './websocketService';

// ============================================
// UTILITY SERVICES
// ============================================

export { default as logger } from './logger';

// ============================================
// AGGREGATED SERVICES OBJECT
// ============================================

import authService from './authService';
import userService from './userService';
import patientService from './patientService';
import appointmentService from './appointmentService';
import queueService from './queueService';
import visitService from './visitService';
import consultationSessionService from './consultationSessionService';
import ophthalmologyService from './ophthalmologyService';
import prescriptionService from './prescriptionService';
import medicationService from './medicationService';
import pharmacyInventoryService from './pharmacyInventoryService';
import glassesOrderService from './glassesOrderService';
import templateCatalogService from './templateCatalogService';
import commentTemplateService from './commentTemplateService';
import doseTemplateService from './doseTemplateService';
import treatmentProtocolService from './treatmentProtocolService';
import examinationTemplateService from './examinationTemplateService';
import clinicalProcedureService from './clinicalProcedureService';
import laboratoryService from './laboratoryService';
import documentService from './documentService';
import documentGenerationService from './documentGenerationService';
import deviceService from './deviceService';
import billingService from './billingService';
import dashboardService from './dashboardService';
import auditService from './auditService';
import notificationService from './notificationService';
import alertService from './alertService';
import settingsService from './settingsService';
import portalService from './portalService';
import database from './database';
import syncService from './syncService';
import websocketService from './websocketService';

export const services = {
  // Core
  auth: authService,
  user: userService,
  patient: patientService,
  appointment: appointmentService,
  queue: queueService,
  visit: visitService,
  consultationSession: consultationSessionService,

  // Ophthalmology
  ophthalmology: ophthalmologyService,

  // Prescription & Pharmacy
  prescription: prescriptionService,
  medication: medicationService,
  pharmacyInventory: pharmacyInventoryService,
  glassesOrder: glassesOrderService,

  // Templates
  templateCatalog: templateCatalogService,
  commentTemplate: commentTemplateService,
  doseTemplate: doseTemplateService,
  treatmentProtocol: treatmentProtocolService,
  examinationTemplate: examinationTemplateService,

  // Clinical
  clinicalProcedure: clinicalProcedureService,
  laboratory: laboratoryService,

  // Documents
  document: documentService,
  documentGeneration: documentGenerationService,

  // Devices
  device: deviceService,

  // Billing
  billing: billingService,

  // Dashboard
  dashboard: dashboardService,
  audit: auditService,

  // Notifications
  notification: notificationService,
  alert: alertService,

  // Settings
  settings: settingsService,

  // Portal
  portal: portalService,

  // Sync
  database,
  sync: syncService,
  websocket: websocketService
};

export default services;
