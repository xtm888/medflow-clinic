/**
 * Hooks Index - Central export for all custom hooks
 *
 * Usage:
 * import { useApi, useToast, usePermissions } from '@hooks';
 */

// API & Data Fetching
export { default as useApi, useApiMutation, usePaginatedApi } from './useApi';
export { default as useAbortController, isAbortError, withAbortSignal } from './useAbortController';
export { default as usePreviousData } from './usePreviousData';

// State Management
export { default as useRedux } from './useRedux';

// UI & Interaction
export { default as useAutoSave } from './useAutoSave';
export { default as useKeyboardShortcuts } from './useKeyboardShortcuts';
export { default as useTabProgression } from './useTabProgression';

// Permissions & Auth
export { default as usePermissions } from './usePermissions';

// File & Upload
export { default as useFileUpload } from './useFileUpload';

// Real-time
export { default as useWebSocket } from './useWebSocket';

// Inventory Management
export { default as useInventory } from './useInventory';
