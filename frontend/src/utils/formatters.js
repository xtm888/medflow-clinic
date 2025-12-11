import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Standardized Formatters Utility
 * Provides consistent formatting across the entire application.
 */

// ============================================================================
// DATE FORMATTING
// ============================================================================

/**
 * Format date with consistent French locale
 * @param {Date|string} date - The date to format
 * @param {string} formatType - 'short' | 'medium' | 'long' | 'datetime' | 'time' | 'relative'
 * @returns {string} Formatted date string
 */
export const formatDate = (date, formatType = 'medium') => {
  if (!date) return 'N/A';

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);

    if (!isValid(dateObj)) return 'N/A';

    const formats = {
      short: 'dd/MM/yyyy',           // 21/11/2025
      medium: 'dd MMM yyyy',          // 21 nov. 2025
      long: 'dd MMMM yyyy',           // 21 novembre 2025
      datetime: 'dd MMM yyyy HH:mm',  // 21 nov. 2025 14:30
      time: 'HH:mm',                  // 14:30
      relative: null                  // Il y a 2 heures
    };

    if (formatType === 'relative') {
      return formatDistanceToNow(dateObj, { addSuffix: true, locale: fr });
    }

    return format(dateObj, formats[formatType] || formats.medium, { locale: fr });
  } catch (error) {
    console.warn('Date formatting error:', error);
    return 'N/A';
  }
};

/**
 * Format date for form inputs (ISO format)
 */
export const formatDateForInput = (date) => {
  if (!date) return '';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    return isValid(dateObj) ? format(dateObj, 'yyyy-MM-dd') : '';
  } catch {
    return '';
  }
};

/**
 * Format time for display
 */
export const formatTime = (time) => {
  if (!time) return 'N/A';
  // If it's already formatted as HH:mm, return as is
  if (typeof time === 'string' && /^\d{2}:\d{2}$/.test(time)) {
    return time;
  }
  // Otherwise try to parse as date
  return formatDate(time, 'time');
};

// ============================================================================
// CURRENCY FORMATTING
// ============================================================================

/**
 * Format currency with consistent display
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code ('USD', 'EUR', 'CDF')
 * @param {boolean} showSymbol - Whether to show currency symbol
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'USD', showSymbol = true) => {
  if (amount == null || isNaN(amount)) return 'N/A';

  try {
    const currencyConfig = {
      USD: { symbol: '$', locale: 'en-US', position: 'before' },
      EUR: { symbol: '€', locale: 'fr-FR', position: 'after' },
      CDF: { symbol: 'FC', locale: 'fr-CD', position: 'after' }
    };

    const config = currencyConfig[currency] || currencyConfig.USD;
    const formattedNumber = new Intl.NumberFormat(config.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);

    if (!showSymbol) return formattedNumber;

    return config.position === 'before'
      ? `${config.symbol}${formattedNumber}`
      : `${formattedNumber} ${config.symbol}`;
  } catch (error) {
    console.warn('Currency formatting error:', error);
    return `${amount}`;
  }
};

/**
 * Format percentage
 */
export const formatPercent = (value, decimals = 0) => {
  if (value == null || isNaN(value)) return 'N/A';
  return `${Number(value).toFixed(decimals)}%`;
};

// ============================================================================
// NAME FORMATTING
// ============================================================================

/**
 * Format patient/user name consistently
 * @param {Object|string} person - Person object or strings
 * @param {string} lastName - Last name (if first param is firstName)
 * @param {string} format - 'full' | 'initials' | 'short'
 * @returns {string} Formatted name
 */
export const formatName = (person, lastName = null, formatType = 'full') => {
  let firstName = '';
  let last = '';

  // Handle different input types
  if (typeof person === 'object' && person !== null) {
    firstName = person.firstName || person.first_name || '';
    last = person.lastName || person.last_name || '';
  } else if (typeof person === 'string') {
    firstName = person;
    last = lastName || '';
  }

  firstName = firstName.trim();
  last = last.trim();

  switch (formatType) {
    case 'initials':
      return `${firstName.charAt(0)}${last.charAt(0)}`.toUpperCase();
    case 'short':
      return `${firstName.charAt(0)}. ${last}`;
    case 'lastFirst':
      return last && firstName ? `${last}, ${firstName}` : firstName || last || 'N/A';
    case 'full':
    default:
      return firstName && last ? `${firstName} ${last}` : firstName || last || 'N/A';
  }
};

/**
 * Format doctor/provider name with title
 */
export const formatDoctorName = (provider) => {
  if (!provider) return 'Non assigné';
  const name = formatName(provider);
  return name !== 'N/A' ? `Dr. ${name}` : 'Non assigné';
};

// ============================================================================
// EMPTY STATE FORMATTING
// ============================================================================

/**
 * Format empty/null/undefined values consistently
 * @param {any} value - The value to check
 * @param {string} fallback - The fallback text
 * @returns {string} The value or fallback
 */
export const formatEmpty = (value, fallback = 'N/A') => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  if (Array.isArray(value) && value.length === 0) {
    return fallback;
  }
  return value;
};

/**
 * French-specific empty value
 */
export const formatEmptyFr = (value) => formatEmpty(value, 'Non renseigné');

