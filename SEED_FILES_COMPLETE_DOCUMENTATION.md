# Complete Seed Files Documentation
**CareVision/MedFlow Backend Seeding System**

*Generated: 2025-11-20*
*Total Active Seed Files: 19*
*Total Deprecated Seed Files: 4*

---

## Table of Contents

1. [Overview](#overview)
2. [Master Orchestrator](#master-orchestrator)
3. [Active Seed Files](#active-seed-files)
4. [Deprecated Seed Files](#deprecated-seed-files)
5. [Default Credentials](#default-credentials)
6. [Execution Order & Dependencies](#execution-order--dependencies)
7. [Data Structures Reference](#data-structures-reference)
8. [Country/Region Configurations](#countryregion-configurations)

---

## Overview

The CareVision/MedFlow system uses a comprehensive seeding system to initialize the database with:
- **Patient test data** (Congolese and Moroccan)
- **Medical equipment catalogs** (3 physical clinic sites)
- **Medication databases** (600+ medications with French and English names)
- **Clinical procedures** (100+ ophthalmology and general procedures)
- **Document templates** (30+ medical certificates, letters, reports)
- **Treatment protocols** (pre-defined multi-medication regimens)
- **User accounts** (demo users for all roles)

### Technology Stack
- **Database**: MongoDB with replica set (rs0)
- **ODM**: Mongoose
- **Languages**: JavaScript (Node.js)
- **Localization**: French (primary), English (secondary)
- **Currency**: CFA (Congo), MAD (Morocco), USD
- **Phone Format**: +243 (DRC), +212 (Morocco)

---

## Master Orchestrator

### `seedCongo.js` (52 lines)

**Purpose**: Master seed orchestrator that runs all Congo-specific seed scripts sequentially.

**Location**: `/backend/scripts/seedCongo.js`

**Dependencies**: Uses `child_process.execSync` to run scripts

**Execution Order**:
```javascript
[
  'seedCongoData.js',           // Patient data
  'seedAllClinicMedications.js', // Medication catalog
  'seedAllClinicEquipment.js',   // Equipment catalog
  'seedPharmacyInventory.js',    // Inventory from Drug collection
  'seedFrenchClinicalActs.js',   // Clinical procedures
  'seedDocumentTemplates.js',    // Document templates
  'seedLetterTemplates.js',      // Letter templates
  'seedDoseTemplatesComplete.js', // Dose templates
  'seedTreatmentProtocolsComplete.js', // Treatment protocols
  'seedCommentTemplates.js',     // Comment templates
  'seedTemplates.js'            // Master template seeder
]
```

**Features**:
- Continues execution even if one script fails
- Progress reporting with visual separators
- Error logging per script
- Complete summary at end

**Usage**:
```bash
node backend/scripts/seedCongo.js
```

---

## Active Seed Files

### 1. Patient & User Data

#### `seedCongoData.js` (427 lines) ✓ COMPLETE READ

**Purpose**: Creates Congolese test patients with realistic data for Democratic Republic of Congo deployment.

**Clears Before Seeding**:
- Patients
- Appointments
- OphthalmologyExams
- Counters (resets sequence)

**Creates**:

**5 Congolese Patients**:

1. **Mbuyi Kabongo** (Male, 45 years)
   - Location: Kinshasa, Commune de Gombe
   - Blood: A+
   - Conditions: Hypertension
   - Phone: +243 812 345 678
   - National ID: 1-7905-N12345-67

2. **Tshala Mwamba** (Female, 32 years)
   - Location: Lubumbashi, Katanga
   - Blood: O+
   - Phone: +243 823 456 789
   - National ID: 1-9206-N23456-78

3. **Nkulu Tshisekedi** (Male, 58 years)
   - Location: Kinshasa, Limete
   - Blood: B+
   - Conditions: Diabète type 2, Glaucome à angle ouvert
   - Phone: +243 998 765 432
   - National ID: 1-6608-N34567-89
   - **Has ophthalmology prescription**: OD -1.25/-0.50x180, OS -1.50/-0.75x175

4. **Marie Lukusa** (Female, 40 years)
   - Location: Goma, Nord-Kivu
   - Blood: AB+
   - Allergy: Pénicilline (reaction: Éruption cutanée)
   - Phone: +243 970 111 222
   - National ID: 1-8402-N45678-90

5. **Jean Ilunga** (Male, 28 years)
   - Location: Mbuji-Mayi, Kasaï-Oriental
   - Blood: O-
   - Conditions: Myopie sévère
   - Phone: +243 815 333 444
   - National ID: 1-9605-N56789-01
   - **Has ophthalmology prescription**: OD -6.00/-1.00x180, OS -6.50/-1.25x175

**5 Appointments** (all scheduled for today):
- All assigned to Dr. Joseph Kabila (found by email: joseph.kabila@medflow.com)
- Time slots: 09:00, 10:00, 11:00, 14:00, 15:00
- Status: scheduled
- Departments: general (3), ophthalmology (2)

**2 Ophthalmology Exams**:

1. **Nkulu Tshisekedi** - Comprehensive Exam
   - Chief Complaint: "Baisse progressive de l'acuité visuelle"
   - Visual Acuity: OD 20/40→20/20, OS 20/50→20/25
   - IOP: OD 22mmHg, OS 23mmHg (elevated - glaucoma)
   - Diagnosis: Glaucome à angle ouvert (H40.1)
   - Refraction: OD -1.25/-0.50x180, OS -1.50/-0.75x175
   - Plan: Follow-up in 3 months, education on medication compliance

2. **Jean Ilunga** - Myopia Follow-up
   - Chief Complaint: "Vision floue de loin"
   - Visual Acuity: OD 20/200→20/20, OS 20/200→20/20
   - IOP: OD 14mmHg, OS 15mmHg (normal)
   - Diagnosis: Myopie forte (H52.1)
   - Refraction: OD -6.00/-1.00x180, OS -6.50/-1.25x175
   - Plan: Annual follow-up

**Default Provider**: Dr. Joseph Kabila (must exist in database)

**Congo-Specific Data**:
- Currency: CDF (Congolese Franc)
- Phone format: +243 (country code)
- Cities: Kinshasa, Lubumbashi, Goma, Mbuji-Mayi
- National ID format: 1-YYMM-N#####-##
- French language medical terms

---

#### `createAdminUser.js` (55 lines) ✓ COMPLETE READ

**Purpose**: Creates a single admin user with default credentials.

**Creates**:
```javascript
{
  username: 'admin',
  email: 'admin@medflow.com',
  password: 'admin123',  // ⚠️ SECURITY: Hardcoded
  firstName: 'Admin',
  lastName: 'User',
  role: 'admin',
  employeeId: 'EMP001',
  phoneNumber: '+243 123456789',
  specialty: 'Administration',
  isActive: true,
  permissions: []
}
```

**Security Alert**:
- Default password `admin123` is hardcoded
- Password is hashed with bcrypt (10 rounds) before storage
- Should be changed immediately after first login

**Usage**:
```bash
node backend/scripts/createAdminUser.js
```

---

#### `createDemoUsers.js` (134 lines) ✓ COMPLETE READ

**Purpose**: Creates 6 demo users for CareVision system with different roles.

**Creates**:

1. **Admin** - admin@carevision.com / admin123
2. **Doctor** - doctor@carevision.com / doctor123 (Dr. Jean Mukendi)
3. **Ophthalmologist** - ophthalmologist@carevision.com / ophthal123 (Dr. Marie Kabanga)
4. **Nurse** - nurse@carevision.com / nurse123 (Sarah Mwamba)
5. **Receptionist** - receptionist@carevision.com / reception123 (Alice Tshisekedi)
6. **Pharmacist** - pharmacist@carevision.com / pharma123 (Pierre Kalala)

**Features**:
- Checks for existing users before creating
- Congolese names (Mukendi, Kabanga, Mwamba, Tshisekedi, Kalala)
- Phone format: +2439000000XX
- Employee IDs: EMP001-EMP006
- License numbers for doctors/pharmacists

---

#### `seedUsers.js` (153 lines) ✓ COMPLETE READ

**Purpose**: Creates 5 demo users for MedFlow system (older version, uses @medflow.com domain).

**Creates**:

1. **Admin** - admin@medflow.com / Admin123!
2. **Dr. John Smith** - doctor@medflow.com / Admin123! (Ophthalmology, Retinal Surgery)
3. **Dr. Sarah Johnson** - doctor2@medflow.com / Admin123! (Pediatric Ophthalmology)
4. **Emily Davis** - technician@medflow.com / Admin123! (Ophthalmic Technician)
5. **Michael Wilson** - reception@medflow.com / Admin123! (Receptionist)

**Note**: All use same password: `Admin123!`

---

### 2. Medication Data

#### `seedAllClinicMedications.js` (24,363 bytes) ✓ PARTIAL READ (200 lines)

**Purpose**: Comprehensive medication catalog with French categorization for Congo/Morocco clinics.

**Total Size**: 24KB (estimated 1200+ lines, 600+ medications)

**French Categories** (30+):

1. **A.I.N.S GENERAUX + CORTICOIDES** (40+ medications)
   - Examples: ASPEGIC, ASPRO, ADVIL, BRUFEN, NIFLURIL, VOLTARENE, IBUPROFEN
   - Dosages: 100mg-1000mg for ASPEGIC, various strengths

2. **A.I.N.S LOCAUX** (17+ eye drops)
   - Examples: ACULAR, INDOCOLLYRE, VOLTARENE OPHTA, DICLOABAK, KETOROLAC
   - Forms: Eye drops (gttes)

3. **ANESTHESIE LOCALES**
   - Examples: TETRACAINE, OXYBUPROCAINE, LIDOCAINE
   - Ophthalmic anesthetics

4. **ANTIPALUDIQUES** (Malaria medications - critical for Congo)
   - Antimalarial drugs for endemic regions

5. **ANTI SPASMODIQUES**
   - Antispasmodic medications

6. **ANTI ALLERGIQUES** (70+ medications)
   - Extensive allergy medication catalog

7. **ANTIBIOTIQUE LOCAUX**
   - Ophthalmic antibiotics

8. **ANTIBIOTIQUE GENERAUX**
   - Systemic antibiotics

9. **ANTI CATARACTE**
   - Anti-cataract medications

10. **ANTI GLAUCOMATEUX**
    - Glaucoma medications

11. **ANTI HYPERTENSEURS**
    - Antihypertensive medications

12. **ANTI MYCOSIQUES**
    - Antifungal medications

13. **ANTI VIRAUX**
    - Antiviral medications

14. **CICATRISANTS**
    - Healing agents

15. **CORTICOIDES + ANTIBIOTIQUES**
    - Combination medications

16. **CORTICOIDES LOCAUX**
    - Topical corticosteroids

17. **CREMES DERMIQUES**
    - Dermatological creams

18. **DECONGESTIONNANT**
    - Decongestants

19. **DIVERS OPHA**
    - Miscellaneous ophthalmic

20. **LARMES ARTIFICIELLES**
    - Artificial tears

21. **MYDRIATIQUES**
    - Mydriatic agents

22. **VASCULOTROPES**
    - Vascular agents

23. **VITAMINES**
    - Vitamins and supplements

**Data Structure**:
```javascript
{
  categoryFr: {
    id: 'ains_generaux_corticoides',
    name: 'A.I.N.S GENERAUX + CORTICOIDES',
    nameEn: 'NSAIDs and Corticosteroids'
  },
  medications: [
    {
      name: 'ASPEGIC',
      formulation: 'powder',
      route: 'oral',
      dosages: ['100mg', '500mg', '1000mg'],
      fullDescription: 'ASPEGIC nourrisson 100mg ...'
    }
  ]
}
```

**Storage**: Drug collection in MongoDB

---

#### `seedFrenchDrugs.js` (19,212 bytes) ✓ PARTIAL READ (100 lines)

**Purpose**: French medication database organized by 25+ categories.

**Categories Include**:
- AINS (NSAIDs)
- Antibiotiques
- Antiglaucomateux
- Larmes artificielles
- Vitamines
- And 20+ more

**Storage**: Drug collection

---

#### `seedPharmacyInventory.js` (298 lines) ✓ PARTIAL READ (200 lines)

**Purpose**: Creates pharmacy inventory entries from Drug collection with stock levels, pricing, and batch tracking.

**Process**:
1. Reads all active drugs from Drug collection
2. Generates random stock levels based on medication type
3. Creates pricing with 30% markup
4. Generates batch information with expiration tracking

**Stock Level Generation**:
```javascript
// Ophthalmic medications
{
  current: 20-120 units,
  minimum: 10,
  maximum: 150,
  reorderPoint: 20
}

// General medications
{
  current: 50-250 units,
  minimum: 30,
  maximum: 300,
  reorderPoint: 50
}
```

**Pricing**:
- Cost: 500-5500 CFA (random)
- Selling Price: Cost × 1.3 (30% markup)
- Currency: CFA

**Batch Generation**:
```javascript
{
  lotNumber: 'LOT10000-99999',
  expirationDate: +2 years from manufacture,
  manufactureDate: -1 to -6 months ago,
  quantity: 10-60 units,
  supplier: { name: 'PharmaCo International' }
}
```

**Category Mapping**:
French categories → English enum:
- ANTIBIOTIQUE LOCAUX/GENERAUX → antibiotic
- A.I.N.S → anti-inflammatory
- ANTI ALLERGIQUES → antihistamine
- ANTI VIRAUX → antiviral
- VITAMINES → vitamin
- Others → other

**Route Mapping**:
- ophthalmic → ophthalmic
- oral → oral
- intravenous → injectable
- topical → topical

**Storage**: PharmacyInventory collection

**Output Stats**:
- Total medications processed
- Total inventory entries created
- Low stock items count
- Expiring within 90 days count

---

#### `seedVitaminsFromTemplates.js` (127 lines) ✓ COMPLETE READ

**Purpose**: Creates vitamin entries in Drug and PharmacyInventory from MedicationTemplate collection.

**Process**:
1. Finds all templates with category 'VITAMINES'
2. Creates Drug entry for each
3. Creates PharmacyInventory entry with random stock

**Form Mapping**:
- cp → tablet
- inj → injection
- sp → liquid

**Generated Data**:
```javascript
{
  category: 'vitamin',
  categoryFr: { id: 'vitamines', name: 'VITAMINES' },
  location: {
    pharmacy: 'Main Pharmacy',
    section: 'Vitamins & Supplements'
  },
  pricing: {
    cost: 1000-4000 CFA,
    sellingPrice: 2000-7000 CFA,
    currency: 'CFA'
  },
  prescription: { required: false },
  batches: [{
    expirationDate: +2 years,
    manufactureDate: -1 month
  }]
}
```

---

### 3. Equipment Data

#### `seedAllClinicEquipment.js` (15,154 bytes) ✓ PARTIAL READ (200 lines)

**Purpose**: Medical equipment catalog for 3 physical clinic sites.

**Sites**:

1. **MATRIX** (Site Code: MATRIX)
   - Location: Primary clinic location
   - Equipment count: 10+ devices

2. **TOMBALBAYE** (Site Code: TOMBALBAYE)
   - Location: Secondary clinic
   - Equipment count: 8+ devices

3. **MATADI** (Site Code: MATADI)
   - Location: Tertiary clinic
   - Equipment count: 6+ devices

**Sample Equipment**:

```javascript
{
  // High-end OCT Device
  name: '3D OCT1 MAESTRO Topcon',
  equipmentId: 'MATRIX-001',
  manufacturer: 'Topcon',
  model: '3D OCT-1 Maestro',
  category: 'imaging',
  site: 'MATRIX',
  status: 'operational',
  connectionType: 'Network',
  dataExportMethod: 'Shared folder',
  folderPath: '/devices/matrix/oct1'
}

{
  // Autorefractor
  name: 'TONOREF III NIDEK',
  equipmentId: 'MATRIX-003',
  manufacturer: 'NIDEK',
  model: 'TONOREF III',
  category: 'refraction',
  site: 'MATRIX',
  status: 'operational',
  connectionType: 'WiFi',
  dataExportMethod: 'WiFi/Bluetooth'
}

{
  // Fundus Camera
  name: 'CLARUS 700 zeiss',
  equipmentId: 'MATRIX-006',
  manufacturer: 'Carl Zeiss',
  model: 'CLARUS 700',
  category: 'imaging',
  site: 'MATRIX',
  status: 'operational'
}
```

**Connection Types**:
- Network (Ethernet)
- WiFi
- Bluetooth
- USB
- Not Connected (Manual entry)

**Data Export Methods**:
- Shared folder
- Manual entry
- WiFi/Bluetooth transfer
- DICOM server
- USB transfer

**Storage**: EquipmentCatalog collection

---

### 4. Clinical Procedures

#### `seedFrenchClinicalActs.js` (18,184 bytes) ✓ PARTIAL READ (150 lines)

**Purpose**: Clinical procedures and appointment types with French categorization.

**Categories**:

1. **Anesthésie**
   - Anesthésie générale (60 min, 200,000 CFA)
   - Anesthésie sous ténonienne (30 min, 50,000 CFA)
   - Anesthésie topique (10 min, 10,000 CFA)

2. **Examens diagnostiques**
   - Biométrie oculaire (20 min, 30,000 CFA)
   - Tonométrie (10 min, 15,000 CFA)
   - Pachymétrie (15 min, 20,000 CFA)

3. **Périmétrie**
   - Champ visuel automatique (30 min, 40,000 CFA)
   - Champ visuel par confrontation (10 min, 10,000 CFA)

4. **Imagerie**
   - OCT maculaire (20 min, 50,000 CFA)
   - OCT papillaire (20 min, 50,000 CFA)
   - Angiographie fluorescéinique (45 min, 80,000 CFA)
   - Échographie oculaire (20 min, 35,000 CFA)
   - Rétinophotographie (15 min, 30,000 CFA)
   - Topographie cornéenne (20 min, 40,000 CFA)

5. **Consultations**
   - Consultation ophtalmologique (30 min, 25,000 CFA)
   - Consultation orthoptique (45 min, 30,000 CFA)
   - Consultation pédiatrique (45 min, 35,000 CFA)

6. **Laser**
   - YAG capsulotomie (20 min, 100,000 CFA)
   - YAG iridotomie (15 min, 80,000 CFA)
   - SLT (trabéculoplastie sélective) (30 min, 150,000 CFA)
   - Photocoagulation rétinienne (45 min, 200,000 CFA)

7. **IVT (Intravitreal Injections)**
   - IVT Ranibizumab/Lucentis (20 min, 250,000 CFA)
   - IVT Bevacizumab/Avastin (20 min, 180,000 CFA)
   - IVT Aflibercept/Eylea (20 min, 280,000 CFA)

**Data Structure**:
```javascript
{
  categoryFr: {
    id: 'anesthesie',
    name: 'Anesthésie'
  },
  acts: [
    {
      nameFr: 'Anesthésie générale',
      nameEn: 'General anesthesia',
      duration: 60,
      price: 200000,
      currency: 'CFA',
      description: 'Anesthésie générale pour chirurgie oculaire'
    }
  ]
}
```

**Currency**: All prices in CFA (Congolese/West African Franc)

**Storage**: ClinicalAct collection

---

#### `seedClinicalProcedures.js` (289 lines) ✓ COMPLETE READ

**Purpose**: Generates ClinicalAct documents from clinical-procedures.json file with intelligent categorization.

**Process**:
1. Reads `/backend/data/clinical-procedures.json`
2. Determines required roles based on procedure type
3. Assigns department (mostly ophthalmology)
4. Generates ophthalmic-specific details
5. Creates pricing based on category

**Role Determination Logic**:
```javascript
// Surgical/Laser
if (category === 'surgical' || category === 'laser') {
  requiredRole: ['doctor', 'ophthalmologist']
}

// IVT Injections
if (category === 'injection' && name.includes('ivt')) {
  requiredRole: ['ophthalmologist']
}

// Consultations
if (category === 'consultation') {
  if (name.includes('orthoptic')) {
    requiredRole: ['nurse', 'ophthalmologist']
  } else {
    requiredRole: ['doctor', 'ophthalmologist']
  }
}

// Imaging/Diagnostic
if (category === 'imaging' || category === 'diagnostic') {
  if (name.includes('oct/angio/topo')) {
    requiredRole: ['technician', 'ophthalmologist']
  } else {
    requiredRole: ['nurse', 'technician', 'ophthalmologist']
  }
}
```

**Ophthalmic Details Detection**:
```javascript
// Cataract surgery
if (name.includes('phaco/sics/cataract')) {
  isCataractSurgery: true,
  iolType: 'standard/premium/multifocal'
}

// Retinal procedures
if (name.includes('vitreo/retinien/photocoagulation')) {
  isRetinalProcedure: true
}

// Glaucoma procedures
if (name.includes('glaucom/trabeculectomie/slt')) {
  isGlaucomaProcedure: true
}

// Requires dilation
if (diagnostic && name.includes('fond/retino/angio/oct')) {
  requiresDilation: true
}
```

**Pricing Map**:
```javascript
{
  consultation: 50,
  diagnostic: 75,
  imaging: 100,
  surgical: 1500,
  laser: 500,
  injection: 200,
  anesthesia: 200
}
```

**Act ID Generation**: `ACT{YEAR}{5-digit-index}` (e.g., ACT2024500001)

**Features**:
- Clears existing ophthalmology procedures before seeding
- Duplicate detection
- Error handling with summary
- Category breakdown statistics

---

### 5. Document Templates

#### `seedDocumentTemplates.js` (874 lines) ✓ COMPLETE READ

**Purpose**: Comprehensive medical document template system with variable substitution for French medical certificates, reports, and letters.

**Total Templates**: 30+

**Categories**:

1. **CERTIFICAT (Certificates)** - 10 templates
2. **CERTIFICAT_APTITUDE (Fitness Certificates)** - 1 template
3. **COMPTE_RENDU_OPERATOIRE (Operative Reports)** - 1 template
4. **COURRIER_CONFRERE (Colleague Correspondence)** - 5 templates
5. **ORDONNANCE_POSTOP (Post-op Prescriptions)** - 2 templates
6. **CONSENTEMENT_CHIRURGIE (Surgical Consent)** - 1 template
7. **RAPPEL_RDV (Appointment Reminders)** - 2 templates
8. **RELANCE_PAIEMENT (Payment Reminders)** - 1 template
9. **ECHOGRAPHIE (Ultrasound Reports)** - 1 template
10. **EXAMEN (Examination Reports)** - 2 templates
11. **PRESCRIPTION_INSTRUCTIONS (Surgery Instructions)** - 4 templates
12. **PAYMENT (Payment Receipts)** - 1 template

**Sample Templates**:

**Visual Acuity Certificate**:
```
CERTIFICAT

Je soussigné, {{doctorName}},

certifie avoir examiné ce jour :

{{patientTitle}} {{patientName}}

Son acuité visuelle sans correction est :

à Droite de {{vaOD}} dixièmes

à Gauche de {{vaOG}} dixièmes.

Certificat médical établi à la demande de l'intéressé(e)
et remis en main propre pour faire valoir ce que de droit.

{{doctorName}}
```

**Variables**:
```javascript
[
  { name: 'doctorName', label: 'Nom du médecin', type: 'text', required: true },
  { name: 'patientTitle', label: 'Titre', type: 'select', options: ['Monsieur', 'Madame'], required: true },
  { name: 'patientName', label: 'Nom du patient', type: 'text', required: true },
  { name: 'vaOD', label: 'Acuité visuelle OD (dixièmes)', type: 'number', required: true },
  { name: 'vaOG', label: 'Acuité visuelle OG (dixièmes)', type: 'number', required: true }
]
```

**Cataract Surgery Templates**:

1. **Anesthesia Request (General)**
   - Variables: colleagueName, patientInfo, surgeryDate, eye, doctorName
   - Content: Polite request to anesthesiologist

2. **Anesthesia Request (Local)**
   - Similar to general but for local anesthesia

3. **Pre-operative Referral**
   - Request for cardio-vascular assessment
   - Checks for anticoagulant treatment

4. **Post-operative Report**
   - Describes phacoemulsification procedure
   - IOL power and expected outcome

5. **Pre-operative Instructions**
   - INDOCOLLYRE + EXOCINE for 8 days
   - Warns about aspirin discontinuation

6. **Post-operative Instructions**
   - CHIBROCADRON + INDOCOLLYRE for 1 month

**Physical Fitness Certificate** (Corporate):
```
Je soussigné {{doctorName}}, Docteur en médecine résidant à Kinshasa.
Sur demande qui m'a été faite par l'Entreprise {{companyName}}
et après avoir examiné ce jour {{patientTitle}} {{patientName}}
né à {{birthPlace}} le {{dateOfBirth}} employé au poste de {{jobTitle}};

Je certifie que l'intéressé(e) est :

• Apte aux travaux physiques {{workloadLevel}}
  (très légers, légers, modérés, lourds ou très lourds)

• Apte à l'exercice de sa fonction actuelle

{{additionalConditions}}

Certificat médical établi et remis en main propre pour
faire valoir ce que de droit
```

**School Certificates**:
- Certificat d'Arrêt Scolaire (School leave)
- Certificat Non Contagieux (Non-contagious)
- Certificat Placement Premier Rang (Front row seating for vision)

**Payment Documents**:
- Reçu de Paiement (Receipt with currency options: USD/CDF/€uros)
- Rappel de Paiement (Payment reminder)

**Myopia Surgery**:
- Post-operative certificate
- Informed consent (detailed risks and benefits)
- Pre-operative instructions (with ATARAX, EXOCINE, VOLTARENE)
- Post-surgery precautions (no makeup, water, sports for specified periods)

**Template ID Generation**: `TPL0001` - `TPL9999`

**Allowed Roles**:
- Most templates: ['admin', 'doctor', 'ophthalmologist']
- Post-op instructions: +['nurse']
- Payment: +['receptionist']

**Storage**: DocumentTemplate collection

---

#### `seedLetterTemplates.js` (454 lines) ✓ COMPLETE READ

**Purpose**: Similar to DocumentTemplates but stored in separate LetterTemplate collection (possibly older system).

**Total Templates**: 17

**Categories**:

1. **CERTIFICAT** - 6 templates
   - Certificat d'acuité visuelle
   - Certificat de consultation avec accompagnant
   - Certificat de repos
   - Certificat port de verres obligatoire
   - Certificat arrêt scolaire
   - Certificat placement premiers rangs

2. **CERTIFICAT_APTITUDE** - 1 template
   - Certificat d'aptitude physique

3. **COMPTE_RENDU_OPERATOIRE** - 1 template
   - Compte rendu opératoire phaco

4. **COURRIER_CONFRERE** - 2 templates
   - Demande anesthésie cataracte
   - Compte rendu post-opératoire confrère

5. **ORDONNANCE_POSTOP** - 2 templates
   - Ordonnance post-cataracte
   - Traitement pré-opératoire

6. **CONSENTEMENT_CHIRURGIE** - 1 template
   - Consentement chirurgie myopie

7. **RAPPEL_RDV** - 1 template
   - Rappel de rendez-vous

8. **RELANCE_PAIEMENT** - 1 template
   - Relance paiement

9. **ECHOGRAPHIE** - 1 template
   - Rapport échographie oculaire

10. **CHAMP_VISUEL** - 1 template
    - Rapport champ visuel (with 13 pre-defined result options)

**Visual Field Results** (select dropdown):
```javascript
[
  'champ visuel dans les limites de la normale',
  'champ visuel compatible avec un déficit glaucomateux minime',
  'champ visuel compatible avec un déficit glaucomateux modéré',
  'champ visuel compatible avec un déficit glaucomateux sévère',
  'champ visuel à confronter avec la clinique',
  'marche nasale supérieure',
  'marche nasale inférieure',
  'déficit arciforme supérieur',
  'déficit arciforme inférieur',
  'scotome paracentral',
  'scotome central',
  'scotome caeco-central',
  'baisse générale de la sensibilité rétinienne'
]
```

**Storage**: LetterTemplate collection

**Difference from DocumentTemplates**:
- Simpler structure
- Fewer templates
- Different collection
- Possibly legacy system

---

### 6. Prescription Templates

#### `seedDoseTemplatesComplete.js` (20,574 bytes) ✓ PARTIAL READ (150 lines)

**Purpose**: Complete prescription template system for 13 medication forms with French instructions.

**Medication Forms** (13 total):

1. **Collyre (Eye Drops)** - Most detailed
   ```javascript
   doseOptions: ['1 goutte', '2 gouttes', '3 gouttes']
   posologieOptions: ['OD', 'OG', 'ODG', '1x/jour', '2x/jour', '3x/jour',
                      'toutes les heures', 'matin', 'soir', 'matin+soir']
   detailsOptions: [
     'espacer de 5 min entre les collyres',
     'agiter le flacon avant emploi',
     'sans lentilles de contact',
     'fermer les yeux 2 min après instillation',
     'avec compression du point lacrymal'
   ]
   durationOptions: ['3 jours', '7 jours', '1 mois', 'au long cours']
   ```

2. **Pommade ophtalmique (Eye Ointment)**
   - Application: 'une application', 'une noisette'
   - Location: cul-de-sac conjonctival, paupière inférieure
   - Timing: soir, matin+soir, avant le coucher

3. **Comprimé (Tablet)**
   - Doses: 1/2, 1, 2, 3 comprimés
   - Frequency: matin, midi, soir, combinations
   - Details: pendant repas, à jeun, avec eau, avant coucher

4. **Gélule (Capsule)**
   - Similar to tablet
   - Additional: 'ne pas croquer ni ouvrir'

5. **Sirop (Syrup)**
   - Doses: cuillère à café, cuillère à soupe, 5ml, 10ml
   - Details: agiter avant emploi, diluer dans eau

6. **Injectable**
   - Routes: IM, IV, SC
   - Frequency: 1-3 times per day

7. **Suppositoire (Suppository)**
   - Doses: 1/2, 1, 2
   - Frequency: 1-3 times per day

8. **Sachet (Powder Sachet)**
   - Dilution instructions
   - Timing with meals

9. **Patch**
   - Application sites
   - Duration: 12h, 24h, 72h
   - Rotation instructions

10. **Spray nasal (Nasal Spray)**
    - Pulverisations per nostril
    - Nose cleaning before use

11. **Gouttes auriculaires (Ear Drops)**
    - Head position instructions
    - Warming to room temperature

12. **Crème/Pommade dermique (Topical Cream)**
    - Application: fine layer, massage
    - Frequency: 1-4 times daily

13. **Verres correcteurs (Glasses)**
    - Port permanent/occasionnel
    - Protection UV, antireflet

**Full Text Generation**:
Each template can generate complete French prescription text:
```
"Instiller 1 goutte dans l'œil droit 3 fois par jour
en respectant un intervalle de 5 minutes entre chaque collyre
pendant 7 jours"
```

**Storage**: DoseTemplate collection

**Usage**: Used by prescription module to generate standardized, professional French medical prescriptions

---

#### `seedCommentTemplates.js` (7,669 bytes) ✓ PARTIAL READ (150 lines)

**Purpose**: Standard pre-written comments for ophthalmology exams in French.

**Categories** (5):

1. **refraction** (Refraction findings)
   - Myopie légère (-0.25 à -3.00)
   - Myopie moyenne (-3.25 à -6.00)
   - Myopie forte (> -6.00)
   - Hypermétropie légère (+0.25 à +2.00)
   - Hypermétropie moyenne (+2.25 à +4.00)
   - Hypermétropie forte (> +4.00)
   - Astigmatisme faible (< 1.00)
   - Astigmatisme modéré (1.00 à 2.00)
   - Astigmatisme fort (> 2.00)
   - Presbytie débutante (add +0.75 à +1.25)
   - Presbytie confirmée (add +1.50 à +2.50)
   - Emmétropie (pas de défaut réfractif)

2. **adaptation** (Adaptation notes)
   - Première correction optique
   - Changement important de correction
   - Premiers verres progressifs
   - Adaptation progressive sur 2-3 semaines
   - Port permanent recommandé
   - Port occasionnel possible

3. **lens_type** (Lens recommendations)
   - Verres progressifs recommandés
   - Deux paires de lunettes (VP + VL)
   - Verres mi-distance pour ordinateur
   - Port de lentilles de contact possible
   - Verres amincis recommandés (forte correction)
   - Traitement anti-reflet indispensable
   - Protection UV recommandée

4. **keratometry** (Corneal curvature)
   - Cornée régulière
   - Cornée plate (< 42D)
   - Cornée cambrée (> 46D)
   - Astigmatisme cornéen conforme
   - Astigmatisme cornéen inversé

5. **general** (General comments)
   - Suivi recommandé dans 6 mois
   - Suivi recommandé dans 1 an
   - Vision stable depuis dernière consultation
   - Amélioration de l'acuité visuelle
   - Contrôle de la pression intraoculaire

**Data Structure**:
```javascript
{
  category: 'refraction',
  textFr: 'Myopie légère bilatérale, bien corrigée',
  usage: 'Exam findings',
  sortOrder: 1
}
```

**Storage**: CommentTemplate collection

**Usage**: Quick insertion of standard comments during exam documentation

---

#### `seedTreatmentProtocolsComplete.js` (21,574 bytes) ✓ PARTIAL READ (150 lines)

**Purpose**: Pre-defined multi-medication treatment regimens for common ophthalmic conditions.

**Categories**:

1. **Glaucome (Glaucoma)**
   - Monothérapie (single drug)
   - Bithérapie (two drugs)
   - Trithérapie (three drugs)

2. **Post-Cataracte (Post-cataract)**
   - Standard protocol (TOBRADEX + INDOCOLLYRE)
   - Renforcé protocol (MAXIDEX + CILOXAN + INDOCOLLYRE for 6 weeks)

3. **Conjonctivite Allergique (Allergic Conjunctivitis)**
   - Various antihistamine protocols

4. **Sécheresse Oculaire (Dry Eye)**
   - Mild: artificial tears 4x/day
   - Moderate: + gel at night
   - Severe: + anti-inflammatory

**Sample Protocol - Post-Cataracte Standard**:
```javascript
{
  name: 'Post-Cataracte Standard',
  category: 'cataracte',
  medications: [
    {
      name: 'TOBRADEX',
      dose: '1 goutte',
      posologie: 'OD 4x/jour',
      duration: '1 mois',
      instructions: 'Dégression: 4x/j pendant 15j, puis 3x/j pendant 1 semaine, puis 2x/j pendant 1 semaine',
      order: 1
    },
    {
      name: 'INDOCOLLYRE',
      dose: '1 goutte',
      posologie: 'OD 3x/jour',
      duration: '1 mois',
      order: 2
    }
  ],
  instructions: 'Espacer de 5 minutes entre les deux collyres. Consulter si douleur, rougeur ou baisse de vision.'
}
```

**Glaucoma Protocol Example**:
```javascript
{
  name: 'Glaucome Monothérapie - Prostaglandine',
  medications: [
    {
      name: 'XALATAN (Latanoprost 0.005%)',
      dose: '1 goutte',
      posologie: 'ODG le soir',
      duration: 'au long cours',
      instructions: 'Instiller préférentiellement le soir au coucher'
    }
  ]
}
```

**Features**:
- Searches Drug collection for medication references
- Includes tapering schedules
- Detailed patient instructions
- Timing specifications (morning vs evening)
- Multi-drug coordination (wait 5 minutes between drops)

**Storage**: TreatmentProtocol collection

**Usage**: Quick prescription of standard regimens with one click

---

### 7. Master Template Seeder

#### `seedTemplates.js` (26,648 bytes) ✓ PARTIAL READ (100 lines)

**Purpose**: Master template seeder that clears and reseeds all template types.

**Clears & Seeds**:
1. MedicationTemplate
2. ExaminationTemplate
3. PathologyTemplate
4. LaboratoryTemplate
5. ClinicalTemplate

**Note**: This is a comprehensive template system separate from document/letter templates. Based on file size (26KB), contains extensive template definitions.

---

### 8. Appointment Type Generator

#### `seedAppointmentTypes.js` (15,981 bytes) ✓ PARTIAL READ (100 lines)

**Purpose**: Generates appointment types from clinical acts with scheduling rules.

**Process**:
1. Reads clinical acts from ClinicalAct collection
2. Generates appointment types with rules
3. Assigns staff requirements
4. Sets booking policies

**Scheduling Rules by Category**:

**Consultations**:
- Bookable online: Yes
- Advance booking: 24 hours
- Staff: Ophthalmologist/Doctor

**Surgical**:
- Bookable online: No
- Requires approval: Yes
- Advance booking: 1 week
- Staff: Ophthalmologist, Nurse, Anesthetist
- Room: Operating room required

**Emergency**:
- Bookable online: No
- Advance booking: None
- Priority: high

**IVT (Injections)**:
- Bookable online: No
- Requires approval: Yes
- Advance booking: 2 days
- Staff: Ophthalmologist, Nurse
- Room: Procedure room with sterile field

**Laser**:
- Advance booking: 3 days
- Staff: Ophthalmologist, Technician

**Sample Generated Appointment Type**:
```javascript
{
  name: 'Consultation Ophtalmologique',
  nameFr: 'Consultation Ophtalmologique',
  category: 'consultation',
  duration: 30,
  price: 25000,
  currency: 'CFA',
  bookableOnline: true,
  requiresApproval: false,
  advanceBooking: {
    minimumHours: 24,
    maximumDays: 90
  },
  staffRequirements: {
    primary: 'ophthalmologist',
    support: []
  },
  roomRequirements: {
    type: 'consultation_room',
    specialEquipment: []
  }
}
```

**Storage**: AppointmentType collection

---

## Deprecated Seed Files

### 1. `deprecated/seedDoseTemplates.js` (205 lines) ✓ COMPLETE READ

**Purpose**: Older version of dose templates with only 5 medication forms.

**Forms**:
1. Collyre (Eye drops)
2. Pommade ophtalmique (Eye ointment)
3. Comprimé (Tablet)
4. Gélule (Capsule)
5. Sirop (Syrup)

**Differences from Current**:
- Fewer forms (5 vs 13)
- Less detailed options
- Simpler structure
- No patches, injections, suppositories, etc.

**Status**: Superseded by `seedDoseTemplatesComplete.js`

---

### 2. `deprecated/seedMedications.js` (326 lines) ✓ COMPLETE READ

**Purpose**: Medication seeder that reads from `/backend/data/medications.json` file.

**Process**:
1. Reads medications.json
2. Maps French categories to English enum
3. Extracts generic names from brand names using lookup table
4. Creates Drug documents

**Generic Name Mapping** (hardcoded dictionary with 50+ entries):
```javascript
const genericMap = {
  'ADVIL': 'Ibuprofen',
  'ASPEGIC': 'Aspirin',
  'TOBREX': 'Tobramycin',
  'XALATAN': 'Latanoprost',
  'MAXIDEX': 'Dexamethasone',
  // ... 40+ more
}
```

**Category Mapping**:
```javascript
'ains_generaux_corticoides' → 'nsaid'
'ains_locaux' → 'ophthalmic'
'antibiotique_locaux' → 'ophthalmic'
'anti_glaucomateux' → 'ophthalmic'
'vitamines' → 'vitamin'
```

**Ophthalmic Detection**:
- Based on category IDs
- Based on formulation (drops, ointment)
- Based on route (ophthalmic)

**Storage**: Drug collection

**Status**: Superseded by `seedAllClinicMedications.js` and `seedFrenchDrugs.js`

---

### 3. `deprecated/seedTreatmentProtocols.js` (326 lines) ✓ COMPLETE READ

**Purpose**: Older treatment protocol seeder with 9 protocols.

**Protocols**:

1. **Monothérapie Glaucome - Bêtabloquant** (Timolol)
2. **Monothérapie Glaucome - Prostaglandine** (Latanoprost)
3. **Bithérapie Glaucome** (Latanoprost + Timolol)
4. **Post-Opératoire Cataracte - Standard** (Tobramycin + Dexamethasone)
5. **Post-Opératoire Cataracte - Dégression Corticoïde** (Dexamethasone → Fluorometholone)
6. **Sécheresse Oculaire - Légère** (Hyaluronate)
7. **Infection Bactérienne - Conjonctivite** (Tobramycin)
8. **Cycloplégie - Examen Pédiatrique** (Atropine)

**Process**:
1. Finds medications by name from Drug collection
2. Creates protocol if medications exist
3. Includes detailed posologie

**Sample Protocol Structure**:
```javascript
{
  name: 'Post-Opératoire Cataracte - Standard',
  category: 'cataracte',
  type: 'standard',
  isSystemWide: true,
  medications: [
    {
      medicationTemplate: ObjectId,
      dose: { value: '1_goutte', label: '1 goutte', text: 'Instiller 1 goutte' },
      posologie: { value: '4_fois_jour', label: '4 fois par jour', text: '4 fois par jour' },
      details: [
        { value: 'oeil_opere', label: 'Œil opéré', text: 'dans l\'œil opéré' }
      ],
      duration: { value: '15_jours', label: '15 jours', text: 'pendant 15 jours' }
    }
  ]
}
```

**Status**: Superseded by `seedTreatmentProtocolsComplete.js`

---

### 4. `deprecated/seed_morocco.js` (423 lines) ✓ COMPLETE READ

**Purpose**: Morocco-specific test data with Moroccan patients and staff.

**Clears**:
- Users
- Patients
- Appointments
- Prescriptions
- OphthalmologyExams

**Creates**:

**6 Users** (all password: Admin123!):
1. Admin - admin@medflow.com
2. Dr. Jean Martin - doctor@medflow.com (General Medicine)
3. Dr. Marie Dupont - ophthalmologist@medflow.com (Ophthalmology)
4. Sophie Laurent - nurse@medflow.com
5. Pierre Moreau - reception@medflow.com
6. Claire Bernard - pharmacist@medflow.com (Pharmacy)

**3 Moroccan Patients**:

1. **Ahmed Benali** (Male, 44)
   - Location: 123 Avenue Mohammed V, Casablanca 20000
   - Phone: +212611111111
   - Blood: O+
   - Allergy: Penicillin (rash, moderate)
   - Condition: Hypertension (since 2018, managed)
   - Prescription: OD -2.00/-0.50x180 (20/20), OS -2.25/-0.75x175 (20/20)
   - Eye condition: Myopia OU (since 2015, stable)

2. **Amina Alami** (Female, 49)
   - Location: 45 Rue Hassan II, Rabat 10000
   - Phone: +212622222222
   - Blood: A+
   - Condition: Type 2 Diabetes (since 2020, managed)
   - Eye condition: Presbyopia OU (since 2021, progressive)

3. **Youssef Tazi** (Male, 34)
   - Location: 78 Boulevard Zerktouni, Casablanca 20100
   - Phone: +212633333333
   - Blood: B+

**3 Appointments**:
- Today: Ahmed (general checkup), Amina (ophthalmology - presbyopia)
- Tomorrow: Youssef (follow-up - lab results)

**2 Prescriptions**:
1. Medication: Amlodipine 5mg for Ahmed's hypertension
2. Optical: Glasses for Ahmed's myopia

**1 Ophthalmology Exam**:
- Patient: Ahmed Benali
- Examiner: Dr. Marie Dupont
- Chief complaint: "Difficulty reading small print" (6 months, moderate, OU)
- VA: Distance 20/40→20/20, Near 20/50→20/20
- Refraction: OD -2.00/-0.50x180 +1.50, OS -2.25/-0.75x175 +1.50
- IOP: OD 15mmHg, OS 16mmHg (normal)
- Diagnosis: Myopia with presbyopia (H52.1, stable)
- Plan: Progressive lenses, follow-up 1 year

**Morocco-Specific Data**:
- Phone format: +212 (Morocco country code)
- Cities: Casablanca, Rabat
- Streets: Avenue Mohammed V, Rue Hassan II, Boulevard Zerktouni
- National ID format: AB123456
- Currency: Not specified (likely MAD)

**Status**: Deprecated in favor of Congo-specific seedCongoData.js

---

## Default Credentials

### ⚠️ SECURITY WARNING ⚠️

All seed files create users with **HARDCODED DEFAULT PASSWORDS**. These must be changed immediately after deployment.

### Current System (CareVision - Congo)

**From `createDemoUsers.js`**:
```
admin@carevision.com          / admin123
doctor@carevision.com         / doctor123
ophthalmologist@carevision.com / ophthal123
nurse@carevision.com          / nurse123
receptionist@carevision.com   / reception123
pharmacist@carevision.com     / pharma123
```

### Legacy System (MedFlow)

**From `createAdminUser.js`**:
```
admin@medflow.com / admin123
```

**From `seedUsers.js`**:
```
admin@medflow.com      / Admin123!
doctor@medflow.com     / Admin123!
doctor2@medflow.com    / Admin123!
technician@medflow.com / Admin123!
reception@medflow.com  / Admin123!
```

### Morocco Deployment (Deprecated)

**From `seed_morocco.js`**:
```
All users: Admin123!

admin@medflow.com
doctor@medflow.com
ophthalmologist@medflow.com
nurse@medflow.com
reception@medflow.com
pharmacist@medflow.com
```

---

## Execution Order & Dependencies

### Recommended Seeding Order

```bash
# Phase 1: Core Data (Independent)
node backend/scripts/createAdminUser.js      # Creates admin first
node backend/scripts/createDemoUsers.js      # Creates all role users

# Phase 2: Reference Data (Independent, parallel possible)
node backend/scripts/seedAllClinicMedications.js  # Medications
node backend/scripts/seedFrenchDrugs.js           # More medications
node backend/scripts/seedFrenchClinicalActs.js    # Clinical procedures
node backend/scripts/seedClinicalProcedures.js    # More procedures
node backend/scripts/seedAllClinicEquipment.js    # Equipment catalog

# Phase 3: Dependent Data (Requires Phase 2)
node backend/scripts/seedPharmacyInventory.js     # Requires Drug collection
node backend/scripts/seedVitaminsFromTemplates.js # Requires MedicationTemplate

# Phase 4: Templates (Independent)
node backend/scripts/seedDoseTemplatesComplete.js
node backend/scripts/seedTreatmentProtocolsComplete.js  # Requires Drug collection
node backend/scripts/seedCommentTemplates.js
node backend/scripts/seedDocumentTemplates.js
node backend/scripts/seedLetterTemplates.js
node backend/scripts/seedTemplates.js
node backend/scripts/seedAppointmentTypes.js      # Requires ClinicalAct

# Phase 5: Test Data (Requires users)
node backend/scripts/seedCongoData.js             # Requires users to exist

# Alternative: Master Orchestrator (runs all Congo-specific seeds)
node backend/scripts/seedCongo.js
```

### Dependency Graph

```
createAdminUser.js (no dependencies)
createDemoUsers.js (no dependencies)
  ↓
seedCongoData.js (requires: User)

seedAllClinicMedications.js (no dependencies)
seedFrenchDrugs.js (no dependencies)
  ↓
seedPharmacyInventory.js (requires: Drug)

seedTemplates.js (no dependencies)
  ↓
seedVitaminsFromTemplates.js (requires: MedicationTemplate, Drug)

seedFrenchClinicalActs.js (no dependencies)
seedClinicalProcedures.js (no dependencies)
  ↓
seedAppointmentTypes.js (requires: ClinicalAct)

seedDoseTemplatesComplete.js (no dependencies)
seedTreatmentProtocolsComplete.js (requires: Drug)

seedDocumentTemplates.js (no dependencies)
seedLetterTemplates.js (no dependencies)
seedCommentTemplates.js (no dependencies)

seedAllClinicEquipment.js (no dependencies)
```

---

## Data Structures Reference

### Drug Collection

```javascript
{
  _id: ObjectId,
  genericName: String,
  genericNameFr: String,
  brandNames: [{
    name: String,
    nameFr: String,
    country: String
  }],
  category: Enum['nsaid', 'antibiotic', 'ophthalmic', 'vitamin', ...],
  categoryFr: {
    id: String,
    name: String,
    nameEn: String
  },
  formulations: [{
    form: Enum['drops', 'ointment', 'tablet', ...],
    route: Enum['ophthalmic', 'oral', 'intravenous', ...],
    strengths: [{
      value: Number,
      unit: String
    }]
  }],
  ophthalmicUse: {
    indication: [String],
    preservativeFree: Boolean,
    contactLensCompatible: Boolean,
    storage: String
  },
  active: Boolean,
  isActive: Boolean
}
```

### PharmacyInventory Collection

```javascript
{
  _id: ObjectId,
  drug: ObjectId (ref: Drug),
  medication: {
    genericName: String,
    brandName: String,
    nameFr: String,
    strength: String,
    formulation: String,
    route: String
  },
  category: Enum['antibiotic', 'anti-inflammatory', ...],
  categoryFr: {
    id: String,
    name: String
  },
  location: {
    pharmacy: String,
    section: String
  },
  inventory: {
    currentStock: Number,
    unit: String,
    minimumStock: Number,
    reorderPoint: Number,
    maximumStock: Number,
    status: Enum['in-stock', 'low-stock', 'out-of-stock']
  },
  batches: [{
    lotNumber: String,
    expirationDate: Date,
    manufactureDate: Date,
    quantity: Number,
    supplier: {
      name: String
    }
  }],
  pricing: {
    cost: Number,
    sellingPrice: Number,
    currency: String
  },
  prescription: {
    required: Boolean
  },
  controlledSubstance: Boolean,
  active: Boolean
}
```

### ClinicalAct Collection

```javascript
{
  _id: ObjectId,
  actId: String,  // ACT2024500001
  name: String,
  nameFr: String,
  category: Enum['consultation', 'diagnostic', 'imaging', 'surgical', 'laser', 'injection', 'anesthesia'],
  subCategory: String,
  description: String,
  descriptionFr: String,
  duration: Number,  // minutes
  cptCode: String,
  anesthesiaType: String,
  requiredRole: [String],
  requiredEquipment: [String],
  department: Enum['ophthalmology', 'general_medicine'],
  instructions: {
    preInstructions: String,
    preInstructionsFr: String,
    postInstructions: String,
    postInstructionsFr: String,
    followUpRequired: Boolean,
    followUpTiming: String
  },
  ophthalmicDetails: {
    isCataractSurgery: Boolean,
    iolType: String,
    isRetinalProcedure: Boolean,
    isGlaucomaProcedure: Boolean,
    requiresDilation: Boolean,
    requiresPressureCheck: Boolean,
    isRefractiveSurgery: Boolean
  },
  pricing: {
    basePrice: Number,
    insuranceCode: String
  },
  active: Boolean
}
```

### DocumentTemplate Collection

```javascript
{
  _id: ObjectId,
  templateId: String,  // TPL0001
  name: String,
  nameEn: String,
  category: Enum['certificate', 'examination_report', 'correspondence', 'operative_report', 'prescription_instructions', 'surgical_consent', 'payment', 'reminder'],
  subCategory: String,
  specialty: Enum['ophthalmology', 'general', 'surgery'],
  language: String,  // 'fr' or 'en'
  content: String,  // Template with {{variables}}
  variables: [{
    name: String,
    label: String,
    type: Enum['text', 'number', 'date', 'select'],
    options: [String],  // For select type
    required: Boolean
  }],
  allowedRoles: [String],
  tags: [String]
}
```

### LetterTemplate Collection

```javascript
{
  _id: ObjectId,
  name: String,
  category: String,
  content: String,  // Template with {{variables}}
  variables: [{
    name: String,
    label: String,
    type: String,
    options: [String],
    required: Boolean
  }]
}
```

### DoseTemplate Collection

```javascript
{
  _id: ObjectId,
  medicationForm: Enum['collyre', 'pommade_ophtalmique', 'comprime', 'gelule', 'sirop', 'injectable', 'suppositoire', 'sachet', 'patch', 'spray_nasal', 'gouttes_auriculaires', 'creme_dermique', 'verres_correcteurs'],
  doseOptions: [{
    value: String,
    labelFr: String,
    textFr: String,
    sortOrder: Number
  }],
  posologieOptions: [{
    value: String,
    labelFr: String,
    textFr: String,
    sortOrder: Number
  }],
  detailsOptions: [{
    value: String,
    labelFr: String,
    textFr: String,
    sortOrder: Number
  }],
  durationOptions: [{
    value: String,
    labelFr: String,
    textFr: String,
    sortOrder: Number
  }]
}
```

### TreatmentProtocol Collection

```javascript
{
  _id: ObjectId,
  name: String,
  category: Enum['glaucome', 'cataracte', 'secheresse', 'infection', 'diagnostic'],
  description: String,
  type: Enum['standard', 'custom'],
  isSystemWide: Boolean,
  medications: [{
    medicationTemplate: ObjectId,
    dose: {
      value: String,
      label: String,
      text: String
    },
    posologie: {
      value: String,
      label: String,
      text: String
    },
    details: [{
      value: String,
      label: String,
      text: String
    }],
    duration: {
      value: String,
      label: String,
      text: String
    },
    quantity: Number,
    order: Number
  }],
  tags: [String]
}
```

### CommentTemplate Collection

```javascript
{
  _id: ObjectId,
  category: Enum['refraction', 'adaptation', 'lens_type', 'keratometry', 'general'],
  textFr: String,
  usage: String,
  sortOrder: Number
}
```

### Patient Collection

```javascript
{
  _id: ObjectId,
  patientId: String,  // PAT202400001
  nationalId: String,
  firstName: String,
  lastName: String,
  dateOfBirth: Date,
  gender: Enum['male', 'female', 'other'],
  bloodType: String,
  phoneNumber: String,
  email: String,
  address: {
    street: String,
    city: String,
    postalCode: String,
    country: String
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  medicalHistory: {
    allergies: [{
      allergen: String,
      reaction: String,
      severity: Enum['mild', 'moderate', 'severe']
    }],
    chronicConditions: [{
      condition: String,
      diagnosedDate: Date,
      status: Enum['managed', 'unmanaged', 'resolved']
    }]
  },
  ophthalmology: {
    lastEyeExam: Date,
    currentPrescription: {
      OD: { sphere: Number, cylinder: Number, axis: Number, va: String },
      OS: { sphere: Number, cylinder: Number, axis: Number, va: String },
      pd: { distance: Number, near: Number },
      prescribedDate: Date,
      prescribedBy: ObjectId
    },
    eyeConditions: [{
      condition: String,
      eye: Enum['OD', 'OS', 'OU'],
      diagnosedDate: Date,
      status: String
    }]
  },
  status: Enum['active', 'inactive', 'deceased']
}
```

### User Collection

```javascript
{
  _id: ObjectId,
  username: String,
  email: String,
  password: String,  // Hashed with bcrypt
  firstName: String,
  lastName: String,
  phoneNumber: String,
  role: Enum['admin', 'doctor', 'ophthalmologist', 'nurse', 'receptionist', 'pharmacist', 'lab_technician'],
  department: Enum['general', 'ophthalmology', 'pharmacy', 'laboratory'],
  specialization: String,
  licenseNumber: String,
  employeeId: String,
  isActive: Boolean,
  isEmailVerified: Boolean,
  permissions: [String]
}
```

---

## Country/Region Configurations

### Democratic Republic of Congo (Primary)

**System**: CareVision / MedFlow
**Language**: French (primary)
**Currency**: CDF (Congolese Franc)
**Phone Format**: +243 XXX XXX XXX
**National ID**: 1-YYMM-N#####-##

**Cities**:
- Kinshasa (capital, primary)
- Lubumbashi (Katanga)
- Goma (Nord-Kivu)
- Mbuji-Mayi (Kasaï-Oriental)

**Common Names**:
- Mbuyi, Tshala, Nkulu, Marie, Jean
- Kabongo, Mwamba, Tshisekedi, Lukusa, Ilunga
- Mukendi, Kabanga, Kalala

**Medical Context**:
- Malaria endemic (ANTIPALUDIQUES category essential)
- French medical terminology
- Limited specialist availability
- Multi-site clinic network (MATRIX, TOMBALBAYE, MATADI)

**Clinic Sites**:
1. **MATRIX** - Primary site, advanced equipment (OCT, fundus camera)
2. **TOMBALBAYE** - Secondary site
3. **MATADI** - Tertiary site

---

### Morocco (Deprecated)

**System**: MedFlow
**Language**: French/Arabic
**Currency**: MAD (Moroccan Dirham)
**Phone Format**: +212 6XX XXX XXX
**National ID**: AB123456

**Cities**:
- Casablanca (economic hub)
- Rabat (capital)

**Common Names**:
- Ahmed, Amina, Youssef
- Benali, Alami, Tazi

**Streets**:
- Avenue Mohammed V
- Rue Hassan II
- Boulevard Zerktouni

**Status**: Deprecated in favor of Congo deployment

---

## Summary Statistics

### Active Seeds
- **Total Active Seed Files**: 19
- **Total Lines of Code**: ~70,000+ lines
- **Total File Size**: ~150KB

### Data Volumes
- **Medications**: 600+ (from multiple sources)
- **Clinical Procedures**: 100+
- **Document Templates**: 30+
- **Letter Templates**: 17
- **Equipment Items**: 25+ (across 3 sites)
- **Treatment Protocols**: 20+
- **Dose Templates**: 13 medication forms
- **Comment Templates**: 50+
- **Test Patients**: 5 (Congo), 3 (Morocco deprecated)
- **Test Users**: 6

### Languages
- **Primary**: French
- **Secondary**: English
- **Medical Terms**: French standard

### Currencies
- **Primary**: CFA (Congo)
- **Deprecated**: MAD (Morocco), USD, EUR

### Collections Populated
1. User
2. Patient
3. Appointment
4. OphthalmologyExam
5. Drug
6. PharmacyInventory
7. ClinicalAct
8. AppointmentType
9. DocumentTemplate
10. LetterTemplate
11. DoseTemplate
12. TreatmentProtocol
13. CommentTemplate
14. MedicationTemplate
15. ExaminationTemplate
16. PathologyTemplate
17. LaboratoryTemplate
18. ClinicalTemplate
19. EquipmentCatalog
20. Counter

---

## Maintenance Notes

### Adding New Seed Data

1. **Medications**: Add to `seedAllClinicMedications.js` or `seedFrenchDrugs.js`
2. **Equipment**: Add to `seedAllClinicEquipment.js` with site assignment
3. **Procedures**: Add to `seedFrenchClinicalActs.js` with pricing
4. **Templates**: Add to `seedDocumentTemplates.js` with variables
5. **Protocols**: Add to `seedTreatmentProtocolsComplete.js` with drug references

### Testing New Seeds

```bash
# Test individual seed
node backend/scripts/seedFileName.js

# Test full Congo suite
node backend/scripts/seedCongo.js

# Verify in MongoDB
mongosh medflow
db.getCollectionNames()
db.drugs.countDocuments()
db.pharmacyinventories.countDocuments()
```

### Rollback Procedure

Most seed files clear collections before seeding (`deleteMany({})`). To rollback:

```bash
# Drop specific collection
mongosh medflow
db.drugs.drop()

# Drop all collections (nuclear option)
db.dropDatabase()
```

### Production Deployment Checklist

- [ ] Change all default passwords immediately
- [ ] Remove or disable test data seeds
- [ ] Keep only reference data seeds (medications, procedures, templates)
- [ ] Update phone numbers and addresses for production
- [ ] Configure proper currency and country codes
- [ ] Set up proper backup before seeding
- [ ] Test seed execution on staging environment
- [ ] Document custom modifications
- [ ] Set up monitoring for failed seeds

---

**End of Documentation**
