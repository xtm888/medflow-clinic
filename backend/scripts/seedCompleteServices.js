/**
 * Seed all ophthalmology exams, lab tests, and procedures with prices
 * These will appear in Services page and be used for billing
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';

const services = [
  // ========================================
  // EXAMENS OPHTALMOLOGIQUES (Imaging)
  // ========================================
  {
    code: 'EXAM-OCT-MACULA',
    name: 'OCT Macula/Nerf Optique',
    category: 'imaging',
    displayCategory: 'Imagerie',
    department: 'Ophtalmologie',
    price: 25000,
    currency: 'CDF',
    description: 'Tomographie par cohérence optique de la macula et du nerf optique',
    duration: 20
  },
  {
    code: 'EXAM-VISUAL-FIELD-HUMPHREY',
    name: 'Champ Visuel (Humphrey)',
    category: 'examination',
    displayCategory: 'Examen',
    department: 'Ophtalmologie',
    price: 15000,
    currency: 'CDF',
    description: 'Test du champ visuel automatisé Humphrey',
    duration: 30
  },
  {
    code: 'EXAM-ANGIOGRAPHY',
    name: 'Angiographie à la fluorescéine',
    category: 'imaging',
    displayCategory: 'Imagerie',
    department: 'Ophtalmologie',
    price: 50000,
    currency: 'CDF',
    description: 'Angiographie rétinienne à la fluorescéine',
    duration: 45
  },
  {
    code: 'EXAM-CORNEAL-TOPOGRAPHY',
    name: 'Topographie cornéenne',
    category: 'imaging',
    displayCategory: 'Imagerie',
    department: 'Ophtalmologie',
    price: 20000,
    currency: 'CDF',
    description: 'Cartographie de la surface cornéenne',
    duration: 15
  },
  {
    code: 'EXAM-PACHYMETRY',
    name: 'Pachymétrie',
    category: 'examination',
    displayCategory: 'Examen',
    department: 'Ophtalmologie',
    price: 8000,
    currency: 'CDF',
    description: 'Mesure de l\'épaisseur cornéenne',
    duration: 10
  },
  {
    code: 'EXAM-ULTRASOUND-BSCAN',
    name: 'Échographie oculaire (B-Scan)',
    category: 'imaging',
    displayCategory: 'Imagerie',
    department: 'Ophtalmologie',
    price: 18000,
    currency: 'CDF',
    description: 'Échographie B-scan de l\'œil',
    duration: 20
  },
  {
    code: 'EXAM-ERG',
    name: 'Électrorétinogramme (ERG)',
    category: 'examination',
    displayCategory: 'Examen',
    department: 'Ophtalmologie',
    price: 30000,
    currency: 'CDF',
    description: 'Électrorétinogramme - test de la fonction rétinienne',
    duration: 45
  },
  {
    code: 'EXAM-IOL-BIOMETRY',
    name: 'Biométrie IOL',
    category: 'examination',
    displayCategory: 'Examen',
    department: 'Ophtalmologie',
    price: 15000,
    currency: 'CDF',
    description: 'Biométrie pour calcul d\'implant intraoculaire',
    duration: 20
  },
  {
    code: 'EXAM-RETINOGRAPHY',
    name: 'Rétinographie',
    category: 'imaging',
    displayCategory: 'Imagerie',
    department: 'Ophtalmologie',
    price: 12000,
    currency: 'CDF',
    description: 'Photographie du fond d\'œil',
    duration: 15
  },
  {
    code: 'EXAM-UBM',
    name: 'UBM (Biomicroscopie ultrasonore)',
    category: 'imaging',
    displayCategory: 'Imagerie',
    department: 'Ophtalmologie',
    price: 35000,
    currency: 'CDF',
    description: 'Biomicroscopie ultrasonore du segment antérieur',
    duration: 30
  },

  // ========================================
  // ANALYSES DE LABORATOIRE
  // ========================================
  {
    code: 'LAB-HBA1C',
    name: 'HbA1c (Hémoglobine glyquée)',
    category: 'laboratory',
    displayCategory: 'Laboratoire',
    department: 'Laboratoire',
    price: 8000,
    currency: 'CDF',
    description: 'Dosage de l\'hémoglobine glyquée pour suivi diabète',
    duration: 15
  },
  {
    code: 'LAB-GLUCOSE-FASTING',
    name: 'Glycémie à jeun',
    category: 'laboratory',
    displayCategory: 'Laboratoire',
    department: 'Laboratoire',
    price: 3000,
    currency: 'CDF',
    description: 'Dosage de la glycémie à jeun',
    duration: 15
  },
  {
    code: 'LAB-CBC',
    name: 'NFS (Numération Formule Sanguine)',
    category: 'laboratory',
    displayCategory: 'Laboratoire',
    department: 'Laboratoire',
    price: 5000,
    currency: 'CDF',
    description: 'Hémogramme complet',
    duration: 30
  },
  {
    code: 'LAB-ESR-CRP',
    name: 'VS + CRP',
    category: 'laboratory',
    displayCategory: 'Laboratoire',
    department: 'Laboratoire',
    price: 6000,
    currency: 'CDF',
    description: 'Vitesse de sédimentation et protéine C réactive',
    duration: 30
  },
  {
    code: 'LAB-INFLAMMATION-PANEL',
    name: 'Bilan inflammatoire complet',
    category: 'laboratory',
    displayCategory: 'Laboratoire',
    department: 'Laboratoire',
    price: 10000,
    currency: 'CDF',
    description: 'VS, CRP, Fibrinogène',
    duration: 45
  },
  {
    code: 'LAB-ACE',
    name: 'ECA (Enzyme de conversion de l\'angiotensine)',
    category: 'laboratory',
    displayCategory: 'Laboratoire',
    department: 'Laboratoire',
    price: 12000,
    currency: 'CDF',
    description: 'Dosage ECA pour dépistage sarcoïdose',
    duration: 30
  },
  {
    code: 'LAB-ANA',
    name: 'Anticorps anti-nucléaires (AAN)',
    category: 'laboratory',
    displayCategory: 'Laboratoire',
    department: 'Laboratoire',
    price: 15000,
    currency: 'CDF',
    description: 'Recherche d\'anticorps anti-nucléaires',
    duration: 45
  },
  {
    code: 'LAB-HLA-B27',
    name: 'HLA-B27',
    category: 'laboratory',
    displayCategory: 'Laboratoire',
    department: 'Laboratoire',
    price: 25000,
    currency: 'CDF',
    description: 'Typage HLA-B27 pour pathologies auto-immunes',
    duration: 60
  },
  {
    code: 'LAB-ANCA',
    name: 'ANCA (Anticorps anti-cytoplasme des polynucléaires)',
    category: 'laboratory',
    displayCategory: 'Laboratoire',
    department: 'Laboratoire',
    price: 20000,
    currency: 'CDF',
    description: 'Recherche ANCA pour vascularites',
    duration: 60
  },
  {
    code: 'LAB-TOXOPLASMOSIS',
    name: 'Sérologie toxoplasmose',
    category: 'laboratory',
    displayCategory: 'Laboratoire',
    department: 'Laboratoire',
    price: 10000,
    currency: 'CDF',
    description: 'Sérologie toxoplasmose (IgG, IgM)',
    duration: 45
  },

  // ========================================
  // PRESCRIPTIONS DE LUNETTES (OPTICAL)
  // ========================================
  {
    code: 'GLASSES-SINGLE-VISION',
    name: 'Lunettes unifocales',
    category: 'optical',
    displayCategory: 'Optique',
    department: 'Ophtalmologie',
    price: 50000,
    currency: 'CDF',
    description: 'Prescription et fourniture de lunettes unifocales',
    duration: 30
  },
  {
    code: 'GLASSES-BIFOCAL',
    name: 'Lunettes bifocales',
    category: 'optical',
    displayCategory: 'Optique',
    department: 'Ophtalmologie',
    price: 75000,
    currency: 'CDF',
    description: 'Prescription et fourniture de lunettes bifocales',
    duration: 30
  },
  {
    code: 'GLASSES-PROGRESSIVE',
    name: 'Lunettes progressives',
    category: 'optical',
    displayCategory: 'Optique',
    department: 'Ophtalmologie',
    price: 100000,
    currency: 'CDF',
    description: 'Prescription et fourniture de lunettes progressives',
    duration: 30
  },
  {
    code: 'GLASSES-CHILD',
    name: 'Lunettes enfant',
    category: 'optical',
    displayCategory: 'Optique',
    department: 'Ophtalmologie',
    price: 60000,
    currency: 'CDF',
    description: 'Prescription et fourniture de lunettes pour enfant',
    duration: 30
  }
];

async function seedServices() {
  try {
    console.log('=== SEEDING COMPLETE SERVICES ===\n');

    await mongoose.connect(MONGODB_URI);

    const FeeSchedule = require('../models/FeeSchedule');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const service of services) {
      // Check if already exists
      const existing = await FeeSchedule.findOne({ code: service.code });

      if (existing) {
        // Update if needed
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
    console.log(`Total services processed: ${services.length}`);
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
          totalPrice: { $sum: '$price' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    breakdown.forEach(cat => {
      console.log(`${cat._id}: ${cat.count} services, ${cat.totalPrice.toLocaleString()} CDF`);
    });

    console.log('\n✅ All services seeded successfully!');

    process.exit(0);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

seedServices();
