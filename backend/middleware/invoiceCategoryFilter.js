// backend/middleware/invoiceCategoryFilter.js
const RolePermission = require('../models/RolePermission');

// Map categories to their required permissions
const CATEGORY_PERMISSIONS = {
  medication: {
    view: ['invoice.view.medication', 'invoice.view.all'],
    complete: ['invoice.dispense.medication'],
    payment: ['invoice.payment.medication', 'invoice.payment.all'],
    external: ['invoice.external.medication']
  },
  optical: {
    view: ['invoice.view.optical', 'invoice.view.all'],
    complete: ['invoice.dispense.optical'],
    payment: ['invoice.payment.optical', 'invoice.payment.all'],
    external: ['invoice.external.optical']
  },
  laboratory: {
    view: ['invoice.view.laboratory', 'invoice.view.all'],
    complete: ['invoice.complete.laboratory'],
    payment: ['invoice.payment.laboratory', 'invoice.payment.all'],
    external: []
  },
  consultation: {
    view: ['invoice.view.consultation', 'invoice.view.all'],
    complete: ['invoice.complete.consultation'],
    payment: ['invoice.payment.consultation', 'invoice.payment.all'],
    external: []
  },
  surgery: {
    view: ['invoice.view.surgery', 'invoice.view.all'],
    complete: ['invoice.complete.surgery'],
    payment: ['invoice.payment.surgery', 'invoice.payment.all'],
    external: []
  },
  imaging: {
    view: ['invoice.view.imaging', 'invoice.view.all'],
    complete: ['invoice.complete.imaging'],
    payment: ['invoice.payment.imaging', 'invoice.payment.all'],
    external: []
  },
  examination: {
    view: ['invoice.view.examination', 'invoice.view.all'],
    complete: ['invoice.complete.examination'],
    payment: ['invoice.payment.examination', 'invoice.payment.all'],
    external: []
  }
};

// Get user's combined permissions (role + individual)
const getUserPermissions = async (user) => {
  const rolePerms = await RolePermission.findOne({ role: user.role });
  return [...(rolePerms?.permissions || []), ...(user.permissions || [])];
};

// Get categories user can view
const getAllowedCategories = async (user) => {
  // Admin has full access to all categories
  if (user.role === 'admin') {
    return Object.keys(CATEGORY_PERMISSIONS);
  }

  const userPerms = await getUserPermissions(user);

  // Check for full access
  if (userPerms.includes('invoice.view.all')) {
    return Object.keys(CATEGORY_PERMISSIONS);
  }

  // Filter to allowed categories
  const allowed = [];
  for (const [category, perms] of Object.entries(CATEGORY_PERMISSIONS)) {
    if (perms.view.some(p => userPerms.includes(p))) {
      allowed.push(category);
    }
  }
  return allowed;
};

// Check if user can perform action on category
const canPerformAction = async (user, category, action) => {
  // Admin has full access
  if (user.role === 'admin') return true;

  const userPerms = await getUserPermissions(user);

  const categoryPerms = CATEGORY_PERMISSIONS[category];
  if (!categoryPerms || !categoryPerms[action]) return false;

  return categoryPerms[action].some(p => userPerms.includes(p));
};

// Filter invoice items by user's allowed categories
const filterInvoiceItems = (invoice, allowedCategories) => {
  if (!invoice || !invoice.items) return invoice;

  const filtered = invoice.toObject ? invoice.toObject() : { ...invoice };
  filtered.items = filtered.items.filter(item =>
    allowedCategories.includes(item.category)
  );

  // Calculate summary for filtered items only
  filtered.filteredSummary = {
    subtotal: filtered.items.reduce((sum, i) => sum + (i.subtotal || 0), 0),
    total: filtered.items.reduce((sum, i) => sum + (i.total || 0), 0),
    paidAmount: filtered.items.reduce((sum, i) => sum + (i.paidAmount || 0), 0),
    pendingAmount: filtered.items
      .filter(i => !i.isExternal && !i.isPaid)
      .reduce((sum, i) => sum + (i.total || 0), 0),
    externalCount: filtered.items.filter(i => i.isExternal).length,
    paidCount: filtered.items.filter(i => i.isPaid).length,
    pendingCount: filtered.items.filter(i => !i.isExternal && !i.isPaid).length
  };

  return filtered;
};

// Get the expected collection point for a category
const getCollectionPoint = (category) => {
  const collectionPoints = {
    medication: 'pharmacy',
    optical: 'optical',
    consultation: 'clinic',
    laboratory: 'clinic',
    imaging: 'clinic',
    surgery: 'clinic',
    examination: 'clinic'
  };
  return collectionPoints[category] || 'clinic';
};

module.exports = {
  CATEGORY_PERMISSIONS,
  getUserPermissions,
  getAllowedCategories,
  canPerformAction,
  filterInvoiceItems,
  getCollectionPoint
};
