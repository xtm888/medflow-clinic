#!/usr/bin/env node
/**
 * Comprehensive Configuration Seeder
 * ===================================
 * Seeds all missing configuration data for complete system operation:
 * - Rooms (consultation, exam, surgery rooms per clinic)
 * - TaxConfigs (DRC tax rates)
 * - FiscalYears (current and next fiscal year)
 * - Referrers (internal and external referring doctors)
 * - UnitConversions (lab unit conversions SI ↔ conventional)
 * - SurgicalSupplyInventory (IOLs, viscoelastics, sutures, etc.)
 * - ExternalFacilities (partner hospitals/labs)
 * - ProviderAvailabilities (doctor schedules)
 * - ReagentLots (reagent batch tracking)
 */

const mongoose = require('mongoose');
const { ReagentInventory, SurgicalSupplyInventory } = require('../models/Inventory');
require('dotenv').config();

const Room = require('../models/Room');
const TaxConfig = require('../models/TaxConfig');
const FiscalYear = require('../models/FiscalYear');
const Referrer = require('../models/Referrer');
const UnitConversion = require('../models/UnitConversion');

const ExternalFacility = require('../models/ExternalFacility');
const ProviderAvailability = require('../models/ProviderAvailability');
const ReagentLot = require('../models/ReagentLot');
const Clinic = require('../models/Clinic');
const User = require('../models/User');

// ============================================================================
// ROOM DEFINITIONS
// ============================================================================
const ROOM_TEMPLATES = [
  // Consultation rooms
  { roomNumber: 'C01', name: 'Consultation Générale 1', type: 'consultation', department: 'general', floor: 0 },
  { roomNumber: 'C02', name: 'Consultation Générale 2', type: 'consultation', department: 'general', floor: 0 },
  { roomNumber: 'C03', name: 'Consultation Pédiatrique', type: 'consultation', department: 'pediatrics', floor: 0 },

  // Ophthalmology rooms
  { roomNumber: 'OPH01', name: 'Salle Ophtalmo 1', type: 'ophthalmology', department: 'ophthalmology', floor: 1,
    features: ['slit_lamp', 'autorefractor', 'tonometer'] },
  { roomNumber: 'OPH02', name: 'Salle Ophtalmo 2', type: 'ophthalmology', department: 'ophthalmology', floor: 1,
    features: ['slit_lamp', 'tonometer'] },
  { roomNumber: 'OPH03', name: 'Salle OCT/Imagerie', type: 'imaging', department: 'ophthalmology', floor: 1,
    features: ['oct', 'perimeter'] },
  { roomNumber: 'ORTH01', name: 'Salle Orthoptie', type: 'orthoptic', department: 'ophthalmology', floor: 1 },

  // Surgery rooms
  { roomNumber: 'BLOC01', name: 'Bloc Opératoire 1', type: 'surgery', department: 'ophthalmology', floor: 2,
    features: ['surgical_table', 'air_conditioning'] },
  { roomNumber: 'BLOC02', name: 'Bloc Opératoire 2', type: 'surgery', department: 'ophthalmology', floor: 2,
    features: ['surgical_table', 'air_conditioning'] },
  { roomNumber: 'LASER01', name: 'Salle Laser', type: 'procedure', department: 'ophthalmology', floor: 2,
    features: ['exam_chair', 'private'] },

  // Laboratory
  { roomNumber: 'LAB01', name: 'Laboratoire Principal', type: 'laboratory', department: 'laboratory', floor: 0 },
  { roomNumber: 'PRÉLÈV', name: 'Salle de Prélèvement', type: 'procedure', department: 'laboratory', floor: 0 },

  // Examination rooms
  { roomNumber: 'EXAM01', name: 'Salle d\'Examen 1', type: 'examination', department: 'general', floor: 0,
    features: ['exam_chair', 'monitor'] },
  { roomNumber: 'EXAM02', name: 'Salle d\'Examen 2', type: 'examination', department: 'general', floor: 0 },

  // Waiting areas
  { roomNumber: 'ATT01', name: 'Salle d\'Attente RDC', type: 'waiting', department: 'general', floor: 0, capacity: 30 },
  { roomNumber: 'ATT02', name: 'Salle d\'Attente Étage', type: 'waiting', department: 'ophthalmology', floor: 1, capacity: 20 },

  // Other
  { roomNumber: 'ACCUEIL', name: 'Réception', type: 'reception', department: 'general', floor: 0 },
  { roomNumber: 'TRIAGE', name: 'Triage/Urgences', type: 'triage', department: 'emergency', floor: 0 },
  { roomNumber: 'PHARM', name: 'Pharmacie', type: 'pharmacy', department: 'general', floor: 0 },
];

