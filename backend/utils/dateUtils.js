/**
 * Date and Timezone Utilities
 * Handles consistent date operations across different timezones
 */

// Default timezone for the clinic (can be configured via environment)
const DEFAULT_TIMEZONE = process.env.CLINIC_TIMEZONE || 'Africa/Kinshasa';

/**
 * Get the start and end of today in a specific timezone
 * @param {string} timezone - IANA timezone string (e.g., 'Africa/Kinshasa', 'Europe/Paris')
 * @returns {Object} { start: Date, end: Date }
 */
const getTodayRange = (timezone = DEFAULT_TIMEZONE) => {
  const now = new Date();

  // Format date in the target timezone to get the local date
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const localDateStr = formatter.format(now); // Returns 'YYYY-MM-DD'

  // Create start of day in UTC that corresponds to midnight in the target timezone
  const startOfDay = new Date(`${localDateStr}T00:00:00`);
  const endOfDay = new Date(`${localDateStr}T23:59:59.999`);

  // Adjust for timezone offset
  const tzOffset = getTimezoneOffset(timezone, now);
  startOfDay.setMinutes(startOfDay.getMinutes() - tzOffset);
  endOfDay.setMinutes(endOfDay.getMinutes() - tzOffset);

  return {
    start: startOfDay,
    end: endOfDay,
    dateString: localDateStr,
    timezone
  };
};

/**
 * Get timezone offset in minutes for a specific timezone
 * @param {string} timezone - IANA timezone string
 * @param {Date} date - Date to get offset for (defaults to now)
 * @returns {number} Offset in minutes
 */
const getTimezoneOffset = (timezone, date = new Date()) => {
  // Get the UTC time
  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  // Get the time in target timezone
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  // Calculate offset in minutes
  return (utcDate - tzDate) / 60000;
};

/**
 * Convert a date to a specific timezone
 * @param {Date|string} date - Date to convert
 * @param {string} timezone - Target timezone
 * @returns {Date} Date adjusted for timezone
 */
const toTimezone = (date, timezone = DEFAULT_TIMEZONE) => {
  const d = new Date(date);
  return new Date(d.toLocaleString('en-US', { timeZone: timezone }));
};

/**
 * Format a date for display in a specific timezone
 * @param {Date|string} date - Date to format
 * @param {string} timezone - Target timezone
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
const formatInTimezone = (date, timezone = DEFAULT_TIMEZONE, options = {}) => {
  const defaultOptions = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };

  return new Intl.DateTimeFormat('fr-FR', defaultOptions).format(new Date(date));
};

/**
 * Check if a date is today in a specific timezone
 * @param {Date|string} date - Date to check
 * @param {string} timezone - Timezone to use
 * @returns {boolean}
 */
const isToday = (date, timezone = DEFAULT_TIMEZONE) => {
  const { dateString } = getTodayRange(timezone);

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const targetDateStr = formatter.format(new Date(date));
  return dateString === targetDateStr;
};

/**
 * Get date range for a specific day in a timezone
 * @param {Date|string} date - The date
 * @param {string} timezone - Timezone to use
 * @returns {Object} { start: Date, end: Date }
 */
const getDayRange = (date, timezone = DEFAULT_TIMEZONE) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const localDateStr = formatter.format(new Date(date));

  const startOfDay = new Date(`${localDateStr}T00:00:00`);
  const endOfDay = new Date(`${localDateStr}T23:59:59.999`);

  const tzOffset = getTimezoneOffset(timezone, new Date(date));
  startOfDay.setMinutes(startOfDay.getMinutes() - tzOffset);
  endOfDay.setMinutes(endOfDay.getMinutes() - tzOffset);

  return {
    start: startOfDay,
    end: endOfDay,
    dateString: localDateStr
  };
};

/**
 * Parse a time string (HH:MM) and combine with a date in a specific timezone
 * @param {Date|string} date - The date
 * @param {string} timeString - Time in HH:MM format
 * @param {string} timezone - Timezone to use
 * @returns {Date} Combined date and time
 */
const parseTimeInTimezone = (date, timeString, timezone = DEFAULT_TIMEZONE) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const localDateStr = formatter.format(new Date(date));
  const [hours, minutes] = timeString.split(':').map(Number);

  const combined = new Date(`${localDateStr}T${timeString}:00`);
  const tzOffset = getTimezoneOffset(timezone, combined);
  combined.setMinutes(combined.getMinutes() - tzOffset);

  return combined;
};

/**
 * Get appointments for today considering timezone
 * Use this in queue and appointment controllers
 * @param {string} timezone - User's timezone
 * @returns {Object} MongoDB query filter for today's date
 */
const getTodayAppointmentFilter = (timezone = DEFAULT_TIMEZONE) => {
  const { start, end } = getTodayRange(timezone);
  return {
    date: {
      $gte: start,
      $lte: end
    }
  };
};

module.exports = {
  DEFAULT_TIMEZONE,
  getTodayRange,
  getTimezoneOffset,
  toTimezone,
  formatInTimezone,
  isToday,
  getDayRange,
  parseTimeInTimezone,
  getTodayAppointmentFilter
};
