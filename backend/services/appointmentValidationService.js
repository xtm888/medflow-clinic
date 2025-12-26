/**
 * Appointment Validation Service
 * Enforces buffer time between appointments and room/resource conflict detection
 *
 * All validation functions include:
 * - Input validation
 * - Proper error handling with try-catch
 * - Structured logging for debugging
 */

const Appointment = require('../models/Appointment');
const Room = require('../models/Room');
const { createContextLogger } = require('../utils/structuredLogger');
const log = createContextLogger('AppointmentValidation');

/**
 * Default buffer times by appointment type (in minutes)
 */
const DEFAULT_BUFFER_TIMES = {
  'consultation': 5,
  'follow_up': 5,
  'eye_exam': 10,
  'comprehensive_exam': 15,
  'contact_lens_fitting': 10,
  'glaucoma_workup': 10,
  'retinal_exam': 10,
  'oct_scan': 5,
  'visual_field': 5,
  'procedure': 15,
  'minor_procedure': 10,
  'surgery': 30,
  'injection': 5,
  'ivt': 10,
  'laser': 15,
  'default': 5
};

/**
 * Appointment duration defaults (in minutes)
 */
const DEFAULT_DURATIONS = {
  'consultation': 30,
  'follow_up': 20,
  'eye_exam': 30,
  'comprehensive_exam': 60,
  'contact_lens_fitting': 45,
  'glaucoma_workup': 45,
  'retinal_exam': 30,
  'oct_scan': 15,
  'visual_field': 20,
  'procedure': 45,
  'minor_procedure': 30,
  'surgery': 120,
  'injection': 15,
  'ivt': 30,
  'laser': 45,
  'default': 30
};

/**
 * Get buffer time for appointment type
 * @param {String} appointmentType - Type of appointment
 * @returns {Number} Buffer time in minutes
 */
function getBufferTime(appointmentType) {
  return DEFAULT_BUFFER_TIMES[appointmentType] || DEFAULT_BUFFER_TIMES.default;
}

/**
 * Get default duration for appointment type
 * @param {String} appointmentType - Type of appointment
 * @returns {Number} Duration in minutes
 */
function getDefaultDuration(appointmentType) {
  return DEFAULT_DURATIONS[appointmentType] || DEFAULT_DURATIONS.default;
}

/**
 * Calculate appointment end time
 * @param {Date} startTime - Start time
 * @param {Number} duration - Duration in minutes
 * @returns {Date} End time
 */
function calculateEndTime(startTime, duration) {
  const end = new Date(startTime);
  end.setMinutes(end.getMinutes() + duration);
  return end;
}

/**
 * Check for provider conflicts
 * @param {String} providerId - Provider ID
 * @param {Date} startTime - Proposed start time
 * @param {Date} endTime - Proposed end time
 * @param {String} excludeAppointmentId - Appointment ID to exclude (for updates)
 * @returns {Object} Conflict check result
 */
async function checkProviderConflicts(providerId, startTime, endTime, excludeAppointmentId = null) {
  try {
    const query = {
      provider: providerId,
      status: { $nin: ['cancelled', 'no_show'] },
      $or: [
        // New appointment overlaps with existing appointment start
        { startTime: { $lt: endTime, $gte: startTime } },
        // New appointment overlaps with existing appointment end
        { endTime: { $gt: startTime, $lte: endTime } },
        // Existing appointment completely contains new appointment
        { startTime: { $lte: startTime }, endTime: { $gte: endTime } }
      ]
    };

    if (excludeAppointmentId) {
      query._id = { $ne: excludeAppointmentId };
    }

    const conflictingAppointments = await Appointment.find(query)
      .populate('patient', 'firstName lastName')
      .lean();

    if (conflictingAppointments.length > 0) {
      return {
        hasConflict: true,
        conflictType: 'provider',
        message: `Le médecin a ${conflictingAppointments.length} rendez-vous en conflit pendant ce créneau`,
        conflicts: conflictingAppointments.map(apt => ({
          appointmentId: apt._id,
          patientName: apt.patient ? `${apt.patient.firstName} ${apt.patient.lastName}` : 'Inconnu',
          startTime: apt.startTime,
          endTime: apt.endTime,
          type: apt.type
        }))
      };
    }

    return { hasConflict: false };
  } catch (error) {
    log.error('Erreur lors de la vérification des conflits médecin:', {
      error: error.message,
      providerId,
      startTime,
      endTime
    });
    return {
      hasConflict: false,
      error: true,
      message: 'Erreur lors de la vérification des conflits médecin'
    };
  }
}

