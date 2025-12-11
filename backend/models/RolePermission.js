const mongoose = require('mongoose');

const rolePermissionSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    unique: true,
    enum: [
      'admin',
      'doctor',
      'ophthalmologist',
      'nurse',
      'receptionist',
      'pharmacist',
      'lab_technician',
      'accountant',
      'manager',
      'technician',
      'orthoptist',
      'optometrist',
      'radiologist',
      'imaging_tech'
    ]
  },
  label: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  menuItems: [{
    type: String,
    enum: [
      'dashboard',
      'patients',
      'queue',
      'appointments',
      'clinical',
      'ophthalmology',
      'prescriptions',
      'pharmacy',
      'laboratory',
      'imaging',
      'finance',
      'invoicing',
      'inventory',
      'notifications',
      'settings',
      'audit',
      'nurse-vitals',
      'orthoptic',
      'documents',
      'correspondence',
      'devices'
    ]
  }],
  permissions: [{
    type: String,
    enum: [
      // General
      'view_all_data',
      'manage_users',
      'manage_system',
      'manage_settings',

      // Patients
      'view_patients',
      'manage_patients',
      'delete_patients',
      'register_patients',
      'check_in_patients',
      'update_contact_info',

      // Appointments
      'view_appointments',
      'manage_appointments',
      'delete_appointments',

      // Medical Records
      'view_medical_records',
      'manage_medical_records',

      // Prescriptions
      'view_prescriptions',
      'create_prescriptions',
      'manage_prescriptions',
      'verify_prescriptions',

      // Pharmacy
      'view_pharmacy',
      'manage_pharmacy',
      'dispense_medications',
      'manage_inventory',
      'drug_interactions_check',
      'view_patient_medications',

      // Laboratory
      'view_laboratory',
      'manage_laboratory',
      'validate_lab_results',
      'view_lab_orders',
      'collect_specimens',
      'receive_specimens',
      'enter_results',
      'verify_results',
      'upload_results',
      'update_test_status',

      // Imaging
      'view_imaging',
      'order_imaging',
      'manage_imaging',
      'view_imaging_orders',
      'schedule_imaging',
      'perform_imaging',
      'upload_imaging_results',
      'create_imaging_reports',

      // Finance
      'view_financial',
      'manage_financial',
      'process_payments',
      'view_invoices',
      'manage_invoices',
      'create_invoices',
      'manage_billing',
      'view_financial_reports',
      'manage_insurance_claims',

      // Queue
      'view_queue',
      'manage_queue',

      // Clinical
      'perform_eye_exams',
      'create_optical_prescriptions',
      'update_vitals',
      'administer_medications',
      'update_patient_notes',
      'perform_orthoptic_exams',
      'manage_glasses_orders',

      // Reports
      'view_reports',
      'export_data',
      'generate_reports',

      // Staff Management
      'manage_staff_schedules',

      // Equipment/Devices
      'manage_devices',
      'manage_equipment',

      // Audit
      'view_audit',
      'manage_audit'
    ]
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isSystemRole: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Static method to get permissions for a role
rolePermissionSchema.statics.getPermissionsForRole = async function(role) {
  const rolePermission = await this.findOne({ role, isActive: true });
  if (!rolePermission) {
    return { menuItems: [], permissions: [] };
  }
  return {
    menuItems: rolePermission.menuItems,
    permissions: rolePermission.permissions
  };
};

// Static method to check if role has specific permission
rolePermissionSchema.statics.hasPermission = async function(role, permission) {
  const rolePermission = await this.findOne({ role, isActive: true });
  if (!rolePermission) return false;
  return rolePermission.permissions.includes(permission);
};

// Static method to check if role has access to menu item
rolePermissionSchema.statics.hasMenuAccess = async function(role, menuItem) {
  const rolePermission = await this.findOne({ role, isActive: true });
  if (!rolePermission) return false;
  return rolePermission.menuItems.includes(menuItem);
};

// Static method to get permissions for a role with caching
rolePermissionSchema.statics.getPermissionsForRoleCached = async function(role) {
  // Import cache dynamically to avoid circular dependency
  const { cache } = require('../config/redis');

  const cacheKey = `role:permissions:${role}`;

  try {
    // Try to get from cache first (cache.get already parses JSON)
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.warn('Cache read error:', error.message);
  }

  // Not in cache, fetch from database
  const rolePermission = await this.findOne({ role, isActive: true });

  if (rolePermission) {
    try {
      // Cache for 5 minutes (300 seconds) - cache.set already stringifies
      await cache.set(cacheKey, rolePermission, 300);
    } catch (error) {
      console.warn('Cache write error:', error.message);
    }
  }

  return rolePermission;
};

// Static method to invalidate cache for a role
rolePermissionSchema.statics.invalidateCache = async function(role) {
  const { cache } = require('../config/redis');
  const cacheKey = `role:permissions:${role}`;

  try {
    await cache.delete(cacheKey); // Use 'delete' not 'del'
    console.log(`✓ Cache invalidated for role: ${role}`);
  } catch (error) {
    console.warn('Cache invalidation error:', error.message);
  }
};

module.exports = mongoose.model('RolePermission', rolePermissionSchema);
