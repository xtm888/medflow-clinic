# MedFlow Legacy Data Import Plan

## Overview

This document outlines the comprehensive plan for importing legacy data from LV (Legacy Vision) CSV files into MedFlow's MongoDB database.

## Data Sources

| File | Records | Status | Target Models |
|------|---------|--------|---------------|
| `LV_Patients.csv` | 38,930 | **IMPORTED** | Patient |
| `LV_Consultations.csv` | 100,914 | NOT IMPORTED | Visit, ConsultationSession, OphthalmologyExam |
| `LV_Actes.csv` | 583,331 | NOT IMPORTED | ClinicalAct (embedded in Visit), Invoice |
| `DiagnosticsRP_Local.csv` | 14,001 | NOT IMPORTED | Visit.diagnoses |

## Import Dependency Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                    IMPORT ORDER (CRITICAL)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. PATIENTS (LV_Patients.csv) ────────► Patient model           │
│     ✓ ALREADY IMPORTED (34,959 records)                          │
│                                                                   │
│  2. CONSULTATIONS (LV_Consultations.csv) ──┬──► Visit model      │
│     Links: Patient via NumFiche             │                     │
│                                             ├──► ConsultationSession
│                                             └──► OphthalmologyExam │
│                                                                   │
│  3. ACTES (LV_Actes.csv) ───────────────────┬──► Visit.clinicalActs
│     Links: Patient via NumFiche              │                    │
│     Links: Visit via NumActe                 └──► Invoice model   │
│                                                                   │
│  4. DIAGNOSTICS (DiagnosticsRP_Local.csv) ──► Visit.diagnoses    │
│     Links: Visit via NumVisite                                    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Import Consultations (LV_Consultations.csv)

### CSV Column Structure
```
Ref, NumActe, Type, Temperature, Poids, Taille, TA, FC, FR,
Plaintes, Diagnostics, Conclusion
```

### Sample Data Analysis
- `Ref`: Record reference number
- `NumActe`: Links to LV_Actes.csv and identifies the consultation
- `Type`: "Ophtalmologie", "Standard", "Gynéco-Obstétrique"
- `Temperature`: Body temperature (e.g., "36.5")
- `Poids`: Weight in kg (e.g., "75")
- `Taille`: Height in cm (e.g., "170")
- `TA`: Blood pressure (e.g., "120/80")
- `FC`: Heart rate (e.g., "72")
- `FR`: Respiratory rate (e.g., "16")
- `Plaintes`: Chief complaint (text)
- `Diagnostics`: Diagnosis text
- `Conclusion`: Contains full ophthalmology exam data in structured format:
  ```
  A/R OD : Sph : -2.50, Cyl : -0.75, Axe : 180 / OG : Sph : -2.25, Cyl : -0.50, Axe : 175
  AV OD : 10/10 avec correction / OG : 10/10 avec correction
  RF OD : Sph : -2.50, Cyl : -0.75, Axe : 180, Add : 2.00 / OG : Sph : -2.25, Cyl : -0.50, Axe : 175, Add : 2.00
  TO OD : 14 / OG : 15
  ```

### Field Mapping: LV_Consultations → MedFlow Models

#### A. Visit Model Mapping

| CSV Field | MedFlow Visit Field | Transformation |
|-----------|---------------------|----------------|
| NumActe | visitId | Prefix with "LV-" for legacy tracking |
| NumFiche (from Actes) | patient | Lookup Patient by legacyIds.lv |
| Type | visitType | Map: "Ophtalmologie"→"consultation", "Standard"→"routine" |
| DateCreation (from Actes) | visitDate | Parse date |
| Temperature | physicalExamination.vitalSigns.temperature | Parse number |
| Poids | physicalExamination.vitalSigns.weight | Parse number |
| Taille | physicalExamination.vitalSigns.height | Parse number |
| TA | physicalExamination.vitalSigns.bloodPressure | String as-is |
| FC | physicalExamination.vitalSigns.heartRate | Parse number |
| FR | physicalExamination.vitalSigns.respiratoryRate | Parse number |
| Plaintes | chiefComplaint.complaint | String as-is |
| Diagnostics | diagnoses[].description | Parse, create diagnosis entries |
| - | status | Set to "completed" |
| - | clinic | Tombalbaye clinic ID |
| - | primaryProvider | System user ID |

