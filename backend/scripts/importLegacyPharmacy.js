/**
 * Import Legacy Pharmacy Inventory from PharmaA/B and StockA/B CSVs
 *
 * Creates PharmacyInventory entries with real stock levels from legacy system.
 * Uses fuzzy matching to link French product names to Drug collection.
 *
 * Data Sources:
 *   - /Users/xtm888/Desktop/DMI_Export/PharmaA_Local.csv
 *   - /Users/xtm888/Desktop/DMI_Export/PharmaB_Local.csv
 *   - /Users/xtm888/Desktop/DMI_Export/StockA_Local.csv
 *   - /Users/xtm888/Desktop/DMI_Export/StockB_Local.csv
 *
 * Usage:
 *   DRY_RUN=true node scripts/importLegacyPharmacy.js   # Validate without importing
 *   node scripts/importLegacyPharmacy.js                # Full import
 */

const mongoose = require('mongoose');
const { PharmacyInventory } = require('../models/Inventory');
const fs = require('fs');
const Papa = require('papaparse');
require('dotenv').config();

// Models
const Drug = require('../models/Drug');

const Clinic = require('../models/Clinic');

// Configuration
const DRY_RUN = process.env.DRY_RUN === 'true';
const BASE_PATH = '/Users/xtm888/Desktop/DMI_Export';

const CSV_FILES = {
  pharmaA: `${BASE_PATH}/PharmaA_Local.csv`,
  pharmaB: `${BASE_PATH}/PharmaB_Local.csv`,
  stockA: `${BASE_PATH}/StockA_Local.csv`,
  stockB: `${BASE_PATH}/StockB_Local.csv`
};

// Statistics
const stats = {
  totalProducts: 0,
  matched: 0,
  unmatched: 0,
  inventoryCreated: 0,
  inventoryUpdated: 0,
  errors: [],
  unmatchedProducts: [],
  startTime: null
};

/**
 * Normalize French drug name for matching
 */
function normalizeName(name) {
  if (!name) return '';
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^A-Z0-9]/g, ' ')       // Replace special chars with space
    .replace(/\s+/g, ' ')             // Collapse multiple spaces
    .trim();
}

/**
 * Extract base drug name (first word typically)
 */
function extractBaseName(name) {
  const normalized = normalizeName(name);
  // Get first significant word (skip numbers at start)
  const words = normalized.split(' ').filter(w => w.length > 2 && !/^\d+$/.test(w));
  return words[0] || normalized.split(' ')[0] || '';
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Find best matching drug from collection
 */
function findBestMatch(productName, drugMap, drugList) {
  const normalized = normalizeName(productName);
  const baseName = extractBaseName(productName);

  // 1. Try exact match on normalized name
  if (drugMap.has(normalized)) {
    return { drug: drugMap.get(normalized), confidence: 1.0, matchType: 'exact' };
  }

  // 2. Try base name match
  for (const [key, drug] of drugMap) {
    if (key.startsWith(baseName) || baseName.startsWith(key.split(' ')[0])) {
      return { drug, confidence: 0.9, matchType: 'baseName' };
    }
  }

  // 3. Try contains match
  for (const [key, drug] of drugMap) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return { drug, confidence: 0.8, matchType: 'contains' };
    }
  }

  // 4. Fuzzy match using Levenshtein distance
  let bestMatch = null;
  let bestDistance = Infinity;
  let bestDrug = null;

  for (const drug of drugList) {
    const drugNormalized = normalizeName(drug.name);
    const distance = levenshteinDistance(baseName, extractBaseName(drug.name));

    if (distance < bestDistance && distance <= 3) { // Max 3 character difference
      bestDistance = distance;
      bestDrug = drug;
    }
  }

  if (bestDrug) {
    const confidence = Math.max(0.5, 1 - (bestDistance / 10));
    return { drug: bestDrug, confidence, matchType: 'fuzzy' };
  }

  return null;
}

/**
 * Parse dosage form from product name
 */
function parseDosageForm(name) {
  const nameLower = name.toLowerCase();

  if (nameLower.includes('collyre') || nameLower.includes('goutte')) return 'drops';
  if (nameLower.includes('pom') || nameLower.includes('pommade') || nameLower.includes('gel')) return 'ointment';
  if (nameLower.includes('cp') || nameLower.includes('comprime') || nameLower.includes('ces')) return 'tablet';
  if (nameLower.includes('inj') || nameLower.includes('injectable') || nameLower.includes('amp')) return 'injection';
  if (nameLower.includes('sirop') || nameLower.includes('sol') || nameLower.includes('sp')) return 'syrup';
  if (nameLower.includes('gel') || nameLower.includes('capsule')) return 'capsule';
  if (nameLower.includes('suppo')) return 'suppository';
  if (nameLower.includes('unidose')) return 'single-dose';

  return 'other';
}

