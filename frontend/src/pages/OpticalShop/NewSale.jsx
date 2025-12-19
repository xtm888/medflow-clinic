/**
 * NewSale - Backward Compatibility Export
 *
 * This file re-exports from the modular NewSale structure.
 * The actual implementation is in ./NewSale/ directory.
 *
 * New structure:
 * ./NewSale/
 * ├── NewSale.jsx          - Main component (~200 lines)
 * ├── constants.js         - All pricing/config data
 * ├── hooks/
 * │   ├── usePricing.js    - Pricing calculation
 * │   └── useFrameSearch.js - Frame search with debounce
 * └── components/
 *     ├── SaleHeader.jsx
 *     ├── StepIndicator.jsx
 *     ├── NavigationButtons.jsx
 *     └── steps/
 *         ├── PrescriptionStep.jsx
 *         ├── FrameStep.jsx
 *         ├── LensesStep.jsx
 *         ├── OptionsStep.jsx
 *         └── SummaryStep.jsx
 */

export { default } from './NewSale/NewSale';
