/**
 * Database Index Migration Script
 *
 * Creates compound indexes for optimizing common query patterns.
 * Run this script after database initialization or when adding new indexes.
 *
 * Usage: node scripts/createIndexes.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Index definitions for each collection
const indexDefinitions = {
  // Patient indexes
  patients: [
    // Search by name (case-insensitive)
    { fields: { firstName: 'text', lastName: 'text', 'contact.email': 'text' }, options: { name: 'patient_search_text' } },
    // Filter by active status and created date
    { fields: { isActive: 1, createdAt: -1 }, options: { name: 'patient_active_created' } },
    // Find by phone number
    { fields: { 'contact.phone': 1 }, options: { name: 'patient_phone', sparse: true } },
    // Find by email
    { fields: { 'contact.email': 1 }, options: { name: 'patient_email', sparse: true } },
    // Filter by gender and date of birth (for demographics)
    { fields: { gender: 1, dateOfBirth: 1 }, options: { name: 'patient_demographics' } },
    // Find patients with recent visits
    { fields: { lastVisitDate: -1, isActive: 1 }, options: { name: 'patient_last_visit' } }
  ],

  // Appointment indexes
  appointments: [
    // Provider schedule lookup (most common query)
    { fields: { provider: 1, date: 1, status: 1 }, options: { name: 'appointment_provider_schedule' } },
    // Patient appointment history
    { fields: { patient: 1, date: -1 }, options: { name: 'appointment_patient_history' } },
    // Today's appointments by department
    { fields: { date: 1, department: 1, status: 1 }, options: { name: 'appointment_daily_dept' } },
    // Find available slots (for booking)
    { fields: { provider: 1, date: 1, startTime: 1, endTime: 1, status: 1 }, options: { name: 'appointment_slot_check' } },
    // Status-based queries with time ordering
    { fields: { status: 1, date: -1, startTime: 1 }, options: { name: 'appointment_status_time' } },
    // Reminder queries (scheduled appointments in the future)
    { fields: { status: 1, date: 1, 'reminders.sent': 1 }, options: { name: 'appointment_reminders' } }
  ],

  // Invoice indexes
  invoices: [
    // Patient billing history
    { fields: { patient: 1, dateIssued: -1 }, options: { name: 'invoice_patient_history' } },
    // Unpaid invoices (for follow-up)
    { fields: { status: 1, dueDate: 1 }, options: { name: 'invoice_status_due' } },
    // Revenue reports by date range
    { fields: { dateIssued: -1, status: 1 }, options: { name: 'invoice_reports' } },
    // Insurance claims tracking
    { fields: { 'insurance.status': 1, dateIssued: -1 }, options: { name: 'invoice_insurance', sparse: true } },
    // Overdue invoices
    { fields: { status: 1, dueDate: 1, 'summary.balance': 1 }, options: { name: 'invoice_overdue' } }
  ],

  // Prescription indexes
  prescriptions: [
    // Patient prescriptions
    { fields: { patient: 1, createdAt: -1 }, options: { name: 'prescription_patient_history' } },
    // Pharmacy queue (pending prescriptions)
    { fields: { status: 1, createdAt: -1 }, options: { name: 'prescription_pharmacy_queue' } },
    // Provider prescriptions
    { fields: { prescribedBy: 1, createdAt: -1 }, options: { name: 'prescription_provider' } },
    // Type and status filtering
    { fields: { type: 1, status: 1, createdAt: -1 }, options: { name: 'prescription_type_status' } },
    // Expiring prescriptions
    { fields: { expiryDate: 1, status: 1 }, options: { name: 'prescription_expiry' } }
  ],

  // Pharmacy Inventory indexes
  pharmacyinventories: [
    // Search by medication name
    { fields: { 'medication.genericName': 'text', 'medication.brandName': 'text' }, options: { name: 'inventory_search_text' } },
    // Low stock alerts
    { fields: { 'inventory.status': 1, 'inventory.currentStock': 1 }, options: { name: 'inventory_stock_status' } },
    // Expiring batches
    { fields: { 'batches.expirationDate': 1, 'batches.status': 1 }, options: { name: 'inventory_batch_expiry' } },
    // Category browsing
    { fields: { category: 1, 'medication.brandName': 1 }, options: { name: 'inventory_category' } },
    // SKU lookup
    { fields: { sku: 1 }, options: { name: 'inventory_sku', unique: true, sparse: true } }
  ],

  // Visit indexes
  visits: [
    // Patient visit history
    { fields: { patient: 1, visitDate: -1 }, options: { name: 'visit_patient_history' } },
    // Provider visits
    { fields: { provider: 1, visitDate: -1 }, options: { name: 'visit_provider_history' } },
    // Active visits (for dashboard)
    { fields: { status: 1, visitDate: -1 }, options: { name: 'visit_status_date' } },
    // Department workload
    { fields: { department: 1, visitDate: 1, status: 1 }, options: { name: 'visit_department' } }
  ],

  // Ophthalmology Exam indexes
  ophthalmologyexams: [
    // Patient exam history
    { fields: { patient: 1, examDate: -1 }, options: { name: 'ophthalmo_patient_history' } },
    // Provider exams
    { fields: { performedBy: 1, examDate: -1 }, options: { name: 'ophthalmo_provider' } },
    // Exam type queries
    { fields: { examType: 1, examDate: -1 }, options: { name: 'ophthalmo_type' } },
    // Linked visit lookup
    { fields: { visit: 1 }, options: { name: 'ophthalmo_visit' } }
  ],

  // Queue indexes
  queues: [
    // Active queue by department
    { fields: { department: 1, status: 1, checkInTime: 1 }, options: { name: 'queue_department_active' } },
    // Patient in queue
    { fields: { patient: 1, status: 1 }, options: { name: 'queue_patient' } },
    // Provider queue
    { fields: { assignedTo: 1, status: 1, checkInTime: 1 }, options: { name: 'queue_provider' } },
    // Priority ordering
    { fields: { status: 1, priority: 1, checkInTime: 1 }, options: { name: 'queue_priority' } }
  ],

  // Audit Log indexes
  auditlogs: [
    // User activity
    { fields: { user: 1, timestamp: -1 }, options: { name: 'audit_user_activity' } },
    // Resource audit trail
    { fields: { resourceType: 1, resourceId: 1, timestamp: -1 }, options: { name: 'audit_resource' } },
    // Action filtering
    { fields: { action: 1, timestamp: -1 }, options: { name: 'audit_action' } },
    // Date range queries (with TTL - auto-delete after 365 days)
    { fields: { timestamp: 1 }, options: { name: 'audit_timestamp_ttl', expireAfterSeconds: 365 * 24 * 60 * 60 } }
  ],

  // User indexes
  users: [
    // Email lookup (unique)
    { fields: { email: 1 }, options: { name: 'user_email', unique: true } },
    // Role-based queries
    { fields: { role: 1, isActive: 1 }, options: { name: 'user_role_active' } },
    // Department staff lookup
    { fields: { department: 1, role: 1, isActive: 1 }, options: { name: 'user_department' } }
  ],

  // Document indexes
  documents: [
    // Patient documents
    { fields: { patient: 1, createdAt: -1 }, options: { name: 'document_patient' } },
    // Visit documents
    { fields: { visit: 1, createdAt: -1 }, options: { name: 'document_visit' } },
    // Type filtering
    { fields: { type: 1, createdAt: -1 }, options: { name: 'document_type' } },
    // Full-text search on document content
    { fields: { title: 'text', description: 'text', tags: 'text' }, options: { name: 'document_search_text' } }
  ],

  // Notification indexes
  notifications: [
    // User notifications
    { fields: { user: 1, read: 1, createdAt: -1 }, options: { name: 'notification_user' } },
    // Unread count
    { fields: { user: 1, read: 1 }, options: { name: 'notification_unread' } },
    // TTL - auto-delete after 30 days
    { fields: { createdAt: 1 }, options: { name: 'notification_ttl', expireAfterSeconds: 30 * 24 * 60 * 60 } }
  ],

  // Consultation Session indexes
  consultationsessions: [
    // Patient sessions
    { fields: { patient: 1, startTime: -1 }, options: { name: 'consultation_patient' } },
    // Provider sessions
    { fields: { provider: 1, startTime: -1 }, options: { name: 'consultation_provider' } },
    // Active sessions
    { fields: { status: 1, startTime: -1 }, options: { name: 'consultation_status' } }
  ],

  // Clinical Alerts indexes
  clinicalalerts: [
    // Patient alerts
    { fields: { patient: 1, status: 1, createdAt: -1 }, options: { name: 'clinicalalert_patient' } },
    // Active alerts by severity
    { fields: { status: 1, severity: 1, createdAt: -1 }, options: { name: 'clinicalalert_severity' } },
    // Unacknowledged alerts
    { fields: { status: 1, acknowledgedAt: 1 }, options: { name: 'clinicalalert_unacked' } }
  ],

  // Lab Orders indexes
  laborders: [
    // Patient lab orders
    { fields: { patient: 1, orderDate: -1 }, options: { name: 'laborder_patient' } },
    // Pending orders (for lab technicians)
    { fields: { status: 1, priority: 1, orderDate: 1 }, options: { name: 'laborder_pending' } },
    // Provider orders
    { fields: { orderedBy: 1, orderDate: -1 }, options: { name: 'laborder_provider' } }
  ]
};

async function createIndexes() {
  console.log('🔧 Starting index creation...\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

  try {
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const [collectionName, indexes] of Object.entries(indexDefinitions)) {
      console.log(`📁 Processing collection: ${collectionName}`);

      try {
        const collection = db.collection(collectionName);

        // Check if collection exists
        const collections = await db.listCollections({ name: collectionName }).toArray();
        if (collections.length === 0) {
          console.log('   ⚠️  Collection does not exist, skipping\n');
          continue;
        }

        // Get existing indexes
        const existingIndexes = await collection.indexes();
        const existingIndexNames = existingIndexes.map(idx => idx.name);

        for (const indexDef of indexes) {
          const indexName = indexDef.options.name;

          if (existingIndexNames.includes(indexName)) {
            console.log(`   ⏭️  Index "${indexName}" already exists`);
            totalSkipped++;
            continue;
          }

          try {
            await collection.createIndex(indexDef.fields, indexDef.options);
            console.log(`   ✅ Created index "${indexName}"`);
            totalCreated++;
          } catch (error) {
            console.log(`   ❌ Failed to create "${indexName}": ${error.message}`);
            totalErrors++;
          }
        }

        console.log('');
      } catch (error) {
        console.log(`   ❌ Error processing collection: ${error.message}\n`);
        totalErrors++;
      }
    }

    console.log('═══════════════════════════════════════');
    console.log('📊 Summary:');
    console.log(`   Created: ${totalCreated}`);
    console.log(`   Skipped: ${totalSkipped} (already exist)`);
    console.log(`   Errors:  ${totalErrors}`);
    console.log('═══════════════════════════════════════\n');

    if (totalErrors === 0) {
      console.log('✅ Index migration completed successfully!');
    } else {
      console.log('⚠️  Index migration completed with some errors.');
    }
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Export for programmatic use
module.exports = { createIndexes, indexDefinitions };

// Run if executed directly
if (require.main === module) {
  createIndexes()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