/**
 * Check for room conflicts
 * @param {String} roomId - Room ID
 * @param {Date} startTime - Proposed start time
 * @param {Date} endTime - Proposed end time
 * @param {String} excludeAppointmentId - Appointment ID to exclude
 * @returns {Object} Conflict check result
 */
async function checkRoomConflicts(roomId, startTime, endTime, excludeAppointmentId = null) {
  if (!roomId) {
    return { hasConflict: false };
  }

  try {
    const query = {
      room: roomId,
      status: { $nin: ['cancelled', 'no_show'] },
      $or: [
        { startTime: { $lt: endTime, $gte: startTime } },
        { endTime: { $gt: startTime, $lte: endTime } },
        { startTime: { $lte: startTime }, endTime: { $gte: endTime } }
      ]
    };

    if (excludeAppointmentId) {
      query._id = { $ne: excludeAppointmentId };
    }

    const conflictingAppointments = await Appointment.find(query)
      .populate('provider', 'firstName lastName')
      .lean();

    if (conflictingAppointments.length > 0) {
      return {
        hasConflict: true,
        conflictType: 'room',
        message: 'La salle est déjà réservée pendant ce créneau',
        conflicts: conflictingAppointments.map(apt => ({
          appointmentId: apt._id,
          providerName: apt.provider ? `${apt.provider.firstName} ${apt.provider.lastName}` : 'Inconnu',
          startTime: apt.startTime,
          endTime: apt.endTime,
          type: apt.type
        }))
      };
    }

    return { hasConflict: false };
  } catch (error) {
    log.error('Erreur lors de la vérification des conflits salle:', {
      error: error.message,
      roomId,
      startTime,
      endTime
    });
    return {
      hasConflict: false,
      error: true,
      message: 'Erreur lors de la vérification des conflits salle'
    };
  }
}

/**
 * Check for equipment conflicts
 * @param {Array} equipmentIds - Equipment IDs needed
 * @param {Date} startTime - Proposed start time
 * @param {Date} endTime - Proposed end time
 * @param {String} excludeAppointmentId - Appointment ID to exclude
 * @returns {Object} Conflict check result
 */
async function checkEquipmentConflicts(equipmentIds, startTime, endTime, excludeAppointmentId = null) {
  if (!equipmentIds || equipmentIds.length === 0) {
    return { hasConflict: false };
  }

  try {
    const query = {
      equipment: { $in: equipmentIds },
      status: { $nin: ['cancelled', 'no_show'] },
      $or: [
        { startTime: { $lt: endTime, $gte: startTime } },
        { endTime: { $gt: startTime, $lte: endTime } },
        { startTime: { $lte: startTime }, endTime: { $gte: endTime } }
      ]
    };

    if (excludeAppointmentId) {
      query._id = { $ne: excludeAppointmentId };
    }

    const conflictingAppointments = await Appointment.find(query).lean();

    if (conflictingAppointments.length > 0) {
      return {
        hasConflict: true,
        conflictType: 'equipment',
        message: 'L\'équipement requis est en cours d\'utilisation',
        conflicts: conflictingAppointments.map(apt => ({
          appointmentId: apt._id,
          startTime: apt.startTime,
          endTime: apt.endTime,
          equipment: apt.equipment
        }))
      };
    }

    return { hasConflict: false };
  } catch (error) {
    log.error('Erreur lors de la vérification des conflits équipement:', {
      error: error.message,
      equipmentIds,
      startTime,
      endTime
    });
    return {
      hasConflict: false,
      error: true,
      message: 'Erreur lors de la vérification des conflits équipement'
    };
  }
}

