const express = require('express');
const router = express.Router();
const RolePermission = require('../models/RolePermission');
const { protect, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// All routes require authentication
router.use(protect);

// @desc    Get all role permissions (for current user's role or admin gets all)
// @route   GET /api/role-permissions
// @access  Private
router.get('/', asyncHandler(async (req, res) => {
  // Admin can see all, others only see their own role
  if (req.user.role === 'admin') {
    const rolePermissions = await RolePermission.find().sort('role');
    return res.status(200).json({
      success: true,
      count: rolePermissions.length,
      data: rolePermissions
    });
  }

  // Non-admin: return only their role's permissions
  const rolePermission = await RolePermission.findOne({ role: req.user.role, isActive: true });
  res.status(200).json({
    success: true,
    data: rolePermission || { menuItems: [], permissions: [] }
  });
}));

// @desc    Get current user's permissions
// @route   GET /api/role-permissions/me
// @access  Private
router.get('/me', asyncHandler(async (req, res) => {
  const rolePermission = await RolePermission.findOne({
    role: req.user.role,
    isActive: true
  });

  res.status(200).json({
    success: true,
    data: rolePermission || { menuItems: [], permissions: [] }
  });
}));

// @desc    Get available menu items and permissions (metadata)
// @route   GET /api/role-permissions/options
// @access  Private/Admin
router.get('/options', authorize('admin'), asyncHandler(async (req, res) => {
  const menuItems = [
    { id: 'dashboard', label: 'Tableau de bord', description: 'Page d\'accueil' },
    { id: 'patients', label: 'Patients', description: 'Gestion des patients' },
    { id: 'queue', label: 'File d\'attente', description: 'Gestion de la file d\'attente' },
    { id: 'appointments', label: 'Rendez-vous', description: 'Calendrier et rendez-vous' },
    { id: 'clinical', label: 'Clinique', description: 'Workflow clinique' },
    { id: 'ophthalmology', label: 'Ophtalmologie', description: 'Examens ophtalmologiques' },
    { id: 'prescriptions', label: 'Ordonnances', description: 'Gestion des ordonnances' },
    { id: 'pharmacy', label: 'Pharmacie', description: 'Inventaire et dispensation' },
    { id: 'laboratory', label: 'Laboratoire', description: 'Examens de laboratoire' },
    { id: 'imaging', label: 'Imagerie', description: 'Imagerie médicale' },
    { id: 'finance', label: 'Finance', description: 'Gestion financière' },
    { id: 'invoicing', label: 'Facturation', description: 'Factures et paiements' },
    { id: 'inventory', label: 'Inventaire', description: 'Gestion des stocks' },
    { id: 'notifications', label: 'Notifications', description: 'Centre de notifications' },
    { id: 'settings', label: 'Paramètres', description: 'Configuration système' },
    { id: 'audit', label: 'Audit', description: 'Journal d\'audit' },
    { id: 'nurse-vitals', label: 'Signes vitaux', description: 'Saisie des constantes' },
    { id: 'orthoptic', label: 'Orthoptie', description: 'Examens orthoptiques' },
    { id: 'documents', label: 'Documents', description: 'Certificats et correspondances' }
  ];

  const permissions = [
    // General
    { id: 'view_all_data', label: 'Voir toutes les données', category: 'Général' },
    { id: 'manage_users', label: 'Gérer les utilisateurs', category: 'Général' },
    { id: 'manage_system', label: 'Gérer le système', category: 'Général' },
    { id: 'manage_settings', label: 'Gérer les paramètres', category: 'Général' },

    // Patients
    { id: 'view_patients', label: 'Voir les patients', category: 'Patients' },
    { id: 'manage_patients', label: 'Gérer les patients', category: 'Patients' },
    { id: 'delete_patients', label: 'Supprimer les patients', category: 'Patients' },

    // Appointments
    { id: 'view_appointments', label: 'Voir les rendez-vous', category: 'Rendez-vous' },
    { id: 'manage_appointments', label: 'Gérer les rendez-vous', category: 'Rendez-vous' },
    { id: 'delete_appointments', label: 'Supprimer les rendez-vous', category: 'Rendez-vous' },

    // Medical Records
    { id: 'view_medical_records', label: 'Voir les dossiers médicaux', category: 'Dossiers médicaux' },
    { id: 'manage_medical_records', label: 'Gérer les dossiers médicaux', category: 'Dossiers médicaux' },

    // Prescriptions
    { id: 'view_prescriptions', label: 'Voir les ordonnances', category: 'Ordonnances' },
    { id: 'create_prescriptions', label: 'Créer des ordonnances', category: 'Ordonnances' },
    { id: 'manage_prescriptions', label: 'Gérer les ordonnances', category: 'Ordonnances' },

    // Pharmacy
    { id: 'view_pharmacy', label: 'Voir la pharmacie', category: 'Pharmacie' },
    { id: 'manage_pharmacy', label: 'Gérer la pharmacie', category: 'Pharmacie' },
    { id: 'dispense_medications', label: 'Dispenser les médicaments', category: 'Pharmacie' },

    // Laboratory
    { id: 'view_laboratory', label: 'Voir le laboratoire', category: 'Laboratoire' },
    { id: 'manage_laboratory', label: 'Gérer le laboratoire', category: 'Laboratoire' },
    { id: 'validate_lab_results', label: 'Valider les résultats', category: 'Laboratoire' },

    // Imaging
    { id: 'view_imaging', label: 'Voir l\'imagerie', category: 'Imagerie' },
    { id: 'order_imaging', label: 'Commander des examens', category: 'Imagerie' },
    { id: 'manage_imaging', label: 'Gérer l\'imagerie', category: 'Imagerie' },

    // Finance
    { id: 'view_financial', label: 'Voir les finances', category: 'Finance' },
    { id: 'manage_financial', label: 'Gérer les finances', category: 'Finance' },
    { id: 'process_payments', label: 'Traiter les paiements', category: 'Finance' },
    { id: 'view_invoices', label: 'Voir les factures', category: 'Finance' },
    { id: 'manage_invoices', label: 'Gérer les factures', category: 'Finance' },

    // Queue
    { id: 'view_queue', label: 'Voir la file d\'attente', category: 'File d\'attente' },
    { id: 'manage_queue', label: 'Gérer la file d\'attente', category: 'File d\'attente' },

    // Clinical
    { id: 'perform_eye_exams', label: 'Examens ophtalmologiques', category: 'Clinique' },
    { id: 'create_optical_prescriptions', label: 'Prescriptions optiques', category: 'Clinique' },
    { id: 'update_vitals', label: 'Mettre à jour les constantes', category: 'Clinique' },
    { id: 'administer_medications', label: 'Administrer les médicaments', category: 'Clinique' },
    { id: 'update_patient_notes', label: 'Notes patient', category: 'Clinique' },

    // Reports & Audit
    { id: 'view_reports', label: 'Voir les rapports', category: 'Rapports' },
    { id: 'export_data', label: 'Exporter les données', category: 'Rapports' },
    { id: 'view_audit', label: 'Voir l\'audit', category: 'Audit' },
    { id: 'manage_audit', label: 'Gérer l\'audit', category: 'Audit' }
  ];

  const roles = [
    { id: 'admin', label: 'Administrateur' },
    { id: 'doctor', label: 'Médecin' },
    { id: 'ophthalmologist', label: 'Ophtalmologue' },
    { id: 'nurse', label: 'Infirmier(e)' },
    { id: 'receptionist', label: 'Réceptionniste' },
    { id: 'pharmacist', label: 'Pharmacien' },
    { id: 'lab_technician', label: 'Technicien labo' },
    { id: 'accountant', label: 'Comptable' },
    { id: 'optician', label: 'Opticien' }
  ];

  res.status(200).json({
    success: true,
    data: { menuItems, permissions, roles }
  });
}));

// @desc    Get single role permission
// @route   GET /api/role-permissions/:role
// @access  Private/Admin
router.get('/:role', authorize('admin'), asyncHandler(async (req, res) => {
  const rolePermission = await RolePermission.findOne({ role: req.params.role });

  if (!rolePermission) {
    return res.status(404).json({
      success: false,
      error: 'Role permission not found'
    });
  }

  res.status(200).json({
    success: true,
    data: rolePermission
  });
}));

// @desc    Create or update role permission
// @route   PUT /api/role-permissions/:role
// @access  Private/Admin
router.put('/:role', authorize('admin'), asyncHandler(async (req, res) => {
  const { menuItems, permissions, label, description, isActive } = req.body;

  // Prevent removing critical admin permissions
  if (req.params.role === 'admin') {
    const criticalPermissions = ['manage_users', 'manage_system', 'view_all_data'];
    const criticalMenuItems = ['settings', 'audit'];

    const hasCriticalPermissions = criticalPermissions.every(p => permissions?.includes(p));
    const hasCriticalMenuItems = criticalMenuItems.every(m => menuItems?.includes(m));

    if (!hasCriticalPermissions || !hasCriticalMenuItems) {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove critical admin permissions (manage_users, manage_system, view_all_data) or menu items (settings, audit)'
      });
    }
  }

  const rolePermission = await RolePermission.findOneAndUpdate(
    { role: req.params.role },
    {
      role: req.params.role,
      menuItems: menuItems || [],
      permissions: permissions || [],
      label: label || req.params.role,
      description: description || '',
      isActive: isActive !== undefined ? isActive : true
    },
    { new: true, upsert: true, runValidators: true }
  );

  // Invalidate cache for this role
  await RolePermission.invalidateCache(req.params.role);

  // Force session invalidation - users must re-login
  const sessionService = require('../services/sessionService');
  try {
    await sessionService.invalidateSessionsByRole(req.params.role);
  } catch (err) {
    console.error('Session invalidation error:', err);
  }

  // Notify affected users via WebSocket
  const io = req.app.get('io');
  if (io) {
    io.to(req.params.role).emit('permission:change', {
      role: req.params.role,
      message: 'Your permissions have been updated. Please log in again.',
      action: 'logout'
    });
  }

  res.status(200).json({
    success: true,
    data: rolePermission
  });
}));

