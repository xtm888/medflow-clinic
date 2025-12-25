---
name: database-maintenance
description: Use for MongoDB maintenance tasks - cleanup, optimization, backup verification, index management
invocable: true
---

# Database Maintenance - MedFlow

## Daily Checks

### 1. Database Health
```bash
# Connection status
mongosh medflow --eval "db.adminCommand('ping')"

# Database stats
mongosh medflow --eval "db.stats()"

# Collection sizes
mongosh medflow --eval "
  db.getCollectionNames().forEach(c => {
    const stats = db[c].stats();
    print(c + ': ' + Math.round(stats.size/1024/1024) + ' MB, docs: ' + stats.count);
  })
"
```

### 2. Slow Query Check
```bash
# Find slow queries (> 100ms)
mongosh medflow --eval "
  db.system.profile.find({millis: {\$gt: 100}})
    .sort({ts: -1})
    .limit(10)
    .forEach(q => print(q.millis + 'ms: ' + q.ns + ' ' + JSON.stringify(q.command)))
"
```

### 3. Index Usage
```bash
# Check index stats
mongosh medflow --eval "
  ['patients', 'visits', 'invoices', 'appointments'].forEach(c => {
    print('=== ' + c + ' ===');
    db[c].aggregate([{\$indexStats: {}}]).forEach(i =>
      print(i.name + ': ' + i.accesses.ops + ' ops')
    );
  })
"
```

## Weekly Maintenance

### 1. Orphaned Data Cleanup
```bash
# Find visits without patients
mongosh medflow --eval "
  const orphanedVisits = db.visits.aggregate([
    {\$lookup: {from: 'patients', localField: 'patient', foreignField: '_id', as: 'pat'}},
    {\$match: {pat: {\$size: 0}}}
  ]).toArray();
  print('Orphaned visits: ' + orphanedVisits.length);
"

# Find invoices without patients
mongosh medflow --eval "
  const orphanedInvoices = db.invoices.aggregate([
    {\$lookup: {from: 'patients', localField: 'patient', foreignField: '_id', as: 'pat'}},
    {\$match: {pat: {\$size: 0}}}
  ]).toArray();
  print('Orphaned invoices: ' + orphanedInvoices.length);
"
```

### 2. Expired Data Cleanup
```bash
# Clean old audit logs (> 1 year)
mongosh medflow --eval "
  const oneYearAgo = new Date(Date.now() - 365*24*60*60*1000);
  const result = db.auditlogs.deleteMany({createdAt: {\$lt: oneYearAgo}});
  print('Deleted ' + result.deletedCount + ' old audit logs');
"

# Clean old device sync queue (> 30 days)
mongosh medflow --eval "
  const thirtyDaysAgo = new Date(Date.now() - 30*24*60*60*1000);
  const result = db.devicesyncqueue.deleteMany({
    status: 'completed',
    completedAt: {\$lt: thirtyDaysAgo}
  });
  print('Deleted ' + result.deletedCount + ' old sync queue entries');
"
```

### 3. Index Optimization
```bash
# Rebuild indexes (run during low-traffic period)
mongosh medflow --eval "
  ['patients', 'visits', 'invoices', 'appointments'].forEach(c => {
    print('Reindexing ' + c + '...');
    db[c].reIndex();
  });
  print('Done!');
"
```

## Monthly Maintenance

### 1. Compact Database
```bash
# Compact collections to reclaim space
mongosh medflow --eval "
  ['auditlogs', 'devicesyncqueue', 'visits'].forEach(c => {
    print('Compacting ' + c + '...');
    db.runCommand({compact: c});
  });
"
```

### 2. Full Backup Verification
```bash
# Create backup
BACKUP_DIR="/backup/monthly_$(date +%Y%m)"
mongodump --db medflow --out $BACKUP_DIR

# Restore to test database
mongorestore --db medflow_test $BACKUP_DIR/medflow

# Verify counts match
mongosh --eval "
  const prod = db.getSiblingDB('medflow');
  const test = db.getSiblingDB('medflow_test');
  ['patients', 'visits', 'invoices'].forEach(c => {
    const prodCount = prod[c].count();
    const testCount = test[c].count();
    print(c + ': prod=' + prodCount + ', backup=' + testCount +
      (prodCount === testCount ? ' ✓' : ' ✗ MISMATCH!'));
  });
"

# Cleanup test database
mongosh --eval "db.getSiblingDB('medflow_test').dropDatabase()"
```

### 3. Schema Validation Check
```bash
# Check for documents with missing required fields
mongosh medflow --eval "
  // Patients without clinic
  const noClinc = db.patients.find({clinic: null}).count();
  print('Patients without clinic: ' + noClinc);

  // Visits without status
  const noStatus = db.visits.find({status: null}).count();
  print('Visits without status: ' + noStatus);

  // Invoices without patient
  const noPatient = db.invoices.find({patient: null}).count();
  print('Invoices without patient: ' + noPatient);
"
```

## Key Indexes for MedFlow

```javascript
// Ensure these indexes exist for performance

// Patients
db.patients.createIndex({clinic: 1, lastName: 1});
db.patients.createIndex({patientId: 1}, {unique: true});
db.patients.createIndex({phone: 1});

// Visits
db.visits.createIndex({patient: 1, createdAt: -1});
db.visits.createIndex({clinic: 1, status: 1, createdAt: -1});

// Invoices
db.invoices.createIndex({patient: 1, createdAt: -1});
db.invoices.createIndex({clinic: 1, status: 1});
db.invoices.createIndex({invoiceId: 1}, {unique: true});

// Appointments
db.appointments.createIndex({clinic: 1, date: 1});
db.appointments.createIndex({patient: 1, date: 1});

// Audit Logs
db.auditlogs.createIndex({createdAt: -1});
db.auditlogs.createIndex({user: 1, createdAt: -1});
db.auditlogs.createIndex({resource: 1, resourceId: 1});
```

## Backup Schedule

| Type | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| Full | Daily | 30 days | /backup/daily/ |
| Oplog | Continuous | 7 days | /backup/oplog/ |
| Monthly | Monthly | 1 year | /backup/monthly/ |
| Off-site | Weekly | 90 days | Cloud/USB |
