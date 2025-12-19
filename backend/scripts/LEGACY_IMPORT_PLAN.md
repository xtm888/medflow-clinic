# MedFlow Legacy Data Import Plan

## Overview

This document outlines the comprehensive plan for importing legacy data from LV (Legacy Vision) CSV files into MedFlow's MongoDB database.

## Data Sources

### Primary LV Data (from `/Users/xtm888/Downloads/`)

| File | Records | Size | Status | Target Models |
|------|---------|------|--------|---------------|
| `LV_Patients.csv` | 38,930 | 6 MB | **IMPORTED** (34,959) | Patient |
| `LV_Consultations.csv` | 100,914 | 44 MB | NOT IMPORTED | Visit, ConsultationSession, OphthalmologyExam |
| `LV_Actes.csv` | 583,331 | 102 MB | NOT IMPORTED | ClinicalAct (embedded in Visit), Invoice |

### Additional DMI Data (from `/Users/xtm888/Desktop/DMI_Export/`)

| File | Records | Size | Status | Target Models |
|------|---------|------|--------|---------------|
| `DiagnosticsRP_Local.csv` | 14,001 | 1.4 MB | NOT IMPORTED | Visit.diagnoses |
| `PharmaA_Local.csv` | ~500 | 54 KB | NOT IMPORTED | PharmacyInventory |
| `PharmaB_Local.csv` | ~500 | 57 KB | NOT IMPORTED | PharmacyInventory |
| `StockA_Local.csv` | ~700 | 68 KB | NOT IMPORTED | PharmacyInventory stock levels |
| `StockB_Local.csv` | ~700 | 71 KB | NOT IMPORTED | PharmacyInventory stock levels |
| `MouvementsPharmacie_Local.csv` | Various | 7.6 KB | NOT IMPORTED | Inventory transactions |

---

## Phase 0: French Medications Reference Data (PREREQUISITE)

### Overview

Before importing pharmacy-related legacy data, the **French medications database** must be seeded. The clinic uses French drug names and categories (not English).

### Available Seed Scripts

| Script | Purpose | Records | Status |
|--------|---------|---------|--------|
| `seedFrenchDrugs.js` | Seed Drug collection with French meds | ~700+ | Available |
| `seedAllClinicMedications.js` | Seed MedicationTemplate with French meds | ~500+ | Available |
| `seedPharmacyInventory.js` | Create PharmacyInventory from Drug collection | Varies | Available |

### French Drug Categories (32 Categories)

The legacy system uses French pharmaceutical categories:

```
A.I.N.S GENERAUX + CORTICOIDES    ANTI ALLERGIQUES           ANTIBIOTIQUE LOCAUX
A.I.N.S LOCAUX                    ANTI CATARACTE             ANTIBIOTIQUE GENERAUX
ANESTHESIE LOCALES                ANTI GLAUCOMATEUX          ANTI HYPERTENSEURS
ANTIPALUDEENS                     ANTI HISTAMINIQUES         ANTI MYCOSIQUES
ANTI SPASMODIQUES                 ANTISEPT SANS VASOCONS     ANTITUSSIF
ANTI VIRAUX                       CICATRISANTS               CORTICOIDES + ANTIBIOTIQUES
CORTICOIDES LOCAUX                CREMES DERMIQUES           DECONGESTIONNANT
DIVERS OPHA                       GOUTTES NASALES            HYPO CHOLESTEROLEMIANTS
LARMES ARTIFICIELLES              LARMES LOTIONS CONTACTO    LAXATIFS ET ANTI DIARRHEIQUES
MAGNESIUM                         MYDRIATIQUES               OVULES VAGINALES
PANSEMENTS GASTRIQUES             POTASSIUM                  SEDATIF
VASCULOTROPES                     VERMIFUGES                 VITAMINES
```

### Sample French Medications (from seedFrenchDrugs.js)

**ANTI GLAUCOMATEUX (Glaucoma):**
- ALPHAGAN collyre 0,2%
- AZARGA, AZOPT collyre
- BETAGAN collyre 0,1%, 0,5%
- COSOPT collyre
- DIAMOX cp séc 250 mg
- LUMIGAN 0,3%
- TIMOPTOL collyre 0,10%, 0,25%, 0,50%
- XALATAN collyre 0,005%

**MYDRIATIQUES (Pupil Dilators):**
- ATROPINE FAURE collyre 1%
- CYCLOGYL 1%
- MYDRIATICUM collyre 0,5%
- NEOSYNEPHRINE FAURE collyre 10%
- TROPICAMIDE FAURE collyre 0,5%

**ANTIBIOTIQUE LOCAUX (Eye Antibiotics):**
- CILOXAN collyre 0,3%
- TOBREX collyre
- AZYTER unidoses
- FUCITHALMIC gel opht 1%

### Execution Order for Medications

