# Complete End-to-End Testing Guide

## Test Scenario: Emergency Diabetic Patient with Full Workflow

This guide covers testing ALL system workflows through a single comprehensive patient journey.

---

## Patient Profile

**Name:** Jean Mukeba
**Age:** 60 years (DOB: 1965-03-15)
**Convention:** SNEL (Employee ID: SNEL-2024-1234)
**Medical History:**
- Type 2 Diabetes (on Metformin)
- Hypertension (on Lisinopril)
- **ALLERGY: Penicillin (Severe - Anaphylaxis)**

**Presenting Complaint:** Sudden vision loss with eye pain for 2 days

---

## Automated Testing

Run the automated E2E test script:

```bash
cd backend
node scripts/e2eWorkflowTest.js
```

This will test all 12 workflow steps programmatically.

---

## Manual UI Testing Checklist

### Prerequisites
- [ ] Backend running on port 5001
- [ ] Frontend running on port 5173
- [ ] MongoDB connected
- [ ] At least one doctor/ophthalmologist user exists
- [ ] At least one convention company exists
- [ ] Pharmacy has some inventory
- [ ] Frame inventory has some frames

---

## PHASE 1: PATIENT REGISTRATION

### Step 1.1: Create New Patient
**URL:** `http://localhost:5173/patients` → Click "New Patient"

- [ ] Fill patient details:
  - First Name: Jean
  - Last Name: Mukeba
  - DOB: 1965-03-15
  - Gender: Male
  - Phone: +243812345678
  - Address: 123 Avenue Lumumba, Kinshasa

- [ ] Add convention:
  - Select company: SNEL
  - Employee ID: SNEL-2024-1234
  - Convention type: Employee

- [ ] Add medical history:
  - Conditions: Diabetes Type 2, Hypertension
  - Current medications: Metformin 500mg, Lisinopril 10mg

- [ ] **CRITICAL:** Add allergy:
  - Allergen: Penicillin
  - Severity: Severe
  - Reaction: Anaphylaxis

- [ ] Save patient
- [ ] Verify patient ID is generated
- [ ] Verify convention badge shows on patient card

**Expected Result:** Patient created with auto-generated ID, convention linked

---

## PHASE 2: QUEUE & RECEPTION

### Step 2.1: Create Emergency Appointment
**URL:** `http://localhost:5173/appointments`

- [ ] Click "New Appointment"
- [ ] Search and select patient: Jean Mukeba
- [ ] Set appointment type: Emergency
- [ ] Set priority: Urgent
- [ ] Set provider: (Select ophthalmologist)
- [ ] Reason: "Vision floue soudaine + douleur oculaire - Patient diabetique"
- [ ] Save appointment

**Expected Result:** Emergency appointment created with urgent priority

### Step 2.2: Check-in Patient
**URL:** `http://localhost:5173/queue`

- [ ] Find patient in queue/appointments list
- [ ] Click "Check-in" button
- [ ] Verify queue number is assigned
- [ ] Verify status changes to "checked-in"
- [ ] Verify on display board: `http://localhost:5173/queue-display`

**Expected Result:** Patient appears in queue with number, status is checked-in

---

## PHASE 3: CONSULTATION

### Step 3.1: Start Consultation
**URL:** `http://localhost:5173/queue` → Click patient → Start

- [ ] Click "Call Patient" or "Start"
- [ ] Verify visit record is created
- [ ] Enter chief complaint:
  - Complaint: Vision floue soudaine avec douleur oculaire
  - Duration: 2 jours
  - Severity: Severe
  - Onset: Sudden

- [ ] Enter vital signs:
  - BP: 165/95 (elevated!)
  - HR: 88
  - Temp: 37.2
  - O2 Sat: 98%
  - Weight: 85kg
  - Height: 175cm

**Expected Result:** Visit created, vitals recorded, consultation in progress

---

## PHASE 4: OPHTHALMOLOGY EXAMINATION

### Step 4.1: Full Eye Exam
**URL:** `http://localhost:5173/ophthalmology/new-consultation/{patientId}`

- [ ] **Visual Acuity:**
  - OD: Uncorrected 20/80, Best corrected 20/40, Pinhole 20/30
  - OS: Uncorrected 20/60, Best corrected 20/25, Pinhole 20/25

- [ ] **Refraction:**
  - OD: Sph -2.00, Cyl -0.75, Axis 90, Add +2.50
  - OS: Sph -1.50, Cyl -0.50, Axis 90, Add +2.50
  - PD: 64mm

