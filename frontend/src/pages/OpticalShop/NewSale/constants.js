/**
 * NewSale Constants
 *
 * Centralized constants for the optical shop sale wizard.
 */

import { FileText, Glasses, Eye, Package, Check } from 'lucide-react';

// Wizard steps configuration
export const STEPS = [
  { id: 'prescription', label: 'Prescription', icon: FileText },
  { id: 'frame', label: 'Monture', icon: Glasses },
  { id: 'lenses', label: 'Verres', icon: Eye },
  { id: 'options', label: 'Options', icon: Package },
  { id: 'summary', label: 'Resume', icon: Check }
];

// Lens prices by material (CDF)
export const LENS_PRICES = {
  'cr39': 15000,
  'cr39-1.56': 25000,
  'polycarbonate': 35000,
  'hi-index-1.60': 50000,
  'hi-index-1.67': 75000,
  'hi-index-1.74': 100000
};

// Lens design options
export const LENS_DESIGNS = [
  { value: 'single_vision', label: 'Unifocal', description: 'Vision simple', priceAdd: 0 },
  { value: 'bifocal', label: 'Bifocal', description: 'Vision de pres et de loin', priceAdd: 25000 },
  { value: 'progressive', label: 'Progressif', description: 'Vision a toutes distances', priceAdd: 50000 }
];

// Lens material options
export const LENS_MATERIALS = [
  { value: 'cr39', label: 'CR-39 (1.50)', price: 15000 },
  { value: 'cr39-1.56', label: 'CR-39 (1.56)', price: 25000 },
  { value: 'polycarbonate', label: 'Polycarbonate', price: 35000 },
  { value: 'hi-index-1.60', label: 'Hi-Index 1.60', price: 50000 },
  { value: 'hi-index-1.67', label: 'Hi-Index 1.67', price: 75000 },
  { value: 'hi-index-1.74', label: 'Hi-Index 1.74', price: 100000 }
];

// Lens coating/treatment options
export const LENS_OPTIONS = {
  antiReflective: {
    id: 'antiReflective',
    label: 'Anti-Reflet',
    description: 'Reduit les reflets et la fatigue oculaire',
    price: 15000
  },
  photochromic: {
    id: 'photochromic',
    label: 'Photochromique',
    description: "S'adapte a la lumiere (Transitions)",
    price: 25000
  },
  blueLight: {
    id: 'blueLight',
    label: 'Filtre Lumiere Bleue',
    description: 'Protection ecrans et digital',
    price: 10000
  },
  tint: {
    id: 'tint',
    label: 'Teinte',
    description: 'Coloration des verres',
    price: 8000
  }
};

// Default order data structure
export const DEFAULT_ORDER_DATA = {
  rightLens: { sphere: '', cylinder: '', axis: '', add: '' },
  leftLens: { sphere: '', cylinder: '', axis: '', add: '' },
  frame: null,
  lensType: { material: 'cr39', design: 'single_vision' },
  lensOptions: {
    antiReflective: { selected: false, coatingType: '', price: 0 },
    photochromic: { selected: false, coatingType: '', price: 0 },
    blueLight: { selected: false, price: 0 },
    tint: { selected: false, color: '', price: 0 }
  },
  measurements: { pd: '', pdRight: '', pdLeft: '', segmentHeight: '' },
  pricing: { subtotal: 0, discount: 0, discountType: 'fixed', finalTotal: 0 }
};

// Currency formatter for CDF
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-CD', {
    style: 'currency',
    currency: 'CDF',
    minimumFractionDigits: 0
  }).format(amount || 0);
};

// Frame image type labels
export const FRAME_IMAGE_TYPES = {
  front: 'Vue de face',
  side: 'Vue de côté',
  folded: 'Plié',
  worn: 'Porté',
  detail: 'Détail'
};