```bash
# Step 1: Seed the Drug collection with French medications
node backend/scripts/seedFrenchDrugs.js

# Step 2: Seed MedicationTemplate for prescription autocomplete
node backend/scripts/seedAllClinicMedications.js

# Step 3: Create PharmacyInventory from seeded drugs (per clinic)
node backend/scripts/seedPharmacyInventory.js
```

---

## Phase 0.5: Import Legacy Pharmacy Inventory (NEW)

### CSV Structure: PharmaA_Local.csv / PharmaB_Local.csv

```csv
ProduitA,StockA
"CYCLOGYL 1% COOLYRE",0
"INDOCOLLYRE 0,1",0
"TOBREX COLLYRE",3
"CORRECTOL COLLYRE",10
"AZELASTIN COMOD 0,5MG/ML COLLYRE",0
```

### CSV Structure: StockA_Local.csv / StockB_Local.csv

```csv
ProduitA,StockA
" ACCESS POINT TP-LINK ( Pce )",0
"CYCLOGYL 1% COOLYRE",5
"FIL NYLON 9-0",10
```

### Field Mapping: Legacy Pharmacy → PharmacyInventory

| CSV Field | MedFlow PharmacyInventory Field | Transformation |
|-----------|--------------------------------|----------------|
| ProduitA/ProduitB | medication.brandName | String as-is (French name) |
| StockA/StockB | inventory.currentStock | Parse integer |
| - | medication.nameFr | Same as brandName |
| - | clinic | Map A→Clinic1, B→Clinic2 |
| - | drug | Fuzzy match to Drug collection |

### Script Needed: `importLegacyPharmacy.js`

```javascript
// Location: backend/scripts/importLegacyPharmacy.js
// Purpose: Import PharmaA/B and StockA/B CSVs into PharmacyInventory

async function importLegacyPharmacy() {
  // 1. Parse PharmaA_Local.csv and PharmaB_Local.csv
  // 2. For each product:
  //    a. Fuzzy match to existing Drug by French name
  //    b. Create or update PharmacyInventory entry
  //    c. Set initial stock from CSV
  // 3. Parse StockA_Local.csv and StockB_Local.csv for additional stock data
  // 4. Merge stock levels into PharmacyInventory
}
```

**STATUS: SCRIPT NOT YET CREATED** ❌

---

## Import Dependency Chain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         IMPORT ORDER (CRITICAL)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  0. FRENCH DRUGS (seedFrenchDrugs.js) ──────► Drug model                    │
│     PREREQUISITE for pharmacy matching       └──► ~700+ French medications  │
│                                                                              │
│  0.5 PHARMACY INVENTORY (PharmaA/B, StockA/B) ──► PharmacyInventory         │
│      Links: Drug via fuzzy French name match     └──► Real stock levels     │
│      ❌ SCRIPT NOT YET CREATED                                               │
│                                                                              │
│  1. PATIENTS (LV_Patients.csv) ────────────────► Patient model              │
│     ✓ ALREADY IMPORTED (34,959 records)                                      │
│                                                                              │
│  2. CONSULTATIONS (LV_Consultations.csv) ──────┬──► Visit model             │
│     Links: Patient via NumFiche                 │                            │
│                                                 ├──► ConsultationSession     │
│                                                 └──► OphthalmologyExam       │
│                                                                              │
│  3. ACTES (LV_Actes.csv) ──────────────────────┬──► Visit.clinicalActs      │
│     Links: Patient via NumFiche                 │                            │
│     Links: Visit via NumActe                    └──► Invoice model           │
│     NOTE: "Service: Pharmacie" items link to PharmacyInventory               │
│                                                                              │
│  4. DIAGNOSTICS (DiagnosticsRP_Local.csv) ─────► Visit.diagnoses            │
│     Links: Visit via NumVisite                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Medication Matching for LV_Actes.csv

When `Service = "Pharmacie"` in LV_Actes.csv, the `Acte` field contains French medication names that must be matched to the Drug collection:

**Sample pharmacy items from LV_Actes.csv:**
```
Service: "Pharmacie", Acte: "TOBREX COLLYRE"
Service: "Pharmacie", Acte: "CYCLOGYL 1%"
Service: "Pharmacie", Acte: "INDOCOLLYRE 0,1%"
Service: "Pharmacie", Acte: "DIAMOX CES 250MG"
```

**Matching strategy:**
1. Normalize French drug name (remove accents, lowercase)
2. Try exact match in Drug.name
3. Try fuzzy match using Levenshtein distance
4. Fall back to creating new Drug entry if no match

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

### Step 0: French Medications (PREREQUISITE) ✅ COMPLETED 2025-12-11
- [x] Run `node backend/scripts/seedFrenchDrugs.js` → **635 drugs in 36 categories**
- [x] Run `node backend/scripts/seedAllClinicMedications.js` → **384 medication templates**
- [x] Verify French categories are correctly mapped
- [x] Verify drug names match legacy CSV naming conventions

