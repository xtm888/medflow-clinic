/**
 * Seed Repair Tracking Test Data
 * Creates sample repair records for testing the Repairs module
 */

require('dotenv').config();
const mongoose = require('mongoose');
const RepairTracking = require('../models/RepairTracking');
const Patient = require('../models/Patient');
const Clinic = require('../models/Clinic');
const User = require('../models/User');

const REPAIR_STATUSES = ['received', 'inspecting', 'waiting_approval', 'in_repair', 'quality_check', 'ready_pickup', 'completed', 'cancelled'];
const ITEM_TYPES = ['eyeglasses', 'frame', 'sunglasses', 'contact_lens_case', 'equipment', 'hearing_aid', 'low_vision_device', 'other'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const REPAIR_TYPES = ['in_house', 'send_out'];
const PROBLEM_CATEGORIES = [
  'broken_frame', 'loose_screw', 'nose_pad', 'temple_adjustment',
  'lens_scratch', 'lens_chip', 'lens_replacement', 'coating_damage',
  'hinge_repair', 'bridge_repair', 'welding', 'cleaning',
  'equipment_malfunction', 'calibration', 'other'
];

const SAMPLE_ITEMS = [
  { type: 'sunglasses', brand: 'Ray-Ban', model: 'Aviator RB3025', description: 'Lunettes de soleil aviator' },
  { type: 'sunglasses', brand: 'Oakley', model: 'Holbrook OO9102', description: 'Lunettes de sport' },
  { type: 'frame', brand: 'Gucci', model: 'GG0010O', description: 'Monture optique femme' },
  { type: 'frame', brand: 'Tom Ford', model: 'TF5401', description: 'Monture optique homme' },
  { type: 'eyeglasses', brand: 'Prada', model: 'PR 17WS', description: 'Lunettes de vue progressives' },
  { type: 'frame', brand: 'Silhouette', model: 'Titan Minimal', description: 'Monture sans vis' },
  { type: 'hearing_aid', brand: 'Phonak', model: 'Audéo P70-R', description: 'Appareil auditif rechargeable' },
  { type: 'eyeglasses', brand: 'Persol', model: 'PO3092V', description: 'Lunettes classiques italiennes' },
  { type: 'frame', brand: 'Lindberg', model: 'Spirit', description: 'Monture titane minimaliste' },
  { type: 'sunglasses', brand: 'Maui Jim', model: 'Peahi', description: 'Lunettes de soleil polarisées' }
];

const SAMPLE_PROBLEMS = [
  { category: 'broken_frame', description: 'Branche cassée côté droit', symptoms: 'La branche est complètement détachée' },
  { category: 'loose_screw', description: 'Vis de charnière manquante', symptoms: 'La branche se détache facilement' },
  { category: 'lens_scratch', description: 'Rayures profondes sur verre droit', symptoms: 'Vision brouillée, multiples rayures' },
  { category: 'nose_pad', description: 'Plaquettes nasales usées', symptoms: 'Inconfort, lunettes glissent' },
  { category: 'temple_adjustment', description: 'Embout de branche à ajuster', symptoms: 'Embout inconfortable' },
  { category: 'hinge_repair', description: 'Charnière grippée', symptoms: 'Difficulté à plier les branches' },
  { category: 'bridge_repair', description: 'Pont à réparer', symptoms: 'Pont desserré ou tordu' },
  { category: 'coating_damage', description: 'Traitement anti-reflet qui pèle', symptoms: 'Reflets gênants, aspect dégradé' },
  { category: 'lens_chip', description: 'Verre gauche ébréché', symptoms: 'Éclat visible sur le bord' },
  { category: 'cleaning', description: 'Nettoyage professionnel requis', symptoms: 'Dépôts et traces persistantes' }
];

async function seedRepairs() {
  try {
    console.log('🔧 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');

    // Get a clinic
    const clinic = await Clinic.findOne();
    if (!clinic) {
      console.error('❌ No clinic found. Please run seedClinics.js first.');
      process.exit(1);
    }

    // Get some patients - try with clinic first, then without
    let patients = await Patient.find({ clinic: clinic._id }).limit(15);
    if (patients.length === 0) {
      // Try to find patients without clinic filter
      patients = await Patient.find({}).limit(15);
      if (patients.length === 0) {
        console.error('❌ No patients found. Please run seedRealisticPatientData.js first.');
        process.exit(1);
      }
      console.log('⚠️  Using patients without clinic association');
    }

    // Get a user (technician or admin)
    const user = await User.findOne({ role: { $in: ['admin', 'optician', 'technician'] } });
    if (!user) {
      console.error('❌ No suitable user found. Please run seedUsers.js first.');
      process.exit(1);
    }

    console.log(`📋 Using clinic: ${clinic.name}`);
    console.log(`👥 Found ${patients.length} patients`);
    console.log(`👤 Using user: ${user.username}`);

    // Clear existing repairs (optional - comment out to keep existing)
    const deleteResult = await RepairTracking.deleteMany({ clinic: clinic._id });
    console.log(`🗑️  Cleared ${deleteResult.deletedCount} existing repairs`);

    const repairs = [];
    const now = new Date();

    // Generate repair number function
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    let repairSequence = 1;

    // Check for existing repairs to get the next sequence number
    const lastRepair = await RepairTracking.findOne({
      repairNumber: new RegExp(`^RPR-${year}${month}`)
    }).sort({ repairNumber: -1 });

    if (lastRepair) {
      const lastSequence = parseInt(lastRepair.repairNumber.split('-')[2]);
      repairSequence = lastSequence + 1;
    }

    const generateRepairNumber = () => {
      const num = `RPR-${year}${month}-${String(repairSequence).padStart(5, '0')}`;
      repairSequence++;
      return num;
    };

    // Create 20 sample repairs across different statuses
    for (let i = 0; i < 20; i++) {
      const patient = patients[i % patients.length];
      const item = SAMPLE_ITEMS[i % SAMPLE_ITEMS.length];
      const problem = SAMPLE_PROBLEMS[i % SAMPLE_PROBLEMS.length];

      // Distribute statuses: more in active states, fewer completed/cancelled
      let status;
      if (i < 4) status = 'received';
      else if (i < 7) status = 'inspecting';
      else if (i < 9) status = 'waiting_approval';
      else if (i < 12) status = 'in_repair';
      else if (i < 14) status = 'quality_check';
      else if (i < 17) status = 'ready_pickup';
      else if (i < 19) status = 'completed';
      else status = 'cancelled';

      // Calculate dates based on status
      const daysAgo = Math.floor(Math.random() * 30) + 1;
      const receivedDate = new Date(now - daysAgo * 24 * 60 * 60 * 1000);

      const estimatedDays = Math.floor(Math.random() * 7) + 3;
      const estimatedCompletion = new Date(receivedDate.getTime() + estimatedDays * 24 * 60 * 60 * 1000);

      // Build status history
      const statusHistory = [
        { status: 'received', changedBy: user._id, changedAt: receivedDate }
      ];

      if (['inspecting', 'waiting_approval', 'in_repair', 'quality_check', 'ready_pickup', 'completed', 'cancelled'].includes(status)) {
        statusHistory.push({
          status: 'inspecting',
          changedBy: user._id,
          changedAt: new Date(receivedDate.getTime() + 1 * 24 * 60 * 60 * 1000),
          notes: 'Inspection en cours'
        });
      }

      if (['waiting_approval', 'in_repair', 'quality_check', 'ready_pickup', 'completed'].includes(status)) {
        statusHistory.push({
          status: 'waiting_approval',
          changedBy: user._id,
          changedAt: new Date(receivedDate.getTime() + 2 * 24 * 60 * 60 * 1000),
          notes: 'Devis envoyé au client'
        });
      }

      if (['in_repair', 'quality_check', 'ready_pickup', 'completed'].includes(status)) {
        statusHistory.push({
          status: 'in_repair',
          changedBy: user._id,
          changedAt: new Date(receivedDate.getTime() + 3 * 24 * 60 * 60 * 1000),
          notes: 'Client a approuvé, réparation lancée'
        });
      }

      if (['quality_check', 'ready_pickup', 'completed'].includes(status)) {
        statusHistory.push({
          status: 'quality_check',
          changedBy: user._id,
          changedAt: new Date(receivedDate.getTime() + 4 * 24 * 60 * 60 * 1000),
          notes: 'Réparation terminée, contrôle qualité'
        });
      }

      if (['ready_pickup', 'completed'].includes(status)) {
        statusHistory.push({
          status: 'ready_pickup',
          changedBy: user._id,
          changedAt: new Date(receivedDate.getTime() + 5 * 24 * 60 * 60 * 1000),
          notes: 'Prêt pour retrait client'
        });
      }

      if (status === 'completed') {
        statusHistory.push({
          status: 'completed',
          changedBy: user._id,
          changedAt: new Date(receivedDate.getTime() + 6 * 24 * 60 * 60 * 1000),
          notes: 'Remis au client'
        });
      }

      // Estimate cost
      const laborCost = Math.floor(Math.random() * 50 + 10) * 100; // 1000-6000 CDF
      const partsCost = Math.floor(Math.random() * 30) * 100; // 0-3000 CDF

      const repair = {
        repairNumber: generateRepairNumber(),
        clinic: clinic._id,
        customer: patient._id,
        customerName: `${patient.firstName} ${patient.lastName}`,
        customerPhone: patient.phone || patient.phoneNumber || '',
        itemType: item.type,
        brand: item.brand,
        model: item.model,
        itemDescription: item.description,
        serialNumber: `SN-${Date.now()}-${i}`,
        problemCategory: problem.category,
        problemReported: problem.description,
        status,
        statusHistory,
        priority: PRIORITIES[Math.floor(Math.random() * PRIORITIES.length)],
        repairType: REPAIR_TYPES[Math.floor(Math.random() * REPAIR_TYPES.length)],
        estimatedCost: laborCost + partsCost,
        laborCost: ['in_repair', 'quality_check', 'ready_pickup', 'completed'].includes(status) ? laborCost : 0,
        partsCost: ['in_repair', 'quality_check', 'ready_pickup', 'completed'].includes(status) ? partsCost : 0,
        totalCost: ['in_repair', 'quality_check', 'ready_pickup', 'completed'].includes(status) ? laborCost + partsCost : 0,
        estimatedCompletionDate: estimatedCompletion,
        warrantyClaimNumber: i % 5 === 0 ? `WC-2026-${String(i).padStart(4, '0')}` : undefined,
        receivedBy: user._id,
        notes: ['inspecting', 'in_repair', 'quality_check', 'ready_pickup', 'completed'].includes(status)
          ? 'Notes du technicien: Travail effectué selon les normes.'
          : '',
        createdAt: receivedDate,
        updatedAt: statusHistory[statusHistory.length - 1]?.changedAt || receivedDate
      };

      repairs.push(repair);
    }

    // Insert all repairs using create() which runs middleware
    console.log('Creating repairs (this may take a moment)...');
    const result = [];
    for (const repairData of repairs) {
      const repair = await RepairTracking.create(repairData);
      result.push(repair);
      process.stdout.write('.');
    }
    console.log('');
    console.log(`✅ Created ${result.length} repair records`);

    // Show summary
    const statusCounts = {};
    result.forEach(r => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });
    console.log('\n📊 Repairs by status:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    console.log('\n🎉 Repair data seeding complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding repairs:', error);
    process.exit(1);
  }
}

seedRepairs();
