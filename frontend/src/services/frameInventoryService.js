/**
 * Frame Inventory Service
 *
 * Re-exports from consolidated inventory services using factory pattern.
 * This file is maintained for backward compatibility.
 *
 * @see /services/inventory/index.js for the consolidated implementation
 */

import { frameInventoryService } from './inventory';

// Re-export as default for backward compatibility
export default frameInventoryService;

// Also export named for new imports
export { frameInventoryService };
