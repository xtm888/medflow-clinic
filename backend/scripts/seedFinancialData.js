#!/usr/bin/env node
/**
 * Financial Data Seeder
 * =====================
 * Populates the system with realistic financial data for dashboard testing.
 *
 * Creates:
 * - 50+ paid invoices with various payment methods
 * - 20+ partial payments
 * - 15+ pending invoices
 * - Payment transactions across 90-day range
 * - Revenue distribution across services
 *
 * Usage: node scripts/seedFinancialData.js [--count=N]
 */

const mongoose = require('mongoose');
require('dotenv').config();

const { requireNonProduction } = require('./_guards');
requireNonProduction('seedFinancialData.js');

// Models
const Invoice = require('../models/Invoice');
const Patient = require('../models/Patient');
const User = require('../models/User');
const Clinic = require('../models/Clinic');
const Visit = require('../models/Visit');
const FeeSchedule = require('../models/FeeSchedule');

// Parse arguments
const args = process.argv.slice(2);
const countArg = args.find(a => a.startsWith('--count='));
const BASE_COUNT = countArg ? parseInt(countArg.split('=')[1]) : 50;

// Helper functions
function randomElement(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysBack = 90) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date;
}

function generatePaymentId() {
  return `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Payment methods with their typical distribution
const PAYMENT_METHODS = [
  { method: 'cash', weight: 40 },
  { method: 'mobile-payment', weight: 20 },
  { method: 'orange-money', weight: 15 },
  { method: 'mtn-money', weight: 10 },
  { method: 'card', weight: 8 },
  { method: 'bank-transfer', weight: 5 },
  { method: 'wave', weight: 2 }
];

function weightedRandomMethod() {
  const totalWeight = PAYMENT_METHODS.reduce((sum, m) => sum + m.weight, 0);
  let random = Math.random() * totalWeight;
  for (const pm of PAYMENT_METHODS) {
    random -= pm.weight;
    if (random <= 0) return pm.method;
  }
  return 'cash';
}

// Service categories with typical prices (CDF)
const SERVICE_CATEGORIES = [
  { category: 'consultation', name: 'Consultation ophtalmologique', minPrice: 15000, maxPrice: 50000 },
  { category: 'examination', name: 'Examen de la vue', minPrice: 10000, maxPrice: 30000 },
  { category: 'procedure', name: 'Acte médical', minPrice: 25000, maxPrice: 100000 },
  { category: 'imaging', name: 'Imagerie médicale', minPrice: 50000, maxPrice: 200000 },
  { category: 'laboratory', name: 'Analyses laboratoire', minPrice: 20000, maxPrice: 80000 },
  { category: 'optical', name: 'Équipement optique', minPrice: 50000, maxPrice: 500000 },
  { category: 'medication', name: 'Médicaments', minPrice: 5000, maxPrice: 100000 },
  { category: 'surgery', name: 'Intervention chirurgicale', minPrice: 500000, maxPrice: 2000000 }
];

// Stats tracking
const stats = {
  paidInvoices: 0,
  partialInvoices: 0,
  pendingInvoices: 0,
  totalRevenue: 0,
  paymentsByMethod: {}
};

async function createInvoiceWithPayment(patient, clinic, user, paymentStatus) {
  // Generate 1-4 items per invoice
  const itemCount = randomInt(1, 4);
  const items = [];
  let subtotal = 0;

  for (let i = 0; i < itemCount; i++) {
    const service = randomElement(SERVICE_CATEGORIES);
    const unitPrice = randomInt(service.minPrice, service.maxPrice);
    const quantity = randomInt(1, 2);
    const itemSubtotal = unitPrice * quantity;
    const discount = Math.random() < 0.2 ? Math.floor(itemSubtotal * 0.1) : 0; // 20% chance of 10% discount
    const tax = 0; // No tax in this system
    const total = itemSubtotal - discount + tax;

    items.push({
      itemId: new mongoose.Types.ObjectId().toString(),
      description: `${service.name} ${i + 1}`,
      category: service.category,
      code: `${service.category.toUpperCase().slice(0, 3)}${randomInt(100, 999)}`,
      quantity,
      unitPrice,
      discount,
      subtotal: itemSubtotal,
      tax,
      total,
      realization: {
        realized: paymentStatus === 'paid' || Math.random() > 0.3,
        realizedAt: new Date(),
        realizedBy: user._id
      }
    });

    subtotal += total;
  }

  const discountTotal = items.reduce((sum, item) => sum + (item.discount || 0), 0);
  const taxTotal = items.reduce((sum, item) => sum + (item.tax || 0), 0);
  const total = subtotal;

  // Determine payment amounts based on status
  let amountPaid = 0;
  let payments = [];
  const invoiceDate = randomDate(90);

  if (paymentStatus === 'paid') {
    // Full payment
    amountPaid = total;
    const paymentMethod = weightedRandomMethod();
    payments.push({
      paymentId: generatePaymentId(),
      amount: total,
      currency: 'CDF',
      amountInBaseCurrency: total,
      exchangeRate: 1,
      method: paymentMethod,
      date: new Date(invoiceDate.getTime() + randomInt(0, 3) * 24 * 60 * 60 * 1000),
      reference: `REF-${Date.now()}-${randomInt(1000, 9999)}`,
      receivedBy: user._id,
      notes: 'Paiement complet'
    });

    stats.paymentsByMethod[paymentMethod] = (stats.paymentsByMethod[paymentMethod] || 0) + total;
    stats.paidInvoices++;
    stats.totalRevenue += total;

  } else if (paymentStatus === 'partial') {
    // Partial payment (30-70% of total)
    const paymentPercent = randomInt(30, 70) / 100;
    amountPaid = Math.floor(total * paymentPercent);
    const paymentMethod = weightedRandomMethod();

    payments.push({
      paymentId: generatePaymentId(),
      amount: amountPaid,
      currency: 'CDF',
      amountInBaseCurrency: amountPaid,
      exchangeRate: 1,
      method: paymentMethod,
      date: new Date(invoiceDate.getTime() + randomInt(0, 7) * 24 * 60 * 60 * 1000),
      reference: `REF-${Date.now()}-${randomInt(1000, 9999)}`,
      receivedBy: user._id,
      notes: 'Paiement partiel - solde à payer'
    });

    stats.paymentsByMethod[paymentMethod] = (stats.paymentsByMethod[paymentMethod] || 0) + amountPaid;
    stats.partialInvoices++;
    stats.totalRevenue += amountPaid;

  } else {
    // Pending - no payment
    stats.pendingInvoices++;
  }

  const amountDue = total - amountPaid;

  // Determine status
  let status = 'issued';
  if (amountPaid >= total) {
    status = 'paid';
  } else if (amountPaid > 0) {
    status = 'partial';
  } else if (new Date() > new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000)) {
    status = 'overdue';
  }

  const invoice = new Invoice({
    patient: patient._id,
    clinic: clinic._id,
    dateIssued: invoiceDate,
    dueDate: new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000),
    items,
    summary: {
      subtotal,
      discountTotal,
      taxTotal,
      total,
      amountPaid,
      amountDue
    },
    payments,
    status,
    currency: 'CDF',
    paidDate: status === 'paid' ? new Date(invoiceDate.getTime() + randomInt(0, 3) * 24 * 60 * 60 * 1000) : null,
    createdBy: user._id,
    updatedBy: user._id
  });

  await invoice.save();
  return invoice;
}

async function seedFinancialData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB\n');

    // Load reference data
    console.log('📚 Loading reference data...');
    const patients = await Patient.find({}).limit(200).lean();
    const users = await User.find({ isActive: true }).lean();
    const clinics = await Clinic.find({}).lean();

    if (patients.length === 0) {
      throw new Error('No patients found. Run patient import first.');
    }

    if (clinics.length === 0) {
      throw new Error('No clinics found. Run clinic seeding first.');
    }

    const cashiers = users.filter(u => ['cashier', 'admin', 'receptionist'].includes(u.role));
    if (cashiers.length === 0) {
      // Fallback to any user
      cashiers.push(...users.slice(0, 5));
    }

    console.log(`  Found ${patients.length} patients, ${users.length} users, ${clinics.length} clinics`);
    console.log(`  Found ${cashiers.length} cashiers/admins\n`);

    // Clean up previous financial test data
    console.log('🧹 Cleaning up previous test invoices...');
    const deleteResult = await Invoice.deleteMany({
      'items.0.description': { $regex: /^(Consultation|Examen|Acte|Imagerie|Analyses|Équipement|Médicaments|Intervention)/ }
    });
    console.log(`  Deleted ${deleteResult.deletedCount} previous test invoices\n`);

    // Create invoices with various payment statuses
    console.log('💰 Creating financial data...\n');

    // 50 paid invoices
    console.log('  Creating paid invoices...');
    for (let i = 0; i < BASE_COUNT; i++) {
      const patient = randomElement(patients);
      const clinic = randomElement(clinics);
      const user = randomElement(cashiers);
      await createInvoiceWithPayment(patient, clinic, user, 'paid');
      if ((i + 1) % 10 === 0) process.stdout.write(`    ${i + 1}/${BASE_COUNT}\r`);
    }
    console.log(`  ✅ Created ${stats.paidInvoices} paid invoices`);

    // 20 partial payments
    const partialCount = Math.floor(BASE_COUNT * 0.4);
    console.log('  Creating partial payment invoices...');
    for (let i = 0; i < partialCount; i++) {
      const patient = randomElement(patients);
      const clinic = randomElement(clinics);
      const user = randomElement(cashiers);
      await createInvoiceWithPayment(patient, clinic, user, 'partial');
    }
    console.log(`  ✅ Created ${stats.partialInvoices} partial payment invoices`);

    // 15 pending invoices
    const pendingCount = Math.floor(BASE_COUNT * 0.3);
    console.log('  Creating pending invoices...');
    for (let i = 0; i < pendingCount; i++) {
      const patient = randomElement(patients);
      const clinic = randomElement(clinics);
      const user = randomElement(cashiers);
      await createInvoiceWithPayment(patient, clinic, user, 'pending');
    }
    console.log(`  ✅ Created ${stats.pendingInvoices} pending invoices`);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Financial Data Summary');
    console.log('='.repeat(50));
    console.log(`Total invoices created: ${stats.paidInvoices + stats.partialInvoices + stats.pendingInvoices}`);
    console.log(`  - Paid: ${stats.paidInvoices}`);
    console.log(`  - Partial: ${stats.partialInvoices}`);
    console.log(`  - Pending: ${stats.pendingInvoices}`);
    console.log(`\nTotal revenue collected: ${stats.totalRevenue.toLocaleString()} CDF`);
    console.log(`  (${(stats.totalRevenue / 2800).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD equivalent)`);
    console.log('\nPayments by method:');
    for (const [method, amount] of Object.entries(stats.paymentsByMethod)) {
      console.log(`  - ${method}: ${amount.toLocaleString()} CDF`);
    }

    console.log('\n✅ Financial data seeding complete!');
    console.log('   The Financial Dashboard should now show revenue data.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

seedFinancialData();
