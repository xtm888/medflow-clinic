// Script to create performance indexes for optical shop
// Run with: node scripts/createOpticalShopIndexes.js

const mongoose = require('mongoose');
require('dotenv').config();

async function createIndexes() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // GlassesOrder indexes
    console.log('Creating GlassesOrder indexes...');
    try {
      await db.collection('glassesorders').createIndexes([
        { key: { clinic: 1, status: 1 }, name: 'clinic_status' },
        { key: { 'opticalShop.optician': 1, createdAt: -1 }, name: 'optician_created' },
        { key: { patient: 1, createdAt: -1 }, name: 'patient_created' },
        { key: { status: 1, 'opticalShop.verification.submittedAt': 1 }, name: 'status_verification' },
        { key: { 'frameTryOnPhotos.frameId': 1 }, name: 'tryon_frame', sparse: true }
      ]);
      console.log('  GlassesOrder indexes created');
    } catch (err) {
      console.log('  GlassesOrder indexes:', err.message);
    }

    // FrameInventory indexes
    console.log('Creating FrameInventory indexes...');
    try {
      await db.collection('frameinventories').createIndexes([
        { key: { clinic: 1, 'inventory.status': 1 }, name: 'clinic_status' },
        { key: { brand: 'text', model: 'text', sku: 'text', color: 'text' }, name: 'text_search' }
      ]);
      console.log('  FrameInventory indexes created');
    } catch (err) {
      console.log('  FrameInventory indexes:', err.message);
    }

    // Invoice indexes
    console.log('Creating Invoice indexes...');
    try {
      await db.collection('invoices').createIndexes([
        { key: { patient: 1, dateIssued: -1 }, name: 'patient_date' },
        { key: { clinic: 1, paymentStatus: 1 }, name: 'clinic_payment' }
      ]);
      console.log('  Invoice indexes created');
    } catch (err) {
      console.log('  Invoice indexes:', err.message);
    }

    // Approval indexes
    console.log('Creating Approval indexes...');
    try {
      await db.collection('approvals').createIndexes([
        { key: { patient: 1, company: 1, actCode: 1, status: 1 }, name: 'patient_company_act_status' }
      ]);
      console.log('  Approval indexes created');
    } catch (err) {
      console.log('  Approval indexes:', err.message);
    }

    // OpticalLensInventory indexes
    console.log('Creating OpticalLensInventory indexes...');
    try {
      await db.collection('opticallensinventories').createIndexes([
        { key: { material: 1, design: 1, isActive: 1, 'inventory.currentStock': 1 }, name: 'material_design_stock' }
      ]);
      console.log('  OpticalLensInventory indexes created');
    } catch (err) {
      console.log('  OpticalLensInventory indexes:', err.message);
    }

    // ContactLensInventory indexes
    console.log('Creating ContactLensInventory indexes...');
    try {
      await db.collection('contactlensinventories').createIndexes([
        { key: { clinic: 1, 'inventory.status': 1 }, name: 'clinic_status' },
        { key: { brand: 1, 'parameters.baseCurve': 1, 'parameters.power': 1 }, name: 'brand_params' }
      ]);
      console.log('  ContactLensInventory indexes created');
    } catch (err) {
      console.log('  ContactLensInventory indexes:', err.message);
    }

    console.log('\n✅ All indexes created successfully!');
    console.log('\nIndex summary:');
    console.log('  - GlassesOrder: 5 indexes (clinic/status, optician/created, patient, verification, try-on)');
    console.log('  - FrameInventory: 2 indexes (clinic/status, text search)');
    console.log('  - Invoice: 2 indexes (patient/date, clinic/payment)');
    console.log('  - Approval: 1 compound index (patient/company/act/status)');
    console.log('  - OpticalLensInventory: 1 compound index (material/design/stock)');
    console.log('  - ContactLensInventory: 2 indexes (clinic/status, brand/params)');

    process.exit(0);
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  }
}

createIndexes();
