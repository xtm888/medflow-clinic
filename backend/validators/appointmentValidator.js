const Joi = require('joi');

/**
 * Appointment Validation Schemas
 */

const createAppointmentSchema = Joi.object({
  patient: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid patient ID format'
    }),

  provider: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid provider ID format'
    }),

  appointmentDate: Joi.date()
    .min('now')
    .required()
    .messages({
      'date.min': 'Appointment date cannot be in the past'
    }),

  duration: Joi.number()
    .integer()
    .min(15)
    .max(240)
    .default(30)
    .messages({
      'number.min': 'Duration must be at least 15 minutes',
      'number.max': 'Duration cannot exceed 240 minutes'
    }),

  type: Joi.string()
    .valid('consultation', 'follow-up', 'surgery', 'emergency', 'screening')
    .required(),

  reason: Joi.string()
    .max(500)
    .required(),

  notes: Joi.string()
    .max(1000)
    .allow('')
});

const updateAppointmentSchema = Joi.object({
  appointmentDate: Joi.date().min('now'),
  duration: Joi.number().integer().min(15).max(240),
  type: Joi.string().valid('consultation', 'follow-up', 'surgery', 'emergency', 'screening'),
  status: Joi.string().valid('scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'),
  reason: Joi.string().max(500),
  notes: Joi.string().max(1000).allow('')
}).min(1);

module.exports = {
  createAppointmentSchema,
  updateAppointmentSchema
};
