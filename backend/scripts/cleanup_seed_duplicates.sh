#!/bin/bash

# Script to clean up duplicate seed files
# This script organizes seed files into active and deprecated folders

echo "==================== SEED FILE CLEANUP ===================="
echo "Organizing seed files for Congo-specific application..."
echo ""

# Create deprecated folder
mkdir -p scripts/deprecated

echo "Moving deprecated/duplicate seed files..."

# Move old/incomplete versions to deprecated
echo "  - Moving seedDoseTemplates.js (keeping Complete version)..."
mv scripts/seedDoseTemplates.js scripts/deprecated/ 2>/dev/null

echo "  - Moving seedTreatmentProtocols.js (keeping Complete version)..."
mv scripts/seedTreatmentProtocols.js scripts/deprecated/ 2>/dev/null

echo "  - Moving seedMedications.js (keeping AllClinicMedications version)..."
mv scripts/seedMedications.js scripts/deprecated/ 2>/dev/null

echo "  - Moving seed.js (contains Moroccan data)..."
mv scripts/seed.js scripts/deprecated/seed_morocco.js 2>/dev/null

echo ""
echo "Creating main Congo seed script..."

# Create a new main seed script for Congo
cat > scripts/seedCongo.js << 'EOF'
const mongoose = require('mongoose');
require('dotenv').config();

async function seedAll() {
  try {
    console.log('Starting Congo-specific database seeding...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');

    // Run all Congo-specific seeds in order
    console.log('\n1. Seeding Congo patient data...');
    await require('./seedCongoData')();

    console.log('\n2. Seeding clinic medications...');
    await require('./seedAllClinicMedications')();

    console.log('\n3. Seeding clinic equipment...');
    await require('./seedAllClinicEquipment')();

    console.log('\n4. Seeding pharmacy inventory...');
    await require('./seedPharmacyInventory')();

    console.log('\n5. Seeding clinical procedures (French)...');
    await require('./seedFrenchClinicalActs')();

    console.log('\n6. Seeding document templates...');
    await require('./seedDocumentTemplates')();

    console.log('\n7. Seeding letter templates...');
    await require('./seedLetterTemplates')();

    console.log('\n8. Seeding dose templates...');
    await require('./seedDoseTemplatesComplete')();

    console.log('\n9. Seeding treatment protocols...');
    await require('./seedTreatmentProtocolsComplete')();

    console.log('\n10. Seeding comment templates...');
    await require('./seedCommentTemplates')();

    console.log('\n✅ All Congo-specific data seeded successfully!');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

if (require.main === module) {
  seedAll();
}

module.exports = seedAll;
EOF

echo "Updating package.json to use Congo seed..."
# Update package.json to use the Congo seed
sed -i.bak 's/"seed": "node scripts\/seed.js"/"seed": "node scripts\/seedCongo.js"/' package.json

echo ""
echo "==================== CLEANUP SUMMARY ===================="
echo ""
echo "KEPT (Active Congo-specific seeds):"
echo "  ✓ seedCongoData.js - Congo patient data"
echo "  ✓ seedAllClinicMedications.js - Complete medication list"
echo "  ✓ seedAllClinicEquipment.js - Clinic equipment"
echo "  ✓ seedPharmacyInventory.js - Pharmacy stock"
echo "  ✓ seedFrenchClinicalActs.js - French clinical procedures"
echo "  ✓ seedFrenchDrugs.js - French drug database"
echo "  ✓ seedDoseTemplatesComplete.js - Complete dose templates"
echo "  ✓ seedTreatmentProtocolsComplete.js - Complete protocols"
echo "  ✓ seedDocumentTemplates.js - Document templates"
echo "  ✓ seedLetterTemplates.js - Letter templates"
echo "  ✓ seedCommentTemplates.js - Comment templates"
echo ""
echo "DEPRECATED (Moved to scripts/deprecated/):"
echo "  ✗ seed.js → seed_morocco.js (contained Moroccan data)"
echo "  ✗ seedDoseTemplates.js (incomplete - 5 vs 13 items)"
echo "  ✗ seedTreatmentProtocols.js (incomplete - 0 vs 15 items)"
echo "  ✗ seedMedications.js (replaced by AllClinicMedications)"
echo ""
echo "NEW:"
echo "  ✓ seedCongo.js - Main seed orchestrator for Congo"
echo ""
echo "USAGE:"
echo "  npm run seed  - Runs Congo-specific seeding"
echo ""
echo "==================== CLEANUP COMPLETE ===================="