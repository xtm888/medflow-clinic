/**
 * Import Legacy Document Templates from CareVision
 *
 * Sources:
 * - Courriertexte (103 letter templates)
 * - Maquettes/Makete (29 document templates)
 *
 * Usage:
 *   node scripts/importLegacyDocumentTemplates.js [--dry-run] [--verbose]
 *
 * Options:
 *   --dry-run   Preview what would be imported without making changes
 *   --verbose   Show detailed progress for each template
 *
 * @module scripts/importLegacyDocumentTemplates
 */

require('dotenv').config();
const mongoose = require('mongoose');
const sql = require('mssql');
const DocumentTemplate = require('../models/DocumentTemplate');

// SQL Server config (CareVision on SERVEUR)
const sqlConfig = {
  user: process.env.CAREVISION_SQL_USER || 'sa',
  password: process.env.CAREVISION_SQL_PASSWORD || 'server',
  server: process.env.CAREVISION_SQL_SERVER || '192.168.4.8',
  database: process.env.CAREVISION_SQL_DATABASE || 'CareVisionBD20',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    requestTimeout: 60000
  },
  pool: {
    max: 5,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

// Category mapping from legacy type codes
const categoryMap = {
  'CERT': 'certificate',
  'CONS': 'surgical_consent',
  'OPER': 'operative_report',
  'CORR': 'correspondence',
  'INST': 'prescription_instructions',
  'PAIE': 'payment',
  'RAPP': 'reminder',
  'EXAM': 'examination_report',
  'LET': 'correspondence',
  'ORD': 'prescription_instructions',
  'FACT': 'payment',
  'default': 'correspondence'
};

// Subcategory inference from template name/content
function inferSubCategory(name, content) {
  const nameLower = (name || '').toLowerCase();
  const contentLower = (content || '').toLowerCase();
  const combined = nameLower + ' ' + contentLower;

  // Visual acuity / refraction
  if (combined.includes('acuite') || combined.includes('vision') || combined.includes('refraction')) {
    return 'visual_acuity';
  }

  // Cataract surgery
  if (combined.includes('cataracte') || combined.includes('phaco')) {
    return 'cataract_surgery';
  }

  // Fitness certificates
  if ((combined.includes('certificat') && combined.includes('apt')) ||
      combined.includes('aptitude') || combined.includes('inaptitude')) {
    return 'fitness';
  }

  // Medical leave
  if (combined.includes('arret') || combined.includes('maladie') ||
      combined.includes('repos') || combined.includes('incapacite')) {
    return 'medical_leave';
  }

  // School
  if (combined.includes('scolaire') || combined.includes('ecole') ||
      combined.includes('etudiant') || combined.includes('scolarite')) {
    return 'school';
  }

  // Glasses required
  if (combined.includes('lunettes') || combined.includes('correction optique')) {
    return 'glasses_required';
  }

  // Payment
  if (combined.includes('recu') || combined.includes('paiement') ||
      combined.includes('facture') || combined.includes('quittance')) {
    return 'payment_receipt';
  }

  // Consultation
  if (combined.includes('consultation') || combined.includes('examen')) {
    return 'consultation';
  }

  // IOP / Tonometry
  if (combined.includes('tonometrie') || combined.includes('tension oculaire') ||
      combined.includes('iop') || combined.includes('pio')) {
    return 'iop';
  }

  // Visual field
  if (combined.includes('champ visuel') || combined.includes('perimetrie')) {
    return 'visual_field';
  }

  // Follow-up
  if (combined.includes('suivi') || combined.includes('controle') ||
      combined.includes('rappel')) {
    return 'follow_up';
  }

  // General surgery
  if (combined.includes('operatoire') || combined.includes('intervention') ||
      combined.includes('chirurgi')) {
    return 'general_surgery';
  }

  // Ultrasound
  if (combined.includes('echograph') || combined.includes('biometrie')) {
    return 'ultrasound';
  }

  return 'general';
}

// Infer category from template name if type code not available
function inferCategory(name, content) {
  const nameLower = (name || '').toLowerCase();
  const contentLower = (content || '').toLowerCase();
  const combined = nameLower + ' ' + contentLower;

  if (combined.includes('certificat')) return 'certificate';
  if (combined.includes('consentement')) return 'surgical_consent';
  if (combined.includes('operatoire') || combined.includes('compte rendu')) return 'operative_report';
  if (combined.includes('lettre') || combined.includes('cher confrere')) return 'correspondence';
  if (combined.includes('ordonnance') || combined.includes('prescription')) return 'prescription_instructions';
  if (combined.includes('facture') || combined.includes('paiement') || combined.includes('recu')) return 'payment';
  if (combined.includes('rappel') || combined.includes('convocation')) return 'reminder';
  if (combined.includes('examen') || combined.includes('bilan')) return 'examination_report';

  return 'correspondence';
}

/**
 * Import letter templates from Courriertexte table
 * @param {sql.ConnectionPool} pool - SQL connection pool
 * @param {boolean} dryRun - If true, don't save to MongoDB
 * @param {boolean} verbose - If true, log each template
 * @returns {Promise<{imported: number, skipped: number, errors: number}>}
 */
async function importCourriertexte(pool, dryRun = false, verbose = false) {
  console.log('\n=== Importing Courriertexte (Letter Templates) ===');

  const result = await pool.request().query(`
    SELECT
      id,
      titre,
      texte,
      type,
      datecreation,
      datemodification
    FROM Courriertexte
    WHERE texte IS NOT NULL AND LEN(CAST(texte AS NVARCHAR(MAX))) > 10
    ORDER BY id
  `);

  console.log(`Found ${result.recordset.length} letter templates`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of result.recordset) {
    const name = row.titre || `Modele Courrier ${row.id}`;
    const content = row.texte || '';
    const typeCode = (row.type || '').toUpperCase().trim();

    // Extract variables from content
    const variables = extractVariables(content);

    // Normalize placeholders in content
    const normalizedContent = normalizePlaceholders(content);

    const template = {
      legacyId: `CT-${row.id}`,
      legacySource: 'courriertexte',
      legacyType: row.type,
      name: name,
      content: normalizedContent,
      category: categoryMap[typeCode] || inferCategory(name, content),
      subCategory: inferSubCategory(name, content),
      specialty: 'ophthalmology',
      language: 'fr',
      status: 'active',
      variables: variables,
      importedAt: new Date()
    };

    if (verbose) {
      console.log(`  [${row.id}] ${name} -> ${template.category}/${template.subCategory} (${variables.length} vars)`);
    }

    if (dryRun) {
      imported++;
      continue;
    }

    try {
      await DocumentTemplate.findOneAndUpdate(
        { legacyId: template.legacyId },
        template,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      imported++;
    } catch (err) {
      console.error(`  Error importing ${name}:`, err.message);
      errors++;
    }
  }

  console.log(`Courriertexte: Imported ${imported}, Skipped ${skipped}, Errors ${errors}`);
  return { imported, skipped, errors };
}

/**
 * Import document templates from Maquettes table
 * @param {sql.ConnectionPool} pool - SQL connection pool
 * @param {boolean} dryRun - If true, don't save to MongoDB
 * @param {boolean} verbose - If true, log each template
 * @returns {Promise<{imported: number, skipped: number, errors: number}>}
 */
async function importMaquettes(pool, dryRun = false, verbose = false) {
  console.log('\n=== Importing Maquettes (Document Templates) ===');

  // Try both possible table names (Maquettes and Makete)
  let result;
  let tableName;

  try {
    result = await pool.request().query(`
      SELECT
        id,
        nom,
        contenu,
        type,
        description
      FROM Maquettes
      WHERE contenu IS NOT NULL AND LEN(CAST(contenu AS NVARCHAR(MAX))) > 10
      ORDER BY id
    `);
    tableName = 'Maquettes';
  } catch (err) {
    console.log('Maquettes table not found, trying Makete...');
    try {
      result = await pool.request().query(`
        SELECT
          id,
          nom,
          contenu,
          type,
          description
        FROM Makete
        WHERE contenu IS NOT NULL AND LEN(CAST(contenu AS NVARCHAR(MAX))) > 10
        ORDER BY id
      `);
      tableName = 'Makete';
    } catch (err2) {
      console.log('Neither Maquettes nor Makete table found. Skipping.');
      return { imported: 0, skipped: 0, errors: 0 };
    }
  }

  console.log(`Found ${result.recordset.length} document templates in ${tableName}`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of result.recordset) {
    const name = row.nom || `Modele Document ${row.id}`;
    const content = row.contenu || '';
    const typeCode = (row.type || '').toUpperCase().trim();

    // Extract variables from content
    const variables = extractVariables(content);

    // Normalize placeholders in content
    const normalizedContent = normalizePlaceholders(content);

    const template = {
      legacyId: `MQ-${row.id}`,
      legacySource: tableName.toLowerCase(),
      legacyType: row.type,
      name: name,
      nameEn: null,
      content: normalizedContent,
      category: categoryMap[typeCode] || inferCategory(name, content),
      subCategory: inferSubCategory(name, content),
      specialty: 'ophthalmology',
      language: 'fr',
      status: 'active',
      description: row.description || null,
      variables: variables,
      importedAt: new Date()
    };

    if (verbose) {
      console.log(`  [${row.id}] ${name} -> ${template.category}/${template.subCategory} (${variables.length} vars)`);
    }

    if (dryRun) {
      imported++;
      continue;
    }

    try {
      await DocumentTemplate.findOneAndUpdate(
        { legacyId: template.legacyId },
        template,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      imported++;
    } catch (err) {
      console.error(`  Error importing ${name}:`, err.message);
      errors++;
    }
  }

  console.log(`${tableName}: Imported ${imported}, Skipped ${skipped}, Errors ${errors}`);
  return { imported, skipped, errors };
}

/**
 * Main import function
 */
async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const verbose = process.argv.includes('--verbose');

  if (dryRun) {
    console.log('=== DRY RUN MODE - No changes will be made ===\n');
  }

  console.log('Legacy Document Template Import');
  console.log('================================');
  console.log(`SQL Server: ${sqlConfig.server}`);
  console.log(`Database: ${sqlConfig.database}`);
  console.log(`MongoDB: ${process.env.MONGODB_URI || 'mongodb://localhost/medflow'}`);
  console.log('');

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost/medflow';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // Connect to SQL Server
  const pool = await sql.connect(sqlConfig);
  console.log('Connected to CareVision SQL Server');

  const startTime = Date.now();

  try {
    // Get counts before import
    const beforeCount = await DocumentTemplate.countDocuments({ status: 'active' });
    const beforeLegacyCount = await DocumentTemplate.countDocuments({
      legacySource: { $in: ['courriertexte', 'maquettes', 'makete'] }
    });

    console.log(`\nBefore import: ${beforeCount} active templates (${beforeLegacyCount} from legacy)`);

    // Import from both sources
    const ctResult = await importCourriertexte(pool, dryRun, verbose);
    const mqResult = await importMaquettes(pool, dryRun, verbose);

    // Get counts after import
    const afterCount = await DocumentTemplate.countDocuments({ status: 'active' });
    const afterLegacyCount = await DocumentTemplate.countDocuments({
      legacySource: { $in: ['courriertexte', 'maquettes', 'makete'] }
    });

    // Summary
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n=== Import Summary ===');
    console.log(`Courriertexte: ${ctResult.imported} imported, ${ctResult.errors} errors`);
    console.log(`Maquettes: ${mqResult.imported} imported, ${mqResult.errors} errors`);
    console.log(`Total imported: ${ctResult.imported + mqResult.imported}`);
    console.log(`Total errors: ${ctResult.errors + mqResult.errors}`);
    console.log(`\nTemplates after import: ${afterCount} active (${afterLegacyCount} from legacy)`);
    console.log(`Duration: ${elapsed}s`);

    if (dryRun) {
      console.log('\n[DRY RUN] No changes were made to the database.');
    }

    // List by category
    console.log('\n=== Templates by Category ===');
    const categoryCounts = await DocumentTemplate.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    categoryCounts.forEach(c => {
      console.log(`  ${c._id}: ${c.count}`);
    });

  } finally {
    await pool.close();
    await mongoose.disconnect();
    console.log('\nConnections closed.');
  }
}

// Run the script
main().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
