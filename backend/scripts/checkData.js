const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProduction } = require('./_guards');
requireNonProduction('checkData.js');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;

  console.log('=== DRUGS BY CATEGORY ===');
  const drugs = await db.collection('drugs').find({}).toArray();
  const categories = {};
  drugs.forEach(d => {
    const cat = d.category || 'uncategorized';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(d.name || d.genericName);
  });

  Object.keys(categories).sort().forEach(cat => {
    console.log(`${cat}: ${categories[cat].length} items`);
  });

  console.log('\n=== SAMPLE DRUGS ===');
  const samples = await db.collection('drugs').find({}).limit(15).toArray();
  samples.forEach(d => console.log('-', d.name || d.genericName, `(${d.category || 'none'})`));

  // Check if maquettes categories are present
  console.log('\n=== MAQUETTES CATEGORIES CHECK ===');
  const maquetteCategories = [
    'A.I.N.S GENERAUX + CORTICOIDES',
    'A.I.N.S LOCAUX',
    'ANTI ALLERGIQUES',
    'ANTIBIOTIQUE LOCAUX',
    'ANTIBIOTIQUE GENERAUX',
    'ANTI GLAUCOMATEUX',
    'MYDRIATIQUES',
    'LARMES ARTIFICIELLES'
  ];

  maquetteCategories.forEach(cat => {
    const found = categories[cat] ? categories[cat].length : 0;
    console.log(`${cat}: ${found > 0 ? `✓ ${found} items` : '✗ MISSING'}`);
  });

  // Sample specific drugs from maquettes
  console.log('\n=== SPECIFIC DRUGS CHECK ===');
  const maquetteDrugs = ['TIMOPTOL', 'XALATAN', 'TOBREX', 'VOLTARENE', 'ATROPINE'];
  for (const name of maquetteDrugs) {
    const found = await db.collection('drugs').findOne({
      $or: [
        { name: { $regex: name, $options: 'i' } },
        { genericName: { $regex: name, $options: 'i' } }
      ]
    });
    console.log(`${name}: ${found ? '✓ Found' : '✗ MISSING'}`);
  }

  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