/**
 * Determine route from product name and category
 */
function determineRoute(name, category) {
  const nameLower = name.toLowerCase();

  if (nameLower.includes('collyre') || nameLower.includes('opht')) return 'ophthalmic';
  if (nameLower.includes('inj') || nameLower.includes('injectable')) return 'injectable';
  if (nameLower.includes('pom') || nameLower.includes('creme')) return 'topical';
  if (nameLower.includes('nasal') || nameLower.includes('nazal')) return 'nasal';
  if (nameLower.includes('suppo')) return 'rectal';
  if (nameLower.includes('ovule') || nameLower.includes('vaginal')) return 'vaginal';

  // Category-based defaults
  if (category && (category.includes('LOCAUX') || category.includes('OPHA'))) return 'ophthalmic';

  return 'oral';
}

/**
 * Extract strength from product name
 */
function extractStrength(name) {
  // Match patterns like "0,1%", "500mg", "1%", "0.5MG/ML"
  const patterns = [
    /(\d+[,.]?\d*)\s*%/,           // Percentage: 0,1% or 1%
    /(\d+[,.]?\d*)\s*mg/i,         // Milligrams: 500mg
    /(\d+[,.]?\d*)\s*ml/i,         // Milliliters: 10ml
    /(\d+[,.]?\d*)\s*g\b/i,        // Grams: 10g
    /(\d+[,.]?\d*)\s*UI/i,         // International Units
    /(\d+\/\d+)/                    // Fractions: 10/10
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return match[0].replace(',', '.');
    }
  }

  return '';
}

/**
 * Build drug lookup map
 */
async function buildDrugMap() {
  console.log('Building drug lookup map...');
  const drugs = await Drug.find({ isActive: true }).lean();

  const map = new Map();
  for (const drug of drugs) {
    const normalized = normalizeName(drug.name);
    map.set(normalized, drug);

    // Also add generic name if different
    if (drug.genericName && drug.genericName !== drug.name) {
      map.set(normalizeName(drug.genericName), drug);
    }
  }

  console.log(`  Loaded ${drugs.length} drugs, ${map.size} lookup entries`);
  return { map, list: drugs };
}

/**
 * Parse CSV file
 */
function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`  File not found: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim()
  });

  return parsed.data;
}

/**
 * Merge pharma and stock data
 */
function mergePharmacyData(pharmaData, stockData) {
  const merged = new Map();

  // Add pharma products
  for (const row of pharmaData) {
    const productName = row.ProduitA?.trim() || row.ProduitB?.trim();
    if (!productName) continue;

    merged.set(productName, {
      name: productName,
      stock: parseInt(row.StockA || row.StockB || row.EntréeB || 0) || 0
    });
  }

  // Update with stock data
  for (const row of stockData) {
    const productName = row.ProduitA?.trim() || row.ProduitB?.trim();
    if (!productName) continue;

    const stock = parseInt(row.StockA || row.StockB || 0) || 0;

    if (merged.has(productName)) {
      merged.get(productName).stock = stock;
    } else {
      merged.set(productName, { name: productName, stock });
    }
  }

  return Array.from(merged.values());
}

/**
 * Main import function
 */
async function importLegacyPharmacy() {
  console.log('\n=== IMPORTING LEGACY PHARMACY INVENTORY ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}\n`);

  stats.startTime = Date.now();

  // Get clinics
  const clinics = await Clinic.find({ isActive: { $ne: false } }).lean();
  if (clinics.length === 0) {
    throw new Error('No clinics found. Run seedClinics.js first.');
  }
  console.log(`Found ${clinics.length} clinics: ${clinics.map(c => c.shortName || c.name).join(', ')}`);

  // Assign clinics for A and B locations
  const clinicA = clinics[0]; // First clinic (e.g., Tombalbaye)
  const clinicB = clinics[1] || clinics[0]; // Second clinic or fallback to first

  console.log(`  Clinic A: ${clinicA.shortName || clinicA.name}`);
  console.log(`  Clinic B: ${clinicB.shortName || clinicB.name}`);

  // Build drug lookup map
  const { map: drugMap, list: drugList } = await buildDrugMap();

  // Parse CSV files
  console.log('\nParsing CSV files...');
  const pharmaA = parseCSV(CSV_FILES.pharmaA);
  const pharmaB = parseCSV(CSV_FILES.pharmaB);
  const stockA = parseCSV(CSV_FILES.stockA);
  const stockB = parseCSV(CSV_FILES.stockB);

  console.log(`  PharmaA: ${pharmaA.length} products`);
  console.log(`  PharmaB: ${pharmaB.length} products`);
  console.log(`  StockA: ${stockA.length} products`);
  console.log(`  StockB: ${stockB.length} products`);

  // Merge data for each location
  const productsA = mergePharmacyData(pharmaA, stockA);
  const productsB = mergePharmacyData(pharmaB, stockB);

  console.log(`\nMerged: ${productsA.length} products (A), ${productsB.length} products (B)`);

  // Clear existing pharmacy inventory if not dry run
  if (!DRY_RUN) {
    console.log('\nClearing existing pharmacy inventory...');
    await PharmacyInventory.deleteMany({});
  }

  // Process Location A
  console.log('\n--- Processing Location A ---');
  await processProducts(productsA, clinicA, drugMap, drugList, 'A');

  // Process Location B
  console.log('\n--- Processing Location B ---');
  await processProducts(productsB, clinicB, drugMap, drugList, 'B');

  printSummary();
}

