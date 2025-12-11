/**
 * MSW Server Setup
 *
 * Creates and exports the MSW server instance for use in tests.
 */

import { setupServer } from 'msw/node';
import { handlers, errorHandlers, networkErrorHandlers } from './handlers';

// Create the server with default handlers
export const server = setupServer(...handlers);

// Helper to use error handlers
export function useErrorHandlers() {
  server.use(...errorHandlers);
}

// Helper to simulate network errors
export function useNetworkErrorHandlers() {
  server.use(...networkErrorHandlers);
}

// Helper to reset to default handlers
export function resetHandlers() {
  server.resetHandlers();
}

// Export for direct use
export { handlers, errorHandlers, networkErrorHandlers };