// ============================================================================
// TAX CONFIGURATIONS (DRC)
// ============================================================================
const TAX_CONFIGS = [
  {
    name: 'TVA Standard',
    code: 'TVA16',
    description: 'Taxe sur la Valeur Ajoutée - Taux standard RDC',
    rate: 16,
    type: 'percentage',
    applicableTo: ['all'],
    region: 'national',
    active: true
  },
  {
    name: 'Exonération Services Médicaux',
    code: 'EXOMED',
    description: 'Exonération TVA pour actes médicaux (Art. 14 Code TVA RDC)',
    rate: 0,
    type: 'percentage',
    applicableTo: ['consultation', 'procedure', 'surgery', 'imaging', 'laboratory'],
    exemptions: [
      { category: 'medical_services', reason: 'Actes médicaux exonérés de TVA' }
    ],
    region: 'national',
    active: true
  },
  {
    name: 'TVA Médicaments',
    code: 'TVAMED',
    description: 'TVA réduite sur médicaments essentiels',
    rate: 0,
    type: 'percentage',
    applicableTo: ['medication'],
    exemptions: [
      { category: 'essential_medicines', reason: 'Médicaments essentiels exonérés' }
    ],
    region: 'national',
    active: true
  },
  {
    name: 'TVA Équipements Optiques',
    code: 'TVAOPT',
    description: 'TVA sur montures et verres optiques',
    rate: 16,
    type: 'percentage',
    applicableTo: ['device'],
    region: 'national',
    active: true
  }
];

// ============================================================================
// REFERRERS (Médecins référents)
// ============================================================================
const REFERRERS = [
  // External referrers
  { name: 'KABONGO Jean-Pierre', type: 'external', specialty: 'Médecine Générale',
    clinic: 'Clinique Ngaliema', phone: '+243812345678', defaultCommissionRate: 10 },
  { name: 'MBUYI Marie', type: 'external', specialty: 'Pédiatrie',
    clinic: 'Centre Médical Kintambo', phone: '+243823456789', defaultCommissionRate: 10 },
  { name: 'LUKUSA Patrick', type: 'external', specialty: 'Cardiologie',
    clinic: 'Hôpital Général de Kinshasa', phone: '+243834567890', defaultCommissionRate: 8 },
  { name: 'NKONGOLO Sophie', type: 'external', specialty: 'Endocrinologie',
    clinic: 'Centre Hospitalier Monkole', phone: '+243845678901', defaultCommissionRate: 10 },
  { name: 'MUKENDI Paul', type: 'external', specialty: 'Neurologie',
    clinic: 'Cliniques Universitaires', phone: '+243856789012', defaultCommissionRate: 8 },
  { name: 'KALALA Véronique', type: 'external', specialty: 'Médecine Interne',
    clinic: 'Centre Médical Lingwala', phone: '+243867890123', defaultCommissionRate: 10 },
  { name: 'TSHIMANGA Albert', type: 'external', specialty: 'Urgentiste',
    clinic: 'Urgences Médicales Kinshasa', phone: '+243878901234', defaultCommissionRate: 5 },
  { name: 'MBOMBO Christine', type: 'external', specialty: 'Gynécologie',
    clinic: 'Maternité Bomoi', phone: '+243889012345', defaultCommissionRate: 10 },
];