#### B. OphthalmologyExam Model Mapping (from Conclusion parsing)

| Parsed Data | MedFlow OphthalmologyExam Field | Notes |
|-------------|----------------------------------|-------|
| A/R OD Sph | refraction.objective.autorefractor.OD.sphere | |
| A/R OD Cyl | refraction.objective.autorefractor.OD.cylinder | |
| A/R OD Axe | refraction.objective.autorefractor.OD.axis | |
| A/R OG Sph | refraction.objective.autorefractor.OS.sphere | |
| A/R OG Cyl | refraction.objective.autorefractor.OS.cylinder | |
| A/R OG Axe | refraction.objective.autorefractor.OS.axis | |
| AV OD | visualAcuity.distance.OD.corrected | Parse fraction |
| AV OG | visualAcuity.distance.OS.corrected | Parse fraction |
| RF OD | refraction.finalPrescription.OD | Sphere, Cyl, Axis, Add |
| RF OG | refraction.finalPrescription.OS | Sphere, Cyl, Axis, Add |
| TO OD | iop.OD.value | Parse number |
| TO OG | iop.OS.value | Parse number |

### Conclusion Field Parser Logic

```javascript
function parseConclusion(conclusionText) {
  const result = {
    autorefractor: { OD: {}, OS: {} },
    visualAcuity: { OD: {}, OS: {} },
    refraction: { OD: {}, OS: {} },
    iop: { OD: null, OS: null }
  };

  if (!conclusionText) return result;

  // Parse Auto-refractor (A/R)
  const arMatch = conclusionText.match(/A\/R\s+OD\s*:\s*Sph\s*:\s*([-\d.]+),?\s*Cyl\s*:\s*([-\d.]+),?\s*Axe\s*:\s*(\d+)\s*\/\s*OG\s*:\s*Sph\s*:\s*([-\d.]+),?\s*Cyl\s*:\s*([-\d.]+),?\s*Axe\s*:\s*(\d+)/i);
  if (arMatch) {
    result.autorefractor.OD = { sphere: parseFloat(arMatch[1]), cylinder: parseFloat(arMatch[2]), axis: parseInt(arMatch[3]) };
    result.autorefractor.OS = { sphere: parseFloat(arMatch[4]), cylinder: parseFloat(arMatch[5]), axis: parseInt(arMatch[6]) };
  }

  // Parse Visual Acuity (AV)
  const avMatch = conclusionText.match(/AV\s+OD\s*:\s*([\d\/]+)[^\d]*\/\s*OG\s*:\s*([\d\/]+)/i);
  if (avMatch) {
    result.visualAcuity.OD = { corrected: avMatch[1] };
    result.visualAcuity.OS = { corrected: avMatch[2] };
  }

  // Parse Final Refraction (RF)
  const rfMatch = conclusionText.match(/RF\s+OD\s*:\s*Sph\s*:\s*([-\d.]+),?\s*Cyl\s*:\s*([-\d.]+),?\s*Axe\s*:\s*(\d+)(?:,?\s*Add\s*:\s*([\d.]+))?[^\d]*\/\s*OG\s*:\s*Sph\s*:\s*([-\d.]+),?\s*Cyl\s*:\s*([-\d.]+),?\s*Axe\s*:\s*(\d+)(?:,?\s*Add\s*:\s*([\d.]+))?/i);
  if (rfMatch) {
    result.refraction.OD = {
      sphere: parseFloat(rfMatch[1]),
      cylinder: parseFloat(rfMatch[2]),
      axis: parseInt(rfMatch[3]),
      add: rfMatch[4] ? parseFloat(rfMatch[4]) : undefined
    };
    result.refraction.OS = {
      sphere: parseFloat(rfMatch[5]),
      cylinder: parseFloat(rfMatch[6]),
      axis: parseInt(rfMatch[7]),
      add: rfMatch[8] ? parseFloat(rfMatch[8]) : undefined
    };
  }

  // Parse Intraocular Pressure (TO)
  const toMatch = conclusionText.match(/TO\s+OD\s*:\s*(\d+)\s*\/\s*OG\s*:\s*(\d+)/i);
  if (toMatch) {
    result.iop.OD = parseInt(toMatch[1]);
    result.iop.OS = parseInt(toMatch[2]);
  }

  return result;
}
```

---

## Phase 2: Import Medical Acts (LV_Actes.csv)

