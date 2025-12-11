/**
 * Notification Service
 *
 * This file is maintained for backward compatibility.
 * All notification functionality is now consolidated in notificationFacade.js
 *
 * @see notificationFacade.js for the unified implementation
 * @deprecated Import from notificationFacade instead
 */

const notificationFacade = require('./notificationFacade');

// Re-export all facade methods for backward compatibility
const notificationService = {
  // Core methods
  sendSMS: notificationFacade.sendSMS.bind(notificationFacade),
  sendEmailNotification: notificationFacade.sendEmailNotification.bind(notificationFacade),

  // Glasses order notifications
  sendGlassesOrderConfirmation: notificationFacade.sendGlassesOrderConfirmation.bind(notificationFacade),
  sendGlassesReadyNotification: notificationFacade.sendGlassesReadyNotification.bind(notificationFacade),
  sendGlassesDeliveredNotification: notificationFacade.sendGlassesDeliveredNotification.bind(notificationFacade),
  sendGlassesPickupReminder: notificationFacade.sendGlassesPickupReminder.bind(notificationFacade),

  // Surgery notifications
  sendSurgeryScheduledNotification: notificationFacade.sendSurgeryScheduledNotification.bind(notificationFacade),
  sendSurgeryReminder: notificationFacade.sendSurgeryReminder.bind(notificationFacade),
  sendFollowUpAppointmentNotification: notificationFacade.sendFollowUpAppointmentNotification.bind(notificationFacade),

  // Lab notifications
  sendLabResultsReadyNotification: notificationFacade.sendLabResultsReadyNotification.bind(notificationFacade),

  // Appointment notifications
  sendAppointmentReminder: notificationFacade.sendAppointmentReminder.bind(notificationFacade),
  sendNewAppointmentNotification: notificationFacade.sendNewAppointmentNotification.bind(notificationFacade),
  sendAppointmentUpdateNotification: notificationFacade.sendAppointmentUpdateNotification.bind(notificationFacade),

  // Payment notifications
  sendPaymentReminder: notificationFacade.sendPaymentReminder.bind(notificationFacade),

  // Utilities
  scheduleNotification: notificationFacade.scheduleNotification.bind(notificationFacade),

  // Statistics
  getStats: notificationFacade.getStats.bind(notificationFacade),
  resetStats: notificationFacade.resetStats.bind(notificationFacade),

  // Validation
  formatPhoneNumber: notificationFacade.formatPhoneNumber.bind(notificationFacade),
  validateEmail: notificationFacade.validateEmail.bind(notificationFacade)
};

module.exports = notificationService;
