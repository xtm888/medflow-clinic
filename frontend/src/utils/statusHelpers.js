/**
 * Shared status and badge helper utilities
 * Consolidates duplicate status logic from across the application
 */

// =============================================================================
// INVENTORY STATUSES (used by Frame, OpticalLens, ContactLens, Reagent, etc.)
// =============================================================================
export const INVENTORY_STATUSES = [
  { value: 'in-stock', label: 'En stock', color: 'bg-green-100 text-green-800' },
  { value: 'low-stock', label: 'Stock bas', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'out-of-stock', label: 'Rupture', color: 'bg-red-100 text-red-800' },
  { value: 'on-order', label: 'En commande', color: 'bg-blue-100 text-blue-800' },
  { value: 'discontinued', label: 'Discontinue', color: 'bg-gray-100 text-gray-800' }
];

// =============================================================================
// APPOINTMENT/VISIT STATUSES
// =============================================================================
export const APPOINTMENT_STATUSES = [
  { value: 'scheduled', label: 'Planifie', color: 'bg-blue-100 text-blue-800' },
  { value: 'confirmed', label: 'Confirme', color: 'bg-green-100 text-green-800' },
  { value: 'checked-in', label: 'Arrive', color: 'bg-purple-100 text-purple-800' },
  { value: 'in-progress', label: 'En cours', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'completed', label: 'Termine', color: 'bg-gray-100 text-gray-800' },
  { value: 'cancelled', label: 'Annule', color: 'bg-red-100 text-red-800' },
  { value: 'no-show', label: 'Absent', color: 'bg-orange-100 text-orange-800' }
];

// =============================================================================
// LAB ORDER STATUSES
// =============================================================================
export const LAB_STATUSES = [
  { value: 'pending', label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'collected', label: 'Preleve', color: 'bg-blue-100 text-blue-800' },
  { value: 'received', label: 'Recu', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'in-progress', label: 'En cours', color: 'bg-purple-100 text-purple-800' },
  { value: 'completed', label: 'Termine', color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'Annule', color: 'bg-red-100 text-red-800' }
];

// =============================================================================
// INVOICE STATUSES
// =============================================================================
export const INVOICE_STATUSES = [
  { value: 'draft', label: 'Brouillon', color: 'bg-gray-100 text-gray-800' },
  { value: 'pending', label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'partial', label: 'Partiel', color: 'bg-orange-100 text-orange-800' },
  { value: 'paid', label: 'Paye', color: 'bg-green-100 text-green-800' },
  { value: 'overdue', label: 'En retard', color: 'bg-red-100 text-red-800' },
  { value: 'cancelled', label: 'Annule', color: 'bg-gray-100 text-gray-800' }
];

// =============================================================================
// GLASSES ORDER STATUSES
// =============================================================================
export const GLASSES_ORDER_STATUSES = [
  { value: 'pending', label: 'En attente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'ordered', label: 'Commande', color: 'bg-blue-100 text-blue-800' },
  { value: 'manufacturing', label: 'Fabrication', color: 'bg-purple-100 text-purple-800' },
  { value: 'shipped', label: 'Expedie', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'ready', label: 'Pret', color: 'bg-green-100 text-green-800' },
  { value: 'delivered', label: 'Livre', color: 'bg-gray-100 text-gray-800' },
  { value: 'cancelled', label: 'Annule', color: 'bg-red-100 text-red-800' }
];

// =============================================================================
// PRIORITY CONFIGS
// =============================================================================
export const PRIORITY_CONFIGS = {
  vip: { label: 'VIP', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  pregnant: { label: 'Enceinte', color: 'bg-pink-100 text-pink-800 border-pink-300' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800 border-red-300' },
  elderly: { label: 'Age', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  emergency: { label: 'Urgence', color: 'bg-red-100 text-red-800 border-red-300' },
  high: { label: 'Priorite', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  normal: { label: 'Normal', color: 'bg-gray-100 text-gray-800 border-gray-300' },
  routine: { label: 'Routine', color: 'bg-gray-100 text-gray-800 border-gray-300' }
};

export const PRIORITY_ORDER = {
  emergency: 0,
  urgent: 1,
  vip: 2,
  pregnant: 3,
  elderly: 4,
  high: 5,
  normal: 6,
  routine: 7
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get status configuration from a status list
 */
export const getStatusConfig = (status, statusList = INVENTORY_STATUSES) => {
  return statusList.find(s => s.value === status) || statusList[0] || {
    value: status,
    label: status,
    color: 'bg-gray-100 text-gray-800'
  };
};

/**
 * Get priority configuration
 */
export const getPriorityConfig = (priority) => {
  return PRIORITY_CONFIGS[priority] || PRIORITY_CONFIGS.normal;
};

/**
 * Get priority color classes
 */
export const getPriorityColor = (priority) => {
  const config = getPriorityConfig(priority);
  return config.color;
};

/**
 * Get priority label
 */
export const getPriorityLabel = (priority) => {
  const config = getPriorityConfig(priority);
  return config.label;
};

/**
 * Get wait time color based on minutes
 */
export const getWaitTimeColor = (minutes) => {
  if (minutes < 15) return 'text-green-600';
  if (minutes < 30) return 'text-orange-600';
  return 'text-red-600 animate-pulse';
};

/**
 * Get wait time bar color for visual indicators
 */
export const getWaitTimeBarColor = (minutes) => {
  if (minutes < 15) return 'border-l-8 border-green-500 bg-green-50/30';
  if (minutes < 30) return 'border-l-8 border-orange-500 bg-orange-50/30';
  return 'border-l-8 border-red-500 bg-red-50/30 animate-pulse';
};

/**
 * Calculate wait time in minutes
 */
export const calculateWaitTime = (checkInTime, currentTime = Date.now()) => {
  if (!checkInTime) return 0;
  const checkIn = new Date(checkInTime).getTime();
  if (isNaN(checkIn)) return 0;
  const diffMs = currentTime - checkIn;
  return Math.max(0, Math.floor(diffMs / 60000));
};

/**
 * Sort patients by priority and arrival time
 */
export const sortByPriority = (items, sortBy = 'priority') => {
  const sorted = [...items];
  const getTime = (dateStr) => {
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  };

  switch (sortBy) {
    case 'priority':
      return sorted.sort((a, b) => {
        const priorityDiff = (PRIORITY_ORDER[a.priority] || 6) - (PRIORITY_ORDER[b.priority] || 6);
        if (priorityDiff !== 0) return priorityDiff;
        return getTime(a.checkInTime || a.createdAt) - getTime(b.checkInTime || b.createdAt);
      });
    case 'arrival':
      return sorted.sort((a, b) => getTime(a.checkInTime || a.createdAt) - getTime(b.checkInTime || b.createdAt));
    case 'waitTime':
      return sorted.sort((a, b) => (b.estimatedWaitTime || 0) - (a.estimatedWaitTime || 0));
    default:
      return sorted;
  }
};
