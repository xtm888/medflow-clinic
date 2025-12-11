/**
 * Password Validation Utility
 *
 * Enforces strong password policy for healthcare application:
 * - Minimum 12 characters (increased from 8 for better security)
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 *
 * These requirements help protect sensitive patient data (PHI)
 * and comply with healthcare security best practices.
 */

const PASSWORD_POLICY = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true
};

const SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/`~';

/**
 * Validate a password against the policy
 * @param {string} password - The password to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validatePassword(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }

  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters`);
  }

  if (password.length > PASSWORD_POLICY.maxLength) {
    errors.push(`Password must not exceed ${PASSWORD_POLICY.maxLength} characters`);
  }

  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (PASSWORD_POLICY.requireSpecial) {
    const hasSpecial = [...password].some(c => SPECIAL_CHARS.includes(c));
    if (!hasSpecial) {
      errors.push(`Password must contain at least one special character (${SPECIAL_CHARS.slice(0, 15)}...)`);
    }
  }

  // Check for common weak patterns
  const weakPatterns = [
    /^(.)\1+$/,        // All same character
    /^123456/,         // Sequential numbers
    /^abcdef/i,        // Sequential letters
    /password/i,       // Contains "password"
    /qwerty/i,         // Keyboard pattern
    /admin/i           // Contains "admin"
  ];

  for (const pattern of weakPatterns) {
    if (pattern.test(password)) {
      errors.push('Password is too common or uses a weak pattern');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get password policy description for display to users
 * @returns {Object} - Policy requirements
 */
function getPasswordPolicy() {
  return {
    ...PASSWORD_POLICY,
    description: `Password must be at least ${PASSWORD_POLICY.minLength} characters with uppercase, lowercase, number, and special character.`
  };
}

/**
 * Calculate password strength score (0-100)
 * @param {string} password - The password to evaluate
 * @returns {Object} - { score: number, strength: string }
 */
function calculateStrength(password) {
  if (!password) return { score: 0, strength: 'none' };

  let score = 0;

  // Length scoring
  if (password.length >= 8) score += 10;
  if (password.length >= 12) score += 15;
  if (password.length >= 16) score += 15;
  if (password.length >= 20) score += 10;

  // Character variety
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[^a-zA-Z0-9]/.test(password)) score += 15;

  // Pattern variety
  const uniqueChars = new Set(password.toLowerCase()).size;
  if (uniqueChars >= 6) score += 5;
  if (uniqueChars >= 10) score += 10;

  // Penalize weak patterns
  if (/^(.)\1+$/.test(password)) score -= 30;
  if (/password|123456|qwerty/i.test(password)) score -= 30;

  score = Math.max(0, Math.min(100, score));

  let strength = 'weak';
  if (score >= 80) strength = 'strong';
  else if (score >= 60) strength = 'good';
  else if (score >= 40) strength = 'fair';

  return { score, strength };
}

module.exports = {
  validatePassword,
  getPasswordPolicy,
  calculateStrength,
  PASSWORD_POLICY,
  SPECIAL_CHARS
};
