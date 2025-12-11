const axios = require('axios');

const BASE_URL = 'http://localhost:5001/api';
const VISIT_ID = '6937e4c362aeaa07dd1748c6';

async function test() {
  console.log('=== Testing Pharmacy Invoice Endpoint ===\n');

  // Login
  console.log('1. Logging in...');
  const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
    email: 'admin@medflow.com',
    password: 'Admin123!'
  });
  const token = loginRes.data.token;
  console.log('   Token received');

  const config = {
    headers: { Authorization: `Bearer ${token}` }
  };

  // Test general invoices endpoint first
  console.log('\n2. Testing general invoices endpoint...');
  try {
    const invoicesRes = await axios.get(`${BASE_URL}/invoices?limit=1`, config);
    console.log('   Success:', invoicesRes.data.success, '| Count:', invoicesRes.data.count);
  } catch (err) {
    console.log('   Error:', err.response?.data?.error || err.message);
  }

  // Test pharmacy endpoint
  console.log(`\n3. Testing pharmacy invoice endpoint for visit: ${VISIT_ID}...`);
  try {
    const pharmacyRes = await axios.get(`${BASE_URL}/invoices/pharmacy/${VISIT_ID}`, config);
    console.log('   Success:', pharmacyRes.data.success);

    if (pharmacyRes.data.data) {
      const data = pharmacyRes.data.data;
      console.log('\n   Invoice:', data.invoice?._id);
      console.log('   Patient:', data.invoice?.patient?.firstName, data.invoice?.patient?.lastName);
      console.log('   Items:', data.invoice?.items?.length);

      if (data.invoice?.items) {
        console.log('\n   Medication Items:');
        data.invoice.items.forEach(item => {
          console.log(`     - ${item.description}: ${item.quantity} x ${item.unitPrice} = ${item.total} (${item.status})`);
        });
      }

      console.log('\n   Permissions:');
      console.log('     canDispense:', data.canDispense);
      console.log('     canMarkExternal:', data.canMarkExternal);
      console.log('     canCollectPayment:', data.canCollectPayment);
    }
  } catch (err) {
    console.log('   Error:', err.response?.data?.error || err.message);
    if (err.response?.status) {
      console.log('   Status:', err.response.status);
    }
  }

  // Test invoice items endpoint
  console.log('\n4. Testing invoice items endpoint...');
  try {
    // First get the invoice for the visit
    const mongoose = require('mongoose');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/medflow');
    const Invoice = require('../models/Invoice');
    const invoice = await mongoose.model('Invoice').findOne({ visit: VISIT_ID });
    await mongoose.disconnect();

    if (invoice) {
      console.log(`   Found invoice: ${invoice._id}`);
      const itemsRes = await axios.get(`${BASE_URL}/invoices/${invoice._id}/items`, config);
      console.log('   Success:', itemsRes.data.success);
      console.log('   Items:', itemsRes.data.data?.items?.length);
    }
  } catch (err) {
    console.log('   Error:', err.response?.data?.error || err.message);
  }

  console.log('\n=== Test Complete ===');
}

test().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
