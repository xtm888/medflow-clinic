---
name: today-stats
description: Show today's activity statistics for MedFlow
---

# Today's MedFlow Statistics

Get today's activity summary:

```bash
mongosh medflow --eval "
  const today = new Date();
  today.setHours(0,0,0,0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  print('=== MedFlow Stats for ' + today.toLocaleDateString('fr-FR') + ' ===');
  print('');

  // Patients registered today
  const newPatients = db.patients.countDocuments({createdAt: {\$gte: today, \$lt: tomorrow}});
  print('New patients registered: ' + newPatients);

  // Visits today
  const visits = db.visits.countDocuments({createdAt: {\$gte: today, \$lt: tomorrow}});
  print('Visits today: ' + visits);

  // Queue status
  const queued = db.visits.countDocuments({status: 'waiting', createdAt: {\$gte: today}});
  const inProgress = db.visits.countDocuments({status: 'in_progress', createdAt: {\$gte: today}});
  const completed = db.visits.countDocuments({status: 'completed', createdAt: {\$gte: today}});
  print('');
  print('Queue: ' + queued + ' waiting, ' + inProgress + ' in progress, ' + completed + ' completed');

  // Appointments
  const appts = db.appointments.countDocuments({date: {\$gte: today, \$lt: tomorrow}});
  print('Appointments scheduled: ' + appts);

  // Invoices
  const invoices = db.invoices.countDocuments({createdAt: {\$gte: today, \$lt: tomorrow}});
  const paidInvoices = db.invoices.countDocuments({
    createdAt: {\$gte: today, \$lt: tomorrow},
    status: 'paid'
  });
  print('');
  print('Invoices: ' + invoices + ' created, ' + paidInvoices + ' paid');

  // Revenue (simplified)
  const revenue = db.invoices.aggregate([
    {\$match: {createdAt: {\$gte: today, \$lt: tomorrow}, status: 'paid'}},
    {\$group: {_id: '\$currency', total: {\$sum: '\$amountPaid'}}}
  ]).toArray();
  print('');
  print('Revenue today:');
  revenue.forEach(r => print('  ' + (r._id || 'CDF') + ': ' + r.total.toLocaleString()));
"
```

Present the statistics in a clear summary format.