- [ ] **Tonometry (IOP):**
  - OD: 28 mmHg (**ELEVATED!**)
  - OS: 24 mmHg (borderline)

- [ ] **Slit Lamp:**
  - Lens OD: NS2+ cataract, PSC1+
  - Lens OS: NS1+ cataract

- [ ] **Fundus Exam:**
  - OD Macula: Diabetic macular edema - CSME
  - OD: Hard exudates, dot-blot hemorrhages
  - OD Periphery: Cotton wool spots, neovascularization
  - OS: Mild DME, scattered microaneurysms

- [ ] **Assessment/Diagnoses:**
  - [ ] Add: Proliferative Diabetic Retinopathy (E11.351)
  - [ ] Add: Clinically Significant DME OD (E11.311)
  - [ ] Add: Nuclear Sclerosis Cataract OD (H25.11)
  - [ ] Add: Ocular Hypertension OU (H40.00)

- [ ] Complete exam

**Expected Result:** Full exam documented, diagnoses entered, exam status completed

---

## PHASE 5: LABORATORY ORDERS

### Step 5.1: Order Lab Tests
**URL:** `http://localhost:5173/laboratory` or from patient chart

- [ ] Create lab order for patient
- [ ] Order tests:
  - [ ] HbA1c (urgent)
  - [ ] Fasting Blood Sugar (urgent)
  - [ ] Lipid Panel
  - [ ] Creatinine + eGFR
  - [ ] Urinalysis

- [ ] Set priority: Urgent
- [ ] Mark fasting required: Yes (8 hours)
- [ ] Save order

**Expected Result:** Lab order created with 5 tests, status "ordered"

### Step 5.2: Lab Workflow (Simulate)
- [ ] Mark specimen collected (barcode assigned)
- [ ] Enter results:
  - HbA1c: 9.2% (HIGH)
  - FBS: 165 mg/dL (HIGH)
  - Lipids: Total 245, LDL 155, HDL 38, TG 260 (abnormal)
  - Creatinine: 1.1 mg/dL (normal)
  - UA: Protein 1+, Glucose 2+ (abnormal)

- [ ] Validate results
- [ ] Mark as completed

**Expected Result:** Results entered with abnormal flags, lab order completed

---

## PHASE 6: MEDICATION PRESCRIPTIONS

### Step 6.1: Create Prescriptions
**URL:** From consultation or `http://localhost:5173/prescriptions`

- [ ] Create new prescription
- [ ] Add medications:

| Medication | Dose | Route | Frequency | Duration | Eye |
|------------|------|-------|-----------|----------|-----|
| Timolol 0.5% | 1 drop | Ophthalmic | BID | 30 days | OU |
| Prednisolone 1% | 1 drop | Ophthalmic | QID | 14 days | OD |
| Ofloxacin 0.3% | 1 drop | Ophthalmic | QID | 7 days | OD |
| Paracetamol 1000mg | 1 tab | Oral | PRN | 7 days | - |

- [ ] **VERIFY:** System checks for penicillin allergy
- [ ] **VERIFY:** System warns about beta-blocker interaction (Timolol + Lisinopril)
- [ ] Save prescription

**Expected Result:** Prescription created, safety checks passed, warnings shown

---

## PHASE 7: IVT INJECTION

### Step 7.1: Schedule IVT
**URL:** `http://localhost:5173/ivt`

- [ ] Create new IVT injection
- [ ] Select patient: Jean Mukeba
- [ ] Eye: OD (right)
- [ ] Medication: Avastin (bevacizumab) 1.25mg
- [ ] Indication: Diabetic Macular Edema
- [ ] Treatment protocol: Loading phase (1 of 3)

- [ ] Enter pre-assessment:
  - VA: 20/40
  - IOP: 28 mmHg
  - Anterior chamber: Deep, quiet
  - Media clarity: NS2+ cataract, view adequate

- [ ] Save/Schedule

**Expected Result:** IVT injection scheduled, pre-assessment recorded

### Step 7.2: Complete IVT
- [ ] Mark injection as started
- [ ] Record:
  - Injection performed successfully
  - No complications

- [ ] Post-assessment:
  - IOP: 18 mmHg (normalized)
  - Anterior chamber: Deep, trace cells
  - Patient tolerated well

- [ ] Schedule next injection: 4 weeks
- [ ] Complete injection