// @desc    Delete role permission (soft delete by deactivating)
// @route   DELETE /api/role-permissions/:role
// @access  Private/Admin
router.delete('/:role', authorize('admin'), asyncHandler(async (req, res) => {
  // Prevent deleting admin role
  if (req.params.role === 'admin') {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete admin role permissions'
    });
  }

  const rolePermission = await RolePermission.findOneAndUpdate(
    { role: req.params.role },
    { isActive: false },
    { new: true }
  );

  if (!rolePermission) {
    return res.status(404).json({
      success: false,
      error: 'Role permission not found'
    });
  }

  res.status(200).json({
    success: true,
    data: {}
  });
}));

// @desc    Reset role to default permissions
// @route   POST /api/role-permissions/:role/reset
// @access  Private/Admin
router.post('/:role/reset', authorize('admin'), asyncHandler(async (req, res) => {
  const defaultPermissions = getDefaultPermissions(req.params.role);

  if (!defaultPermissions) {
    return res.status(404).json({
      success: false,
      error: 'No default permissions found for this role'
    });
  }

  const rolePermission = await RolePermission.findOneAndUpdate(
    { role: req.params.role },
    defaultPermissions,
    { new: true, upsert: true }
  );

  res.status(200).json({
    success: true,
    data: rolePermission
  });
}));

