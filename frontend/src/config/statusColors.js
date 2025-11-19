/**
 * Centralized Status Color Configuration
 * Provides consistent status-to-color mappings across the entire application.
 */

// ============================================================================
// BASE COLOR PALETTE
// ============================================================================

const COLORS = {
  // Success/Positive
  green: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-300',
    badge: 'badge badge-success'
  },
  // Warning/Pending
  yellow: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    border: 'border-yellow-300',
    badge: 'badge badge-warning'
  },
  // Error/Danger
  red: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
    badge: 'badge badge-danger'
  },
  // Info/Primary
  blue: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-300',
    badge: 'badge badge-info'
  },
  // Neutral/Inactive
  gray: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-300',
    badge: 'badge'
  },
  // VIP/Special
  purple: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-300',
    badge: 'bg-purple-100 text-purple-800'
  },
  // Progress/In-progress
  orange: {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    border: 'border-orange-300',
    badge: 'bg-orange-100 text-orange-800'
  },
  // Urgent
  pink: {
    bg: 'bg-pink-100',
    text: 'text-pink-800',
    border: 'border-pink-300',
    badge: 'bg-pink-100 text-pink-800'
  }
};

// ============================================================================
// STATUS MAPPINGS
// ============================================================================

/**
 * Appointment Status Colors
 */
export const appointmentStatusColors = {
  scheduled: COLORS.blue,
  confirmed: COLORS.green,
  'checked-in': COLORS.purple,
  'in-progress': COLORS.orange,
  completed: COLORS.blue,
  cancelled: COLORS.red,
  'no-show': COLORS.gray,
  rescheduled: COLORS.yellow,
  pending: COLORS.yellow
};

/**
 * Invoice Status Colors
 */
export const invoiceStatusColors = {
  draft: COLORS.gray,
  pending: COLORS.yellow,
  paid: COLORS.green,
  partial: COLORS.orange,
  overdue: COLORS.red,
  cancelled: COLORS.gray,
  refunded: COLORS.purple
};

/**
 * Patient Status Colors
 */
export const patientStatusColors = {
  active: COLORS.green,
  inactive: COLORS.gray,
  deceased: COLORS.red,
  transferred: COLORS.yellow
};

/**
 * Prescription Status Colors
 */
export const prescriptionStatusColors = {
  active: COLORS.green,
  pending: COLORS.yellow,
  dispensed: COLORS.blue,
  expired: COLORS.red,
  cancelled: COLORS.gray
};

/**
 * Visit Status Colors
 */
export const visitStatusColors = {
  scheduled: COLORS.blue,
  'in-progress': COLORS.orange,
  completed: COLORS.green,
  cancelled: COLORS.gray
};

/**
 * Queue Priority Colors
 */
export const queuePriorityColors = {
  normal: COLORS.gray,
  high: COLORS.yellow,
  urgent: COLORS.orange,
  emergency: COLORS.red,
  vip: COLORS.purple,
  pregnant: COLORS.pink,
  elderly: COLORS.blue
};

/**
 * IVT Status Colors
 */
export const ivtStatusColors = {
  scheduled: COLORS.blue,
  completed: COLORS.green,
  cancelled: COLORS.red,
  postponed: COLORS.yellow
};

/**
 * Device Status Colors
 */
export const deviceStatusColors = {
  active: COLORS.green,
  inactive: COLORS.gray,
  maintenance: COLORS.yellow,
  error: COLORS.red
};

/**
 * Lab Order Status Colors
 */
export const labOrderStatusColors = {
  pending: COLORS.yellow,
  'in-progress': COLORS.orange,
  completed: COLORS.green,
  cancelled: COLORS.gray
};

/**
 * Pharmacy/Inventory Status Colors
 */
export const inventoryStatusColors = {
  'in-stock': COLORS.green,
  'low-stock': COLORS.yellow,
  'out-of-stock': COLORS.red,
  discontinued: COLORS.gray,
  expired: COLORS.red
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get status color classes
 * @param {string} status - The status value
 * @param {string} type - The status type ('appointment', 'invoice', 'patient', etc.)
 * @param {string} variant - 'badge' | 'background' | 'text' | 'border'
 * @returns {string} Tailwind CSS classes
 */
export const getStatusColor = (status, type = 'appointment', variant = 'badge') => {
  const statusMaps = {
    appointment: appointmentStatusColors,
    invoice: invoiceStatusColors,
    patient: patientStatusColors,
    prescription: prescriptionStatusColors,
    visit: visitStatusColors,
    priority: queuePriorityColors,
    ivt: ivtStatusColors,
    device: deviceStatusColors,
    labOrder: labOrderStatusColors,
    inventory: inventoryStatusColors
  };

  const statusMap = statusMaps[type] || statusMaps.appointment;
  const normalizedStatus = status?.toLowerCase().replace(/_/g, '-') || '';
  const colors = statusMap[normalizedStatus] || COLORS.gray;

  switch (variant) {
    case 'badge':
      return colors.badge;
    case 'background':
      return `${colors.bg} ${colors.text}`;
    case 'text':
      return colors.text;
    case 'border':
      return colors.border;
    case 'full':
      return `${colors.bg} ${colors.text} ${colors.border}`;
    default:
      return colors.badge;
  }
};

/**
 * Get status badge classes (shorthand)
 */
export const getStatusBadge = (status, type = 'appointment') => {
  return getStatusColor(status, type, 'badge');
};

/**
 * Get status background classes (for cards, rows, etc.)
 */
export const getStatusBackground = (status, type = 'appointment') => {
  return getStatusColor(status, type, 'background');
};

/**
 * Get wait time color based on minutes
 */
export const getWaitTimeColor = (minutes) => {
  if (minutes < 15) return 'text-green-600';
  if (minutes < 30) return 'text-yellow-600';
  if (minutes < 60) return 'text-orange-600';
  return 'text-red-600 animate-pulse';
};

/**
 * Get stock level color based on quantity and threshold
 */
export const getStockLevelColor = (quantity, minStock = 10) => {
  if (quantity <= 0) return COLORS.red;
  if (quantity <= minStock) return COLORS.yellow;
  return COLORS.green;
};

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

const statusColors = {
  COLORS,
  appointment: appointmentStatusColors,
  invoice: invoiceStatusColors,
  patient: patientStatusColors,
  prescription: prescriptionStatusColors,
  visit: visitStatusColors,
  priority: queuePriorityColors,
  ivt: ivtStatusColors,
  device: deviceStatusColors,
  labOrder: labOrderStatusColors,
  inventory: inventoryStatusColors,
  getStatusColor,
  getStatusBadge,
  getStatusBackground,
  getWaitTimeColor,
  getStockLevelColor
};

export default statusColors;
