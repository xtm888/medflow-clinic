import React from 'react';
import {
  INVENTORY_STATUSES,
  APPOINTMENT_STATUSES,
  LAB_STATUSES,
  INVOICE_STATUSES,
  GLASSES_ORDER_STATUSES,
  getStatusConfig,
  getPriorityConfig
} from '../utils/statusHelpers';

/**
 * StatusBadge - Unified status badge component
 * Replaces duplicate getStatusBadge() functions across the application
 *
 * @param {string} status - The status value
 * @param {string} type - Type of status: 'inventory' | 'appointment' | 'lab' | 'invoice' | 'glasses' | 'custom'
 * @param {Array} customStatuses - Custom status list when type='custom'
 * @param {string} size - Size variant: 'sm' | 'md' | 'lg'
 * @param {boolean} showDot - Show status dot indicator
 */
const StatusBadge = ({
  status,
  type = 'inventory',
  customStatuses,
  size = 'sm',
  showDot = false,
  className = ''
}) => {
  // Get the appropriate status list
  const getStatusList = () => {
    switch (type) {
      case 'inventory':
        return INVENTORY_STATUSES;
      case 'appointment':
        return APPOINTMENT_STATUSES;
      case 'lab':
        return LAB_STATUSES;
      case 'invoice':
        return INVOICE_STATUSES;
      case 'glasses':
        return GLASSES_ORDER_STATUSES;
      case 'custom':
        return customStatuses || [];
      default:
        return INVENTORY_STATUSES;
    }
  };

  const config = getStatusConfig(status, getStatusList());

  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ${config.color} ${sizeClasses[size]} ${className}`}
    >
      {showDot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-75" />
      )}
      {config.label}
    </span>
  );
};

/**
 * PriorityBadge - Unified priority badge component
 *
 * @param {string} priority - The priority value
 * @param {string} size - Size variant: 'sm' | 'md' | 'lg'
 * @param {boolean} showBorder - Show border
 */
export const PriorityBadge = ({
  priority,
  size = 'sm',
  showBorder = false,
  className = ''
}) => {
  const config = getPriorityConfig(priority);

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  const borderClass = showBorder ? 'border' : '';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.color} ${sizeClasses[size]} ${borderClass} ${className}`}
    >
      {config.label}
    </span>
  );
};

/**
 * StockLevelIndicator - Shows stock level with color coding
 *
 * @param {number} available - Available stock
 * @param {number} reserved - Reserved stock
 * @param {number} minimum - Minimum stock threshold
 */
export const StockLevelIndicator = ({
  available = 0,
  reserved = 0,
  minimum = 0,
  showReserved = true
}) => {
  const getColor = () => {
    if (available <= 0) return 'text-red-600';
    if (available <= minimum) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="text-center">
      <span className={`font-medium ${getColor()}`}>
        {available}
      </span>
      {showReserved && reserved > 0 && (
        <span className="text-xs text-gray-400 ml-1">
          ({reserved} res.)
        </span>
      )}
    </div>
  );
};

export default StatusBadge;
