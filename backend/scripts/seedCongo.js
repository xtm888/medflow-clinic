/**
 * Master Seed Script for MedFlow Congo
 *
 * Runs all seed scripts in the correct dependency order:
 * 1. Foundation: Clinics, Users, Role Permissions
 * 2. Conventions & Billing: Companies, Convention Rules, Fee Schedules
 * 3. Clinical: Services, Templates, Procedures
 * 4. Inventory: Pharmacy, Optical, Lab
 * 5. Data: Sample patients, appointments
 *
 * Usage: node scripts/seedCongo.js
 *        npm run seed
 */

const { execSync } = require('child_process');
const path = require('path');

async function seedAll() {
  const startTime = Date.now();

  try {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║       MEDFLOW CONGO - MASTER DATABASE SEEDING            ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // Scripts organized by dependency order
    const scripts = [
      // ============================================
      // PHASE 1: FOUNDATION (must run first)
      // ============================================
      { name: 'Clinics', file: 'seedClinics.js', phase: 1 },
      { name: 'Users', file: 'seedUsers.js', phase: 1 },
      { name: 'Role Permissions', file: 'seedRolePermissions.js', phase: 1 },

      // ============================================
      // PHASE 2: CONVENTIONS & BILLING
      // ============================================
      { name: 'Conventions (Companies)', file: 'seedConventions.js', phase: 2 },
      { name: 'Convention Rules', file: 'seedConventionRules.js', phase: 2 },
      { name: 'Complete Fee Schedule', file: 'seedCompleteFeeSchedule.js', phase: 2 },
      { name: 'Medication Fee Schedules', file: 'seedMedicationFeeSchedules.js', phase: 2 },
      { name: 'Fee Schedule Aliases', file: 'seedFeeScheduleAliases.js', phase: 2 },

      // ============================================
      // PHASE 3: CLINICAL SERVICES & TEMPLATES
      // ============================================
      { name: 'Clinical Procedures (French)', file: 'seedFrenchClinicalActs.js', phase: 3 },
      { name: 'Complete Services', file: 'seedCompleteServices.js', phase: 3 },
      { name: 'Consultation Templates', file: 'seedConsultationTemplates.js', phase: 3 },
      { name: 'Clinic Medications', file: 'seedAllClinicMedications.js', phase: 3 },
      { name: 'Clinic Equipment', file: 'seedAllClinicEquipment.js', phase: 3 },
      { name: 'Clinic Devices', file: 'seedClinicDevices.js', phase: 3 },
      { name: 'Treatment Protocols', file: 'seedTreatmentProtocolsComplete.js', phase: 3 },
      { name: 'Dose Templates', file: 'seedDoseTemplatesComplete.js', phase: 3 },

      // ============================================
      // PHASE 4: DOCUMENT & LETTER TEMPLATES
      // ============================================
      { name: 'Document Templates', file: 'seedDocumentTemplates.js', phase: 4 },
      { name: 'Letter Templates', file: 'seedLetterTemplates.js', phase: 4 },
      { name: 'Comment Templates', file: 'seedCommentTemplates.js', phase: 4 },
      { name: 'All Templates (Medication/Exam/Lab/Clinical/Pathology)', file: 'seedTemplates.js', phase: 4 },

      // ============================================
      // PHASE 5: INVENTORY
      // ============================================
      { name: 'Pharmacy Inventory', file: 'seedPharmacyInventory.js', phase: 5 },
      { name: 'Frame Inventory', file: 'seedFrameInventory.js', phase: 5 },
      { name: 'Depot Frames', file: 'seedDepotFrames.js', phase: 5 },
      { name: 'Contact Lens Inventory', file: 'seedContactLensInventory.js', phase: 5 },
      { name: 'Optical Lens Inventory', file: 'seedOpticalLensInventory.js', phase: 5 },
      { name: 'Reagent Inventory', file: 'seedReagentInventory.js', phase: 5 },
      { name: 'Lab Consumable Inventory', file: 'seedLabConsumableInventory.js', phase: 5 },

      // ============================================
      // PHASE 6: IMAGING & ADDITIONAL DATA
      // ============================================
      { name: 'Imaging Data', file: 'seedImagingData.js', phase: 6 },
      { name: 'Additional Services', file: 'seedAdditionalServices.js', phase: 6 },

      // ============================================
      // PHASE 7: REAL PATIENT DATA (must run last)
      // ============================================
      { name: 'Import LV Patients (~38,929 patients)', file: 'importPatientsWithPapa.js', phase: 7 }
    ];

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    const results = [];
    let currentPhase = 0;

    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];

      // Print phase header
      if (script.phase !== currentPhase) {
        currentPhase = script.phase;
        const phaseNames = {
          1: 'FOUNDATION',
          2: 'CONVENTIONS & BILLING',
          3: 'CLINICAL SERVICES & TEMPLATES',
          4: 'DOCUMENT TEMPLATES',
          5: 'INVENTORY',
          6: 'IMAGING & ADDITIONAL',
          7: 'SAMPLE DATA'
        };
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`PHASE ${currentPhase}: ${phaseNames[currentPhase]}`);
        console.log(`${'═'.repeat(60)}`);
      }

      console.log(`\n[${i + 1}/${scripts.length}] Seeding ${script.name}...`);
      console.log('-'.repeat(50));

      const scriptPath = path.join(__dirname, script.file);

      try {
        // Check if file exists
        const fs = require('fs');
        if (!fs.existsSync(scriptPath)) {
          console.log(`⚠️  Script not found: ${script.file}`);
          skippedCount++;
          results.push({ name: script.name, status: 'skipped', reason: 'file not found' });
          continue;
        }

        execSync(`node ${scriptPath}`, {
          stdio: 'inherit',
          cwd: process.cwd(),
          timeout: 300000 // 5 minute timeout per script
        });
        console.log(`✅ ${script.name} seeded successfully`);
        successCount++;
        results.push({ name: script.name, status: 'success' });
      } catch (error) {
        console.error(`❌ Failed to seed ${script.name}: ${error.message}`);
        failCount++;
        results.push({ name: script.name, status: 'failed', error: error.message });
        // Continue with other seeds even if one fails
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                    SEEDING SUMMARY                        ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`\n  ✅ Successful: ${successCount}`);
    console.log(`  ❌ Failed:     ${failCount}`);
    console.log(`  ⚠️  Skipped:    ${skippedCount}`);
    console.log(`  ⏱️  Duration:   ${duration}s`);
    console.log(`  📊 Total:      ${scripts.length} scripts\n`);

    if (failCount > 0) {
      console.log('Failed scripts:');
      results.filter(r => r.status === 'failed').forEach(r => {
        console.log(`  - ${r.name}`);
      });
      console.log('');
    }

    console.log('═'.repeat(60));
    if (failCount === 0) {
      console.log('✅ All Congo-specific data seeding completed successfully!');
    } else {
      console.log(`⚠️  Seeding completed with ${failCount} error(s).`);
    }
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('❌ Master seeding failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedAll();
}

module.exports = seedAll;
