/**
 * PatientEdit Constants
 *
 * Configuration, initial state, and options for patient editing.
 */

import { User, Phone, AlertCircle, Heart, Pill, Building2, Calendar } from 'lucide-react';

// Initial form data structure
export const INITIAL_FORM_DATA = {
  // Personal Info
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  nationalId: '',
  occupation: '',
  maritalStatus: '',

  // Contact
  phoneNumber: '',
  alternativePhone: '',
  email: '',
  address: {
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'RD Congo'
  },

  // Emergency Contact
  emergencyContact: {
    name: '',
    relationship: '',
    phone: '',
    email: ''
  },

  // Medical Info
  bloodType: '',
  medicalHistory: {
    allergies: [],
    chronicConditions: [],
    surgeries: [],
    familyHistory: []
  },
  medications: [],

  // Insurance
  insurance: {
    provider: '',
    policyNumber: '',
    groupNumber: '',
    validUntil: '',
    coverageType: '',
    copayAmount: ''
  },

  // Convention
  convention: {
    hasConvention: false,
    company: null,
    companyName: '',
    employeeId: '',
    jobTitle: '',
    department: '',
    beneficiaryType: 'employee',
    status: 'active',
    notes: ''
  },

  // Preferences
  preferences: {
    language: 'fr',
    communicationMethod: 'phone',
    appointmentReminders: true
  },
  preferredPharmacy: '',

  // Status
  status: 'active',
  vip: false
};

// Form sections configuration
export const FORM_SECTIONS = [
  { id: 'personal', label: 'Informations personnelles', icon: User },
  { id: 'contact', label: 'Coordonnees', icon: Phone },
  { id: 'emergency', label: 'Contact d\'urgence', icon: AlertCircle },
  { id: 'medical', label: 'Informations medicales', icon: Heart },
  { id: 'medications', label: 'Medicaments', icon: Pill },
  { id: 'convention', label: 'Convention / Assurance', icon: Building2 },
  { id: 'preferences', label: 'Preferences', icon: Calendar }
];

// Blood type options
export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Gender options
export const GENDER_OPTIONS = [
  { value: '', label: 'Selectionner' },
  { value: 'male', label: 'Homme' },
  { value: 'female', label: 'Femme' }
];

// Marital status options
export const MARITAL_STATUS_OPTIONS = [
  { value: '', label: 'Selectionner' },
  { value: 'single', label: 'Celibataire' },
  { value: 'married', label: 'Marie(e)' },
  { value: 'divorced', label: 'Divorce(e)' },
  { value: 'widowed', label: 'Veuf/Veuve' }
];

// Country options
export const COUNTRY_OPTIONS = [
  { value: 'RD Congo', label: 'RD Congo' },
  { value: 'Congo-Brazzaville', label: 'Congo-Brazzaville' },
  { value: 'Angola', label: 'Angola' },
  { value: 'Other', label: 'Autre' }
];

// Relationship options
export const RELATIONSHIP_OPTIONS = [
  { value: '', label: 'Selectionner' },
  { value: 'spouse', label: 'Conjoint(e)' },
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Enfant' },
  { value: 'sibling', label: 'Frere/Soeur' },
  { value: 'friend', label: 'Ami(e)' },
  { value: 'other', label: 'Autre' }
];

// Allergy severity options
export const ALLERGY_SEVERITY_OPTIONS = [
  { value: 'mild', label: 'Legere' },
  { value: 'moderate', label: 'Moderee' },
  { value: 'severe', label: 'Severe' }
];

// Medication status options
export const MEDICATION_STATUS_OPTIONS = [
  { value: 'active', label: 'Actif' },
  { value: 'completed', label: 'Termine' },
  { value: 'discontinued', label: 'Arrete' }
];

// Beneficiary type options
export const BENEFICIARY_TYPE_OPTIONS = [
  { value: 'employee', label: 'Employé(e)' },
  { value: 'spouse', label: 'Conjoint(e)' },
  { value: 'child', label: 'Enfant' },
  { value: 'dependent', label: 'Personne à charge' }
];

// Convention status options
export const CONVENTION_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspendue' },
  { value: 'expired', label: 'Expirée' },
  { value: 'terminated', label: 'Résiliée' }
];

// Language options
export const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Francais' },
  { value: 'ar', label: 'Arabe' },
  { value: 'en', label: 'Anglais' }
];

// Communication method options
export const COMMUNICATION_OPTIONS = [
  { value: 'phone', label: 'Telephone' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' }
];

// Helper to map patient data to form data
export const mapPatientToFormData = (patientData) => ({
  firstName: patientData.firstName || '',
  lastName: patientData.lastName || '',
  dateOfBirth: patientData.dateOfBirth ? patientData.dateOfBirth.split('T')[0] : '',
  gender: patientData.gender || '',
  nationalId: patientData.nationalId || '',
  occupation: patientData.occupation || '',
  maritalStatus: patientData.maritalStatus || '',
  phoneNumber: patientData.phoneNumber || '',
  alternativePhone: patientData.alternativePhone || '',
  email: patientData.email || '',
  address: {
    street: patientData.address?.street || '',
    city: patientData.address?.city || '',
    state: patientData.address?.state || '',
    postalCode: patientData.address?.postalCode || '',
    country: patientData.address?.country || 'RD Congo'
  },
  emergencyContact: {
    name: patientData.emergencyContact?.name || '',
    relationship: patientData.emergencyContact?.relationship || '',
    phone: patientData.emergencyContact?.phone || '',
    email: patientData.emergencyContact?.email || ''
  },
  bloodType: patientData.bloodType || '',
  medicalHistory: {
    allergies: patientData.medicalHistory?.allergies || [],
    chronicConditions: patientData.medicalHistory?.chronicConditions || [],
    surgeries: patientData.medicalHistory?.surgeries || [],
    familyHistory: patientData.medicalHistory?.familyHistory || []
  },
  medications: patientData.medications || [],
  insurance: {
    provider: patientData.insurance?.provider || '',
    policyNumber: patientData.insurance?.policyNumber || '',
    groupNumber: patientData.insurance?.groupNumber || '',
    validUntil: patientData.insurance?.validUntil ? patientData.insurance.validUntil.split('T')[0] : '',
    coverageType: patientData.insurance?.coverageType || '',
    copayAmount: patientData.insurance?.copayAmount || ''
  },
  convention: {
    hasConvention: !!patientData.convention?.company,
    company: patientData.convention?.company?._id || patientData.convention?.company || null,
    companyName: patientData.convention?.company?.name || patientData.convention?.companyName || '',
    employeeId: patientData.convention?.employeeId || '',
    jobTitle: patientData.convention?.jobTitle || '',
    department: patientData.convention?.department || '',
    beneficiaryType: patientData.convention?.beneficiaryType || 'employee',
    status: patientData.convention?.status || 'active',
    notes: patientData.convention?.notes || ''
  },
  preferences: {
    language: patientData.preferences?.language || 'fr',
    communicationMethod: patientData.preferences?.communicationMethod || 'phone',
    appointmentReminders: patientData.preferences?.appointmentReminders ?? true
  },
  preferredPharmacy: patientData.preferredPharmacy || '',
  status: patientData.status || 'active',
  vip: patientData.vip || false
});