/**
 * Check buffer time violations
 * @param {String} providerId - Provider ID
 * @param {Date} startTime - Proposed start time
 * @param {Date} endTime - Proposed end time
 * @param {String} appointmentType - Type of appointment
 * @param {String} excludeAppointmentId - Appointment ID to exclude
 * @returns {Object} Buffer check result
 */
async function checkBufferTimeViolations(providerId, startTime, endTime, appointmentType, excludeAppointmentId = null) {
  try {
    const bufferTime = getBufferTime(appointmentType);

    // Expand time window to include buffer
    const bufferStart = new Date(startTime);
    bufferStart.setMinutes(bufferStart.getMinutes() - bufferTime);

    const bufferEnd = new Date(endTime);
    bufferEnd.setMinutes(bufferEnd.getMinutes() + bufferTime);

    const query = {
      provider: providerId,
      status: { $nin: ['cancelled', 'no_show'] },
      $or: [
        // Check if any appointment ends within buffer before our start
        { endTime: { $gt: bufferStart, $lte: startTime } },
        // Check if any appointment starts within buffer after our end
        { startTime: { $gte: endTime, $lt: bufferEnd } }
      ]
    };

    if (excludeAppointmentId) {
      query._id = { $ne: excludeAppointmentId };
    }

    const adjacentAppointments = await Appointment.find(query)
      .populate('patient', 'firstName lastName')
      .lean();

    const violations = [];

    for (const apt of adjacentAppointments) {
      const aptEnd = new Date(apt.endTime);
      const aptStart = new Date(apt.startTime);
      const aptBuffer = getBufferTime(apt.type);

      // Check if buffer is violated before our appointment
      if (aptEnd <= startTime) {
        const requiredBuffer = Math.max(bufferTime, aptBuffer);
        const actualGap = (startTime - aptEnd) / 60000; // minutes

        if (actualGap < requiredBuffer) {
          violations.push({
            type: 'before',
            conflictingAppointment: {
              id: apt._id,
              patientName: apt.patient ? `${apt.patient.firstName} ${apt.patient.lastName}` : 'Inconnu',
              endTime: apt.endTime
            },
            requiredBuffer: requiredBuffer,
            actualGap: Math.round(actualGap),
            message: `Seulement ${Math.round(actualGap)} min avant ce RDV (${requiredBuffer} min requis)`
          });
        }
      }

      // Check if buffer is violated after our appointment
      if (aptStart >= endTime) {
        const requiredBuffer = Math.max(bufferTime, aptBuffer);
        const actualGap = (aptStart - endTime) / 60000; // minutes

        if (actualGap < requiredBuffer) {
          violations.push({
            type: 'after',
            conflictingAppointment: {
              id: apt._id,
              patientName: apt.patient ? `${apt.patient.firstName} ${apt.patient.lastName}` : 'Inconnu',
              startTime: apt.startTime
            },
            requiredBuffer: requiredBuffer,
            actualGap: Math.round(actualGap),
            message: `Seulement ${Math.round(actualGap)} min après ce RDV (${requiredBuffer} min requis)`
          });
        }
      }
    }

    if (violations.length > 0) {
      return {
        hasViolation: true,
        violations,
        message: `Violations du temps tampon: ${violations.map(v => v.message).join('; ')}`
      };
    }

    return { hasViolation: false };
  } catch (error) {
    log.error('Erreur lors de la vérification des temps tampon:', {
      error: error.message,
      providerId,
      startTime,
      endTime,
      appointmentType
    });
    return {
      hasViolation: false,
      error: true,
      message: 'Erreur lors de la vérification des temps tampon'
    };
  }
}

/**
 * Validate appointment (comprehensive check)
 * @param {Object} appointmentData - Appointment data to validate
 * @param {String} excludeAppointmentId - Appointment ID to exclude (for updates)
 * @returns {Object} Validation result
 */