**Expected Result:** IVT completed, next appointment scheduled

---

## PHASE 8: SURGERY SCHEDULING

### Step 8.1: Create Surgery Case
**URL:** `http://localhost:5173/surgery`

- [ ] Create new surgery case
- [ ] Patient: Jean Mukeba
- [ ] Type: Phacoemulsification with IOL
- [ ] Eye: OD
- [ ] Indication: Visually significant cataract with diabetic retinopathy
- [ ] Surgeon: (select)

- [ ] Enter biometry:
  - Axial length: 23.45mm
  - ACD: 3.12mm
  - K1: 43.50, K2: 44.25
  - IOL Power: 21.5D
  - IOL Model: AcrySof IQ SN60WF
  - Target refraction: -0.50D

- [ ] Schedule date: ~2 months out (after DME treatment)
- [ ] Mark pre-op requirements:
  - [ ] Biometry: Done
  - [ ] Blood work: Done
  - [ ] Medical clearance: Pending
  - [ ] Consent: Pending

**Expected Result:** Surgery case created, scheduled, requirements tracked

---

## PHASE 9: OPTICAL SHOP / GLASSES ORDER

### Step 9.1: Access Optical Shop
**URL:** `http://localhost:5173/optical-shop`

- [ ] Search for patient: Jean Mukeba
- [ ] Verify convention info displays (SNEL - 50% optical coverage)
- [ ] Click "New Sale"

### Step 9.2: Create Glasses Order
- [ ] **Prescription Step:**
  - Verify prescription auto-populated from exam
  - OD: Sph -2.00, Cyl -0.75, Axis 90, Add +2.50
  - OS: Sph -1.50, Cyl -0.50, Axis 90, Add +2.50
  - PD: 64mm

- [ ] **Frame Selection:**
  - Search frames (live search as you type)
  - Select a frame (note stock status)
  - If out of stock: verify "external order required" message

- [ ] **Lens Type:**
  - Design: Progressive
  - Material: Polycarbonate

- [ ] **Options:**
  - [x] Anti-Reflective (+15,000 CDF)
  - [x] Blue Light Filter (+10,000 CDF)

- [ ] **Summary:**
  - Verify subtotal calculated
  - Verify convention split shows:
    - Company portion (50%)
    - Patient portion (50%)

- [ ] Submit for verification

**Expected Result:** Order created, pricing calculated, convention split correct

### Step 9.3: Technician Verification
- [ ] (As technician) Review order
- [ ] Check verification items:
  - [ ] Prescription correct
  - [ ] Measurements correct
  - [ ] Frame compatible
  - [ ] Lens type appropriate
  - [ ] Pricing correct
- [ ] Approve order

**Expected Result:** Order verified, status updated

---

## PHASE 10: BILLING & PAYMENT

### Step 10.1: Review Invoice
**URL:** `http://localhost:5173/invoicing` or `http://localhost:5173/financial`

- [ ] Find invoice for patient
- [ ] Verify all services listed:
  - [ ] Emergency consultation
  - [ ] Ophthalmology exam
  - [ ] IOP measurement
  - [ ] Fundus exam
  - [ ] IVT injection (Avastin)
  - [ ] Lab tests
  - [ ] Medications

- [ ] Verify convention breakdown:
  - Medical services: 80% company
  - Lab: 100% company
  - Pharmacy: 70% company
  - Optical: 50% company

### Step 10.2: Process Payment
- [ ] Click "Record Payment"
- [ ] Enter patient portion amount
- [ ] Select payment method: Cash
- [ ] Process payment
- [ ] Verify receipt generated
- [ ] Verify invoice status: PAID

**Expected Result:** Payment processed, invoice paid, receipt available

---

## PHASE 11: PHARMACY DISPENSING

### Step 11.1: Dispense Medications
**URL:** `http://localhost:5173/pharmacy`

- [ ] Find prescription in queue
- [ ] Verify all medications:
  - [ ] Timolol 0.5%
  - [ ] Prednisolone 1%
  - [ ] Ofloxacin 0.3%
  - [ ] Paracetamol 1000mg

- [ ] Check inventory availability
- [ ] Dispense each medication
- [ ] Mark prescription as dispensed
- [ ] Verify inventory decremented

**Expected Result:** All medications dispensed, inventory updated

---

## PHASE 12: COMPLETE & FOLLOW-UP

