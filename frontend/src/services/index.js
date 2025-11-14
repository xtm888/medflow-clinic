// Central export for all services
export { default as apiConfig } from './apiConfig';
export { default as api } from './apiConfig';
export { apiHelpers } from './apiConfig';

// Core services
export { default as authService } from './authService';
export { default as patientService } from './patientService';
export { default as appointmentService } from './appointmentService';
export { default as visitService } from './visitService';
export { default as ophthalmologyService } from './ophthalmologyService';
export { default as prescriptionService } from './prescriptionService';
export { default as documentService } from './documentService';
export { default as billingService } from './billingService';

// Database and sync services
export { default as database } from './database';
export { default as syncService } from './syncService';

// Re-export commonly used functions
export const services = {
  auth: authService,
  patient: patientService,
  appointment: appointmentService,
  visit: visitService,
  ophthalmology: ophthalmologyService,
  prescription: prescriptionService,
  document: documentService,
  billing: billingService,
  database,
  sync: syncService
};

export default services;