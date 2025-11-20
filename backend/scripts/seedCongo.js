const { execSync } = require('child_process');
const path = require('path');

async function seedAll() {
  try {
    console.log('Starting Congo-specific database seeding...');

    const scripts = [
      { name: 'Congo patient data', file: 'seedCongoData.js' },
      { name: 'clinic medications', file: 'seedAllClinicMedications.js' },
      { name: 'clinic equipment', file: 'seedAllClinicEquipment.js' },
      { name: 'pharmacy inventory', file: 'seedPharmacyInventory.js' },
      { name: 'clinical procedures (French)', file: 'seedFrenchClinicalActs.js' },
      { name: 'document templates', file: 'seedDocumentTemplates.js' },
      { name: 'letter templates', file: 'seedLetterTemplates.js' },
      { name: 'dose templates', file: 'seedDoseTemplatesComplete.js' },
      { name: 'treatment protocols', file: 'seedTreatmentProtocolsComplete.js' },
      { name: 'comment templates', file: 'seedCommentTemplates.js' },
      { name: 'all templates', file: 'seedTemplates.js' }
    ];

    for (let i = 0; i < scripts.length; i++) {
      const script = scripts[i];
      console.log(`\n${i + 1}. Seeding ${script.name}...`);
      console.log('='.repeat(60));
      try {
        execSync(`node ${path.join(__dirname, script.file)}`, {
          stdio: 'inherit',
          cwd: process.cwd()
        });
        console.log(`✓ ${script.name} seeded successfully`);
      } catch (error) {
        console.error(`❌ Failed to seed ${script.name}: ${error.message}`);
        // Continue with other seeds even if one fails
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All Congo-specific data seeding completed!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedAll();
}

module.exports = seedAll;