// ============================================================================
// EXTERNAL FACILITIES
// ============================================================================
const EXTERNAL_FACILITIES = [
  {
    name: 'Hôpital Général de Référence de Kinshasa',
    shortName: 'HGR Kinshasa',
    type: 'hospital',
    contact: {
      address: { city: 'Kinshasa', state: 'Kinshasa', country: 'RDC' },
      phone: '+243815000001',
      email: 'hgr.kinshasa@health.cd'
    },
    isActive: true
  },
  {
    name: 'Centre Hospitalier Monkole',
    shortName: 'Monkole',
    type: 'hospital',
    contact: {
      address: { city: 'Kinshasa', state: 'Kinshasa', country: 'RDC' },
      phone: '+243815000002',
      email: 'contact@monkole.cd'
    },
    isActive: true
  },
  {
    name: 'Laboratoire Central de Kinshasa',
    shortName: 'LCK',
    type: 'laboratory',
    contact: {
      address: { city: 'Kinshasa', state: 'Kinshasa', country: 'RDC' },
      phone: '+243815000003'
    },
    isActive: true
  },
  {
    name: 'Centre d\'Imagerie Médicale Kinshasa',
    shortName: 'CIMK',
    type: 'imaging-center',
    contact: {
      address: { city: 'Kinshasa', state: 'Kinshasa', country: 'RDC' },
      phone: '+243815000004'
    },
    isActive: true
  },
  {
    name: 'Pharmacie Centrale de Kinshasa',
    shortName: 'PCK',
    type: 'pharmacy',
    contact: {
      address: { city: 'Kinshasa', state: 'Kinshasa', country: 'RDC' },
      phone: '+243815000005'
    },
    isActive: true
  }
];

