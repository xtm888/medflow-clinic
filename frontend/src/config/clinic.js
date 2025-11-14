// Clinic Configuration for MedFlow - Congo (DRC)
// Made by Aymane Moumni

export const clinicConfig = {
  // Clinic Information
  name: 'MedFlow Clinic',
  tagline: 'Medical Management System',
  developer: 'Aymane Moumni',

  // Contact Information
  phone: '+243 81 234 5678',
  whatsapp: '+243 81 234 5678',
  email: 'contact@medflow-cd.com',

  // Address
  address: {
    street: 'Avenue du Commerce, n°45',
    neighborhood: 'Gombe',
    city: 'Kinshasa',
    country: 'République Démocratique du Congo',
    full: 'Avenue du Commerce, n°45, Gombe, Kinshasa, RDC'
  },

  // Emergency Numbers
  emergency: {
    general: '112',
    police: '113',
    clinic: '+243 81 234 5678'
  },

  // Currency
  currency: {
    primary: 'USD', // US Dollar (widely used in DRC)
    secondary: 'CDF', // Congolese Franc
    symbol: '$',
    secondarySymbol: 'FC'
  },

  // Phone Validation (Congo format)
  phoneRegex: /^\+?243[0-9]{9}$/,
  phoneFormat: '+243 XX XXX XXXX',
  phoneExample: '+243 81 234 5678',

  // Business Hours
  hours: {
    weekdays: '08:00 - 18:00',
    saturday: '08:00 - 14:00',
    sunday: 'Fermé'
  },

  // Supported Mobile Operators
  operators: [
    { name: 'Vodacom', prefixes: ['81', '82'] },
    { name: 'Airtel', prefixes: ['97', '98', '99'] },
    { name: 'Orange', prefixes: ['84', '85', '89'] },
    { name: 'Africell', prefixes: ['90', '91'] }
  ]
};

// Attribution footer text
export const getAttribution = () => {
  return `© ${new Date().getFullYear()} ${clinicConfig.name} - Développé par ${clinicConfig.developer}`;
};

// Format phone number for display
export const formatPhone = (phone) => {
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');

  // Check if it starts with 243 (Congo code)
  if (cleaned.startsWith('243') && cleaned.length === 12) {
    return `+243 ${cleaned.substring(3, 5)} ${cleaned.substring(5, 8)} ${cleaned.substring(8)}`;
  }

  return phone;
};

// Validate Congo phone number
export const validateCongoPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');

  // Must be 12 digits total (243 + 9 digits)
  if (cleaned.length !== 12) return false;

  // Must start with 243
  if (!cleaned.startsWith('243')) return false;

  // Check if operator prefix is valid
  const prefix = cleaned.substring(3, 5);
  const validPrefixes = ['81', '82', '97', '98', '99', '84', '85', '89', '90', '91'];

  return validPrefixes.includes(prefix);
};

export default clinicConfig;
