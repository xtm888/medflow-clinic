/**
 * Add short-code aliases for fee schedules to match consultation template codes
 * Run with: node scripts/seedFeeScheduleAliases.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

// Short-code aliases matching what's used in consultation templates and UI
const aliases = [
  // Imaging & Functional Tests
  { code: 'OCT', name: 'OCT Macula/Nerf Optique', category: 'Imaging', price: 25000 },
  { code: 'CV', name: 'Champ Visuel (Humphrey)', category: 'Functional', price: 15000 },
  { code: 'ANGIO', name: 'Angiographie à la fluorescéine', category: 'Imaging', price: 50000 },
  { code: 'PACHY', name: 'Pachymétrie', category: 'Functional', price: 8000 },
  { code: 'ERG', name: 'Électrorétinogramme (ERG)', category: 'Functional', price: 30000 },
  { code: 'PHOTO', name: 'Rétinographie', category: 'Imaging', price: 12000 },
  { code: 'TOPO', name: 'Topographie cornéenne', category: 'Imaging', price: 20000 },
  { code: 'ECHO', name: 'Échographie oculaire (B-Scan)', category: 'Imaging', price: 18000 },
  { code: 'UBM', name: 'UBM (Biomicroscopie ultrasonore)', category: 'Imaging', price: 35000 },
  { code: 'BIOM', name: 'Biométrie IOL', category: 'Functional', price: 15000 },
  { code: 'GONIO', name: 'Gonioscopie', category: 'Functional', price: 5000 },
  { code: 'PEV', name: 'Potentiels évoqués visuels', category: 'Functional', price: 25000 },

  // Laboratory Tests
  { code: 'NFS', name: 'NFS (Hémogramme)', category: 'Laboratory', price: 5000 },
  { code: 'HBA1C', name: 'HbA1c', category: 'Laboratory', price: 8000 },
  { code: 'GLYCEMIE', name: 'Glycémie à jeun', category: 'Laboratory', price: 3000 },
  { code: 'VS_CRP', name: 'VS + CRP', category: 'Laboratory', price: 6000 },
  { code: 'BILAN_INF', name: 'Bilan inflammatoire (VS, CRP, Fibrinogène)', category: 'Laboratory', price: 10000 },
  { code: 'ECA', name: 'ECA (Enzyme de conversion)', category: 'Laboratory', price: 12000 },
  { code: 'AAN', name: 'Anticorps anti-nucléaires (AAN)', category: 'Laboratory', price: 15000 },
  { code: 'HLAB27', name: 'HLA-B27', category: 'Laboratory', price: 25000 },
  { code: 'ANCA', name: 'ANCA', category: 'Laboratory', price: 20000 },
  { code: 'TOXO', name: 'Sérologie toxoplasmose', category: 'Laboratory', price: 10000 },
  { code: 'VIH', name: 'Sérologie VIH', category: 'Laboratory', price: 8000 },
  { code: 'SYPHILIS', name: 'Sérologie syphilis (TPHA/VDRL)', category: 'Laboratory', price: 8000 },
  { code: 'HSV', name: 'Sérologie herpès (HSV1/HSV2)', category: 'Laboratory', price: 12000 },
  { code: 'CMV', name: 'Sérologie CMV', category: 'Laboratory', price: 12000 },
  { code: 'TOXOCARA', name: 'Sérologie toxocarose', category: 'Laboratory', price: 15000 },

  // Consultations
  { code: 'CONSULT', name: 'Consultation générale', category: 'Consultation', price: 10000 },
  { code: 'CONSULT_SPEC', name: 'Consultation spécialisée', category: 'Consultation', price: 15000 },
  { code: 'CONSULT_URGENCE', name: 'Consultation urgence', category: 'Consultation', price: 20000 },
  { code: 'CONTROLE', name: 'Contrôle post-opératoire', category: 'Consultation', price: 5000 },

  // Procedures
  { code: 'IVT', name: 'Injection intravitréenne', category: 'Procedure', price: 75000 },
  { code: 'LASER_PAN', name: 'Panphotocoagulation laser', category: 'Procedure', price: 100000 },
  { code: 'LASER_FOCAL', name: 'Laser focal', category: 'Procedure', price: 75000 },
  { code: 'YAG_CAPS', name: 'YAG capsulotomie', category: 'Procedure', price: 50000 },
  { code: 'YAG_IRIDO', name: 'YAG iridotomie', category: 'Procedure', price: 50000 },
  { code: 'PARACENTESE', name: 'Ponction de chambre antérieure', category: 'Procedure', price: 30000 },
  { code: 'CHALAZION', name: 'Incision chalazion', category: 'Procedure', price: 25000 },
  { code: 'CORPS_ETRANGER', name: 'Ablation corps étranger cornéen', category: 'Procedure', price: 20000 }
];

async function seedAliases() {
  try {
    console.log('=== SEEDING FEE SCHEDULE SHORT-CODE ALIASES ===\n');

    await mongoose.connect(MONGODB_URI);

    const FeeSchedule = require('../models/FeeSchedule');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const alias of aliases) {
      const existing = await FeeSchedule.findOne({ code: alias.code });

      if (existing) {
        if (existing.price !== alias.price || existing.category !== alias.category) {
          await FeeSchedule.updateOne(
            { code: alias.code },
            {
              $set: {
                ...alias,
                active: true,
                effectiveFrom: new Date(),
                effectiveTo: null,
                updatedAt: new Date()
              }
            }
          );
          console.log(`✅ Updated: ${alias.code} - ${alias.name} (${alias.price} CDF)`);
          updated++;
        } else {
          console.log(`⏭️  Skipped: ${alias.code} - Already exists`);
          skipped++;
        }
      } else {
        await FeeSchedule.create({
          ...alias,
          currency: 'CDF',
          department: alias.category === 'Laboratory' ? 'Laboratoire' : 'Ophtalmologie',
          displayCategory: alias.category,
          active: true,
          effectiveFrom: new Date(),
          effectiveTo: null
        });
        console.log(`✨ Created: ${alias.code} - ${alias.name} (${alias.price} CDF)`);
        created++;
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total aliases processed: ${aliases.length}`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);

    console.log('\n✅ All fee schedule aliases seeded successfully!');

    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

seedAliases();
