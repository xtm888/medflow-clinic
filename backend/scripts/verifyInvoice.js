const mongoose = require('mongoose');
require('dotenv').config();
const Invoice = require('../models/Invoice');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const inv = await Invoice.findOne({ 'summary.total': 1000000 });
  console.log('=== INVOICE ITEMS ===');
  inv.items.forEach(item => {
    const needsApproval = item.approvalRequired === true && item.hasApproval !== true;
    const status = item.notCovered ? 'NOT COVERED' 
      : needsApproval ? 'NEEDS DELIBERATION'
      : 'AUTO';
    console.log(item.description + ' (' + item.category + '):');
    console.log('  Status:', status);
    console.log('  Coverage:', item.coveragePercentage + '%');
    console.log('  Company:', (item.companyShare || 0).toLocaleString());
    console.log('  Patient:', (item.patientShare || 0).toLocaleString());
    console.log('');
  });
  
  console.log('=== INVOICE TOTALS ===');
  console.log('Company Share:', inv.companyBilling?.companyShare);
  console.log('Patient Share:', inv.companyBilling?.patientShare);
  console.log('Amount Due:', inv.summary?.amountDue);
  console.log('Has Approval Issues:', inv.companyBilling?.hasApprovalIssues);
  console.log('Items Needing Approval:', inv.companyBilling?.itemsNeedingApproval);
  
  mongoose.disconnect();
});
