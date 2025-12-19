/**
 * GlassesOrder Constants
 *
 * Configuration options for glasses and contact lens ordering.
 */

// Order types
export const ORDER_TYPES = [
  { value: 'glasses', label: 'Lunettes' },
  { value: 'contact-lenses', label: 'Lentilles' },
  { value: 'both', label: 'Les deux' }
];

// Lens types for glasses
export const LENS_TYPES = [
  { value: 'single-vision-distance', label: 'Vision de loin (Simple)' },
  { value: 'single-vision-near', label: 'Vision de près (Simple)' },
  { value: 'bifocal', label: 'Bifocaux' },
  { value: 'progressive', label: 'Progressifs' },
  { value: 'varifocal', label: 'Multifocaux' },
  { value: 'two-pairs', label: 'Deux paires (Loin + Près)' }
];

// Lens materials with refractive index
export const LENS_MATERIALS = [
  { value: 'cr39', label: 'CR-39 (Standard)', index: '1.50' },
  { value: 'polycarbonate', label: 'Polycarbonate', index: '1.59' },
  { value: 'trivex', label: 'Trivex', index: '1.53' },
  { value: 'hi-index-1.60', label: 'Haut indice', index: '1.60' },
  { value: 'hi-index-1.67', label: 'Haut indice', index: '1.67' },
  { value: 'hi-index-1.74', label: 'Ultra haut indice', index: '1.74' }
];

// Coating options with prices
export const COATING_OPTIONS = [
  { value: 'anti-reflective', label: 'Anti-reflet', price: 25000 },
  { value: 'blue-light', label: 'Filtre lumière bleue', price: 30000 },
  { value: 'photochromic', label: 'Photochromique', price: 50000 },
  { value: 'polarized', label: 'Polarisé', price: 45000 },
  { value: 'scratch-resistant', label: 'Anti-rayures', price: 15000 },
  { value: 'uv-protection', label: 'Protection UV', price: 10000 },
  { value: 'hydrophobic', label: 'Hydrophobe', price: 20000 }
];

// Priority options
export const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'rush', label: 'Express' }
];

// Delivery methods
export const DELIVERY_METHODS = [
  { value: 'pickup', label: 'Retrait sur place' },
  { value: 'delivery', label: 'Livraison' }
];

// Default item for new orders
export const getDefaultItem = () => ({
  description: 'Verres correcteurs',
  category: 'lens',
  quantity: 2,
  unitPrice: 50000,
  discount: 0,
  total: 100000
});

// Empty item template for additions
export const getEmptyItem = () => ({
  description: '',
  category: 'accessory',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  total: 0
});

// Default form state
export const getDefaultFormState = () => ({
  orderType: 'glasses',
  lensType: 'single-vision-distance',
  lensMaterial: 'cr39',
  coatings: [],
  selectedFrame: null,
  selectedLensOd: null,
  selectedLensOs: null,
  contactLensQuantity: { od: 1, os: 1 },
  items: [getDefaultItem()],
  notes: { clinical: '', production: '' },
  priority: 'normal',
  deliveryMethod: 'pickup'
});

// Calculate coatings total
export const calculateCoatingsTotal = (selectedCoatings) => {
  return selectedCoatings.reduce((sum, c) => {
    const coating = COATING_OPTIONS.find(opt => opt.value === c);
    return sum + (coating?.price || 0);
  }, 0);
};

// Calculate order total
export const calculateOrderTotal = (formState) => {
  const {
    items,
    coatings,
    selectedFrame,
    selectedLensOd,
    selectedLensOs,
    contactLensQuantity
  } = formState;

  let total = items.reduce((sum, item) => sum + (item.total || 0), 0);

  // Add coatings
  total += calculateCoatingsTotal(coatings);

  // Add frame from inventory
  if (selectedFrame) {
    total += selectedFrame.price || 0;
  }

  // Add contact lenses from inventory
  if (selectedLensOd) {
    total += (selectedLensOd.price || 0) * (contactLensQuantity.od || 1);
  }
  if (selectedLensOs) {
    total += (selectedLensOs.price || 0) * (contactLensQuantity.os || 1);
  }

  return total;
};

