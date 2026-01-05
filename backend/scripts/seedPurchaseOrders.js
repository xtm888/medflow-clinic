/**
 * Seed Purchase Orders with Sample Data
 * Creates realistic purchase orders across different departments
 */

require('dotenv').config();
const mongoose = require('mongoose');
const PurchaseOrder = require('../models/PurchaseOrder');
const User = require('../models/User');
const Clinic = require('../models/Clinic');

// Sample suppliers for Congo/DRC context
const SUPPLIERS = [
  {
    name: 'Pharma Congo SARL',
    contactPerson: 'Jean-Pierre Mukendi',
    email: 'commandes@pharmacongo.cd',
    phone: '+243 81 234 5678',
    address: '123 Avenue Lumumba, Kinshasa'
  },
  {
    name: 'OptiVision Africa',
    contactPerson: 'Marie Kabongo',
    email: 'orders@optivision.cd',
    phone: '+243 99 876 5432',
    address: '45 Boulevard du 30 Juin, Kinshasa'
  },
  {
    name: 'MedLab Supplies',
    contactPerson: 'Patrick Tshisekedi',
    email: 'supply@medlab.cd',
    phone: '+243 82 345 6789',
    address: '78 Rue de la Science, Lubumbashi'
  },
  {
    name: 'Surgical Equipment International',
    contactPerson: 'Claire Mbuyi',
    email: 'orders@surgequip.com',
    phone: '+243 81 567 8901',
    address: '90 Avenue Kasa-Vubu, Kinshasa'
  },
  {
    name: 'General Medical Distributors',
    contactPerson: 'François Kabila',
    email: 'sales@gmd-congo.cd',
    phone: '+243 99 012 3456',
    address: "12 Place de l'Indépendance, Goma"
  }
];

// Sample items by department
// Valid inventoryType enum: 'pharmacy', 'frame', 'contactLens', 'opticalLens', 'reagent', 'labConsumable', 'surgicalSupply'
const ITEMS_BY_DEPARTMENT = {
  pharmacy: [
    { itemName: 'Timolol 0.5% Collyre', itemCode: 'PHARM-TIM-05', inventoryType: 'pharmacy', unitPrice: 8500, unit: 'flacon' },
    { itemName: 'Latanoprost 0.005%', itemCode: 'PHARM-LAT-005', inventoryType: 'pharmacy', unitPrice: 25000, unit: 'flacon' },
    { itemName: 'Tropicamide 1%', itemCode: 'PHARM-TRO-1', inventoryType: 'pharmacy', unitPrice: 6500, unit: 'flacon' },
    { itemName: 'Fluorescéine Bandelettes', itemCode: 'PHARM-FLU-BAN', inventoryType: 'pharmacy', unitPrice: 15000, unit: 'boîte' },
    { itemName: 'Tobramycine 0.3%', itemCode: 'PHARM-TOB-03', inventoryType: 'pharmacy', unitPrice: 12000, unit: 'flacon' }
  ],
  optical: [
    { itemName: 'Monture Ray-Ban RB5154', itemCode: 'OPT-RB-5154', inventoryType: 'frame', unitPrice: 85000, unit: 'pièce' },
    { itemName: 'Verre Essilor Crizal', itemCode: 'OPT-ESS-CRZ', inventoryType: 'opticalLens', unitPrice: 45000, unit: 'paire' },
    { itemName: 'Lentilles Acuvue Oasys', itemCode: 'OPT-ACV-OAS', inventoryType: 'contactLens', unitPrice: 35000, unit: 'boîte' },
    { itemName: 'Monture Oakley OX8046', itemCode: 'OPT-OAK-8046', inventoryType: 'frame', unitPrice: 95000, unit: 'pièce' },
    { itemName: 'Verre progressif Varilux', itemCode: 'OPT-VAR-PRO', inventoryType: 'opticalLens', unitPrice: 75000, unit: 'paire' }
  ],
  laboratory: [
    { itemName: 'Réactif Glucose', itemCode: 'LAB-GLU-REA', inventoryType: 'reagent', unitPrice: 75000, unit: 'kit' },
    { itemName: 'Tubes EDTA 5ml', itemCode: 'LAB-TUB-EDT', inventoryType: 'labConsumable', unitPrice: 25000, unit: 'boîte de 100' },
    { itemName: 'Lames de microscope', itemCode: 'LAB-LAM-MIC', inventoryType: 'labConsumable', unitPrice: 8000, unit: 'boîte de 50' },
    { itemName: 'Contrôle qualité HbA1c', itemCode: 'LAB-CQ-HBA', inventoryType: 'reagent', unitPrice: 120000, unit: 'kit' },
    { itemName: 'Pipettes Pasteur stériles', itemCode: 'LAB-PIP-PAS', inventoryType: 'labConsumable', unitPrice: 12000, unit: 'boîte de 500' }
  ],
  surgery: [
    { itemName: 'Kit phacoémulsification', itemCode: 'SUR-KIT-PHA', inventoryType: 'surgicalSupply', unitPrice: 450000, unit: 'kit' },
    { itemName: 'IOL pliable +20.0D', itemCode: 'SUR-IOL-20', inventoryType: 'surgicalSupply', unitPrice: 180000, unit: 'pièce' },
    { itemName: 'Viscoélastique OVD', itemCode: 'SUR-VIS-OVD', inventoryType: 'surgicalSupply', unitPrice: 95000, unit: 'seringue' },
    { itemName: 'Gants chirurgicaux stériles', itemCode: 'SUR-GAN-STE', inventoryType: 'surgicalSupply', unitPrice: 35000, unit: 'boîte de 50' },
    { itemName: 'Champs opératoires', itemCode: 'SUR-CHA-OPE', inventoryType: 'surgicalSupply', unitPrice: 25000, unit: 'paquet de 10' }
  ],
  general: [
    { itemName: 'Papier thermique ECG', itemCode: 'GEN-PAP-ECG', inventoryType: 'labConsumable', unitPrice: 8000, unit: 'rouleau' },
    { itemName: 'Gel échographie', itemCode: 'GEN-GEL-ECH', inventoryType: 'labConsumable', unitPrice: 15000, unit: 'flacon 500ml' },
    { itemName: 'Masques chirurgicaux', itemCode: 'GEN-MAS-CHI', inventoryType: 'surgicalSupply', unitPrice: 20000, unit: 'boîte de 50' },
    { itemName: 'Désinfectant surfaces', itemCode: 'GEN-DES-SUR', inventoryType: 'labConsumable', unitPrice: 12000, unit: 'bidon 5L' },
    { itemName: 'Compresses stériles', itemCode: 'GEN-COM-STE', inventoryType: 'surgicalSupply', unitPrice: 8500, unit: 'paquet de 100' }
  ]
};