/**
 * Process products for a location
 */
async function processProducts(products, clinic, drugMap, drugList, locationId) {
  const inventoryToInsert = [];

  for (const product of products) {
    stats.totalProducts++;

    // Skip non-medication items (equipment, supplies, etc.)
    const nameLower = product.name.toLowerCase();
    if (isEquipmentOrSupply(product.name)) {
      // Still track but skip drug matching
      const inventoryEntry = createInventoryEntry(product, clinic, null, locationId);
      if (inventoryEntry) {
        inventoryToInsert.push(inventoryEntry);
      }
      continue;
    }

    // Try to match to drug collection
    const match = findBestMatch(product.name, drugMap, drugList);

    if (match && match.confidence >= 0.5) {
      stats.matched++;
      const inventoryEntry = createInventoryEntry(product, clinic, match.drug, locationId);
      if (inventoryEntry) {
        inventoryToInsert.push(inventoryEntry);
      }
    } else {
      stats.unmatched++;
      stats.unmatchedProducts.push(product.name);
      // Still create inventory entry without drug reference
      const inventoryEntry = createInventoryEntry(product, clinic, null, locationId);
      if (inventoryEntry) {
        inventoryToInsert.push(inventoryEntry);
      }
    }
  }

  // Batch insert
  if (!DRY_RUN && inventoryToInsert.length > 0) {
    try {
      const result = await PharmacyInventory.insertMany(inventoryToInsert, { ordered: false });
      stats.inventoryCreated += result.length;
      console.log(`  Created ${result.length} inventory entries for ${clinic.shortName || clinic.name}`);
    } catch (error) {
      if (error.insertedDocs) {
        stats.inventoryCreated += error.insertedDocs.length;
      }
      stats.errors.push(`Insert error: ${error.message}`);
    }
  } else if (DRY_RUN) {
    stats.inventoryCreated += inventoryToInsert.length;
    console.log(`  Would create ${inventoryToInsert.length} inventory entries (dry run)`);
  }
}

/**
 * Check if product is equipment/supply rather than medication
 */
function isEquipmentOrSupply(name) {
  const nameLower = name.toLowerCase();
  const equipmentKeywords = [
    'seringue', 'aiguille', 'gant', 'masque', 'champ', 'bistouri',
    'fil ', 'suture', 'compresse', 'pansement', 'sparadrap',
    'catheter', 'sonde', 'drain', 'canule', 'tubulure',
    'filter', 'cartridge', 'machine', 'pump', 'incubator',
    'lentille intraoculaire', 'iol', 'injecteur', 'vitrectomy',
    'trocar', 'cutter', 'cannula', 'pack', 'kit',
    'opticlude', 'chausson', 'sterpack', 'sterilisation',
    'access point', 'tp-link', 'agenda'
  ];

  return equipmentKeywords.some(kw => nameLower.includes(kw));
}

/**
 * Create inventory entry
 */