// Build optical act codes for approval check
export const buildOpticalActCodes = (formState) => {
  const { orderType, lensType, coatings, selectedFrame } = formState;
  const codes = [];

  if (orderType === 'glasses' || orderType === 'both') {
    codes.push('OPT-LUNETTES');
    if (lensType === 'progressive') codes.push('OPT-PROGRESSIFS');
    if (lensType === 'bifocal') codes.push('OPT-BIFOCAUX');
    if (coatings.includes('photochromic')) codes.push('OPT-PHOTOCHROMIQUE');
  }

  if (orderType === 'contact-lenses' || orderType === 'both') {
    codes.push('OPT-LENTILLES');
  }

  if (selectedFrame?.sku) {
    codes.push(selectedFrame.sku);
  }

  return codes;
};

// Format currency
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('fr-CD').format(amount) + ' CDF';
};

// Build order data for submission
export const buildOrderData = (formState, examId, exam, coatingOptions) => {
  const {
    orderType,
    lensType,
    lensMaterial,
    coatings,
    selectedFrame,
    selectedLensOd,
    selectedLensOs,
    contactLensQuantity,
    items,
    notes,
    priority,
    deliveryMethod
  } = formState;

  // Build all items including coatings and inventory selections
  const allItems = [...items];

  // Add coating items
  coatings.forEach(c => {
    const coating = coatingOptions.find(opt => opt.value === c);
    if (coating) {
      allItems.push({
        description: coating.label,
        category: 'coating',
        quantity: 1,
        unitPrice: coating.price,
        discount: 0,
        total: coating.price
      });
    }
  });

  // Add frame item
  if (selectedFrame) {
    allItems.push({
      description: `Monture ${selectedFrame.brand} ${selectedFrame.model} - ${selectedFrame.color}`,
      category: 'frame',
      quantity: 1,
      unitPrice: selectedFrame.price,
      discount: 0,
      total: selectedFrame.price,
      inventoryRef: selectedFrame.id
    });
  }

  // Add contact lens items
  if (selectedLensOd) {
    allItems.push({
      description: `Lentilles OD - ${selectedLensOd.brand} ${selectedLensOd.productLine}`,
      category: 'contact-lens',
      quantity: contactLensQuantity.od,
      unitPrice: selectedLensOd.price,
      discount: 0,
      total: selectedLensOd.price * contactLensQuantity.od,
      inventoryRef: selectedLensOd.id
    });
  }

  if (selectedLensOs) {
    allItems.push({
      description: `Lentilles OS - ${selectedLensOs.brand} ${selectedLensOs.productLine}`,
      category: 'contact-lens',
      quantity: contactLensQuantity.os,
      unitPrice: selectedLensOs.price,
      discount: 0,
      total: selectedLensOs.price * contactLensQuantity.os,
      inventoryRef: selectedLensOs.id
    });
  }

  return {
    examId,
    orderType,
    glasses: orderType !== 'contact-lenses' ? {
      lensType,
      lensMaterial,
      coatings,
      frame: selectedFrame ? {
        brand: selectedFrame.brand,
        model: selectedFrame.model,
        color: selectedFrame.color,
        size: selectedFrame.size,
        inventoryItem: selectedFrame.id,
        sku: selectedFrame.sku,
        sellingPrice: selectedFrame.price,
        costPrice: selectedFrame.costPrice
      } : undefined
    } : undefined,
    contactLenses: orderType !== 'glasses' ? {
      od: selectedLensOd ? {
        brand: selectedLensOd.brand,
        productLine: selectedLensOd.productLine,
        baseCurve: selectedLensOd.parameters?.baseCurve,
        diameter: selectedLensOd.parameters?.diameter,
        power: exam?.finalPrescription?.od?.sphere,
        inventoryItem: selectedLensOd.id,
        quantity: contactLensQuantity.od,
        sellingPrice: selectedLensOd.price,
        costPrice: selectedLensOd.costPrice
      } : undefined,
      os: selectedLensOs ? {
        brand: selectedLensOs.brand,
        productLine: selectedLensOs.productLine,
        baseCurve: selectedLensOs.parameters?.baseCurve,
        diameter: selectedLensOs.parameters?.diameter,
        power: exam?.finalPrescription?.os?.sphere,
        inventoryItem: selectedLensOs.id,
        quantity: contactLensQuantity.os,
        sellingPrice: selectedLensOs.price,
        costPrice: selectedLensOs.costPrice
      } : undefined
    } : undefined,
    items: allItems,
    notes,
    priority,
    deliveryInfo: {
      method: deliveryMethod
    }
  };
};