### Step 12.1: Complete Visit
- [ ] Return to consultation/visit
- [ ] Enter final assessment
- [ ] Enter follow-up plan:
  - 4 weeks: IVT loading dose #2
  - 8 weeks: IVT loading dose #3
  - 12 weeks: DME response evaluation
  - ~2 months: Cataract surgery (after DME stable)

- [ ] Complete visit

### Step 12.2: Schedule Follow-up
- [ ] Create follow-up appointment
- [ ] Date: 4 weeks from now
- [ ] Type: Follow-up
- [ ] Reason: IVT loading dose #2 + DME response evaluation

**Expected Result:** Visit completed, follow-up scheduled

---

## VERIFICATION CHECKLIST

After completing all steps, verify:

### Patient Record
- [ ] Patient created with correct data
- [ ] Convention linked
- [ ] Medical history saved
- [ ] Allergy recorded

### Clinical Data
- [ ] Visit documented
- [ ] Ophthalmology exam saved
- [ ] Lab results recorded
- [ ] IVT injection documented
- [ ] Surgery case created

### Financial
- [ ] Invoice generated
- [ ] Convention split calculated correctly
- [ ] Payment recorded
- [ ] Receipt available

### Inventory
- [ ] Medications dispensed from pharmacy
- [ ] Frame reserved/ordered for glasses
- [ ] Stock levels updated

### Follow-up
- [ ] Follow-up appointment scheduled
- [ ] Next IVT scheduled
- [ ] Surgery scheduled

---

## REPORTING VERIFICATION

### Financial Reports
**URL:** `http://localhost:5173/financial`

- [ ] Verify patient appears in revenue reports
- [ ] Verify convention billing shows:
  - Company: SNEL
  - Amount billed to company
  - Amount collected from patient

- [ ] Verify optical shop section shows:
  - Glasses order revenue
  - Optician performance (if tracked)

### Analytics
**URL:** `http://localhost:5173/analytics`

- [ ] Verify patient counted in:
  - Daily visits
  - Emergency consultations
  - IVT injections
  - Lab orders
  - Prescriptions dispensed

---

## TROUBLESHOOTING

### Common Issues

1. **Patient search not working:**
   - Check backend logs
   - Verify patient was created
   - Try searching by phone or file number

2. **Convention not applying:**
   - Verify company is active
   - Verify convention rules exist
   - Check patient has employeeId set

3. **Prescription safety checks failing:**
   - Review allergy list
   - Check drug database populated
   - Verify interaction rules

4. **Lab results not saving:**
   - Check lab order exists
   - Verify specimen collected first
   - Check validation rules

5. **IVT validation errors:**
   - Check minimum interval between injections
   - Verify medication in allowed list
   - Check eye selection

6. **Glasses order pricing wrong:**
   - Verify frame price set
   - Check lens pricing configured
   - Verify convention rules for optical

---

## API TESTING (Optional)

You can also test individual APIs using curl or Postman:

```bash
# Get auth token
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' \
  | jq -r '.token')

# Search patients
curl -s http://localhost:5001/api/patients/search?q=Mukeba \
  -H "Authorization: Bearer $TOKEN"

# Get queue
curl -s http://localhost:5001/api/queue \
  -H "Authorization: Bearer $TOKEN"

# Get invoices
curl -s http://localhost:5001/api/invoices \
  -H "Authorization: Bearer $TOKEN"
```

---

## Cleanup

To remove test data after testing:

```bash
cd backend
node -e "
const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const collections = ['patients', 'appointments', 'visits', 'ophthalmologyexams',
    'prescriptions', 'laborders', 'ivtinjections', 'surgerycases', 'glassesorders', 'invoices'];
  for (const coll of collections) {
    const result = await mongoose.connection.db.collection(coll).deleteMany({
      \$or: [
        { 'notes.internal': /E2E_TEST_/ },
        { firstName: /E2E_TEST_/ }
      ]
    });
    if (result.deletedCount > 0) console.log('Deleted', result.deletedCount, 'from', coll);
  }
  mongoose.disconnect();
});
"
```

---

## Success Criteria

The complete E2E test is successful if:

1. **All 12 workflow steps complete without errors**
2. **Data persists correctly across all modules**
3. **Convention billing calculates correctly**
4. **Safety checks work (allergies, drug interactions)**
5. **Inventory updates properly**
6. **Financial reports reflect the transactions**
7. **Follow-up appointments are scheduled**

**Total workflows tested: 12**
**Total features validated: 50+**
