/**
 * Seed additional services: IVT procedures, additional exams, etc.
 * Complements seedCompleteServices.js with procedures and exams not yet in FeeSchedule
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

const additionalServices = [
  // ========================================
  // IVT (INTRAVITREAL INJECTION) PROCEDURES
  // ========================================
  {
    code: 'PROC-IVT',
    name: 'Injection intravitréenne (générique)',
    category: 'procedure',
    displayCategory: 'Procédure',
    department: 'Ophtalmologie',
    price: 50000,
    currency: 'CDF',
    description: 'Injection intravitréenne générique',
    duration: 30
  },
  {
    code: 'PROC-IVT-LUCENTIS',
    name: 'IVT Lucentis (Ranibizumab)',
    category: 'procedure',
    displayCategory: 'Procédure',
    department: 'Ophtalmologie',
    price: 150000,
    currency: 'CDF',
    description: 'Injection intravitréenne de Lucentis pour DMLA, OMD, etc.',
    duration: 30
  },
  {
    code: 'PROC-IVT-EYLEA',
    name: 'IVT Eylea (Aflibercept)',
    category: 'procedure',
    displayCategory: 'Procédure',
    department: 'Ophtalmologie',
    price: 180000,
    currency: 'CDF',
    description: 'Injection intravitréenne d\'Eylea pour DMLA, OMD, etc.',
    duration: 30
  },
  {
    code: 'PROC-IVT-AVASTIN',
    name: 'IVT Avastin (Bevacizumab)',
    category: 'procedure',
    displayCategory: 'Procédure',
    department: 'Ophtalmologie',
    price: 80000,
    currency: 'CDF',
    description: 'Injection intravitréenne d\'Avastin pour DMLA, OMD, etc.',
    duration: 30
  },

  // ========================================
  // ADDITIONAL OPHTHALMIC EXAMINATIONS
  // ========================================
  {
    code: 'EXAM-AUTOREFRACTION',
    name: 'Autoréfractométrie',
    category: 'examination',
    displayCategory: 'Examen',
    department: 'Ophtalmologie',
    price: 3000,
    currency: 'CDF',
    description: 'Mesure automatique de la réfraction',
    duration: 10
  },
  {
    code: 'EXAM-KERATOMETRY',
    name: 'Kératométrie',
    category: 'examination',
    displayCategory: 'Examen',
    department: 'Ophtalmologie',
    price: 2500,
    currency: 'CDF',
    description: 'Mesure de la courbure cornéenne',
    duration: 10
  },
  {
    code: 'EXAM-TONOMETRY',
    name: 'Tonométrie',
    category: 'examination',
    displayCategory: 'Examen',
    department: 'Ophtalmologie',
    price: 5000,
    currency: 'CDF',
    description: 'Mesure de la pression intraoculaire',
    duration: 10
  },
  {
    code: 'EXAM-GONIOSCOPY',
    name: 'Gonioscopie',
    category: 'examination',
    displayCategory: 'Examen',
    department: 'Ophtalmologie',
    price: 10000,
    currency: 'CDF',
    description: 'Examen de l\'angle iridocornéen',
    duration: 15
  },
  {
    code: 'EXAM-ULTRASOUND-ASCAN',
    name: 'Échographie oculaire (A-Scan)',
    category: 'imaging',
    displayCategory: 'Imagerie',
    department: 'Ophtalmologie',
    price: 15000,
    currency: 'CDF',
    description: 'Échographie A-scan pour biométrie',
    duration: 15
  },
  {
    code: 'EXAM-ENDOTHELIAL-COUNT',
    name: 'Comptage endothélial cornéen',
    category: 'examination',
    displayCategory: 'Examen',
    department: 'Ophtalmologie',
    price: 18000,
    currency: 'CDF',
    description: 'Mesure de la densité endothéliale cornéenne',
    duration: 15
  },

  // ========================================
  // SURGICAL PROCEDURES
  // ========================================
  {
    code: 'SURG-CATARACT',
    name: 'Chirurgie de la cataracte (Phaco + IOL)',
    category: 'surgery',
    displayCategory: 'Procédure',
    department: 'Ophtalmologie',
    price: 500000,
    currency: 'CDF',
    description: 'Phacoémulsification avec implant intraoculaire',
    duration: 60
  },
  {
    code: 'SURG-YAG-CAPSULOTOMY',
    name: 'YAG Laser - Capsulotomie',
    category: 'procedure',
    displayCategory: 'Procédure',
    department: 'Ophtalmologie',
    price: 80000,
    currency: 'CDF',
    description: 'Capsulotomie au laser YAG pour cataracte secondaire',
    duration: 20
  },
  {
    code: 'SURG-YAG-IRIDOTOMY',
    name: 'YAG Laser - Iridotomie',
    category: 'procedure',
    displayCategory: 'Procédure',
    department: 'Ophtalmologie',
    price: 75000,
    currency: 'CDF',
    description: 'Iridotomie au laser YAG pour glaucome à angle fermé',
    duration: 20
  },
  {
    code: 'SURG-SLT',
    name: 'SLT (Trabéculoplastie sélective au laser)',
    category: 'procedure',
    displayCategory: 'Procédure',
    department: 'Ophtalmologie',
    price: 120000,
    currency: 'CDF',
    description: 'Trabéculoplastie sélective au laser pour glaucome',
    duration: 30
  },
  {
    code: 'SURG-ARGON-LASER',
    name: 'Photocoagulation au laser Argon',
    category: 'procedure',
    displayCategory: 'Procédure',
    department: 'Ophtalmologie',
    price: 100000,
    currency: 'CDF',
    description: 'Photocoagulation rétinienne au laser Argon',
    duration: 45
  }
];

async function seedAdditionalServices() {
  try {
    console.log('=== SEEDING ADDITIONAL SERVICES ===\n');

    await mongoose.connect(MONGODB_URI);

    const FeeSchedule = require('../models/FeeSchedule');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const service of additionalServices) {
      // Check if already exists
      const existing = await FeeSchedule.findOne({ code: service.code });

      if (existing) {
        // Update if price or category changed
        if (existing.price !== service.price || existing.displayCategory !== service.displayCategory) {
          await FeeSchedule.updateOne(
            { code: service.code },
            {
              $set: {
                ...service,
                active: true,
                effectiveFrom: new Date(),
                effectiveTo: null
              }
            }
          );
          console.log(`✅ Updated: ${service.code} - ${service.name} (${service.price} ${service.currency})`);
          updated++;
        } else {
          console.log(`⏭️  Skipped: ${service.code} - Already exists with same price`);
          skipped++;
        }
      } else {
        // Create new
        await FeeSchedule.create({
          ...service,
          active: true,
          effectiveFrom: new Date(),
          effectiveTo: null
        });
        console.log(`✨ Created: ${service.code} - ${service.name} (${service.price} ${service.currency})`);
        created++;
      }
    }

    console.log('\n=== SUMMARY ===');
    console.log(`Total services processed: ${additionalServices.length}`);
    console.log(`Created: ${created}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);

    // Show breakdown by category
    console.log('\n=== BY CATEGORY ===');
    const breakdown = await FeeSchedule.aggregate([
      { $match: { active: true } },
      {
        $group: {
          _id: '$displayCategory',
          count: { $sum: 1 },
          totalValue: { $sum: '$price' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    breakdown.forEach(cat => {
      console.log(`${cat._id}: ${cat.count} services`);
    });

    console.log('\n✅ All additional services seeded successfully!');

    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

seedAdditionalServices();