function createInventoryEntry(product, clinic, drug, locationId) {
  const strength = extractStrength(product.name);
  const form = parseDosageForm(product.name);
  const route = determineRoute(product.name, drug?.category);

  // Determine category
  let category = 'other';
  if (drug?.category) {
    category = mapDrugCategoryToInventoryCategory(drug.category);
  } else if (isEquipmentOrSupply(product.name)) {
    category = 'other'; // Equipment/supplies
  }

  // Calculate stock status
  const currentStock = product.stock || 0;
  const reorderPoint = 10;
  const minimumStock = 5;
  let status = 'in-stock';
  if (currentStock <= 0) status = 'out-of-stock';
  else if (currentStock <= minimumStock) status = 'critical';
  else if (currentStock <= reorderPoint) status = 'low-stock';

  return {
    clinic: clinic._id,
    drug: drug?._id || undefined,
    medication: {
      genericName: drug?.genericName || extractBaseName(product.name),
      brandName: product.name,
      nameFr: product.name,
      strength: strength,
      formulation: form,
      route: route
    },
    category: category,
    categoryFr: drug ? {
      id: drug.category,
      name: drug.category
    } : {
      id: 'legacy',
      name: 'Legacy Import'
    },
    location: {
      pharmacy: `${clinic.shortName || clinic.name} Pharmacy`,
      section: route === 'ophthalmic' ? 'Ophthalmic Section' : 'General Pharmacy',
      shelf: `LOC-${locationId}`
    },
    inventory: {
      currentStock: currentStock,
      unit: 'units',
      minimumStock: minimumStock,
      reorderPoint: reorderPoint,
      maximumStock: 100,
      status: status
    },
    batches: currentStock > 0 ? [{
      lotNumber: `LEGACY-${locationId}-${Date.now()}`,
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      quantity: currentStock,
      supplier: { name: 'Legacy Import' }
    }] : [],
    pricing: {
      cost: 0,
      sellingPrice: 0,
      currency: process.env.BASE_CURRENCY || 'CDF'
    },
    prescription: {
      required: !isEquipmentOrSupply(product.name)
    },
    controlledSubstance: false,
    active: true,
    legacyData: {
      importedFrom: `Location ${locationId}`,
      originalName: product.name,
      importDate: new Date()
    }
  };
}

/**
 * Map drug category to inventory category enum
 */
function mapDrugCategoryToInventoryCategory(drugCategory) {
  const categoryMap = {
    'ANTIBIOTIQUE LOCAUX': 'antibiotic',
    'ANTIBIOTIQUE GENERAUX': 'antibiotic',
    'CORTICOIDES + ANTIBIOTIQUES': 'antibiotic',
    'A.I.N.S LOCAUX': 'anti-inflammatory',
    'A.I.N.S GENERAUX + CORTICOIDES': 'anti-inflammatory',
    'CORTICOIDES LOCAUX': 'anti-inflammatory',
    'ANTI ALLERGIQUES': 'antihistamine',
    'ANTI HISTAMINIQUES GENERAUX': 'antihistamine',
    'ANTI VIRAUX': 'antiviral',
    'ANTI MYCOSIQUES': 'antifungal',
    'VITAMINES': 'vitamin',
    'VASCULOTROPES': 'supplement'
  };

  return categoryMap[drugCategory] || 'other';
}

/**
 * Print summary
 */
function printSummary() {
  const elapsed = Math.round((Date.now() - stats.startTime) / 1000);

  console.log(`\n${'='.repeat(60)}`);
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE IMPORT'}`);
  console.log(`Total Products Processed: ${stats.totalProducts}`);
  console.log(`Matched to Drug Collection: ${stats.matched}`);
  console.log(`Unmatched (created anyway): ${stats.unmatched}`);
  console.log(`Inventory Entries Created: ${stats.inventoryCreated}`);
  console.log(`Errors: ${stats.errors.length}`);
  console.log(`Time: ${elapsed}s`);

  if (stats.unmatchedProducts.length > 0) {
    console.log(`\nFirst 20 unmatched products:`);
    stats.unmatchedProducts.slice(0, 20).forEach(p => console.log(`  - ${p}`));
    if (stats.unmatchedProducts.length > 20) {
      console.log(`  ... and ${stats.unmatchedProducts.length - 20} more`);
    }
  }

  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach(e => console.log(`  - ${e}`));
  }

  console.log('='.repeat(60));
}

/**
 * Main entry point
 */
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    console.log('Connected to MongoDB');

    await importLegacyPharmacy();

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

main();
