// Role-based permissions and menu access configuration

console.log('🔄 rolePermissions.js loaded - IVT and Pharmacy modules should be available');

export const rolePermissions = {
  admin: {
    menuItems: [
      'dashboard',
      'patients',
      'queue',
      'appointments',
      'clinical',
      'finance',
      'notifications',
      'settings'
    ],
    permissions: [
      'view_all_data',
      'manage_users',
      'manage_system',
      'manage_financial',
      'manage_patients',
      'manage_appointments',
      'manage_pharmacy',
      'manage_imaging',
      'view_reports',
      'manage_settings'
    ]
  },

  doctor: {
    menuItems: [
      'dashboard',
      'patients',
      'queue',
      'appointments',
      'clinical',
      'notifications'
    ],
    permissions: [
      'view_patients',
      'manage_patients',
      'manage_appointments',
      'create_prescriptions',
      'view_prescriptions',
      'order_imaging',
      'view_imaging',
      'view_queue',
      'manage_medical_records'
    ]
  },

  ophthalmologist: {
    menuItems: [
      'dashboard',
      'patients',
      'queue',
      'appointments',
      'clinical',
      'notifications',
      'settings'
    ],
    permissions: [
      'view_patients',
      'manage_patients',
      'manage_appointments',
      'create_prescriptions',
      'view_prescriptions',
      'order_imaging',
      'view_imaging',
      'view_queue',
      'manage_medical_records',
      'perform_eye_exams',
      'create_optical_prescriptions'
    ]
  },

  nurse: {
    menuItems: [
      'dashboard',
      'patients',
      'queue',
      'appointments',
      'clinical',
      'notifications'
    ],
    permissions: [
      'view_patients',
      'update_vitals',
      'view_appointments',
      'manage_queue',
      'view_prescriptions',
      'administer_medications',
      'update_patient_notes'
    ]
  },

  receptionist: {
    menuItems: [
      'dashboard',
      'patients',
      'queue',
      'appointments',
      'finance',
      'notifications'
    ],
    permissions: [
      'view_patients',
      'register_patients',
      'manage_appointments',
      'manage_queue',
      'create_invoices',
      'check_in_patients',
      'update_contact_info'
    ]
  },

  pharmacist: {
    menuItems: [
      'dashboard',
      'patients',
      'clinical',
      'notifications'
    ],
    permissions: [
      'view_prescriptions',
      'dispense_medications',
      'manage_inventory',
      'verify_prescriptions',
      'view_patient_medications',
      'drug_interactions_check'
    ]
  },

  lab_technician: {
    menuItems: [
      'dashboard',
      'patients',
      'queue',
      'clinical',
      'notifications'
    ],
    permissions: [
      'view_imaging_orders',
      'upload_results',
      'manage_imaging',
      'view_patients',
      'update_test_status'
    ]
  },

  accountant: {
    menuItems: [
      'dashboard',
      'finance',
      'notifications'
    ],
    permissions: [
      'manage_billing',
      'view_financial_reports',
      'manage_invoices',
      'process_payments',
      'manage_insurance_claims',
      'generate_reports'
    ]
  }
};

// Helper function to check if a user has access to a menu item
export const hasMenuAccess = (userRole, menuItem) => {
  if (!userRole || !rolePermissions[userRole]) return false;
  return rolePermissions[userRole].menuItems.includes(menuItem);
};

// Helper function to check if a user has a specific permission
export const hasPermission = (userRole, permission) => {
  if (!userRole || !rolePermissions[userRole]) return false;
  return rolePermissions[userRole].permissions.includes(permission);
};

// Get all accessible menu items for a role
export const getAccessibleMenuItems = (userRole) => {
  if (!userRole || !rolePermissions[userRole]) return [];
  return rolePermissions[userRole].menuItems;
};

// Menu item configurations with details
export const menuConfigurations = {
  dashboard: {
    label: 'Dashboard',
    path: '/dashboard',
    icon: 'LayoutDashboard',
    description: 'Overview and statistics'
  },
  patients: {
    label: 'Patients',
    path: '/patients',
    icon: 'Users',
    description: 'Manage patient records'
  },
  queue: {
    label: 'Queue',
    path: '/queue',
    icon: 'Clock',
    description: 'Patient queue management'
  },
  appointments: {
    label: 'Appointments',
    path: '/appointments',
    icon: 'Calendar',
    description: 'Schedule and manage appointments'
  },
  pharmacy: {
    label: 'Pharmacy',
    path: '/pharmacy',
    icon: 'Pill',
    description: 'Medication inventory and dispensing'
  },
  prescriptions: {
    label: 'Prescriptions',
    path: '/prescriptions',
    icon: 'FileText',
    description: 'Manage prescriptions'
  },
  imaging: {
    label: 'Imaging',
    path: '/imaging',
    icon: 'Image',
    description: 'Medical imaging and lab results'
  },
  documents: {
    label: 'Documents',
    path: '/documents',
    icon: 'FileText',
    description: 'Generate medical certificates and letters'
  },
  notifications: {
    label: 'Notifications',
    path: '/notifications',
    icon: 'Bell',
    description: 'System notifications'
  },
  financial: {
    label: 'Financial',
    path: '/financial',
    icon: 'DollarSign',
    description: 'Financial management'
  },
  invoicing: {
    label: 'Invoicing',
    path: '/invoicing',
    icon: 'Receipt',
    description: 'Billing and invoices'
  },
  services: {
    label: 'Services',
    path: '/services',
    icon: 'Briefcase',
    description: 'Service catalog'
  },
  settings: {
    label: 'Settings',
    path: '/settings',
    icon: 'Settings',
    description: 'System settings'
  },
  // Consolidated Clinical menu with submenus
  clinical: {
    label: 'Clinical',
    path: null,
    icon: 'Stethoscope',
    description: 'Clinical modules',
    subItems: [
      { label: 'Prescriptions', path: '/prescriptions', icon: 'FileText' },
      { label: 'Laboratory', path: '/laboratory', icon: 'FlaskConical' },
      { label: 'Imaging', path: '/imaging', icon: 'Image' },
      { label: 'Pharmacy', path: '/pharmacy', icon: 'Pill' },
      { label: 'Ophthalmology', path: '/ophthalmology', icon: 'Eye' },
      { label: 'IVT', path: '/ivt', icon: 'Syringe' },
      { label: 'Devices', path: '/devices', icon: 'HardDrive' }
    ]
  },
  // Consolidated Finance menu with submenus
  finance: {
    label: 'Finance',
    path: null,
    icon: 'DollarSign',
    description: 'Financial management',
    subItems: [
      { label: 'Invoicing', path: '/invoicing', icon: 'Receipt' },
      { label: 'Financial Reports', path: '/financial', icon: 'BarChart3' },
      { label: 'Services', path: '/services', icon: 'Briefcase' }
    ]
  },
  // Keep individual items for direct access (legacy support)
  ophthalmology: {
    label: 'Ophthalmology',
    path: '/ophthalmology',
    icon: 'Eye',
    description: 'Eye care and examinations'
  },
  ivt: {
    label: 'IVT Injections',
    path: '/ivt',
    icon: 'Stethoscope',
    description: 'Intravitreal injection tracking and management'
  },
  'pharmacy-inventory': {
    label: 'Pharmacy Inventory',
    path: '/pharmacy-inventory',
    icon: 'Pill',
    description: 'Medication inventory and stock management'
  },
  devices: {
    label: 'Devices',
    path: '/devices',
    icon: 'HardDrive',
    description: 'Medical device integration and management'
  }
};