### Step 0.5: Legacy Pharmacy Inventory ✅ COMPLETED 2025-12-11
- [x] **CREATED** `importLegacyPharmacy.js` script
- [x] Parse PharmaA_Local.csv and PharmaB_Local.csv
- [x] Fuzzy match products to Drug collection (5,196 matched)
- [x] Import StockA_Local.csv and StockB_Local.csv stock levels
- [x] **931 pharmacy inventory entries created**

### Step 1: Preparation ✅ COMPLETED
- [x] Verify all CSV files are accessible
- [x] Patient import completed: **21,607 patients** with legacy IDs

### Step 2: Import Consultations ✅ COMPLETED 2025-12-11
- [x] Run `DRY_RUN=true node backend/scripts/importLegacyConsultations.js`
- [x] Run full import
- [x] **55,739 visits created**
- [x] **11,586 ophthalmology exams created**

### Step 3: Import Acts & Invoices ✅ COMPLETED 2025-12-11
- [x] Run `DRY_RUN=true node backend/scripts/importLegacyActes.js`
- [x] Run full import
- [x] **168,251 invoices created**
- [x] **Total invoice value: 13,020,357,461 CDF**
- [x] **55,739 visits updated with clinical acts**

### Step 4: Import Diagnoses ⚠️ SKIPPED
- [x] Analyzed DiagnosticsRP_Local.csv
- ❌ **SKIPPED**: DMI patient IDs don't match LV patient IDs
  - LV format: `10000C01`, `10001A01`
  - DMI format: `10002CLB`, `10020CLA`, `1007VL`
- ℹ️ Requires patient ID mapping between systems to proceed

### Step 5: Post-Import Verification ✅ COMPLETED 2025-12-11
- [x] Run data integrity checks
- [x] Verified collection counts
- [x] **49,563 visits have diagnoses** (from consultations import)
- [x] French medication names verified
- [x] Pharmacy inventory: 888 out-of-stock, 23 low-stock, 20 in-stock

---

## Final Import Statistics (2025-12-11)

| Model | Actual Records | Notes |
|-------|----------------|-------|
| Drug | **635** | French medications in 36 categories |
| MedicationTemplate | **384** | French medications from seedAllClinicMedications.js |
| PharmacyInventory | **931** | From PharmaA/B + StockA/B CSVs (5,196 matched to drugs) |
| Patient | **21,607** | With legacy LV IDs |
| Visit | **55,739** | All legacy visits imported |
| OphthalmologyExam | **11,586** | For ophtho consultations with exam data |
| Invoice | **168,251** | Created from LV_Actes.csv |
| Invoice Total Value | **13,020,357,461 CDF** | ~$4.8M USD equivalent |
| Visit.clinicalActs | **55,739** | All visits have clinical acts |
| Visit.diagnoses | **49,563** | From consultation Diagnostics field |

---

## Notes

1. **Time Zone**: All dates are assumed to be in Africa/Kinshasa timezone
2. **Currency**: All prices are in CDF (Congolese Franc)
3. **Provider**: System user will be assigned as provider for all legacy records
4. **Status**: All imported visits/invoices will be marked as "completed"/"paid"
5. **Clinic**: All records assigned to Tombalbaye clinic (source of backup)

### French Language Specifics

6. **Drug Names**: All medications use French names and forms:
   - "collyre" = eye drops
   - "pom opht" / "pommade" = ophthalmic ointment
   - "cp" / "comprimé" = tablet
   - "gél" / "gélule" = capsule
   - "inj" / "injectable" = injection
   - "sirop" / "sol buv" = syrup/oral solution
   - "suppo" = suppository
   - "unidose" = single-use unit

7. **Drug Categories**: French pharmaceutical categories (32 total), examples:
   - "A.I.N.S" = Anti-Inflammatoires Non Stéroïdiens (NSAIDs)
   - "ANTIBIOTIQUE LOCAUX" = Local/Topical Antibiotics
   - "ANTI GLAUCOMATEUX" = Glaucoma Medications
   - "MYDRIATIQUES" = Pupil Dilators
   - "LARMES ARTIFICIELLES" = Artificial Tears
   - "CORTICOIDES" = Corticosteroids

8. **Decimal Format**: French uses comma for decimals:
   - "0,1%" not "0.1%"
   - "-3,25" not "-3.25"
   - Scripts must handle both formats

### Missing Scripts Summary

| Script | Purpose | Status |
|--------|---------|--------|
| `importLegacyPharmacy.js` | Import PharmaA/B, StockA/B CSVs | ❌ NOT CREATED |
| `importLegacyConsultations.js` | Import LV_Consultations.csv | ✅ EXISTS |
| `importLegacyActes.js` | Import LV_Actes.csv | ✅ EXISTS |
| `importLegacyDiagnoses.js` | Import DiagnosticsRP_Local.csv | ✅ EXISTS |
| `seedFrenchDrugs.js` | Seed French medications | ✅ EXISTS |
| `seedAllClinicMedications.js` | Seed MedicationTemplate | ✅ EXISTS |
| `seedPharmacyInventory.js` | Create PharmacyInventory | ✅ EXISTS |
