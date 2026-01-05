// Role-based permissions and menu access configuration

export const rolePermissions = {
  admin: {
    menuItems: [
      'dashboard',
      'patients',
      'queue',
      'appointments',
      'clinical',
      'inventory',
      'procurement',
      'finance',
      'operations',
      'notifications',
      'settings',
      'admin',
      'audit'
    ],
    permissions: [
      'view_all_data',
      'manage_users',
      'manage_system',
      'manage_financial',
      'manage_patients',
      'register_patients',
      'manage_appointments',
      'manage_pharmacy',
      'manage_imaging',
      'view_reports',
      'manage_settings',
      // Prescription & dispensing permissions (admin can do everything)
      'create_prescriptions',
      'view_prescriptions',
      'dispense_medications',
      'verify_prescriptions',
      // Invoice permissions
      'create_invoices',
      'manage_invoices'
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
      'inventory',
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
      'nurse-vitals',
      'appointments',
      'clinical',
      'notifications'
    ],
    permissions: [
      'view_patients',
      'update_vitals',
      'view_appointments',
      'manage_appointments',      // ADDED: Can book any appointment
      'manage_queue',
      'view_prescriptions',
      'administer_medications',
      'update_patient_notes',
      'check_in_patients',
      'register_patients',         // ADDED: Can register new patients (with face scan)
      'view_lab_orders',          // ADDED: Can view lab orders
      'order_imaging'             // ADDED: Can order any lab test
    ]
  },

  receptionist: {
    menuItems: [
      'dashboard',
      'receptionist-view',
      'patients',
      'queue',
      'appointments',
      'inventory',
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
      'pharmacist-view',
      'patients',
      'prescription-queue',
      'clinical',
      'notifications'
    ],
    permissions: [
      'view_patients',             // ADDED: Can view FULL patient details (allergies, etc.)
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
      'lab-tech-view',
      'patients',
      'queue',
      'lab-worklist',
      'lab-checkin',
      'clinical',
      'inventory',
      'notifications'
    ],
    permissions: [
      'view_lab_orders',
      'collect_specimens',
      'receive_specimens',
      'enter_results',
      'verify_results',
      'upload_results',
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
  },

  manager: {
    menuItems: [
      'dashboard',
      'patients',
      'queue',
      'appointments',
      'clinical',
      'inventory',
      'finance',
      'operations',
      'notifications'
    ],
    permissions: [
      'view_all_data',
      'view_reports',
      'manage_queue',
      'view_financial_reports',
      'manage_staff_schedules'
    ]
  },

  optician: {
    menuItems: [
      'dashboard',
      'optician-view',
      'patients',
      'queue',
      'optical-shop',
      'inventory',
      'operations',
      'notifications'
    ],
    permissions: [
      'view_patients',
      'search_patients',
      'view_prescriptions',
      'create_glasses_orders',
      'manage_glasses_orders',
      'view_inventory',
      'view_queue'
    ]
  },

  technician: {
    menuItems: [
      'dashboard',
      'clinical',
      'optical-shop',
      'inventory',
      'notifications'
    ],
    permissions: [
      'view_patients',
      'manage_devices',
      'view_imaging',
      'upload_results',
      'manage_equipment',
      'verify_glasses_orders',
      'manage_external_orders'
    ]
  },

  orthoptist: {
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
      'perform_orthoptic_exams',
      'manage_appointments',
      'view_prescriptions',
      'update_patient_notes',
      'view_queue'
    ]
  },

  optometrist: {
    menuItems: [
      'dashboard',
      'patients',
      'queue',
      'appointments',
      'clinical',
      'inventory',
      'notifications'
    ],
    permissions: [
      'view_patients',
      'manage_patients',
      'perform_eye_exams',
      'create_optical_prescriptions',
      'manage_glasses_orders',
      'view_prescriptions',
      'view_queue',
      'manage_appointments'        // ADDED: Can manage own appointments only
    ]
  },

  radiologist: {
    menuItems: [
      'dashboard',
      'patients',
      'clinical',
      'notifications'
    ],
    permissions: [
      'view_patients',
      'view_imaging',
      'upload_imaging_results',
      'manage_imaging',
      'create_imaging_reports'
    ]
  },

  imaging_tech: {
    menuItems: [
      'dashboard',
      'patients',
      'queue',
      'imaging-orders',
      'clinical',
      'notifications'
    ],
    permissions: [
      'view_patients',
      'view_imaging_orders',
      'schedule_imaging',
      'perform_imaging',
      'upload_imaging_results',
      'manage_imaging',
      'view_queue'
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
  // Admin has all permissions
  if (userRole === 'admin') return true;
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
    label: 'Tableau de bord',
    path: '/dashboard',
    icon: 'LayoutDashboard',
    description: 'Aperçu et statistiques'
  },
  patients: {
    label: 'Patients',
    path: '/patients',
    icon: 'Users',
    description: 'Gérer les dossiers patients'
  },
  queue: {
    label: 'File d\'attente',
    path: '/queue',
    icon: 'Clock',
    description: 'Gestion de la file d\'attente'
  },
  appointments: {
    label: 'Rendez-vous',
    path: '/appointments',
    icon: 'Calendar',
    description: 'Planifier et gérer les rendez-vous'
  },
  pharmacy: {
    label: 'Pharmacie',
    path: '/pharmacy',
    icon: 'Pill',
    description: 'Inventaire et délivrance des médicaments'
  },
  prescriptions: {
    label: 'Ordonnances',
    path: '/prescriptions',
    icon: 'FileText',
    description: 'Gérer les ordonnances'
  },
  imaging: {
    label: 'Imagerie',
    path: '/imaging',
    icon: 'Image',
    description: 'Imagerie médicale et résultats de laboratoire'
  },
  documents: {
    label: 'Documents',
    path: '/documents',
    icon: 'FileText',
    description: 'Générer des certificats et courriers médicaux'
  },
  notifications: {
    label: 'Notifications',
    path: '/notifications',
    icon: 'Bell',
    description: 'Notifications système'
  },
  financial: {
    label: 'Rapports financiers',
    path: '/financial',
    icon: 'DollarSign',
    description: 'Gestion financière'
  },
  invoicing: {
    label: 'Facturation',
    path: '/invoicing',
    icon: 'Receipt',
    description: 'Factures et paiements'
  },
  services: {
    label: 'Services',
    path: '/services',
    icon: 'Briefcase',
    description: 'Catalogue de services'
  },
  settings: {
    label: 'Paramètres',
    path: '/settings',
    icon: 'Settings',
    description: 'Paramètres système'
  },
  audit: {
    label: 'Journal d\'audit',
    path: '/audit',
    icon: 'Shield',
    description: 'Journaux d\'audit système'
  },
  // Consolidated Clinical menu with submenus - Clean, non-redundant structure
  clinical: {
    label: 'Clinique',
    path: null,
    icon: 'Stethoscope',
    description: 'Modules cliniques',
    subItems: [
      { label: 'Ordonnances', path: '/prescriptions', icon: 'FileText', roles: ['admin', 'doctor', 'ophthalmologist', 'pharmacist', 'nurse', 'optometrist'] },
      { label: 'Pharmacie', path: '/pharmacy', icon: 'Pill', roles: ['admin', 'pharmacist', 'doctor', 'ophthalmologist'] },
      { label: 'Laboratoire', path: '/laboratory', icon: 'FlaskConical', roles: ['admin', 'doctor', 'ophthalmologist', 'lab_technician', 'nurse'] },
      { label: 'Imagerie', path: '/imaging', icon: 'Image', roles: ['admin', 'doctor', 'ophthalmologist', 'radiologist', 'technician', 'imaging_tech'] },
      { label: 'Signes Vitaux', path: '/nurse-vitals', icon: 'Activity', roles: ['admin', 'nurse', 'doctor', 'ophthalmologist'] },
      { label: 'Centre Ophta', path: '/eye-clinic', icon: 'Eye', roles: ['admin', 'doctor', 'ophthalmologist', 'optometrist', 'nurse', 'orthoptist'] },
      { label: 'Boutique Optique', path: '/optical-shop', icon: 'Glasses', roles: ['admin', 'optician', 'technician', 'receptionist', 'manager', 'ophthalmologist', 'optometrist'] },
      { label: 'Appareils', path: '/devices', icon: 'HardDrive', roles: ['admin', 'technician', 'imaging_tech', 'doctor', 'ophthalmologist'] }
    ]
  },
  // Consolidated Finance menu with submenus
  finance: {
    label: 'Finances',
    path: '/finance',
    icon: 'DollarSign',
    description: 'Gestion financière',
    subItems: [
      { label: 'Facturation', path: '/finance?tab=invoicing', icon: 'Receipt', roles: ['admin', 'receptionist', 'accountant'] },
      { label: 'Rapports', path: '/finance?tab=reports', icon: 'BarChart3', roles: ['admin', 'accountant', 'manager'] },
      { label: 'Conventions', path: '/finance?tab=conventions', icon: 'Building2', roles: ['admin', 'accountant', 'manager'] },
      { label: 'Approbations', path: '/finance?tab=approvals', icon: 'ShieldCheck', roles: ['admin', 'accountant', 'manager', 'doctor', 'receptionist'] },
      { label: 'Services', path: '/finance?tab=services', icon: 'Briefcase', roles: ['admin', 'accountant', 'manager'] }
    ]
  },
  // Keep individual items for direct access (legacy support)
  ophthalmology: {
    label: 'Ophtalmologie',
    path: '/ophthalmology',
    icon: 'Eye',
    description: 'Soins et examens oculaires'
  },
  ivt: {
    label: 'Injections IVT',
    path: '/ivt',
    icon: 'Stethoscope',
    description: 'Suivi et gestion des injections intravitréennes'
  },
  surgery: {
    label: 'Chirurgie',
    path: '/surgery',
    icon: 'Scissors',
    description: 'Gestion des cas chirurgicaux et agenda opératoire'
  },
  devices: {
    label: 'Appareils',
    path: '/devices',
    icon: 'HardDrive',
    description: 'Intégration et gestion des appareils médicaux'
  },
  'prescription-queue': {
    label: 'File Ordonnances',
    path: '/pharmacy?tab=prescriptions',
    icon: 'FileText',
    description: 'Vérification et délivrance des ordonnances'
  },
  'lab-worklist': {
    label: 'Liste de Travail',
    path: '/laboratory?tab=worklist',
    icon: 'FlaskConical',
    description: 'Gestion des prélèvements et saisie des résultats'
  },
  'nurse-vitals': {
    label: 'Saisie Signes Vitaux',
    path: '/nurse-vitals',
    icon: 'Activity',
    description: 'Saisie des signes vitaux patients'
  },
  // Disabled - Lab Orders page requires MUI (use Laboratory page instead)
  // 'lab-orders': {
  //   label: 'Commandes Labo',
  //   path: '/lab-orders',
  //   icon: 'FlaskConical',
  //   description: 'Gestion des commandes de laboratoire'
  // },
  // Disabled - Imaging Orders page requires MUI (use Imaging page instead)
  // 'imaging-orders': {
  //   label: 'Commandes Imagerie',
  //   path: '/imaging-orders',
  //   icon: 'Scan',
  //   description: 'Gestion des commandes d\'imagerie médicale'
  // },
  laboratory: {
    label: 'Laboratoire',
    path: '/laboratory',
    icon: 'FlaskConical',
    description: 'Gestion du laboratoire et résultats'
  },
  orthoptic: {
    label: 'Orthoptie',
    path: '/orthoptic',
    icon: 'Eye',
    description: 'Examens orthoptiques'
  },
  correspondence: {
    label: 'Correspondance',
    path: '/correspondence',
    icon: 'Mail',
    description: 'Courriers et correspondances médicales'
  },
  companies: {
    label: 'Conventions',
    path: '/companies',
    icon: 'Building2',
    description: 'Gestion des entreprises et conventions'
  },
  approvals: {
    label: 'Approbations',
    path: '/approvals',
    icon: 'ShieldCheck',
    description: 'Demandes d\'approbation préalable (délibérations)'
  },
  // Inventory menu with submenus - Using Unified Inventory with type params
  inventory: {
    label: 'Inventaire',
    path: '/unified-inventory',
    icon: 'Package',
    description: 'Gestion des stocks',
    subItems: [
      { label: 'Vue Unifiée', path: '/unified-inventory', icon: 'Package', roles: ['admin', 'manager'] },
      { label: 'Montures', path: '/unified-inventory?type=frame', icon: 'Glasses', roles: ['admin', 'optometrist', 'ophthalmologist', 'receptionist', 'manager', 'optician'] },
      { label: 'Verres Optiques', path: '/unified-inventory?type=optical_lens', icon: 'Eye', roles: ['admin', 'optometrist', 'ophthalmologist', 'receptionist', 'manager', 'optician'] },
      { label: 'Lentilles Contact', path: '/unified-inventory?type=contact_lens', icon: 'Circle', roles: ['admin', 'optometrist', 'ophthalmologist', 'receptionist', 'manager', 'optician'] },
      { label: 'Réactifs Labo', path: '/unified-inventory?type=reagent', icon: 'FlaskConical', roles: ['admin', 'lab_technician', 'manager'] },
      { label: 'Consommables Labo', path: '/unified-inventory?type=lab_consumable', icon: 'TestTube', roles: ['admin', 'lab_technician', 'nurse', 'manager'] }
    ]
  },
  // Legacy inventory items - Now redirect to Unified Inventory with type filters
  'frame-inventory': {
    label: 'Inventaire Montures',
    path: '/unified-inventory?type=frame',
    icon: 'Glasses',
    description: 'Gestion du stock de montures'
  },
  'contact-lens-inventory': {
    label: 'Inventaire Lentilles',
    path: '/unified-inventory?type=contact_lens',
    icon: 'Circle',
    description: 'Gestion du stock de lentilles de contact'
  },
  'optical-lens-inventory': {
    label: 'Inventaire Verres Optiques',
    path: '/unified-inventory?type=optical_lens',
    icon: 'Eye',
    description: 'Gestion du stock de verres ophtalmiques'
  },
  'reagent-inventory': {
    label: 'Réactifs Laboratoire',
    path: '/unified-inventory?type=reagent',
    icon: 'FlaskConical',
    description: 'Gestion du stock de réactifs de laboratoire'
  },
  'lab-consumable-inventory': {
    label: 'Consommables Laboratoire',
    path: '/unified-inventory?type=lab_consumable',
    icon: 'TestTube',
    description: 'Gestion du stock de consommables de laboratoire (tubes, aiguilles, etc.)'
  },
  'optical-shop': {
    label: 'Boutique Optique',
    path: '/optical-shop',
    icon: 'Glasses',
    description: 'Vente de lunettes et verres correcteurs',
    subItems: [
      { label: 'Commandes', path: '/optical-shop?tab=orders', icon: 'Glasses', roles: ['admin', 'optician', 'technician', 'receptionist', 'manager', 'ophthalmologist', 'optometrist'] },
      { label: 'Vérification QC', path: '/optical-shop?tab=verification', icon: 'CheckCircle', roles: ['admin', 'technician', 'optician', 'manager'] },
      { label: 'Externes', path: '/optical-shop?tab=external', icon: 'Truck', roles: ['admin', 'optician', 'technician', 'manager'] },
      { label: 'Performance', path: '/optical-shop?tab=performance', icon: 'BarChart3', roles: ['admin', 'manager', 'ophthalmologist'] }
    ]
  },
  // Procurement menu with submenus
  procurement: {
    label: 'Achats & Stock',
    path: null,
    icon: 'ShoppingCart',
    description: 'Gestion des achats et inventaires',
    subItems: [
      { label: 'Bons de Commande', path: '/purchase-orders', icon: 'FileBox', roles: ['admin', 'manager', 'accountant'] },
      { label: 'Inventaire Physique', path: '/stock-reconciliation', icon: 'ClipboardList', roles: ['admin', 'manager', 'pharmacist', 'lab_technician'] },
      { label: 'Garanties', path: '/warranties', icon: 'Shield', roles: ['admin', 'manager', 'optician', 'technician'] },
      { label: 'Réparations', path: '/repairs', icon: 'Wrench', roles: ['admin', 'manager', 'optician', 'technician'] }
    ]
  },
  'purchase-orders': {
    label: 'Bons de Commande',
    path: '/purchase-orders',
    icon: 'FileBox',
    description: 'Gestion des achats et approvisionnements'
  },
  'stock-reconciliation': {
    label: 'Inventaire Physique',
    path: '/stock-reconciliation',
    icon: 'ClipboardList',
    description: 'Réconciliation et comptage des stocks'
  },
  warranties: {
    label: 'Garanties',
    path: '/warranties',
    icon: 'Shield',
    description: 'Suivi des garanties produits et réclamations'
  },
  repairs: {
    label: 'Réparations',
    path: '/repairs',
    icon: 'Wrench',
    description: 'Suivi des réparations et SAV'
  },
  // Admin menu with submenus
  admin: {
    label: 'Administration',
    path: null,
    icon: 'Settings',
    description: 'Administration système',
    subItems: [
      { label: 'Utilisateurs', path: '/users', icon: 'Users', roles: ['admin'] },
      { label: 'Sauvegardes', path: '/backups', icon: 'Database', roles: ['admin'] },
      { label: 'Journal d\'audit', path: '/audit', icon: 'Shield', roles: ['admin'] },
      { label: 'Paramètres', path: '/settings', icon: 'Settings', roles: ['admin'] }
    ]
  },
  users: {
    label: 'Utilisateurs',
    path: '/users',
    icon: 'Users',
    description: 'Gestion des comptes utilisateurs'
  },
  backups: {
    label: 'Sauvegardes',
    path: '/backups',
    icon: 'Database',
    description: 'Sauvegardes et restauration du système'
  },
  // Operations menu for cross-clinic features - Using unified Multi-Clinic page with tab params
  operations: {
    label: 'Opérations',
    path: '/multi-clinic',
    icon: 'Building2',
    description: 'Gestion multi-cliniques',
    subItems: [
      { label: 'Tableau Multi-Cliniques', path: '/multi-clinic?tab=dashboard', icon: 'LayoutGrid', roles: ['admin', 'manager'] },
      { label: 'Inventaire Consolidé', path: '/multi-clinic?tab=inventory', icon: 'Package', roles: ['admin', 'manager'] },
      { label: 'Établissements Externes', path: '/external-facilities', icon: 'Building', roles: ['admin', 'manager'] },
      { label: 'Dispatch', path: '/dispatch-dashboard', icon: 'Truck', roles: ['admin', 'manager', 'optician', 'technician'] },
      { label: 'Rapports Consolidés', path: '/multi-clinic?tab=reports', icon: 'BarChart3', roles: ['admin', 'manager', 'accountant'] }
    ]
  },
  'cross-clinic-dashboard': {
    label: 'Tableau Multi-Cliniques',
    path: '/multi-clinic?tab=dashboard',
    icon: 'LayoutGrid',
    description: 'Vue d\'ensemble de toutes les cliniques'
  },
  'cross-clinic-inventory': {
    label: 'Inventaire Consolidé',
    path: '/multi-clinic?tab=inventory',
    icon: 'Package',
    description: 'Inventaire multi-sites consolidé'
  },
  'external-facilities': {
    label: 'Établissements Externes',
    path: '/external-facilities',
    icon: 'Building',
    description: 'Gestion des partenaires et laboratoires externes'
  },
  'dispatch-dashboard': {
    label: 'Dispatch',
    path: '/dispatch-dashboard',
    icon: 'Truck',
    description: 'Suivi des expéditions et commandes externes'
  },
  'consolidated-reports': {
    label: 'Rapports Consolidés',
    path: '/multi-clinic?tab=reports',
    icon: 'BarChart3',
    description: 'Rapports financiers et opérationnels multi-sites'
  },
  // Lab workflow pages - Now redirect to Laboratory tabs
  'lab-checkin': {
    label: 'Accueil Labo',
    path: '/laboratory?tab=checkin',
    icon: 'ClipboardCheck',
    description: 'Réception et enregistrement des prélèvements'
  },
  // Role-specific workspace views
  'receptionist-view': {
    label: 'Espace Réception',
    path: '/receptionist',
    icon: 'UserCircle',
    description: 'Vue optimisée pour la réception'
  },
  'pharmacist-view': {
    label: 'Espace Pharmacie',
    path: '/pharmacist-view',
    icon: 'Pill',
    description: 'Vue optimisée pour le pharmacien'
  },
  'optician-view': {
    label: 'Espace Opticien',
    path: '/optician-view',
    icon: 'Glasses',
    description: 'Vue optimisée pour l\'opticien'
  },
  'lab-tech-view': {
    label: 'Espace Laboratoire',
    path: '/lab-tech-view',
    icon: 'FlaskConical',
    description: 'Vue optimisée pour le technicien de laboratoire'
  },
  // Ophthalmology Hub - Unified ophthalmology page with tabs
  'eye-clinic': {
    label: 'Centre Ophtalmologique',
    path: '/eye-clinic',
    icon: 'Eye',
    description: 'Consultations, examens et interventions ophtalmologiques',
    subItems: [
      { label: 'Tableau de Bord', path: '/eye-clinic?tab=dashboard', icon: 'LayoutDashboard', roles: ['admin', 'doctor', 'ophthalmologist', 'optometrist', 'nurse', 'orthoptist'] },
      { label: 'Orthoptie', path: '/eye-clinic?tab=orthoptic', icon: 'Glasses', roles: ['admin', 'doctor', 'ophthalmologist', 'orthoptist', 'nurse'] },
      { label: 'Injections IVT', path: '/eye-clinic?tab=ivt', icon: 'Syringe', roles: ['admin', 'doctor', 'ophthalmologist', 'nurse'] },
      { label: 'Chirurgie', path: '/eye-clinic?tab=surgery', icon: 'Scissors', roles: ['admin', 'doctor', 'ophthalmologist', 'nurse', 'receptionist'] }
    ]
  },
  // Finance Hub - Unified financial operations page with tabs
  'finance-hub': {
    label: 'Centre Financier',
    path: '/finance',
    icon: 'DollarSign',
    description: 'Facturation, rapports et gestion des conventions',
    subItems: [
      { label: 'Facturation', path: '/finance?tab=invoicing', icon: 'Receipt', roles: ['admin', 'receptionist', 'accountant'] },
      { label: 'Rapports', path: '/finance?tab=reports', icon: 'BarChart3', roles: ['admin', 'accountant', 'manager'] },
      { label: 'Conventions', path: '/finance?tab=conventions', icon: 'Building2', roles: ['admin', 'accountant', 'manager'] },
      { label: 'Approbations', path: '/finance?tab=approvals', icon: 'ShieldCheck', roles: ['admin', 'accountant', 'manager', 'doctor', 'receptionist'] },
      { label: 'Services', path: '/finance?tab=services', icon: 'Briefcase', roles: ['admin', 'accountant', 'manager'] }
    ]
  }
};