// Helper function to get default permissions
function getDefaultPermissions(role) {
  const defaults = {
    admin: {
      role: 'admin',
      label: 'Administrateur',
      description: 'Accès complet au système',
      menuItems: ['dashboard', 'patients', 'queue', 'appointments', 'clinical', 'finance', 'inventory', 'notifications', 'settings', 'audit', 'documents'],
      permissions: ['view_all_data', 'manage_users', 'manage_system', 'manage_settings', 'view_patients', 'manage_patients', 'delete_patients', 'view_appointments', 'manage_appointments', 'delete_appointments', 'view_medical_records', 'manage_medical_records', 'view_prescriptions', 'create_prescriptions', 'manage_prescriptions', 'view_pharmacy', 'manage_pharmacy', 'dispense_medications', 'view_laboratory', 'manage_laboratory', 'validate_lab_results', 'view_imaging', 'order_imaging', 'manage_imaging', 'view_financial', 'manage_financial', 'process_payments', 'manage_invoices', 'view_queue', 'manage_queue', 'perform_eye_exams', 'create_optical_prescriptions', 'update_vitals', 'administer_medications', 'update_patient_notes', 'view_reports', 'export_data', 'view_audit', 'manage_audit'],
      isActive: true,
      isSystemRole: true
    },
    doctor: {
      role: 'doctor',
      label: 'Médecin',
      description: 'Médecin généraliste',
      menuItems: ['dashboard', 'patients', 'queue', 'appointments', 'clinical', 'prescriptions', 'laboratory', 'imaging', 'notifications'],
      permissions: ['view_patients', 'manage_patients', 'view_appointments', 'manage_appointments', 'view_medical_records', 'manage_medical_records', 'view_prescriptions', 'create_prescriptions', 'view_laboratory', 'order_imaging', 'view_imaging', 'view_queue'],
      isActive: true,
      isSystemRole: false
    },
    ophthalmologist: {
      role: 'ophthalmologist',
      label: 'Ophtalmologue',
      description: 'Médecin spécialiste en ophtalmologie',
      menuItems: ['dashboard', 'patients', 'queue', 'appointments', 'clinical', 'inventory', 'notifications', 'settings'],
      permissions: ['view_patients', 'manage_patients', 'view_appointments', 'manage_appointments', 'view_medical_records', 'manage_medical_records', 'view_prescriptions', 'create_prescriptions', 'view_laboratory', 'order_imaging', 'view_imaging', 'view_queue', 'perform_eye_exams', 'create_optical_prescriptions'],
      isActive: true,
      isSystemRole: false
    },
    nurse: {
      role: 'nurse',
      label: 'Infirmier(e)',
      description: 'Personnel infirmier',
      menuItems: ['dashboard', 'patients', 'queue', 'nurse-vitals', 'appointments', 'clinical', 'notifications'],
      permissions: ['view_patients', 'view_appointments', 'view_medical_records', 'view_prescriptions', 'view_queue', 'manage_queue', 'update_vitals', 'administer_medications', 'update_patient_notes'],
      isActive: true,
      isSystemRole: false
    },
    receptionist: {
      role: 'receptionist',
      label: 'Réceptionniste',
      description: 'Accueil et gestion des rendez-vous',
      menuItems: ['dashboard', 'patients', 'queue', 'appointments', 'finance', 'inventory', 'notifications'],
      permissions: ['view_patients', 'manage_patients', 'view_appointments', 'manage_appointments', 'view_queue', 'manage_queue', 'process_payments', 'view_financial'],
      isActive: true,
      isSystemRole: false
    },
    pharmacist: {
      role: 'pharmacist',
      label: 'Pharmacien',
      description: 'Gestion de la pharmacie',
      menuItems: ['dashboard', 'pharmacy', 'prescriptions', 'notifications'],
      permissions: ['view_prescriptions', 'view_pharmacy', 'manage_pharmacy', 'dispense_medications'],
      isActive: true,
      isSystemRole: false
    },
    lab_technician: {
      role: 'lab_technician',
      label: 'Technicien labo',
      description: 'Technicien de laboratoire',
      menuItems: ['dashboard', 'laboratory', 'patients', 'notifications'],
      permissions: ['view_patients', 'view_laboratory', 'manage_laboratory', 'validate_lab_results'],
      isActive: true,
      isSystemRole: false
    },
    accountant: {
      role: 'accountant',
      label: 'Comptable',
      description: 'Gestion financière et comptabilité',
      menuItems: ['dashboard', 'finance', 'invoicing', 'notifications'],
      permissions: ['view_financial', 'manage_financial', 'process_payments', 'manage_invoices', 'view_reports', 'export_data'],
      isActive: true,
      isSystemRole: false
    },
    optician: {
      role: 'optician',
      label: 'Opticien',
      description: 'Optique et lunetterie',
      menuItems: ['dashboard', 'patients', 'prescriptions', 'notifications'],
      permissions: ['view_patients', 'view_prescriptions', 'create_optical_prescriptions'],
      isActive: true,
      isSystemRole: false
    }
  };

  return defaults[role] || null;
}

module.exports = router;