### CSV Column Structure
```
NumActe, NumFiche, NomsPatient, Convention, Acte, Service, Famille,
Prix, Quantite, Paiement, DateCreation, DateRealisation, Resultat1, Destination
```

### Service Categories Found
- `Pharmacie` → medication category
- `Ophtalmologie - Examens` → examination category
- `Ophtalmologie - Actes` → procedure category
- `Consultations` → consultation category
- `Laboratoire` → laboratory category
- `Chirurgie` → surgery category
- `Verres et Montures` → optical category
- `Echographie` → imaging category

### Field Mapping: LV_Actes → MedFlow Models

#### A. Visit.clinicalActs (embedded array)

| CSV Field | MedFlow clinicalActs Field | Transformation |
|-----------|---------------------------|----------------|
| Acte | actName | String as-is |
| Service | actType | Map service to enum |
| - | actCode | Generate from Acte name |
| Prix | price | Parse number |
| Quantite | quantity | Parse number, default 1 |
| DateRealisation | startTime, endTime | Parse date |
| - | status | "completed" if DateRealisation exists |
| Resultat1 | results | Mixed data |
| - | provider | System user ID |

#### B. Invoice Model Mapping

| CSV Field | MedFlow Invoice Field | Transformation |
|-----------|----------------------|----------------|
| NumActe | - | Group items by NumActe |
| NumFiche | patient | Lookup Patient by legacyIds.lv |
| DateCreation | dateIssued | Parse date |
| Acte | items[].description | String as-is |
| Service | items[].category | Map service to category enum |
| Prix | items[].unitPrice | Parse number |
| Quantite | items[].quantity | Parse number |
| Prix * Quantite | items[].total | Calculate |
| Paiement | summary.amountPaid | Parse number |
| Convention | companyBilling.companyName | If not "[Patient Privé]" |

### Service to Category Mapping

```javascript
const SERVICE_TO_CATEGORY = {
  'Pharmacie': 'medication',
  'Ophtalmologie - Examens': 'examination',
  'Ophtalmologie - Actes': 'procedure',
  'Consultations': 'consultation',
  'Laboratoire': 'laboratory',
  'Chirurgie': 'surgery',
  'Verres et Montures': 'optical',
  'Echographie': 'imaging',
  'Imagerie': 'imaging',
  'Kinésithérapie': 'therapy',
  'ORL': 'procedure',
  'Gynécologie': 'procedure'
};

const SERVICE_TO_ACT_TYPE = {
  'Pharmacie': 'therapy',  // medications = therapy in clinicalActs
  'Ophtalmologie - Examens': 'examination',
  'Ophtalmologie - Actes': 'procedure',
  'Consultations': 'consultation',
  'Laboratoire': 'laboratory',
  'Chirurgie': 'procedure',
  'Verres et Montures': 'procedure',
  'Echographie': 'imaging',
  'Imagerie': 'imaging'
};
```

---

## Phase 3: Import Diagnostics (DiagnosticsRP_Local.csv)

### CSV Column Structure
```
NumFiche, NomsPatient, DateDiagnostic, Diagnostic, Catégorie,
Certitude, Durée, NumVisite
```

### Field Mapping: DiagnosticsRP_Local → Visit.diagnoses

| CSV Field | MedFlow Visit.diagnoses Field | Transformation |
|-----------|------------------------------|----------------|
| Diagnostic | description | String as-is |
| Catégorie | - | Could map to ICD category |
| Certitude | type | Map: "Certain"→"primary", "Probable"→"secondary", "Possible"→"rule-out" |
| DateDiagnostic | dateOfDiagnosis | Parse date |
| NumVisite | - | Link to Visit via legacy mapping |
| - | code | Generate or lookup ICD code |

---

## Implementation Scripts

### Script 1: importLegacyConsultations.js

```javascript
// Location: backend/scripts/importLegacyConsultations.js
// Purpose: Import LV_Consultations.csv into Visit + OphthalmologyExam models

const BATCH_SIZE = 500;

async function importConsultations() {
  // 1. Parse CSV with PapaParse
  // 2. For each unique NumActe:
  //    a. Lookup patient by NumFiche from LV_Actes.csv
  //    b. Create Visit record with vital signs from consultation
  //    c. Parse Conclusion field for ophthalmology data
  //    d. Create OphthalmologyExam if eye data exists
  //    e. Link Visit.examinations.refraction to OphthalmologyExam
  // 3. Create LegacyMapping records for cross-reference
}
```

