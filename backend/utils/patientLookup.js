/**
 * Patient Lookup Utility
 *
 * Provides standardized patient lookup to eliminate duplicate code.
 * This pattern is repeated 25+ times across controllers.
 */

const Patient = require('../models/Patient');

const OBJECTID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Find a patient by ObjectId or patientId
 * @param {string} identifier - MongoDB ObjectId or patientId
 * @param {Object} options - Query options
 * @param {string|Object} options.populate - Fields to populate
 * @param {string} options.select - Fields to select
 * @param {boolean} options.lean - Return plain object
 * @returns {Promise<Object|null>} - Patient document or null
 */
const findPatientByIdOrCode = async (identifier, options = {}) => {
  const { populate = null, select = null, lean = false } = options;

  if (!identifier) return null;

  const isObjectId = OBJECTID_REGEX.test(String(identifier));
  let query;

  if (isObjectId) {
    query = Patient.findById(identifier);
  } else {
    query = Patient.findOne({ patientId: identifier });
  }

  if (populate) query = query.populate(populate);
  if (select) query = query.select(select);
  if (lean) query = query.lean();

  let patient = await query;

  // If ObjectId search failed, try by patientId as fallback
  if (!patient && isObjectId) {
    query = Patient.findOne({ patientId: identifier });
    if (populate) query = query.populate(populate);
    if (select) query = query.select(select);
    if (lean) query = query.lean();
    patient = await query;
  }

  return patient;
};

/**
 * Find a patient or throw an error if not found
 * @param {string} identifier - MongoDB ObjectId or patientId
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Patient document
 * @throws {Error} - If patient not found
 */
const findPatientOrFail = async (identifier, options = {}) => {
  const patient = await findPatientByIdOrCode(identifier, options);
  if (!patient) {
    const error = new Error('Patient not found');
    error.statusCode = 404;
    error.code = 'PATIENT_NOT_FOUND';
    throw error;
  }
  return patient;
};

/**
 * Check if an identifier is a valid MongoDB ObjectId
 * @param {string} id - The identifier to check
 * @returns {boolean}
 */
const isValidObjectId = (id) => {
  return Boolean(id) && OBJECTID_REGEX.test(String(id));
};

module.exports = {
  findPatientByIdOrCode,
  findPatientOrFail,
  isValidObjectId,
  OBJECTID_REGEX
};
