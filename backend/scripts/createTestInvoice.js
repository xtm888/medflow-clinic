const mongoose = require('mongoose');
require('dotenv').config();

const Invoice = require('../models/Invoice');
const Patient = require('../models/Patient');
const User = require('../models/User');

async function createTestInvoice() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find a patient (get the first one)
    const patient = await Patient.findOne().sort({ createdAt: -1 });
    if (!patient) {
      console.error('❌ No patients found. Please create a patient first.');
      process.exit(1);
    }
    console.log(`✅ Found patient: ${patient.firstName} ${patient.lastName}`);

    // Find an admin/receptionist user
    const user = await User.findOne({ role: { $in: ['admin', 'receptionist'] } });
    if (!user) {
      console.error('❌ No admin/receptionist user found.');
      process.exit(1);
    }

    // Generate invoice ID
    const invoiceCount = await Invoice.countDocuments();
    const invoiceId = `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(6, '0')}`;

    // Create invoice with multiple items
    const items = [
      {
        description: 'Consultation Ophtalmologique Complète',
        category: 'consultation',
        code: 'CONS-001',
        quantity: 1,
        unitPrice: 50000, // 50,000 CDF
        discount: 0,
        subtotal: 50000,
        tax: 0,
        total: 50000
      },
      {
        description: 'Examen OCT (Tomographie par Cohérence Optique)',
        category: 'imaging',
        code: 'IMG-OCT',
        quantity: 2, // Both eyes
        unitPrice: 75000, // 75,000 CDF per eye
        discount: 10000, // 10,000 CDF discount
        subtotal: 150000,
        tax: 0,
        total: 140000
      },
      {
        description: 'Test du Champ Visuel',
        category: 'procedure',
        code: 'PROC-VF',
        quantity: 1,
        unitPrice: 40000, // 40,000 CDF
        discount: 0,
        subtotal: 40000,
        tax: 0,
        total: 40000
      },
      {
        description: 'Tonométrie (Mesure Pression Intraoculaire)',
        category: 'procedure',
        code: 'PROC-TON',
        quantity: 1,
        unitPrice: 15000, // 15,000 CDF
        discount: 0,
        subtotal: 15000,
        tax: 0,
        total: 15000
      },
      {
        description: 'Collyre Antibiotique',
        category: 'medication',
        code: 'MED-AB01',
        quantity: 2,
        unitPrice: 8000, // 8,000 CDF per bottle
        discount: 0,
        subtotal: 16000,
        tax: 0,
        total: 16000
      }
    ];

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const discountTotal = items.reduce((sum, item) => sum + item.discount, 0);
    const taxTotal = items.reduce((sum, item) => sum + item.tax, 0);
    const total = items.reduce((sum, item) => sum + item.total, 0);

    // Create invoice
    const invoice = await Invoice.create({
      invoiceId,
      patient: patient._id,
      dateIssued: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      items,
      summary: {
        subtotal,
        discountTotal,
        taxTotal,
        total,
        amountPaid: 0,
        amountDue: total
      },
      billing: {
        billTo: {
          name: `${patient.firstName} ${patient.lastName}`,
          phone: patient.contact?.phone,
          email: patient.contact?.email
        },
        currency: 'CDF', // Base currency
        taxRate: 0
      },
      status: 'issued',
      payments: [],
      currencyBreakdown: {
        CDF: 0,
        USD: 0,
        EUR: 0
      },
      notes: {
        internal: 'Test invoice for multi-currency payment demonstration',
        patient: 'Merci de votre visite. Plusieurs options de paiement disponibles: CDF, USD, EUR.',
        billing: 'Multi-currency payment test'
      },
      createdBy: user._id
    });

    console.log('\n✅ Test invoice created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📄 Invoice ID: ${invoice.invoiceId}`);
    console.log(`👤 Patient: ${patient.firstName} ${patient.lastName}`);
    console.log(`💰 Total: ${total.toLocaleString('fr-CD')} CDF`);
    console.log(`💵 Amount Due: ${invoice.summary.amountDue.toLocaleString('fr-CD')} CDF`);
    console.log(`📊 Status: ${invoice.status}`);
    console.log('\n📋 Invoice Items:');
    items.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.description} - ${item.total.toLocaleString('fr-CD')} CDF`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 You can now test multi-currency payments with:');
    console.log('   • CDF (Franc Congolais)');
    console.log('   • USD (Dollar US)');
    console.log('   • EUR (Euro)');
    console.log('\n🌐 Navigate to: Finances → Facturation → Find invoice ' + invoice.invoiceId);
    console.log('\n');

  } catch (error) {
    console.error('❌ Error creating test invoice:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

createTestInvoice();
