// Central export for all services
export { default as apiConfig } from './apiConfig';
export { default as api } from './apiConfig';
export { apiHelpers } from './apiConfig';

// Import services first
import authService from './authService';
import patientService from './patientService';
import appointmentService from './appointmentService';
import visitService from './visitService';
import ophthalmologyService from './ophthalmologyService';
import prescriptionService from './prescriptionService';
import documentService from './documentService';
import billingService from './billingService';
import database from './database';
import syncService from './syncService';

// Core services
export { authService };
export { patientService };
export { appointmentService };
export { visitService };
export { ophthalmologyService };
export { prescriptionService };
export { documentService };
export { billingService };

// Database and sync services
export { database };
export { syncService };

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