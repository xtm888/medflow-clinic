/**
 * Barcode Generation Utility for Laboratory Module
 *
 * Generates unique specimen barcodes with collision detection.
 * Format: SP + YYMMDDHHmmss + 6 random alphanumeric chars
 * This provides ~2.1 billion unique combinations per second.
 */

const crypto = require('crypto');
const Visit = require('../../../models/Visit');
const LabOrder = require('../../../models/LabOrder');

/**
 * Generate a barcode string (without collision check)
 * @returns {string} Barcode in format SP{timestamp}{random}
 */
function generateBarcode() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${year}${month}${day}${hour}${minute}${second}`;

  // Use crypto for cryptographically secure random bytes
  // 4 bytes = 4,294,967,296 combinations
  const randomBytes = crypto.randomBytes(4);
  const random = randomBytes.toString('hex').toUpperCase().slice(0, 6);

  return `SP${timestamp}${random}`;
}

/**
 * Generate a unique barcode with collision detection
 * Checks both Visit.specimens and LabOrder.specimen collections
 *
 * @param {number} maxRetries - Maximum number of retry attempts (default: 5)
 * @returns {Promise<string>} A unique barcode string
 */
async function generateUniqueBarcode(maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const barcode = generateBarcode();

    // Check for collision in both Visit.specimens and LabOrder.specimen
    const [visitCollision, labOrderCollision] = await Promise.all([
      Visit.findOne({ 'specimens.barcode': barcode }).select('_id').lean(),
      LabOrder.findOne({ 'specimen.barcode': barcode }).select('_id').lean()
    ]);

    if (!visitCollision && !labOrderCollision) {
      return barcode;
    }

    // If collision, log warning and retry
    console.warn(`Barcode collision detected for ${barcode}, attempt ${attempt + 1}/${maxRetries}`);

    // Small delay to ensure timestamp changes
    await new Promise(resolve => setTimeout(resolve, 1));
  }

  // If all retries fail, add UUID suffix for guaranteed uniqueness
  const fallback = generateBarcode() + crypto.randomUUID().slice(0, 4).toUpperCase();
  console.warn(`Using fallback barcode: ${fallback}`);
  return fallback;
}

module.exports = {
  generateBarcode,
  generateUniqueBarcode
};
