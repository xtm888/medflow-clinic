/**
 * Reagent Inventory Service
 *
 * Re-exports from consolidated inventory services using factory pattern.
 * This file is maintained for backward compatibility.
 *
 * @see /services/inventory/index.js for the consolidated implementation
 */

import { reagentInventoryService } from './inventory';

// Re-export as default for backward compatibility
export default reagentInventoryService;

// Also export named for new imports
export { reagentInventoryService };
