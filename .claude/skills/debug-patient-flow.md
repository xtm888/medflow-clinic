---
name: debug-patient-flow
description: Use when debugging patient workflow issues - registration, queue, consultation, or billing problems
invocable: true
---

# Debug Patient Flow

Systematic debugging for patient journey issues in MedFlow.

## 1. Identify the Stage

```
Registration → Check-in → Queue → Consultation → Prescription → Checkout → Payment
     ↓            ↓          ↓          ↓              ↓            ↓          ↓
  Patient      Visit      Queue     Consult        Prescription  Invoice   Payment
   Model       Model      Entry     Session          Model        Model     Record
```

## 2. Quick Status Check

### Patient Exists?
```bash
mongosh medflow --eval "
  db.patients.findOne({
    \$or: [
      {patientId: 'SEARCH_TERM'},
      {lastName: /SEARCH_TERM/i},
      {phone: /SEARCH_TERM/}
    ]
  }, {patientId: 1, firstName: 1, lastName: 1, _id: 1})
"
```

### Today's Visits for Patient
```bash
mongosh medflow --eval "
  const today = new Date();
  today.setHours(0,0,0,0);
  db.visits.find({
    patient: ObjectId('PATIENT_ID'),
    createdAt: {\$gte: today}
  }).pretty()
"
```

### Queue Status
```bash
mongosh medflow --eval "
  db.visits.find({
    status: {\$in: ['checked_in', 'waiting', 'in_progress']},
    patient: ObjectId('PATIENT_ID')
  }).pretty()
"
```

## 3. Common Issues

### Issue: Patient checked in but not in queue
**Check**:
```bash
mongosh medflow --eval "
  db.visits.findOne({patient: ObjectId('PATIENT_ID')}, {status: 1, queueNumber: 1})
"
```
**Fix**: Update visit status to 'checked_in' and assign queue number

### Issue: Consultation not saving
**Check**:
```bash
# Check consultation session
mongosh medflow --eval "
  db.consultationsessions.find({
    patient: ObjectId('PATIENT_ID'),
    status: {\$ne: 'completed'}
  }).sort({createdAt: -1}).limit(1).pretty()
"
```
**Fix**: Check for validation errors in backend logs

### Issue: Invoice not generating
**Check**:
```bash
# Check for existing invoice
mongosh medflow --eval "
  db.invoices.find({
    patient: ObjectId('PATIENT_ID'),
    visit: ObjectId('VISIT_ID')
  }).pretty()
"
```
**Fix**: May need to regenerate invoice from visit/prescription

### Issue: Payment not recording
**Check**:
```bash
# Check invoice payments array
mongosh medflow --eval "
  db.invoices.findOne(
    {_id: ObjectId('INVOICE_ID')},
    {payments: 1, totalAmount: 1, amountPaid: 1}
  )
"
```
**Fix**: Add payment record to invoice.payments array

## 4. Full Patient Journey Trace

```bash
PATIENT_ID="INSERT_PATIENT_ID"

echo "=== PATIENT ==="
mongosh medflow --eval "db.patients.findOne({_id: ObjectId('$PATIENT_ID')}, {patientId: 1, firstName: 1, lastName: 1, clinic: 1})"

echo "=== RECENT VISITS ==="
mongosh medflow --eval "db.visits.find({patient: ObjectId('$PATIENT_ID')}).sort({createdAt: -1}).limit(3).pretty()"

echo "=== RECENT CONSULTATIONS ==="
mongosh medflow --eval "db.consultationsessions.find({patient: ObjectId('$PATIENT_ID')}).sort({createdAt: -1}).limit(3).pretty()"

echo "=== RECENT PRESCRIPTIONS ==="
mongosh medflow --eval "db.prescriptions.find({patient: ObjectId('$PATIENT_ID')}).sort({createdAt: -1}).limit(3).pretty()"

echo "=== RECENT INVOICES ==="
mongosh medflow --eval "db.invoices.find({patient: ObjectId('$PATIENT_ID')}).sort({createdAt: -1}).limit(3).pretty()"
```

## 5. WebSocket/Real-time Debug

```bash
# Check if WebSocket server running
lsof -i :5001 | grep LISTEN

# Monitor WebSocket events (in backend logs)
tail -f /var/log/medflow/backend.log | grep -i socket
```

## 6. Clinic Context Issues

```bash
# Verify patient belongs to expected clinic
mongosh medflow --eval "
  const patient = db.patients.findOne({_id: ObjectId('PATIENT_ID')});
  const clinic = db.clinics.findOne({_id: patient.clinic});
  print('Patient clinic: ' + clinic.name);
"

# Check if user has access to clinic
mongosh medflow --eval "
  const user = db.users.findOne({username: 'USERNAME'});
  print('User clinics: ' + JSON.stringify(user.clinics));
"
```
