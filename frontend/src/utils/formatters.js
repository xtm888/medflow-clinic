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
// EXPORT ALL FORMATTERS
// ============================================================================

const formatters = {
  date: formatDate,
  dateForInput: formatDateForInput,
  time: formatTime,
  currency: formatCurrency,
  percent: formatPercent,
  name: formatName,
  doctorName: formatDoctorName,
  empty: formatEmpty,
  emptyFr: formatEmptyFr,
  number: formatNumber,
  phone: formatPhone,
  age: formatAge,
  status: formatStatus
};

export default formatters;