// ============================================================================
// SURGICAL SUPPLIES (IOLs, Viscoelastics, Sutures, etc.)
// ============================================================================
const SURGICAL_SUPPLIES = [
  // ================================
  // INTRAOCULAR LENSES (IOLs)
  // ================================
  // Monofocal IOLs
  {
    sku: 'IOL-ALCON-SA60AT',
    category: 'iol',
    brand: 'Alcon',
    productName: 'AcrySof IQ',
    model: 'SA60AT',
    manufacturer: 'Alcon Laboratories',
    iol: {
      type: 'monofocal',
      material: 'hydrophobic-acrylic',
      design: '1-piece',
      optic: { diameter: 6.0, type: 'aspheric' },
      haptic: { design: 'C-loop', angulation: 0 },
      aConstant: 118.7,
      powerRange: { min: 6, max: 30, step: 0.5 },
      incisionSize: 2.2,
      uvBlocking: true,
      blueBlocking: true
    },
    specifications: { sterile: true, singleUse: true, latexFree: true },
    regulatory: { ceMarking: true, fdaApproved: true, classificationClass: 'III' },
    pricing: { costPrice: 150000, sellingPrice: 350000, currency: 'CDF' },
    inventory: { currentStock: 50, minimumStock: 10, reorderPoint: 15, unit: 'units' }
  },
  {
    sku: 'IOL-ZEISS-CT-LUCIA',
    category: 'iol',
    brand: 'Zeiss',
    productName: 'CT Lucia',
    model: '211P',
    manufacturer: 'Carl Zeiss Meditec',
    iol: {
      type: 'monofocal',
      material: 'hydrophilic-acrylic',
      design: '1-piece',
      optic: { diameter: 6.0, type: 'aspheric' },
      aConstant: 118.0,
      powerRange: { min: 0, max: 32, step: 0.5 },
      incisionSize: 2.2,
      uvBlocking: true
    },
    specifications: { sterile: true, singleUse: true },
    pricing: { costPrice: 120000, sellingPrice: 280000, currency: 'CDF' },
    inventory: { currentStock: 40, minimumStock: 8, reorderPoint: 12 }
  },
  // Toric IOL
  {
    sku: 'IOL-ALCON-SN6AT',
    category: 'iol',
    brand: 'Alcon',
    productName: 'AcrySof IQ Toric',
    model: 'SN6AT',
    manufacturer: 'Alcon Laboratories',
    iol: {
      type: 'toric',
      material: 'hydrophobic-acrylic',
      design: '1-piece',
      optic: { diameter: 6.0, type: 'aspheric' },
      aConstant: 118.9,
      powerRange: { min: 6, max: 30, step: 0.5 },
      incisionSize: 2.2,
      uvBlocking: true,
      blueBlocking: true
    },
    specifications: { sterile: true, singleUse: true },
    pricing: { costPrice: 300000, sellingPrice: 600000, currency: 'CDF' },
    inventory: { currentStock: 20, minimumStock: 5, reorderPoint: 8 }
  },
  // Multifocal IOL
  {
    sku: 'IOL-ALCON-PANOPTIX',
    category: 'iol',
    brand: 'Alcon',
    productName: 'PanOptix',
    model: 'TFNT00',
    manufacturer: 'Alcon Laboratories',
    iol: {
      type: 'multifocal',
      material: 'hydrophobic-acrylic',
      design: '1-piece',
      optic: { diameter: 6.0, type: 'aspheric' },
      aConstant: 119.1,
      powerRange: { min: 6, max: 30, step: 0.5 },
      incisionSize: 2.2,
      uvBlocking: true,
      blueBlocking: true
    },
    specifications: { sterile: true, singleUse: true },
    pricing: { costPrice: 500000, sellingPrice: 1000000, currency: 'CDF' },
    inventory: { currentStock: 15, minimumStock: 3, reorderPoint: 5 }
  },

  // ================================
  // VISCOELASTICS (OVDs)
  // ================================
  {
    sku: 'VISC-ALCON-VISCOAT',
    category: 'viscoelastic',
    brand: 'Alcon',
    productName: 'Viscoat',
    manufacturer: 'Alcon Laboratories',
    viscoelastic: {
      type: 'dispersive',
      volume: 0.5,
      concentration: 3,
      composition: ['sodium hyaluronate', 'chondroitin sulfate']
    },
    specifications: { sterile: true, singleUse: true },
    pricing: { costPrice: 40000, sellingPrice: 80000, currency: 'CDF' },
    inventory: { currentStock: 100, minimumStock: 20, reorderPoint: 30 }
  },
  {
    sku: 'VISC-ALCON-PROVISC',
    category: 'viscoelastic',
    brand: 'Alcon',
    productName: 'ProVisc',
    manufacturer: 'Alcon Laboratories',
    viscoelastic: {
      type: 'cohesive',
      volume: 0.55,
      concentration: 1,
      molecularWeight: 'High',
      composition: ['sodium hyaluronate']
    },
    specifications: { sterile: true, singleUse: true },
    pricing: { costPrice: 35000, sellingPrice: 70000, currency: 'CDF' },
    inventory: { currentStock: 100, minimumStock: 20, reorderPoint: 30 }
  },
  {
    sku: 'VISC-AMO-HEALON',
    category: 'viscoelastic',
    brand: 'Johnson & Johnson Vision',
    productName: 'Healon',
    manufacturer: 'Johnson & Johnson',
    viscoelastic: {
      type: 'cohesive',
      volume: 0.85,
      concentration: 1,
      composition: ['sodium hyaluronate']
    },
    specifications: { sterile: true, singleUse: true },
    pricing: { costPrice: 45000, sellingPrice: 90000, currency: 'CDF' },
    inventory: { currentStock: 80, minimumStock: 15, reorderPoint: 25 }
  },

  // ================================
  // SUTURES
  // ================================
  {
    sku: 'SUT-ETHICON-10-0-NYL',
    category: 'suture',
    brand: 'Ethicon',
    productName: 'Ethilon',
    model: '10-0 Nylon',
    manufacturer: 'Ethicon (J&J)',
    suture: {
      material: 'nylon',
      size: '10-0',
      length: 30,
      needleType: 'spatula',
      needleSize: '6mm',
      absorbable: false,
      color: 'black'
    },
    specifications: { sterile: true, singleUse: true },
    pricing: { costPrice: 25000, sellingPrice: 50000, currency: 'CDF' },
    inventory: { currentStock: 200, minimumStock: 30, reorderPoint: 50 }
  },
  {
    sku: 'SUT-ETHICON-9-0-VIC',
    category: 'suture',
    brand: 'Ethicon',
    productName: 'Vicryl',
    model: '9-0',
    manufacturer: 'Ethicon (J&J)',
    suture: {
      material: 'vicryl',
      size: '9-0',
      length: 30,
      needleType: 'spatula',
      needleSize: '6mm',
      absorbable: true,
      color: 'violet'
    },
    specifications: { sterile: true, singleUse: true },
    pricing: { costPrice: 30000, sellingPrice: 60000, currency: 'CDF' },
    inventory: { currentStock: 150, minimumStock: 25, reorderPoint: 40 }
  },

  // ================================
  // BLADES & KNIVES
  // ================================
  {
    sku: 'BLD-ALCON-CLEARCUT',
    category: 'blade-knife',
    brand: 'Alcon',
    productName: 'ClearCut',
    model: '2.4mm',
    manufacturer: 'Alcon Laboratories',
    specifications: { size: '2.4mm', sterile: true, singleUse: true },
    pricing: { costPrice: 15000, sellingPrice: 30000, currency: 'CDF' },
    inventory: { currentStock: 100, minimumStock: 20, reorderPoint: 30 }
  },
  {
    sku: 'BLD-ALCON-SIDEPORT',
    category: 'blade-knife',
    brand: 'Alcon',
    productName: 'Side Port Knife',
    model: '1.2mm',
    manufacturer: 'Alcon Laboratories',
    specifications: { size: '1.2mm', sterile: true, singleUse: true },
    pricing: { costPrice: 12000, sellingPrice: 25000, currency: 'CDF' },
    inventory: { currentStock: 100, minimumStock: 20, reorderPoint: 30 }
  },
  {
    sku: 'BLD-MVR-20G',
    category: 'blade-knife',
    brand: 'Beaver',
    productName: 'MVR Blade',
    model: '20 Gauge',
    manufacturer: 'Beaver-Visitec',
    specifications: { size: '20G', sterile: true, singleUse: true },
    pricing: { costPrice: 8000, sellingPrice: 18000, currency: 'CDF' },
    inventory: { currentStock: 80, minimumStock: 15, reorderPoint: 25 }
  },

  // ================================
  // PHACO CONSUMABLES
  // ================================
  {
    sku: 'PHACO-ALCON-PACK',
    category: 'phaco-consumable',
    brand: 'Alcon',
    productName: 'Centurion Pack',
    manufacturer: 'Alcon Laboratories',
    phacoConsumable: {
      type: 'tubing-pack',
      compatibility: ['Centurion', 'Centurion Vision System']
    },
    specifications: { sterile: true, singleUse: true },
    pricing: { costPrice: 80000, sellingPrice: 160000, currency: 'CDF' },
    inventory: { currentStock: 50, minimumStock: 10, reorderPoint: 15 }
  },
  {
    sku: 'PHACO-TIP-45',
    category: 'phaco-consumable',
    brand: 'Alcon',
    productName: 'OZil Phaco Tip',
    model: '45 degree',
    manufacturer: 'Alcon Laboratories',
    phacoConsumable: {
      type: 'phaco-tip',
      compatibility: ['Centurion'],
      angle: 45
    },
    specifications: { sterile: true, singleUse: true },
    pricing: { costPrice: 25000, sellingPrice: 50000, currency: 'CDF' },
    inventory: { currentStock: 40, minimumStock: 8, reorderPoint: 12 }
  },

  // ================================
  // IOL INJECTORS
  // ================================
  {
    sku: 'INJ-ALCON-MONARCH',
    category: 'implant-accessory',
    brand: 'Alcon',
    productName: 'Monarch III Injector',
    model: 'D Cartridge',
    manufacturer: 'Alcon Laboratories',
    specifications: { sterile: true, singleUse: true },
    pricing: { costPrice: 20000, sellingPrice: 40000, currency: 'CDF' },
    inventory: { currentStock: 60, minimumStock: 12, reorderPoint: 20 }
  },

  // ================================
  // DRAPES
  // ================================
  {
    sku: 'DRP-OPHTHALMIC',
    category: 'drape',
    brand: '3M',
    productName: 'Ophthalmic Drape',
    manufacturer: '3M Healthcare',
    specifications: { sterile: true, singleUse: true, latexFree: true },
    pricing: { costPrice: 5000, sellingPrice: 12000, currency: 'CDF' },
    inventory: { currentStock: 200, minimumStock: 40, reorderPoint: 60 }
  },

  // ================================
  // INTRAVITREAL SUPPLIES
  // ================================
  {
    sku: 'IVT-NEEDLE-30G',
    category: 'intravitreal',
    brand: 'BD',
    productName: 'Intravitreal Needle',
    model: '30G x 0.5 inch',
    manufacturer: 'Becton Dickinson',
    specifications: { size: '30G', sterile: true, singleUse: true },
    pricing: { costPrice: 3000, sellingPrice: 8000, currency: 'CDF' },
    inventory: { currentStock: 150, minimumStock: 30, reorderPoint: 50 }
  },
  {
    sku: 'IVT-SPECULUM',
    category: 'instrument',
    brand: 'Katena',
    productName: 'Lid Speculum',
    model: 'Barraquer Wire',
    manufacturer: 'Katena Products',
    instrument: {
      type: 'speculum',
      material: 'stainless-steel',
      reusable: true,
      maxSterilizations: 500
    },
    specifications: { sterile: false, singleUse: false },
    pricing: { costPrice: 50000, sellingPrice: 100000, currency: 'CDF' },
    inventory: { currentStock: 10, minimumStock: 2, reorderPoint: 3 }
  }
];

