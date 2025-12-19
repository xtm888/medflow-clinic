const mongoose = require('mongoose');
require('dotenv').config();

// Import all relevant models
const LaboratoryTemplate = require('../models/LaboratoryTemplate');
const ClinicalAct = require('../models/ClinicalAct');
const DocumentTemplate = require('../models/DocumentTemplate');
const ExaminationTemplate = require('../models/ExaminationTemplate');
const PathologyTemplate = require('../models/PathologyTemplate');
const CommentTemplate = require('../models/CommentTemplate');
const DoseTemplate = require('../models/DoseTemplate');
const TreatmentProtocol = require('../models/TreatmentProtocol');
const AppointmentType = require('../models/AppointmentType');

async function checkAllData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');

    console.log('='.repeat(60));
    console.log('CARE VISION DATA AUDIT - ALL COLLECTIONS');
    console.log('='.repeat(60));

    // 1. Laboratory Templates
    console.log('\n=== LABORATORY TEMPLATES ===');
    const labCount = await LaboratoryTemplate.countDocuments();
    console.log('Total:', labCount);

    if (labCount > 0) {
      const labSamples = await LaboratoryTemplate.find().limit(10).select('name category');
      console.log('Samples:');
      labSamples.forEach(l => console.log('  -', l.name, l.category ? `(${l.category})` : ''));

      // Get categories
      const labCategories = await LaboratoryTemplate.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      if (labCategories.length > 0) {
        console.log('Categories:');
        labCategories.forEach(c => console.log('  ', c._id || 'Uncategorized', ':', c.count));
      }
    }

    // 2. Clinical Acts/Procedures
    console.log('\n=== CLINICAL ACTS/PROCEDURES ===');
    const clinicalCount = await ClinicalAct.countDocuments();
    console.log('Total:', clinicalCount);

    if (clinicalCount > 0) {
      const clinicalSamples = await ClinicalAct.find().limit(10).select('name code category');
      console.log('Samples:');
      clinicalSamples.forEach(c => console.log('  -', c.name, c.code ? `[${c.code}]` : ''));

      // Get categories
      const clinicalCategories = await ClinicalAct.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      if (clinicalCategories.length > 0) {
        console.log('Categories:');
        clinicalCategories.forEach(c => console.log('  ', c._id || 'Uncategorized', ':', c.count));
      }
    }

    // 3. Document Templates (Certificates, Letters)
    console.log('\n=== DOCUMENT TEMPLATES ===');
    const docCount = await DocumentTemplate.countDocuments();
    console.log('Total:', docCount);

    if (docCount > 0) {
      const docSamples = await DocumentTemplate.find().limit(10).select('name type category');
      console.log('Samples:');
      docSamples.forEach(d => console.log('  -', d.name, d.type ? `(${d.type})` : ''));

      // Get types
      const docTypes = await DocumentTemplate.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      if (docTypes.length > 0) {
        console.log('Types:');
        docTypes.forEach(t => console.log('  ', t._id || 'Untyped', ':', t.count));
      }
    }

    // 4. Examination Templates
    console.log('\n=== EXAMINATION TEMPLATES ===');
    const examCount = await ExaminationTemplate.countDocuments();
    console.log('Total:', examCount);

    if (examCount > 0) {
      const examSamples = await ExaminationTemplate.find().limit(10).select('name type');
      console.log('Samples:');
      examSamples.forEach(e => console.log('  -', e.name, e.type ? `(${e.type})` : ''));
    }

    // 5. Pathology Templates
    console.log('\n=== PATHOLOGY TEMPLATES ===');
    const pathCount = await PathologyTemplate.countDocuments();
    console.log('Total:', pathCount);

    if (pathCount > 0) {
      const pathSamples = await PathologyTemplate.find().limit(10).select('name category');
      console.log('Samples:');
      pathSamples.forEach(p => console.log('  -', p.name));
    }

    // 6. Comment Templates (for quick notes)
    console.log('\n=== COMMENT TEMPLATES ===');
    const commentCount = await CommentTemplate.countDocuments();
    console.log('Total:', commentCount);

    if (commentCount > 0) {
      const commentCategories = await CommentTemplate.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      console.log('Categories:');
      commentCategories.forEach(c => console.log('  ', c._id || 'Uncategorized', ':', c.count));
    }

    // 7. Dose Templates
    console.log('\n=== DOSE TEMPLATES ===');
    const doseCount = await DoseTemplate.countDocuments();
    console.log('Total:', doseCount);

    // 8. Treatment Protocols
    console.log('\n=== TREATMENT PROTOCOLS ===');
    const protocolCount = await TreatmentProtocol.countDocuments();
    console.log('Total:', protocolCount);

    if (protocolCount > 0) {
      const protocolSamples = await TreatmentProtocol.find().limit(5).select('name condition');
      console.log('Samples:');
      protocolSamples.forEach(p => console.log('  -', p.name, p.condition ? `(${p.condition})` : ''));
    }

    // 9. Appointment Types
    console.log('\n=== APPOINTMENT TYPES ===');
    const apptCount = await AppointmentType.countDocuments();
    console.log('Total:', apptCount);

    if (apptCount > 0) {
      const apptSamples = await AppointmentType.find().limit(10).select('name duration');
      console.log('Types:');
      apptSamples.forEach(a => console.log('  -', a.name, a.duration ? `(${a.duration} min)` : ''));
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log('Laboratory Templates:', labCount);
    console.log('Clinical Acts/Procedures:', clinicalCount);
    console.log('Document Templates:', docCount);
    console.log('Examination Templates:', examCount);
    console.log('Pathology Templates:', pathCount);
    console.log('Comment Templates:', commentCount);
    console.log('Dose Templates:', doseCount);
    console.log('Treatment Protocols:', protocolCount);
    console.log('Appointment Types:', apptCount);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

checkAllData();