async function validateAppointment(appointmentData, excludeAppointmentId = null) {
  try {
    const {
      provider,
      room,
      equipment,
      startTime,
      duration,
      type
    } = appointmentData;

    const start = new Date(startTime);
    const appointmentDuration = duration || getDefaultDuration(type);
    const end = calculateEndTime(start, appointmentDuration);

    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Check provider conflicts
    const providerConflicts = await checkProviderConflicts(provider, start, end, excludeAppointmentId);
    if (providerConflicts.hasConflict) {
      validationResult.isValid = false;
      validationResult.errors.push({
        type: 'provider_conflict',
        ...providerConflicts
      });
    }

    // Check room conflicts
    const roomConflicts = await checkRoomConflicts(room, start, end, excludeAppointmentId);
    if (roomConflicts.hasConflict) {
      validationResult.isValid = false;
      validationResult.errors.push({
        type: 'room_conflict',
        ...roomConflicts
      });
    }

    // Check equipment conflicts
    const equipmentConflicts = await checkEquipmentConflicts(equipment, start, end, excludeAppointmentId);
    if (equipmentConflicts.hasConflict) {
      validationResult.isValid = false;
      validationResult.errors.push({
        type: 'equipment_conflict',
        ...equipmentConflicts
      });
    }

    // Check buffer time violations (warning, not error)
    const bufferViolations = await checkBufferTimeViolations(provider, start, end, type, excludeAppointmentId);
    if (bufferViolations.hasViolation) {
      validationResult.warnings.push({
        type: 'buffer_violation',
        ...bufferViolations
      });
    }

    // Add suggestions if conflicts found
    if (!validationResult.isValid) {
      const nextAvailable = await findNextAvailableSlot(provider, start, appointmentDuration, type);
      if (nextAvailable) {
        validationResult.suggestions.push({
          type: 'next_available',
          message: 'Prochain créneau disponible',
          startTime: nextAvailable.startTime,
          endTime: nextAvailable.endTime
        });
      }
    }

    return validationResult;
  } catch (error) {
    log.error('Erreur lors de la validation du rendez-vous:', {
      error: error.message,
      appointmentData: {
        provider: appointmentData.provider,
        startTime: appointmentData.startTime,
        type: appointmentData.type
      }
    });
    return {
      isValid: false,
      errors: [{
        type: 'validation_error',
        message: 'Erreur lors de la validation du rendez-vous'
      }],
      warnings: [],
      suggestions: []
    };
  }
}

/**
 * Find next available slot for a provider
 * @param {String} providerId - Provider ID
 * @param {Date} afterTime - Find slot after this time
 * @param {Number} duration - Required duration in minutes
 * @param {String} appointmentType - Type of appointment
 * @returns {Object|null} Available slot or null
 */
async function findNextAvailableSlot(providerId, afterTime, duration, appointmentType) {
  try {
    const bufferTime = getBufferTime(appointmentType);
    const searchStart = new Date(afterTime);
    const searchEnd = new Date(afterTime);
    searchEnd.setDate(searchEnd.getDate() + 7); // Search 7 days ahead

    // Get all appointments for the provider in the search range
    const appointments = await Appointment.find({
      provider: providerId,
      status: { $nin: ['cancelled', 'no_show'] },
      startTime: { $gte: searchStart, $lte: searchEnd }
    })
      .sort({ startTime: 1 })
      .lean();

    // Business hours (configurable)
    const businessStart = 8; // 8 AM
    const businessEnd = 18; // 6 PM

    let currentSlot = new Date(searchStart);

    // Adjust to business hours
    if (currentSlot.getHours() < businessStart) {
      currentSlot.setHours(businessStart, 0, 0, 0);
    } else if (currentSlot.getHours() >= businessEnd) {
      currentSlot.setDate(currentSlot.getDate() + 1);
      currentSlot.setHours(businessStart, 0, 0, 0);
    }

    for (const apt of appointments) {
      const aptStart = new Date(apt.startTime);
      const aptEnd = new Date(apt.endTime);
      const aptBuffer = getBufferTime(apt.type);

      // Check if we can fit before this appointment
      const slotEnd = calculateEndTime(currentSlot, duration);
      const requiredGap = new Date(aptStart);
      requiredGap.setMinutes(requiredGap.getMinutes() - Math.max(bufferTime, aptBuffer));

      if (slotEnd <= requiredGap) {
        return {
          startTime: currentSlot,
          endTime: slotEnd
        };
      }

      // Move to after this appointment plus buffer
      currentSlot = new Date(aptEnd);
      currentSlot.setMinutes(currentSlot.getMinutes() + Math.max(bufferTime, aptBuffer));

      // Adjust for business hours
      if (currentSlot.getHours() >= businessEnd) {
        currentSlot.setDate(currentSlot.getDate() + 1);
        currentSlot.setHours(businessStart, 0, 0, 0);
      }
    }

    // Check if we can fit at the current slot
    const slotEnd = calculateEndTime(currentSlot, duration);
    if (currentSlot.getHours() < businessEnd && slotEnd.getHours() <= businessEnd) {
      return {
        startTime: currentSlot,
        endTime: slotEnd
      };
    }

    return null;
  } catch (error) {
    log.error('Erreur lors de la recherche du prochain créneau disponible:', {
      error: error.message,
      providerId,
      afterTime,
      duration,
      appointmentType
    });
    return null;
  }
}