// ============================================================================
// MAIN SEEDING FUNCTION
// ============================================================================
async function seedComprehensiveConfig() {
  const stats = {
    rooms: 0,
    taxConfigs: 0,
    fiscalYears: 0,
    referrers: 0,
    unitConversions: 0,
    surgicalSupplies: 0,
    externalFacilities: 0,
    providerAvailabilities: 0,
    reagentLots: 0
  };

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB');

    // Get all clinics
    const clinics = await Clinic.find({});
    if (clinics.length === 0) {
      throw new Error('No clinics found. Run seedClinics.js first.');
    }
    console.log(`📍 Found ${clinics.length} clinics`);

    // Get users for provider availability
    const providers = await User.find({
      role: { $in: ['doctor', 'ophthalmologist', 'optometrist', 'nurse'] },
      isActive: true
    });
    console.log(`👨‍⚕️ Found ${providers.length} providers`);

    // ========================================
    // 1. SEED ROOMS
    // ========================================
    console.log('\n📦 Seeding Rooms...');
    for (const clinic of clinics) {
      for (const template of ROOM_TEMPLATES) {
        const existing = await Room.findOne({
          clinic: clinic._id,
          roomNumber: template.roomNumber
        });

        if (!existing) {
          await Room.create({
            ...template,
            clinic: clinic._id,
            displaySettings: {
              showOnDisplayBoard: ['waiting', 'reception'].includes(template.type) ? false : true,
              displayOrder: ROOM_TEMPLATES.indexOf(template)
            },
            operatingHours: {
              monday: { open: '07:00', close: '18:00' },
              tuesday: { open: '07:00', close: '18:00' },
              wednesday: { open: '07:00', close: '18:00' },
              thursday: { open: '07:00', close: '18:00' },
              friday: { open: '07:00', close: '18:00' },
              saturday: { open: '07:00', close: '13:00' },
              sunday: { open: null, close: null }
            }
          });
          stats.rooms++;
        }
      }
    }
    console.log(`  ✅ Created ${stats.rooms} rooms`);

    // ========================================
    // 2. SEED TAX CONFIGS
    // ========================================
    console.log('\n💰 Seeding Tax Configurations...');
    for (const tax of TAX_CONFIGS) {
      const existing = await TaxConfig.findOne({ code: tax.code });
      if (!existing) {
        await TaxConfig.create(tax);
        stats.taxConfigs++;
      }
    }
    console.log(`  ✅ Created ${stats.taxConfigs} tax configurations`);

    // ========================================
    // 3. SEED FISCAL YEARS
    // ========================================
    console.log('\n📅 Seeding Fiscal Years...');
    const currentYear = new Date().getFullYear();
    const adminUser = await User.findOne({ role: 'admin' });

    // Current fiscal year
    const currentFY = await FiscalYear.findOne({ fiscalYearId: `FY${currentYear}` });
    if (!currentFY) {
      await FiscalYear.createFiscalYear({
        fiscalYearId: `FY${currentYear}`,
        name: `Exercice Fiscal ${currentYear}`,
        startDate: new Date(currentYear, 0, 1),
        endDate: new Date(currentYear, 11, 31),
        status: 'active',
        isCurrent: true,
        settings: {
          invoicePrefix: `INV${currentYear}`,
          gracePeriodDays: 5
        }
      }, adminUser?._id);
      stats.fiscalYears++;
    }

    // Next fiscal year (planning)
    const nextFY = await FiscalYear.findOne({ fiscalYearId: `FY${currentYear + 1}` });
    if (!nextFY) {
      await FiscalYear.createFiscalYear({
        fiscalYearId: `FY${currentYear + 1}`,
        name: `Exercice Fiscal ${currentYear + 1}`,
        startDate: new Date(currentYear + 1, 0, 1),
        endDate: new Date(currentYear + 1, 11, 31),
        status: 'planning',
        isCurrent: false,
        settings: {
          invoicePrefix: `INV${currentYear + 1}`,
          gracePeriodDays: 5
        }
      }, adminUser?._id);
      stats.fiscalYears++;
    }
    console.log(`  ✅ Created ${stats.fiscalYears} fiscal years`);

    // ========================================
    // 4. SEED REFERRERS
    // ========================================
    console.log('\n👨‍⚕️ Seeding Referrers...');
    for (const ref of REFERRERS) {
      const existing = await Referrer.findOne({ name: ref.name });
      if (!existing) {
        await Referrer.create(ref);
        stats.referrers++;
      }
    }
    // Add internal referrers from doctors
    for (const provider of providers.filter(p => p.role === 'doctor' || p.role === 'ophthalmologist')) {
      const existing = await Referrer.findOne({ user: provider._id });
      if (!existing) {
        await Referrer.create({
          name: `${provider.lastName} ${provider.firstName}`,
          type: 'internal',
          user: provider._id,
          specialty: provider.specialty || 'Médecine',
          defaultCommissionRate: 5,
          isActive: true
        });
        stats.referrers++;
      }
    }
    console.log(`  ✅ Created ${stats.referrers} referrers`);

    // ========================================
    // 5. SEED UNIT CONVERSIONS
    // ========================================
    console.log('\n🔬 Seeding Unit Conversions...');
    const conversionCount = await UnitConversion.seedCommonConversions();
    stats.unitConversions = conversionCount;
    console.log(`  ✅ Created/updated ${stats.unitConversions} unit conversions`);

    // ========================================
    // 6. SEED SURGICAL SUPPLIES
    // ========================================
    console.log('\n🏥 Seeding Surgical Supplies...');
    const mainClinic = clinics[0]; // Use first clinic as main surgical center

    for (const supply of SURGICAL_SUPPLIES) {
      const existing = await SurgicalSupplyInventory.findOne({ sku: supply.sku });
      if (!existing) {
        // Add batch for items with stock
        const batches = [];
        if (supply.inventory?.currentStock > 0) {
          const expiryDate = new Date();
          expiryDate.setFullYear(expiryDate.getFullYear() + 2); // 2 years expiry

          batches.push({
            lotNumber: `LOT-${supply.sku}-${Date.now()}`,
            quantity: supply.inventory.currentStock,
            receivedDate: new Date(),
            expirationDate: expiryDate,
            status: 'active',
            cost: {
              unitCost: supply.pricing?.costPrice || 0,
              totalCost: (supply.pricing?.costPrice || 0) * supply.inventory.currentStock,
              currency: 'CDF'
            }
          });
        }

        await SurgicalSupplyInventory.create({
          ...supply,
          clinic: mainClinic._id,
          batches,
          inventory: {
            ...supply.inventory,
            status: supply.inventory?.currentStock > supply.inventory?.minimumStock ? 'in-stock' : 'low-stock'
          }
        });
        stats.surgicalSupplies++;
      }
    }
    console.log(`  ✅ Created ${stats.surgicalSupplies} surgical supplies`);

    // ========================================
    // 7. SEED EXTERNAL FACILITIES
    // ========================================
    console.log('\n🏢 Seeding External Facilities...');
    for (const facility of EXTERNAL_FACILITIES) {
      const existing = await ExternalFacility.findOne({ name: facility.name });
      if (!existing) {
        await ExternalFacility.create(facility);
        stats.externalFacilities++;
      }
    }
    console.log(`  ✅ Created ${stats.externalFacilities} external facilities`);

    // ========================================
    // 8. SEED PROVIDER AVAILABILITIES
    // ========================================
    console.log('\n📋 Seeding Provider Availabilities...');
    for (const provider of providers) {
      for (const clinic of clinics) {
        try {
          await ProviderAvailability.getOrCreateDefault(provider._id, clinic._id);
          stats.providerAvailabilities++;
        } catch (e) {
          // Already exists - that's fine
        }
      }
    }
    console.log(`  ✅ Created ${stats.providerAvailabilities} provider availabilities`);

    // ========================================
    // 9. SEED REAGENT LOTS (Skipped - requires LabAnalyzer setup)
    // ========================================
    console.log('\n🧪 Seeding Reagent Lots...');
    console.log('  ⏭️  Skipped - Reagent lots require LabAnalyzer configuration');

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n' + '═'.repeat(60));
    console.log('  COMPREHENSIVE CONFIG SEEDING COMPLETE');
    console.log('═'.repeat(60));
    console.log(`  📦 Rooms:                  ${stats.rooms}`);
    console.log(`  💰 Tax Configs:            ${stats.taxConfigs}`);
    console.log(`  📅 Fiscal Years:           ${stats.fiscalYears}`);
    console.log(`  👨‍⚕️ Referrers:              ${stats.referrers}`);
    console.log(`  🔬 Unit Conversions:       ${stats.unitConversions}`);
    console.log(`  🏥 Surgical Supplies:      ${stats.surgicalSupplies}`);
    console.log(`  🏢 External Facilities:    ${stats.externalFacilities}`);
    console.log(`  📋 Provider Availabilities: ${stats.providerAvailabilities}`);
    console.log(`  🧪 Reagent Lots:           ${stats.reagentLots}`);
    console.log('═'.repeat(60));

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run
seedComprehensiveConfig()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
