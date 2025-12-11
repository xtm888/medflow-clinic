const mongoose = require('mongoose');
require('dotenv').config();
const RolePermission = require('../models/RolePermission');

const defaultRolePermissions = [
  {
    role: 'admin',
    label: 'Administrateur',
    description: 'Accès complet au système',
    menuItems: ['dashboard', 'patients', 'queue', 'appointments', 'clinical', 'finance', 'inventory', 'notifications', 'settings', 'audit', 'documents'],
    permissions: ['view_all_data', 'manage_users', 'manage_system', 'manage_settings', 'view_patients', 'manage_patients', 'delete_patients', 'register_patients', 'check_in_patients', 'update_contact_info', 'view_appointments', 'manage_appointments', 'delete_appointments', 'view_medical_records', 'manage_medical_records', 'view_prescriptions', 'create_prescriptions', 'manage_prescriptions', 'verify_prescriptions', 'view_pharmacy', 'manage_pharmacy', 'dispense_medications', 'manage_inventory', 'drug_interactions_check', 'view_patient_medications', 'view_laboratory', 'manage_laboratory', 'validate_lab_results', 'view_lab_orders', 'collect_specimens', 'receive_specimens', 'enter_results', 'verify_results', 'upload_results', 'update_test_status', 'view_imaging', 'order_imaging', 'manage_imaging', 'view_imaging_orders', 'schedule_imaging', 'perform_imaging', 'upload_imaging_results', 'create_imaging_reports', 'view_financial', 'manage_financial', 'process_payments', 'view_invoices', 'manage_invoices', 'create_invoices', 'manage_billing', 'view_financial_reports', 'manage_insurance_claims', 'view_queue', 'manage_queue', 'perform_eye_exams', 'create_optical_prescriptions', 'manage_glasses_orders', 'update_vitals', 'administer_medications', 'update_patient_notes', 'perform_orthoptic_exams', 'view_reports', 'export_data', 'generate_reports', 'manage_staff_schedules', 'manage_devices', 'manage_equipment', 'view_audit', 'manage_audit'],
    isActive: true,
    isSystemRole: true
  },
  {
    role: 'doctor',
    label: 'Médecin',
    description: 'Médecin généraliste',
    menuItems: ['dashboard', 'patients', 'queue', 'appointments', 'clinical', 'prescriptions', 'laboratory', 'imaging', 'notifications'],
    permissions: ['view_patients', 'manage_patients', 'view_appointments', 'manage_appointments', 'view_medical_records', 'manage_medical_records', 'view_prescriptions', 'create_prescriptions', 'view_laboratory', 'order_imaging', 'view_imaging', 'view_queue', 'view_financial', 'view_invoices', 'perform_eye_exams'],
    isActive: true,
    isSystemRole: false
  },
  {
    role: 'ophthalmologist',
    label: 'Ophtalmologue',
    description: 'Médecin spécialiste en ophtalmologie',
    menuItems: ['dashboard', 'patients', 'queue', 'appointments', 'clinical', 'inventory', 'notifications', 'settings'],
    permissions: ['view_patients', 'manage_patients', 'view_appointments', 'manage_appointments', 'view_medical_records', 'manage_medical_records', 'view_prescriptions', 'create_prescriptions', 'view_laboratory', 'order_imaging', 'view_imaging', 'view_queue', 'perform_eye_exams', 'create_optical_prescriptions', 'view_financial', 'view_invoices'],
    isActive: true,
    isSystemRole: false
  },
  {
    role: 'nurse',
    label: 'Infirmier(e)',
    description: 'Personnel infirmier',
    menuItems: ['dashboard', 'patients', 'queue', 'nurse-vitals', 'appointments', 'clinical', 'notifications'],
    permissions: ['view_patients', 'view_appointments', 'view_medical_records', 'view_prescriptions', 'view_queue', 'manage_queue', 'update_vitals', 'administer_medications', 'update_patient_notes'],
    isActive: true,
    isSystemRole: false
  },
  {
    role: 'receptionist',
    label: 'Réceptionniste',
    description: 'Accueil et gestion des rendez-vous',
    menuItems: ['dashboard', 'patients', 'queue', 'appointments', 'finance', 'inventory', 'notifications'],
    permissions: ['view_patients', 'manage_patients', 'view_appointments', 'manage_appointments', 'view_queue', 'manage_queue', 'process_payments', 'view_financial', 'view_invoices', 'create_invoices'],
    isActive: true,
    isSystemRole: false
  },
  {
    role: 'pharmacist',
    label: 'Pharmacien',
    description: 'Gestion de la pharmacie',
    menuItems: ['dashboard', 'pharmacy', 'prescriptions', 'notifications'],
    permissions: ['view_prescriptions', 'view_pharmacy', 'manage_pharmacy', 'dispense_medications', 'view_invoices'],
    isActive: true,
    isSystemRole: false
  },
  {
    role: 'lab_technician',
    label: 'Technicien labo',
    description: 'Technicien de laboratoire',
    menuItems: ['dashboard', 'laboratory', 'patients', 'notifications'],
    permissions: ['view_patients', 'view_laboratory', 'manage_laboratory', 'validate_lab_results', 'view_invoices'],
    isActive: true,
    isSystemRole: false
  },
  {
    role: 'accountant',
    label: 'Comptable',
    description: 'Gestion financière et comptabilité',
    menuItems: ['dashboard', 'finance', 'invoicing', 'notifications'],
    permissions: ['view_financial', 'manage_financial', 'process_payments', 'view_invoices', 'manage_invoices', 'view_reports', 'export_data'],
    isActive: true,
    isSystemRole: false
  },
  {
    role: 'manager',
    label: 'Gestionnaire',
    description: 'Gestion et supervision',
    menuItems: ['dashboard', 'patients', 'queue', 'appointments', 'clinical', 'finance', 'inventory', 'notifications'],
    permissions: ['view_all_data', 'view_reports', 'manage_queue', 'view_financial_reports', 'manage_staff_schedules'],
    isActive: true,
    isSystemRole: false
  },
  {
    role: 'technician',
    label: 'Technicien',
    description: 'Technicien médical et appareils',
    menuItems: ['dashboard', 'clinical', 'notifications'],
    permissions: ['view_patients', 'manage_devices', 'view_imaging', 'upload_results', 'manage_equipment'],
    isActive: true,
    isSystemRole: false
  },
  {
    role: 'orthoptist',
    label: 'Orthoptiste',
    description: 'Spécialiste en orthoptie',
    menuItems: ['dashboard', 'patients', 'queue', 'appointments', 'clinical', 'notifications'],
    permissions: ['view_patients', 'perform_orthoptic_exams', 'manage_appointments', 'view_prescriptions', 'update_patient_notes', 'view_queue'],
    isActive: true,
    isSystemRole: false
  },
  {
    role: 'optometrist',
    label: 'Optométriste',
    description: 'Optométrie et prescriptions optiques',
    menuItems: ['dashboard', 'patients', 'queue', 'appointments', 'clinical', 'inventory', 'notifications'],
    permissions: ['view_patients', 'manage_patients', 'perform_eye_exams', 'create_optical_prescriptions', 'manage_glasses_orders', 'view_prescriptions', 'view_queue', 'manage_appointments', 'view_invoices'],
    isActive: true,
    isSystemRole: false
  },
  {
    role: 'radiologist',
    label: 'Radiologue',
    description: 'Spécialiste en imagerie médicale',
    menuItems: ['dashboard', 'patients', 'clinical', 'notifications'],
    permissions: ['view_patients', 'view_imaging', 'upload_imaging_results', 'manage_imaging', 'create_imaging_reports'],
    isActive: true,
    isSystemRole: false
  },
  {
    role: 'imaging_tech',
    label: 'Technicien en imagerie',
    description: 'Technicien en imagerie médicale',
    menuItems: ['dashboard', 'patients', 'queue', 'clinical', 'notifications'],
    permissions: ['view_patients', 'view_imaging_orders', 'schedule_imaging', 'perform_imaging', 'upload_imaging_results', 'manage_imaging', 'view_queue'],
    isActive: true,
    isSystemRole: false
  }
];

async function seedRolePermissions() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/care-vision');
    console.log('Connected to MongoDB');

    console.log('\nSeeding role permissions...');

    for (const rolePermission of defaultRolePermissions) {
      const existing = await RolePermission.findOne({ role: rolePermission.role });

      if (existing) {
        console.log(`  - Role "${rolePermission.role}" already exists, skipping...`);
      } else {
        await RolePermission.create(rolePermission);
        console.log(`  ✓ Created role permission: ${rolePermission.label}`);
      }
    }

    console.log('\n✅ Role permissions seeded successfully!');

    // Display summary
    const count = await RolePermission.countDocuments();
    console.log(`\nTotal role permissions in database: ${count}`);

    const roles = await RolePermission.find().select('role label isActive');
    console.log('\nRoles:');
    roles.forEach(r => {
      console.log(`  - ${r.label} (${r.role}) - ${r.isActive ? 'Active' : 'Inactive'}`);
    });

  } catch (error) {
    console.error('Error seeding role permissions:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  seedRolePermissions()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = seedRolePermissions;
