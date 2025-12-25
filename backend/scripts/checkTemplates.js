const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProduction } = require('./_guards');
requireNonProduction('checkTemplates.js');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;

  // Check comment templates
  console.log('=== COMMENT TEMPLATES ===');
  const comments = await db.collection('commenttemplates').find({}).toArray();
  comments.forEach(c => console.log('-', c.name || c.code || c.title, ':', `${c.text?.substring(0, 50)}...`));

  // Check examination templates - should include orthoptic data
  console.log('\n=== EXAMINATION TEMPLATES (types) ===');
  const exams = await db.collection('examinationtemplates').find({}).toArray();
  const examTypes = {};
  exams.forEach(e => {
    const type = e.type || e.category || 'other';
    if (!examTypes[type]) examTypes[type] = 0;
    examTypes[type]++;
  });
  Object.keys(examTypes).sort().forEach(t => console.log(`${t}: ${examTypes[t]}`));

  // Check laboratory templates
  console.log('\n=== LABORATORY TEMPLATES (categories) ===');
  const labs = await db.collection('laboratorytemplates').find({}).toArray();
  const labCats = {};
  labs.forEach(l => {
    const cat = l.category || l.type || 'other';
    if (!labCats[cat]) labCats[cat] = 0;
    labCats[cat]++;
  });
  Object.keys(labCats).sort().forEach(c => console.log(`${c}: ${labCats[c]}`));

  // Check for maquettes specific templates
  console.log('\n=== MAQUETTES SPECIFIC DATA CHECK ===');

  // From maquettes - Anamnese mobile items
  const anamneseItems = ['Baisse de la vision', 'Céphalées', 'Douleur', 'larmoiement', 'Rougeur'];
  console.log('\nAnamnese templates:');
  for (const item of anamneseItems) {
    const found = await db.collection('commenttemplates').findOne({
      $or: [
        { name: { $regex: item, $options: 'i' } },
        { text: { $regex: item, $options: 'i' } }
      ]
    });
    console.log(`  ${item}: ${found ? '✓' : '✗'}`);
  }

  // From maquettes - Dominante (diagnoses)
  const dominanteItems = ['Glaucome', 'Cataracte', 'DMLA', 'Diabète'];
  console.log('\nDominante (pathology) templates:');
  for (const item of dominanteItems) {
    const found = await db.collection('pathologytemplates').findOne({
      $or: [
        { name: { $regex: item, $options: 'i' } },
        { diagnosis: { $regex: item, $options: 'i' } }
      ]
    });
    console.log(`  ${item}: ${found ? '✓' : '✗'}`);
  }

  // From maquettes - Lab profiles
  const labProfiles = ['CHECK UP PROMO', 'PROFIL DIABETIQUE', 'PROFIL UVEITE', 'HEMOGRAMME'];
  console.log('\nLaboratory profiles:');
  for (const profile of labProfiles) {
    const found = await db.collection('laboratorytemplates').findOne({
      $or: [
        { name: { $regex: profile, $options: 'i' } },
        { category: { $regex: profile, $options: 'i' } }
      ]
    });
    console.log(`  ${profile}: ${found ? '✓' : '✗'}`);
  }

  // From maquettes - Ophthalmology procedures
  const ophProcs = ['Fluoangiographie', 'Oct Macula', 'Champ visuel', 'Biométrie', 'Laser YAG'];
  console.log('\nOphthalmology procedures:');
  for (const proc of ophProcs) {
    const found = await db.collection('clinicalacts').findOne({
      $or: [
        { name: { $regex: proc, $options: 'i' } },
        { code: { $regex: proc, $options: 'i' } }
      ]
    });
    console.log(`  ${proc}: ${found ? '✓' : '✗'}`);
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