### Script 2: importLegacyActes.js

```javascript
// Location: backend/scripts/importLegacyActes.js
// Purpose: Import LV_Actes.csv into Visit.clinicalActs + Invoice models

async function importActes() {
  // 1. Parse CSV with PapaParse
  // 2. Group records by NumActe (one visit = multiple acts)
  // 3. For each group:
  //    a. Find or create Visit by NumActe
  //    b. Add each act to Visit.clinicalActs
  //    c. Create Invoice with all acts as line items
  //    d. Apply convention billing if Convention != "[Patient Privé]"
  //    e. Record payments
}
```

### Script 3: importLegacyDiagnoses.js

```javascript
// Location: backend/scripts/importLegacyDiagnoses.js
// Purpose: Import DiagnosticsRP_Local.csv into Visit.diagnoses

async function importDiagnoses() {
  // 1. Parse CSV with PapaParse
  // 2. For each diagnosis:
  //    a. Find Visit by NumVisite legacy mapping
  //    b. Add diagnosis to Visit.diagnoses array
  //    c. Save Visit
}
```

---

## Data Validation Rules

### Pre-Import Validation

1. **Patient Existence**: All NumFiche values must map to existing Patient records
2. **Date Validity**: All dates must be parseable and not in the future
3. **Price Validation**: All Prix values must be positive numbers
4. **Required Fields**: NumActe, NumFiche must not be empty

### Post-Import Validation

1. **Visit Count**: Total visits should approximately match unique NumActe count
2. **Invoice Totals**: Sum of Invoice totals should match legacy system totals
3. **Patient Links**: All Visit.patient references should resolve
4. **Date Consistency**: Visit dates should fall within reasonable historical range

---

## Rollback Strategy

Each import script should:

1. Create backup collections before import:
   - `visits_backup_YYYYMMDD`
   - `invoices_backup_YYYYMMDD`
   - `ophthalmologyexams_backup_YYYYMMDD`

2. Track imported record IDs for potential rollback:
   ```javascript
   const LegacyMapping = mongoose.model('LegacyMapping');
   // Store: { legacyType: 'LV_Consultation', legacyId: 'xxx', modelType: 'Visit', modelId: ObjectId }
   ```

3. Provide rollback script:
   ```javascript
   // rollbackLegacyImport.js
   async function rollback(importDate) {
     // Delete all records with legacyIds.lv field created on importDate
   }
   ```

---

## Execution Plan

### Step 1: Preparation
- [ ] Verify all CSV files are accessible
- [ ] Run data quality checks on CSVs
- [ ] Create backup of current database
- [ ] Verify Patient import completed (34,959 records)

### Step 2: Import Consultations
- [ ] Run importLegacyConsultations.js in dry-run mode
- [ ] Review validation errors
- [ ] Fix data issues
- [ ] Run full import
- [ ] Verify visit count

### Step 3: Import Acts
- [ ] Run importLegacyActes.js in dry-run mode
- [ ] Review validation errors
- [ ] Run full import
- [ ] Verify clinical acts and invoices

### Step 4: Import Diagnoses
- [ ] Run importLegacyDiagnoses.js in dry-run mode
- [ ] Review validation errors
- [ ] Run full import
- [ ] Verify diagnoses linked to visits

### Step 5: Post-Import Verification
- [ ] Run data integrity checks
- [ ] Compare totals with legacy system
- [ ] Test patient timeline views
- [ ] Test invoice reports

---

## Estimated Import Statistics

| Model | Expected Records | Notes |
|-------|-----------------|-------|
| Patient | 34,959 | Already imported |
| Visit | ~100,914 | One per consultation |
| OphthalmologyExam | ~80,000 | Only for ophtho consultations |
| Invoice | ~100,914 | One per visit |
| Invoice.items | ~583,331 | All acts become line items |
| Visit.diagnoses | ~14,001 | From diagnostics CSV |

---

## Notes

1. **Time Zone**: All dates are assumed to be in Africa/Kinshasa timezone
2. **Currency**: All prices are in CDF (Congolese Franc)
3. **Provider**: System user will be assigned as provider for all legacy records
4. **Status**: All imported visits/invoices will be marked as "completed"/"paid"
5. **Clinic**: All records assigned to Tombalbaye clinic (source of backup)
