const Joi = require('joi');

/**
 * Invoice Validation Schemas
 */

const invoiceItemSchema = Joi.object({
  service: Joi.string().required(),
  description: Joi.string().required(),
  quantity: Joi.number().integer().min(1).required(),
  unitPrice: Joi.number().min(0).required(),
  totalPrice: Joi.number().min(0).required(),
  conventionCoverage: Joi.number().min(0).max(100).default(0),
  conventionAmount: Joi.number().min(0),
  patientAmount: Joi.number().min(0)
});

const createInvoiceSchema = Joi.object({
  patient: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid patient ID format'
    }),

  visit: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({
      'string.pattern.base': 'Invalid visit ID format'
    }),

  items: Joi.array()
    .items(invoiceItemSchema)
    .min(1)
    .required()
    .messages({
      'array.min': 'Invoice must have at least one item'
    }),

  totalAmount: Joi.number()
    .min(0)
    .required(),

  currency: Joi.string()
    .valid('CDF', 'USD')
    .default('CDF'),

  discount: Joi.object({
    type: Joi.string().valid('percentage', 'fixed').required(),
    value: Joi.number().min(0).required(),
    amount: Joi.number().min(0).required(),
    reason: Joi.string().allow('')
  }),

  tax: Joi.object({
    rate: Joi.number().min(0).max(100),
    amount: Joi.number().min(0)
  }),

  notes: Joi.string().max(1000).allow(''),

  dueDate: Joi.date().min('now')
});

const recordPaymentSchema = Joi.object({
  amount: Joi.number()
    .min(0.01)
    .required()
    .messages({
      'number.min': 'Payment amount must be greater than 0'
    }),

  paymentMethod: Joi.string()
    .valid('cash', 'card', 'mobile_money', 'bank_transfer', 'insurance')
    .required(),

  currency: Joi.string()
    .valid('CDF', 'USD')
    .required(),

  transactionId: Joi.string().allow(''),

  notes: Joi.string().max(500).allow('')
});

module.exports = {
  createInvoiceSchema,
  recordPaymentSchema
};
