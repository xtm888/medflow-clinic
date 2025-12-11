const Joi = require('joi');

/**
 * Patient Validation Schemas
 *
 * Joi schemas for validating patient-related requests
 */

// Create patient schema
const createPatientSchema = Joi.object({
  firstName: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.empty': 'First name is required',
      'string.min': 'First name must be at least 2 characters',
      'string.max': 'First name must not exceed 50 characters'
    }),

  lastName: Joi.string()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Last name is required',
      'string.min': 'Last name must be at least 2 characters'
    }),

  dateOfBirth: Joi.date()
    .max('now')
    .required()
    .messages({
      'date.max': 'Date of birth cannot be in the future'
    }),

  gender: Joi.string()
    .valid('male', 'female', 'other')
    .required()
    .messages({
      'any.only': 'Gender must be male, female, or other'
    }),

  phoneNumber: Joi.string()
    .pattern(/^\+243\d{9}$/)
    .messages({
      'string.pattern.base': 'Phone number must be in DRC format (+243XXXXXXXXX)'
    }),

  email: Joi.string()
    .email()
    .messages({
      'string.email': 'Invalid email address'
    }),

  address: Joi.object({
    street: Joi.string().allow(''),
    city: Joi.string().allow(''),
    province: Joi.string().allow(''),
    country: Joi.string().default('DRC')
  }),

  convention: Joi.object({
    company: Joi.string(),
    membershipNumber: Joi.string(),
    coveragePercentage: Joi.number().min(0).max(100),
    isActive: Joi.boolean()
  }),

  medicalHistory: Joi.object({
    allergies: Joi.array().items(
      Joi.object({
        allergen: Joi.string().required(),
        reaction: Joi.string(),
        severity: Joi.string().valid('mild', 'moderate', 'severe')
      })
    ),
    chronicConditions: Joi.array().items(Joi.string()),
    medications: Joi.array().items(Joi.string()),
    surgicalHistory: Joi.array()
  })
});

// Update patient schema (all fields optional)
const updatePatientSchema = Joi.object({
  firstName: Joi.string().min(2).max(50),
  lastName: Joi.string().min(2).max(50),
  phoneNumber: Joi.string().pattern(/^\+243\d{9}$/),
  email: Joi.string().email(),
  address: Joi.object({
    street: Joi.string().allow(''),
    city: Joi.string().allow(''),
    province: Joi.string().allow(''),
    country: Joi.string()
  }),
  convention: Joi.object({
    company: Joi.string(),
    membershipNumber: Joi.string(),
    coveragePercentage: Joi.number().min(0).max(100),
    isActive: Joi.boolean()
  })
}).min(1); // At least one field must be provided

module.exports = {
  createPatientSchema,
  updatePatientSchema
};