function randomPastDate(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date;
}

function randomFutureDate(daysAhead) {
  const date = new Date();
  date.setDate(date.getDate() + Math.floor(Math.random() * daysAhead) + 1);
  return date;
}

async function seedPurchaseOrders() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const clinic = await Clinic.findOne();
    if (!clinic) {
      console.error('No clinic found. Please run seedClinics.js first.');
      process.exit(1);
    }

    const adminUser = await User.findOne({ role: 'admin' });
    const pharmacist = await User.findOne({ role: 'pharmacist' }) || adminUser;
    const labTech = await User.findOne({ role: 'lab_tech' }) || adminUser;

    if (!adminUser) {
      console.error('No admin user found. Please run seed scripts first.');
      process.exit(1);
    }

    await PurchaseOrder.deleteMany({});
    console.log('Cleared existing purchase orders');

    const purchaseOrders = [];
    const departments = Object.keys(ITEMS_BY_DEPARTMENT);
    const statuses = ['draft', 'pending_approval', 'approved', 'sent', 'partial_received', 'received', 'closed'];

    // Generate PO numbers for this batch
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    for (let i = 0; i < 25; i++) {
      const poNumber = `PO-${year}${month}-${String(i + 1).padStart(5, '0')}`;
      const department = departments[Math.floor(Math.random() * departments.length)];
      const supplier = SUPPLIERS[Math.floor(Math.random() * SUPPLIERS.length)];
      const departmentItems = ITEMS_BY_DEPARTMENT[department];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      const numItems = Math.floor(Math.random() * 3) + 2;
      const selectedItems = [];
      const usedIndexes = new Set();

      for (let j = 0; j < Math.min(numItems, departmentItems.length); j++) {
        let idx;
        do {
          idx = Math.floor(Math.random() * departmentItems.length);
        } while (usedIndexes.has(idx));
        usedIndexes.add(idx);

        const item = departmentItems[idx];
        const quantity = Math.floor(Math.random() * 20) + 5;
        const receivedQty = status === 'received' || status === 'closed'
          ? quantity
          : status === 'partial_received'
            ? Math.floor(quantity / 2)
            : 0;

        selectedItems.push({
          itemName: item.itemName,
          itemCode: item.itemCode,
          inventoryType: item.inventoryType,
          quantityOrdered: quantity,
          quantityReceived: receivedQty,
          unit: item.unit,
          unitPrice: item.unitPrice,
          totalPrice: quantity * item.unitPrice,
          status: receivedQty >= quantity ? 'received' : receivedQty > 0 ? 'partial' : 'pending',
          notes: receivedQty > 0 ? 'Reçu le ' + new Date().toLocaleDateString('fr-FR') : ''
        });
      }

      const subtotal = selectedItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const totalTax = Math.round(subtotal * 0.16); // 16% TVA
      const shippingCost = Math.floor(Math.random() * 50000) + 10000;

      const history = [{ action: 'created', performedBy: adminUser._id, performedAt: randomPastDate(30), details: { notes: 'Commande créée' } }];

      if (['pending_approval', 'approved', 'sent', 'partial_received', 'received', 'closed'].includes(status)) {
        history.push({ action: 'submitted_for_approval', performedBy: adminUser._id, performedAt: randomPastDate(28), details: { notes: 'Soumis pour approbation' } });
      }
      if (['approved', 'sent', 'partial_received', 'received', 'closed'].includes(status)) {
        history.push({ action: 'approved', performedBy: adminUser._id, performedAt: randomPastDate(25), details: { notes: 'Approuvé par la direction' } });
      }
      if (['sent', 'partial_received', 'received', 'closed'].includes(status)) {
        history.push({ action: 'sent_to_supplier', performedBy: adminUser._id, performedAt: randomPastDate(20), details: { notes: 'Envoyé au fournisseur' } });
      }
      if (['partial_received', 'received', 'closed'].includes(status)) {
        history.push({ action: 'items_received', performedBy: department === 'pharmacy' ? pharmacist._id : labTech._id, performedAt: randomPastDate(10), details: { notes: status === 'partial_received' ? 'Réception partielle' : 'Réception complète' } });
      }
      if (status === 'closed') {
        history.push({ action: 'closed', performedBy: adminUser._id, performedAt: randomPastDate(5), details: { notes: 'Commande clôturée' } });
      }

      const poData = {
        poNumber: poNumber,
        clinic: clinic._id,
        department: department,
        supplier: supplier,
        items: selectedItems,
        subtotal: subtotal,
        totalTax: totalTax,
        shippingCost: shippingCost,
        grandTotal: subtotal + totalTax + shippingCost,
        currency: 'CDF',
        status: status,
        priority: ['low', 'normal', 'high', 'urgent'][Math.floor(Math.random() * 4)],
        expectedDeliveryDate: randomFutureDate(30),
        notes: 'Commande ' + department + ' - ' + supplier.name,
        history: history,
        createdBy: adminUser._id
      };

      if (['approved', 'sent', 'partial_received', 'received', 'closed'].includes(status)) {
        poData.approvedBy = adminUser._id;
        poData.approvedAt = randomPastDate(25);
      }
      if (['sent', 'partial_received', 'received', 'closed'].includes(status)) {
        poData.sentAt = randomPastDate(20);
        poData.sentBy = adminUser._id;
      }
      if (['partial_received', 'received', 'closed'].includes(status)) {
        poData.actualDeliveryDate = randomPastDate(10);
        poData.receivedBy = department === 'pharmacy' ? pharmacist._id : labTech._id;
      }
      if (status === 'closed') {
        poData.closedBy = adminUser._id;
        poData.closedAt = randomPastDate(5);
      }

      // Use save() instead of insertMany() to trigger pre-save hooks (poNumber generation)
      const po = new PurchaseOrder(poData);
      await po.save();
      purchaseOrders.push(po);
    }

    console.log('✅ Created ' + purchaseOrders.length + ' purchase orders');

    const statusCounts = {};
    purchaseOrders.forEach(po => { statusCounts[po.status] = (statusCounts[po.status] || 0) + 1; });
    console.log('\nPurchase Orders by Status:');
    Object.entries(statusCounts).forEach(([s, c]) => console.log('  ' + s + ': ' + c));

    const deptCounts = {};
    purchaseOrders.forEach(po => { deptCounts[po.department] = (deptCounts[po.department] || 0) + 1; });
    console.log('\nPurchase Orders by Department:');
    Object.entries(deptCounts).forEach(([d, c]) => console.log('  ' + d + ': ' + c));

    console.log('\n✅ Purchase Order seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding purchase orders:', error);
    process.exit(1);
  }
}

seedPurchaseOrders();
