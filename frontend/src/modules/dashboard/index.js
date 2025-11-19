/**
 * Dashboard Module - Role-based dashboard management
 *
 * Usage:
 * import { DashboardContainer, useDashboardData, StatsWidget } from '@/modules/dashboard';
 */

// Main container
export { default as DashboardContainer, defaultRoleLayouts } from './DashboardContainer';

// Hooks
export {
  default as useDashboardData,
  useQueueData,
  useAppointmentsData
} from './useDashboardData';

// Widgets
export { default as StatsWidget } from './widgets/StatsWidget';