// ============================================================================
// NUMBER FORMATTING
// ============================================================================

/**
 * Format number with locale
 */
export const formatNumber = (value, decimals = 0) => {
  if (value == null || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

/**
 * Format phone number for display
 */
export const formatPhone = (phone) => {
  if (!phone) return 'N/A';
  // Clean the phone number
  const cleaned = phone.replace(/\D/g, '');
  // Format for Congo (example: +243 81 234 5678)
  if (cleaned.length >= 9) {
    const parts = [];
    if (cleaned.startsWith('243')) {
      parts.push('+243');
      const rest = cleaned.slice(3);
      for (let i = 0; i < rest.length; i += 3) {
        parts.push(rest.slice(i, i + 3));
      }
    } else {
      // Generic format
      for (let i = 0; i < cleaned.length; i += 3) {
        parts.push(cleaned.slice(i, i + 3));
      }
    }
    return parts.join(' ');
  }
  return phone;
};

/**
 * Calculate and format age from date of birth
 */
export const formatAge = (dateOfBirth) => {
  if (!dateOfBirth) return 'N/A';

  try {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    return `${age} ans`;
  } catch {
    return 'N/A';
  }
};

// ============================================================================
// STATUS FORMATTING
// ============================================================================

/**
 * Get status display text in French
 */
export const formatStatus = (status) => {
  if (!status) return 'N/A';

  const statusMap = {
    // Appointment statuses
    scheduled: 'Planifié',
    confirmed: 'Confirmé',
    'checked-in': 'Arrivé',
    'in-progress': 'En cours',
    completed: 'Terminé',
    cancelled: 'Annulé',
    'no-show': 'Absent',
    rescheduled: 'Reporté',
    pending: 'En attente',

    // Invoice statuses
    paid: 'Payé',
    partial: 'Partiel',
    overdue: 'En retard',
    draft: 'Brouillon',

    // Patient statuses
    active: 'Actif',
    inactive: 'Inactif',

    // Prescription statuses
    dispensed: 'Dispensé',
    expired: 'Expiré',

    // Generic
    yes: 'Oui',
    no: 'Non',
    true: 'Oui',
    false: 'Non'
  };

  const key = status.toLowerCase().replace(/_/g, '-');
  return statusMap[key] || status;
};

// ============================================================================
// PATIENT NAME HELPERS (for Lab sections and other uses)
// ============================================================================

/**
 * Get patient name from various patient object structures
 * Used across Lab, Queue, Invoice, and other components
 */
export const getPatientName = (patient) => {
  if (!patient) return 'Patient inconnu';

  // Handle string (already formatted or just an ID)
  if (typeof patient === 'string') return patient;

  // Handle populated patient object with various field names
  const firstName = patient.firstName || patient.prenom || patient.first_name || '';
  const lastName = patient.lastName || patient.nom || patient.last_name || '';

  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim();
  }

  // Handle combined name fields
  if (patient.name) return patient.name;
  if (patient.fullName) return patient.fullName;

  return 'Patient inconnu';
};

/**
 * Get patient initials for avatars
 */
export const getPatientInitials = (patient) => {
  const name = getPatientName(patient);
  if (name === 'Patient inconnu') return '??';

  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

/**
 * Get patient display info with ID
 */
export const getPatientDisplayInfo = (patient) => {
  const name = getPatientName(patient);
  const id = patient?.patientId || patient?.fileNumber || patient?.id || patient?._id;

  return {
    name,
    id: id ? `#${id}` : '',
    display: id ? `${name} (#${id})` : name
  };
};

// ============================================================================
// COMPACT/SHORT FORMATTERS
// ============================================================================

/**
 * Format amount as compact currency (e.g., 1.2M)
 */
export const formatCompactCurrency = (amount, currency = 'CDF') => {
  if (amount == null || isNaN(amount)) return 'N/A';

  const config = {
    USD: '$',
    EUR: '€',
    CDF: 'FC'
  };
  const symbol = config[currency] || currency;

  if (Math.abs(amount) >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M ${symbol}`;
  }
  if (Math.abs(amount) >= 1000) {
    return `${(amount / 1000).toFixed(0)}K ${symbol}`;
  }
  return formatCurrency(amount, currency);
};

/**
 * Truncate text with ellipsis
 */
export const truncate = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

/**
 * Capitalize first letter
 */
export const capitalize = (text) => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Convert to title case
 */
export const toTitleCase = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Format file size
 */
export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

// ============================================================================
// EXPORT ALL FORMATTERS
// ============================================================================

const formatters = {
  date: formatDate,
  dateForInput: formatDateForInput,
  time: formatTime,
  currency: formatCurrency,
  compactCurrency: formatCompactCurrency,
  percent: formatPercent,
  name: formatName,
  doctorName: formatDoctorName,
  patientName: getPatientName,
  patientInitials: getPatientInitials,
  patientDisplayInfo: getPatientDisplayInfo,
  empty: formatEmpty,
  emptyFr: formatEmptyFr,
  number: formatNumber,
  phone: formatPhone,
  age: formatAge,
  status: formatStatus,
  truncate,
  capitalize,
  toTitleCase,
  fileSize: formatFileSize
};

export default formatters;