/**
 * Get available slots for a provider on a specific date
 * @param {String} providerId - Provider ID
 * @param {Date} date - Date to check
 * @param {Number} duration - Appointment duration in minutes
 * @param {String} appointmentType - Type of appointment
 * @returns {Array} Available time slots
 */
async function getAvailableSlots(providerId, date, duration, appointmentType) {
  try {
    const bufferTime = getBufferTime(appointmentType);
    const slotDuration = duration || getDefaultDuration(appointmentType);

    // Set day boundaries
    const dayStart = new Date(date);
    dayStart.setHours(8, 0, 0, 0); // 8 AM

    const dayEnd = new Date(date);
    dayEnd.setHours(18, 0, 0, 0); // 6 PM

    // Get existing appointments
    const appointments = await Appointment.find({
      provider: providerId,
      status: { $nin: ['cancelled', 'no_show'] },
      startTime: { $gte: dayStart, $lt: dayEnd }
    })
      .sort({ startTime: 1 })
      .lean();

    const availableSlots = [];
    let currentTime = new Date(dayStart);

    for (const apt of appointments) {
      const aptStart = new Date(apt.startTime);
      const aptEnd = new Date(apt.endTime);
      const aptBuffer = getBufferTime(apt.type);
      const requiredBuffer = Math.max(bufferTime, aptBuffer);

      // Calculate potential slot end
      const slotEnd = calculateEndTime(currentTime, slotDuration);

      // Check if slot fits before this appointment (with buffer)
      const gapNeeded = new Date(aptStart);
      gapNeeded.setMinutes(gapNeeded.getMinutes() - requiredBuffer);

      if (slotEnd <= gapNeeded) {
        availableSlots.push({
          startTime: new Date(currentTime),
          endTime: slotEnd,
          duration: slotDuration
        });
      }

      // Move current time to after this appointment plus buffer
      currentTime = new Date(aptEnd);
      currentTime.setMinutes(currentTime.getMinutes() + requiredBuffer);
    }

    // Check for slot at end of day
    const finalSlotEnd = calculateEndTime(currentTime, slotDuration);
    if (currentTime < dayEnd && finalSlotEnd <= dayEnd) {
      availableSlots.push({
        startTime: new Date(currentTime),
        endTime: finalSlotEnd,
        duration: slotDuration
      });
    }

    return availableSlots;
  } catch (error) {
    log.error('Erreur lors de la récupération des créneaux disponibles:', {
      error: error.message,
      providerId,
      date,
      duration,
      appointmentType
    });
    return [];
  }
}

module.exports = {
  validateAppointment,
  checkProviderConflicts,
  checkRoomConflicts,
  checkEquipmentConflicts,
  checkBufferTimeViolations,
  findNextAvailableSlot,
  getAvailableSlots,
  getBufferTime,
  getDefaultDuration,
  calculateEndTime,
  DEFAULT_BUFFER_TIMES,
  DEFAULT_DURATIONS
};
