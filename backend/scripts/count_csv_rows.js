const fs = require('fs');
const csv = require('csv-parser');

const { requireNonProduction } = require('./_guards');
requireNonProduction('count_csv_rows.js');

let count = 0;
let withNumFiche = 0;
let emptyNumFiche = 0;

fs.createReadStream('/Users/xtm888/Downloads/LV_Patients.csv')
  .pipe(csv())
  .on('data', (row) => {
    count++;
    if (row.NumFiche && row.NumFiche.trim() !== '' && row.NumFiche !== 'NumFiche') {
      withNumFiche++;
    } else {
      emptyNumFiche++;
      if (emptyNumFiche <= 5) {
        console.log('Empty NumFiche at row', count, ':', JSON.stringify(row).substring(0, 200));
      }
    }
    if (count % 5000 === 0) {
      console.log(`Processed ${count} rows...`);
    }
  })
  .on('end', () => {
    console.log('\n=== CSV PARSING COMPLETE ===');
    console.log('Total rows read:', count);
    console.log('Rows with NumFiche:', withNumFiche);
    console.log('Rows without NumFiche:', emptyNumFiche);
  })
  .on('error', (err) => {
    console.error('Error:', err);
  });
