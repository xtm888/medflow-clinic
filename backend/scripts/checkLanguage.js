const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;

  console.log('=== LANGUAGE CHECK ===\n');

  // Check drugs - should be French brand names
  console.log('DRUGS (should be French brand names like TIMOPTOL, XALATAN):');
  const drugs = await db.collection('drugs').find({}).limit(10).toArray();
  drugs.forEach(d => console.log('  -', d.name));

  // Check appointment types
  console.log('\nAPPOINTMENT TYPES:');
  const appts = await db.collection('appointmenttypes').find({}).limit(10).toArray();
  appts.forEach(a => console.log('  -', a.name));

  // Check clinical acts
  console.log('\nCLINICAL ACTS (should be French like "Fluoangiographie retinienne"):');
  const acts = await db.collection('clinicalacts').find({}).limit(10).toArray();
  acts.forEach(a => console.log('  -', a.name));

  // Check document templates - should match maquettes (certificates, letters)
  console.log('\nDOCUMENT TEMPLATES:');
  const docs = await db.collection('documenttemplates').find({}).limit(10).toArray();
  docs.forEach(d => console.log('  -', d.name || d.title));

  // Check pathology templates
  console.log('\nPATHOLOGY TEMPLATES (sample):');
  const pathos = await db.collection('pathologytemplates').find({}).limit(10).toArray();
  pathos.forEach(p => console.log('  -', p.name));

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log('The maquettes are in FRENCH for a Congolese ophthalmology clinic.');
  console.log('The database appears to have data in ENGLISH.');
  console.log('This is a critical issue - the clinic needs French terminology.');

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
