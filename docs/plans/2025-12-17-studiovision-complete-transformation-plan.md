# StudioVision Complete Transformation Plan
## MedFlow Visual Parity with Modern Functionality

**Created:** 2025-12-17
**Based on:** Deep analysis of oph1.jpg through oph5.jpg reference screenshots
**Goal:** Achieve identical StudioVision visual layout while preserving MedFlow's superior functionality

---

## Executive Summary

After analyzing all 5 StudioVision reference screenshots and comparing them to the current MedFlow implementation, here's the status:

| Screen | StudioVision Ref | MedFlow Component | Parity Level | Work Required |
|--------|------------------|-------------------|--------------|---------------|
| Patient Summary | oph1.jpg | PatientCompactDashboard | **70%** | Medium |
| Refraction | oph2.jpg | SubjectiveRefractionStep | **50%** | High |
| Contact Lens | oph3.jpg | ContactLensFitting | **85%** | Low |
| Pathology | oph4.jpg | DiagnosisStep + PathologyPicker | **80%** | Medium |
| Treatment | oph5.jpg | TreatmentBuilder | **90%** | Low |

---

## OPH1: Patient Summary (Fiche Patient)

### StudioVision Layout Analysis

```
+------------------------------------------------------------------+
| MENU BAR: Fiches | Consultations | Documents | Chirurgie | ...   |
+------------------------------------------------------------------+
| TAB BAR: Fermer | Réfraction | Lentilles | Pathologies | ...     |
+------------------------------------------------------------------+
|                                                                  |
| LEFT 25%          | CENTER 50%              | RIGHT 25%          |
| (Blue border)     | (Color-coded sections)  | (Visit history)    |
|                   |                         |                    |
| [LAREC]           | Date: vendredi 31 mai   | Date | Dom  | Dr   |
| Doriane  42 Ans   |                         |------|------|------|
| ---               | === REFRACTION === (PINK)| 18/07 Lun  | CS   |
| DOB: 19/04/1971   | OD= -1,75 (-0,25@170°)  | 23/05 Cat  | CS   |
| Address: ...      | OG= -2,00 (-0,25@25°)   | ...        |      |
| Tel: ...          | Add 1,00 = P2           |            |      |
| SS#: ...          |                         |            |      |
| Profession: ...   | === TONOMETRY === (GREEN)|            |      |
|                   | TOD=13 mmHg TOG=13 mmHg |            |      |
| --- Antecedents   |                         | [Documents Table] |
| - Hypercholest... | === PATHOLOGIES === (YEL)| Date | Desc | Img |
| - Diabète type I  | Chalazion Paupière sup  |------|------|-----|
| - TT: Insuline    | LAF: Normal O.D.G.      | 04/09| msg  |     |
| - Allergies: ras  | FOGD: Normal O.D.G.     | 18/07| Angio|  ✓  |
|                   |                         |      |      |     |
| --- Important     | === TREATMENT === (ORANGE)               |
| (Red highlight)   | - Gant toilette eau chaude 10 min        |
| En rouge stabilo  | - STERDEX 1 app matin/soir x 8 jours     |
|                   | - DACUDOSES: laver yeux                  |
|                   | - HYDROFTA: 2 gellules/jour x 3 mois     |
|                   |                         |            |      |
|                   | [Nouvelle consultation] | [Action Buttons]  |
|                   | ☐ ALD ☐ CMU ☐ Dossier   | Schéma | Lettre |
+------------------------------------------------------------------+
| FOOTER: Nouveau patient | Imprimer consultation | Imprimer fiche |
+------------------------------------------------------------------+
```

### Current MedFlow: PatientCompactDashboard

**What's Good:**
- ✅ 3-column layout (matches StudioVision)
- ✅ Patient photo/avatar with info header
- ✅ Quick actions panel
- ✅ Alerts & allergies display
- ✅ Document archive
- ✅ Visit history with navigation
- ✅ Refraction display (OD/OS columns)
- ✅ IOP display with threshold highlighting
- ✅ Diagnoses list
- ✅ Active medications

**What's Missing (GAPs):**

| Gap | StudioVision Has | MedFlow Missing | Priority |
|-----|------------------|-----------------|----------|
| Color-coded sections | Pink/Green/Yellow/Orange borders | Generic white cards | **HIGH** |
| Antecedents section | Dedicated expandable area | Merged in alerts | **MEDIUM** |
| Important notes (red) | Red highlighted "Important" section | No specific area | **MEDIUM** |
| Quick print footer | Bottom toolbar with action buttons | Actions in header | **LOW** |
| SS# display | Social security prominently shown | Not displayed | **HIGH** (for France) |
| Profession field | Shown in patient info | Not in compact view | **LOW** |
| ALD/CMU checkboxes | Insurance status indicators | Not shown | **HIGH** (for France) |
| Document links table | Table with Date/Desc/Image columns | Simple list | **MEDIUM** |

### Implementation Plan for OPH1

#### Phase 1: Color-Coded Clinical Sections
```jsx
// Add color coding to PatientCompactDashboard
const SECTION_COLORS = {
  refraction: { bg: 'bg-pink-50', border: 'border-pink-300', header: 'bg-pink-100' },
  tonometry: { bg: 'bg-green-50', border: 'border-green-300', header: 'bg-green-100' },
  pathology: { bg: 'bg-yellow-50', border: 'border-yellow-300', header: 'bg-yellow-100' },
  treatment: { bg: 'bg-orange-50', border: 'border-orange-300', header: 'bg-orange-100' },
};

// Modify CompactCard to accept variant
function CompactCard({ title, icon, children, variant = 'default' }) {
  const colors = SECTION_COLORS[variant] || { bg: 'bg-white', border: 'border-gray-200' };
  return (
    <div className={`rounded-lg ${colors.bg} ${colors.border} border`}>
      <div className={`px-3 py-2 border-b ${colors.header}`}>
        {/* ... */}
      </div>
    </div>
  );
}
```

#### Phase 2: French Medical Fields
- Add `socialSecurityNumber` display in patient header
- Add ALD/CMU checkbox indicators
- Add "Important" notes section with red styling
- Add Antecedents collapsible section

#### Phase 3: Footer Actions
- Add bottom toolbar with: Nouveau patient, Imprimer consultation, etc.

**Files to Modify:**
1. `frontend/src/components/patient/PatientCompactDashboard.jsx` - Main changes
2. `frontend/src/pages/PatientDetail/index.jsx` - Integration

---

## OPH2: Refraction Module

### StudioVision Layout Analysis

```
+------------------------------------------------------------------+
| REFRACTION de Madame LAREC Doriane, 42 Ans - du mardi 4 juin 2013|
+------------------------------------------------------------------+
| TAB BAR: Fermer | Réfraction | Lentilles | Pathologies | ...     |
+------------------------------------------------------------------+
|                                                                   |
| Date List    |    OD      65      OG       | Auto-Text Panel     |
| ----------   | +--------+----+---------+  |                     |
| 23/05/2010 1 | Tension  [13▼]    [11▼]   | Rédaction de la     |
| 31/05/2013 1X| +--------+----+---------+  | fiche:              |
| 04/06/2013 1X| Réfraction  | Réf subjective| Réfraction subj:   |
|              | Sphère[-1,75▼]  [-2,00▼]  | OD=-1,75 (-0,25...  |
| [New Rx Btn] | Cyl   [-0,25▼]  [-0,25▼]  | OG=-2,00 (-0,25...  |
| [Empty Btn]  | Axe    [170▼]   [30▼]     |                     |
|              | AV loin[=6/10▼] [=5/10▼]  | Kératométrie:       |
| Send to:     | Addition[1,00▼] [1,00▼]   | ROD= 7,90/7,80...   |
| -> mem.LM    | Parinaud[P 2▼]  [=P 2▼]   |                     |
| -> mem.RM    | ☐ Binoculaire             |                     |
|              | +------------------------+ |                     |
| [Perso.]     | | Kératométrie           | | Commentaires:      |
| [Imprimer]   | | ROD 7,9|7,8|8,01|7,91  | | [Dropdown menus]   |
| [Voir ord]   | | Axes 165|75 |14  |104  | |                     |
| [Externe...] | +------------------------+ | Prescription:      |
| [Renouv.]    |                           | [Verres prescrits▼]|
+------------------------------------------------------------------+
```

### Current MedFlow: SubjectiveRefractionStep

**What's Good:**
- ✅ OD/OS eye selector tabs
- ✅ Sphere/Cylinder/Axis controls with +/- buttons
- ✅ Visual acuity dropdown
- ✅ Cross-cylinder refinement
- ✅ Duochrome test
- ✅ Binocular balance section
- ✅ Current prescription summary

**What's Missing (GAPs):**

| Gap | StudioVision Has | MedFlow Missing | Priority |
|-----|------------------|-----------------|----------|
| Date history sidebar | Left column with exam dates | No date list | **HIGH** |
| Side-by-side OD/OG | Single grid showing both eyes | Toggle between eyes | **HIGH** |
| Keratometry section | K-readings in same screen | Separate step | **MEDIUM** |
| Auto-text generation | Real-time prescription text | Summary only | **MEDIUM** |
| Prescription dropdown | Lens type selection (progressifs, bifocaux) | Separate step | **MEDIUM** |
| Quick actions sidebar | Perso/Imprimer/Voir ord buttons | No quick actions | **MEDIUM** |
| Memory send buttons | "Envoyer au réfracteur" | No device send | **LOW** |

### Implementation Plan for OPH2

#### Phase 1: Side-by-Side OD/OG Grid
Create new `RefractionGrid.jsx` component:
```jsx
// New component: frontend/src/components/refraction/RefractionGrid.jsx
export default function RefractionGrid({ data, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Left: Date History */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3>Historique</h3>
        {/* Date list with checkboxes */}
      </div>

      {/* Center: OD/OG Grid */}
      <div className="col-span-1">
        <table className="w-full">
          <thead>
            <tr>
              <th></th>
              <th className="text-blue-600">OD</th>
              <th className="text-center">PD: 65</th>
              <th className="text-green-600">OG</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Tension</td>
              <td><select>{/* TOD */}</select></td>
              <td></td>
              <td><select>{/* TOG */}</select></td>
            </tr>
            {/* Sphere, Cylinder, Axis, VA, Add, Parinaud rows */}
          </tbody>
        </table>

        {/* Keratometry section below */}
        <div className="mt-4 border-t pt-4">
          <h4>Kératométrie</h4>
          <table>{/* K-readings grid */}</table>
        </div>
      </div>

      {/* Right: Auto-text & Prescription */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4>Rédaction de la fiche:</h4>
        <div className="bg-white p-2 rounded text-sm font-mono">
          {/* Auto-generated text */}
        </div>

        <h4 className="mt-4">Prescription:</h4>
        <select>{/* Lens types */}</select>
      </div>
    </div>
  );
}
```

#### Phase 2: Quick Actions Sidebar
Add left sidebar with:
- Date history list
- Nouvelle réfraction pré-remplie
- Nouvelle réfraction vide
- Imprimer lunettes
- Voir ordonnance lunettes
- Externe...
- Renouvellement prescription

**Files to Create/Modify:**
1. `frontend/src/components/refraction/RefractionGrid.jsx` - **NEW**
2. `frontend/src/pages/ophthalmology/components/SubjectiveRefractionStep.jsx` - Add view toggle
3. `frontend/src/components/refraction/RefractionQuickActions.jsx` - **NEW**

---

## OPH3: Contact Lens Module

### StudioVision Layout Analysis

```
+------------------------------------------------------------------+
| LENTILLES de Madame LAREC Doriane, 42 Ans - mercredi 5 juin 2013 |
+------------------------------------------------------------------+
| LEFT             | CENTER                    | RIGHT              |
| Date List        | Tab: [Lentille droite] [Lentille gauche]        |
| ----------       | +----------------------+  | Rédaction de la   |
| 23/05/2010       | Laboratoire: [OPHTALMIC▼] | fiche:            |
| 31/05/2013 1 X   | Lentille: [OPHT HR PROG▼] | K-OD: 7,9/7,8...  |
| 04/06/2013 1 X   | Rx: [8,70] [14,20]        |                   |
| 05/06/2013 1     | Prescription Lot:         | =>Lentilles Prescr|
|                  | Sphère:  [+▼]  [-1,75▼]   | - OEIL DROIT:     |
| [Prescription    | Cylindre: [  ▼]           |   OPHTALMIC HR... |
|  refraction box] | Axe: [    ] SIAM [    ]   | - OEIL GAUCHE:    |
|                  | AV de loin: [   ▼]        |   OPHTALMIC HR... |
| [Nouvelles       | Addition: [LOW▼]          |                   |
|  lentilles btn]  | Parinaud: [    ]          | Port Journalier;  |
|                  | +----------------------+  | Renouvellement... |
| [Importer réfr.] |                           |                   |
|                  | K-range bar: 7.40<=Km<=8.10                   |
| [Commands en     | LOW: jusqu'à +2.25d       |                   |
|  cours...]       | HIGH: +2.25d à +3.00d     |                   |
|                  |                           | Produits utilisés:|
| [Action buttons] | [Rédiger cet essai]       | [dropdown]        |
|                  |                           |                   |
|                  | Entretien: | Commentaires: | Prescription:    |
|                  | [detailed care instructions panel]             |
+------------------------------------------------------------------+
```

### Current MedFlow: ContactLensFitting

**What's Good:**
- ✅ 4-tab structure (History, Fitting, Care, Follow-up)
- ✅ Lens type selector (soft, toric, multifocal, RGP, scleral, hybrid, ortho-k)
- ✅ Trial lens parameters (OD/OS)
- ✅ Fitting assessment grid
- ✅ Care instructions tab
- ✅ Follow-up scheduling
- ✅ Education checklist with progress bar
- ✅ Status badges (New wearer, In progress, Completed)

**What's Missing (GAPs):**

| Gap | StudioVision Has | MedFlow Missing | Priority |
|-----|------------------|-----------------|----------|
| OD/OG tabs (not 4-tab) | Separate Lentille droite/gauche tabs | Combined view | **MEDIUM** |
| K-range indicator bar | Visual Km range bar with LOW/HIGH | No visual bar | **LOW** |
| Entretien panel | Detailed care text in main view | In separate tab | **LOW** |
| Auto-text prescription | Right panel with formatted Rx | No auto-text | **MEDIUM** |
| Lab/Lens dropdowns | Laboratoire & Lentille product selectors | Generic inputs | **MEDIUM** |

### Implementation Plan for OPH3

#### Phase 1: Add Lab/Product Database
```jsx
const CONTACT_LENS_LABS = [
  { id: 'ophtalmic', name: 'OPHTALMIC', products: ['OPHTALMIC HR', 'OPHTALMIC HR PROGRESSIVE'] },
  { id: 'coopervision', name: 'CooperVision', products: ['Biofinity', 'Proclear', 'clariti'] },
  { id: 'alcon', name: 'Alcon', products: ['Air Optix', 'Dailies Total 1', 'Precision1'] },
  { id: 'jnj', name: 'Johnson & Johnson', products: ['Acuvue Oasys', 'Acuvue Moist', 'Acuvue Vita'] },
  // ...
];
```

#### Phase 2: K-Range Visual Bar
```jsx
function KRangeBar({ km, low = 7.40, high = 8.10 }) {
  const position = ((km - low) / (high - low)) * 100;
  return (
    <div className="relative h-6 bg-gradient-to-r from-blue-200 via-green-200 to-red-200 rounded">
      <div className="absolute" style={{ left: `${position}%` }}>
        <div className="w-1 h-6 bg-black" />
        <span className="text-xs">{km}</span>
      </div>
      <span className="absolute left-0 text-xs">LOW: jusqu'à +2.25d</span>
      <span className="absolute right-0 text-xs">HIGH: +2.25d à +3.00d</span>
    </div>
  );
}
```

**Files to Modify:**
1. `frontend/src/components/contactLens/ContactLensFittingTab.jsx` - Add Lab/Product selectors
2. `frontend/src/components/contactLens/ContactLensFitting.jsx` - Add K-range bar

**Status: 85% Complete** - Minor enhancements needed

---

## OPH4: Pathology/Diagnosis Module

### StudioVision Layout Analysis

```
+------------------------------------------------------------------+
| PATHOLOGIES de Madame LAREC Doriane - du mardi 4 juin 2013       |
+------------------------------------------------------------------+
| Dominante: [Diabète▼] | TOD: [13▼] → | ← [11▼] TOG: [Heure]     |
+------------------------------------------------------------------+
|                                                                   |
| Maquettes         | Symptomes           | Description | Diagnostic|
| (LEFT SIDEBAR)    |                     |             |           |
| ----------------- | ------------------- | ----------- | --------- |
| Ocular Coh. Tomo  | F.O: Stade R.D non  | -Maculop.   | ○ Rétino. |
| Lasik             |   proliferative     |   exsudative|   Diabét. |
| Voies Lacrymales  | Debutante:          | -R.A.S.     |   Prolif. |
| Vitré             |   Microanévr. < 5   | -claire,    | ○ Rétino. |
| Surveillance APS  | Moyenne:            |   négative  |   Diabét. |
| PKE+ICP           |   Microanévr. > 5   | ...         |   Pré-Pr  |
| Explor. vision    | Severe:             |             | ● Rétino. |
| Motif Consult.    |   Nodules coton. >2 | Oeil droit  |   Diabét. |
| Normal            |   Hémorragie diss.  | [OD et OG]  |   Ischém. |
| Conjonctivite     | [Stade R.D pré-pro] | Oeil gauche | ...       |
| Traumatologie     |   (selected GREEN)  |             |           |
| Cataracte         | Stade R.D prolif.   | foréolaire  |           |
| Glaucome          | ...                 | pôle post.  |           |
| Rétine Centrale   |                     | périphérie  |           |
| Rétine Périph.    |                     |             |           |
| Paupière          |                     |             |           |
| Cornée            |                     | Rédaction de l'observation:|
| Uvéite            |                     | LAF: Cornée Claire O.D.G  |
| [DIABETE] (sel.)  |                     | Chambre ant. Calme...     |
| HTA               |                     |                           |
| Résultats exam.   |                     | [Renouvellement pathologie|
| Chirurgie cataracte                     |  précédente] button      |
+------------------------------------------------------------------+
```

### Current MedFlow: DiagnosisStep + PathologyPicker

**What's Good:**
- ✅ StudioVision mode toggle (Standard vs StudioVision view)
- ✅ PathologyPicker component with 3-column layout
- ✅ ICD-10 search with common diagnoses
- ✅ Multiple diagnosis support with primary marking
- ✅ Notes per diagnosis
- ✅ Dominante selector
- ✅ Symptom/Description/Diagnostic columns
- ✅ Auto-text generation

**What's Missing (GAPs):**

| Gap | StudioVision Has | MedFlow Missing | Priority |
|-----|------------------|-----------------|----------|
| Maquettes sidebar | Comprehensive pathology template list | Limited templates | **MEDIUM** |
| DR staging specific | Detailed diabetic retinopathy stages | Generic symptoms | **HIGH** |
| Visual staging reference | Grade selection with visual cues | Text only | **MEDIUM** |
| IOP inline display | TOD/TOG dropdowns in header | No inline IOP | **LOW** |
| "Renouvellement" button | Quick copy from previous | No quick copy | **LOW** |

### Implementation Plan for OPH4

#### Phase 1: Expand Maquettes/Templates
Add comprehensive pathology templates:
```jsx
const PATHOLOGY_TEMPLATES = {
  'Diabète': {
    dominante: 'DIABETE',
    symptoms: [
      { id: 'fo_non_prolif', label: 'F.O: Stade R.D non proliferative', subOptions: ['Débutante', 'Moyenne', 'Sévère'] },
      { id: 'fo_pre_prolif', label: 'Stade R.D pré proliférative' },
      { id: 'fo_prolif', label: 'Stade R.D proliférative' },
      { id: 'maculopathie', label: 'Maculopathie', subOptions: ['Modérée', 'Sévère'] },
    ],
    diagnostics: [
      'Rétinopathie Diabétique Proliférative',
      'Rétinopathie Diabétique Pre-Proliférative',
      'Rétinopathie Diabétique Ischémique',
      'Rétinopathie Diabétique Oedémateuse',
      'Absence de Rétinopathie diabétique',
    ]
  },
  'Glaucome': { /* ... */ },
  'Cataracte': { /* ... */ },
  // ... all categories from StudioVision
};
```

#### Phase 2: DR Staging Component
Create specialized diabetic retinopathy staging:
```jsx
function DRStagingSelector({ value, onChange }) {
  const stages = [
    { id: 'none', label: 'Pas de rétinopathie', color: 'green' },
    { id: 'mild_npdr', label: 'RDNP Légère', color: 'yellow' },
    { id: 'moderate_npdr', label: 'RDNP Modérée', color: 'orange' },
    { id: 'severe_npdr', label: 'RDNP Sévère', color: 'red' },
    { id: 'pdr', label: 'RD Proliférative', color: 'purple' },
  ];
  // Visual staging selector with color coding
}
```

**Files to Modify:**
1. `frontend/src/components/pathology/PathologyPicker.jsx` - Expand templates
2. `frontend/src/components/pathology/DRStagingSelector.jsx` - **NEW**

**Status: 80% Complete** - Template expansion needed

---

## OPH5: Treatment/Prescription Module

### StudioVision Layout Analysis

```
+------------------------------------------------------------------+
| TRAITEMENT de Madame LAREC Doriane - vendredi 31 mai 2013        |
+------------------------------------------------------------------+
| Liste médicaments | Dose    | Posologie | Détails   | Durée     |
| (PURPLE bg)       |         |           |           | + Standards|
| ----------------- | ------- | --------- | --------- | --------- |
| [Maquettes][Vidal]| à 3 lav | le matin  | œil droit | pendant 1j|
|                   | 1 goutte| à midi    | œil gauche| pendant 2j|
| A.I.N.S. Généraux | 2 gouttes| l'après-m| 2 yeux    | pendant 3j|
| Antalgiques       | 1 applic.| le soir  | paupière D| pendant 1s|
| Antibiot. Génér.  | 1 comprimé| matin+soir| racine cil| ...     |
| Anti-cataracte    | 2 comprimés| 3x/jour |           |           |
| Anti-glaucomateux | 1 sachet | 4x/jour  |           | Standards:|
| Anti-histaminiques| 1 ampoule| 5x/jour  |           | - ESACINE |
| Antioxydants      | 1 gélule | 1h/jour  |           | - Angio A.|
| Antisept Avec vaso| 2 gélules| 2h/jour  |           | - Atropine|
| Antisept Sans vaso| 1 pipette| 3h/jour  |           | - Chalaz. |
| Anti-viraux       | 1 boîte  | 4h/jour  |           | - Conjonc.|
| Cicatrisants      | 2 boîtes | 6h/jour  |           | ...       |
| Collyres AINS     | 1 tube   | 1j/2     |           |           |
| Collyres Antial.  | 2 tubes  | 1j/3     |           | [Print    |
| Collyres Antibio/ | 1 flacon | 1x/sem   |           |  options] |
| Corticoïdes       | 2 flacons|           |           |           |
| ...               |          |           |           |           |
+------------------------------------------------------------------+
| Ordonnance 1 | Ordonnance 2 | 1 & 2 ou Bi-zone | Liste perso.   |
+------------------------------------------------------------------+
| - Appliquer gant toilette eau chaude 10 min matin/soir           |
| - STERDEX: 1 application matin/soir paupière x 8 jours           |
| - DACUDOSES: pour laver les yeux                                 |
| - HYDROFTA: 2 gélules/jour x 3 mois                              |
+------------------------------------------------------------------+
| [Simple] [Dupli(1)] [Double(2)] [Gras] | [100% Cerfa]            |
| ○ Imprimer  ○ Voir  | [Renouvellement] [Enregistrer standard]   |
+------------------------------------------------------------------+
```

### Current MedFlow: TreatmentBuilder

**What's Good:**
- ✅ 4-column layout (Categories, Drugs, Posologie, Options)
- ✅ Medication categories list (matches StudioVision)
- ✅ Drug database with generic names
- ✅ Dose/Posologie/Détails sub-columns
- ✅ Duration options
- ✅ Standard treatments quick-apply
- ✅ Multiple ordonnance tabs
- ✅ Print type options (Simple, Dupli, Double, Gras, Cerfa)
- ✅ Current prescription preview
- ✅ Add/remove items
- ✅ Toast notifications

**What's Missing (GAPs):**

| Gap | StudioVision Has | MedFlow Missing | Priority |
|-----|------------------|-----------------|----------|
| Vidal tab | Maquettes + Vidal tabs | Single list | **LOW** |
| Liste personnelle | Personal favorites list | In Standard treatments | **LOW** |
| Renouvellement btn | "Renouvellement traitement précédent" | No renewal | **MEDIUM** |
| Notes: QSP field | "QSP 3 MOIS" duration shortcut | Generic duration | **LOW** |

### Implementation Plan for OPH5

The TreatmentBuilder is **90% complete**. Minor additions needed:

#### Phase 1: Add Renouvellement Button
```jsx
// Add to TreatmentBuilder
<button
  onClick={() => loadPreviousTreatment()}
  className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-700 rounded"
>
  <History className="w-4 h-4" />
  Renouvellement traitement précédent
</button>
```

#### Phase 2: Add QSP Duration Shortcuts
```jsx
const QSP_OPTIONS = [
  { label: 'QSP 3 MOIS', value: 'pour 3 mois.' },
  { label: 'QSP 6 MOIS', value: 'pour 6 mois.' },
];
```

**Files to Modify:**
1. `frontend/src/components/treatment/TreatmentBuilder.jsx` - Add renouvellement

**Status: 90% Complete** - Minimal work needed

---

## Priority Implementation Order

### Phase 1: High Priority (Core Visual Parity)

1. **OPH1 Color-Coded Sections** - PatientCompactDashboard
   - Add SECTION_COLORS with pink/green/yellow/orange
   - Modify CompactCard to accept variant prop
   - Estimated: 2-3 hours

2. **OPH2 Side-by-Side Grid** - Create RefractionGrid
   - New component with OD/OG columns
   - Date history sidebar
   - Keratometry section
   - Estimated: 4-6 hours

3. **OPH4 Expanded Templates** - PathologyPicker
   - Add all Maquettes from StudioVision
   - Add DR staging component
   - Estimated: 3-4 hours

### Phase 2: Medium Priority (French Medical Fields)

4. **OPH1 French Fields** - PatientCompactDashboard
   - Social security display
   - ALD/CMU indicators
   - Antecedents section
   - Estimated: 2-3 hours

5. **OPH3 Lab/Product Database** - ContactLensFitting
   - Add manufacturer dropdown
   - Add product catalog
   - K-range visual bar
   - Estimated: 2-3 hours

### Phase 3: Low Priority (Polish)

6. **OPH5 Renouvellement** - TreatmentBuilder
   - Add renewal button
   - Add QSP shortcuts
   - Estimated: 1 hour

7. **OPH2 Quick Actions** - RefractionQuickActions
   - Action buttons sidebar
   - Print integration
   - Estimated: 2 hours

---

## Summary: What Already Exists vs. What's Needed

### Already Implemented (Keep As-Is):
- ✅ PatientCompactDashboard 3-column layout
- ✅ TreatmentBuilder 4-column layout
- ✅ ContactLensFitting 4-tab workflow
- ✅ PathologyPicker with StudioVision mode
- ✅ LOCSIIIGrading cataract component
- ✅ DrugInteractionPanel
- ✅ FavoriteMedicationsBar
- ✅ TreatmentProtocolSelector
- ✅ PatientAlertsBanner
- ✅ useViewPreference hook

### New Components Needed:
- 🆕 RefractionGrid (OD/OG side-by-side view)
- 🆕 RefractionQuickActions (sidebar buttons)
- 🆕 DRStagingSelector (diabetic retinopathy stages)
- 🆕 KRangeBar (contact lens K-value indicator)

### Modifications Needed:
- ✏️ PatientCompactDashboard - color-coded sections, French fields
- ✏️ PathologyPicker - expand Maquettes templates
- ✏️ ContactLensFittingTab - lab/product selectors
- ✏️ TreatmentBuilder - renouvellement button

---

## Estimated Total Effort

| Phase | Components | Estimated Hours |
|-------|------------|-----------------|
| Phase 1 | Core Visual Parity | 10-13 hours |
| Phase 2 | French Medical Fields | 4-6 hours |
| Phase 3 | Polish | 3 hours |
| **Total** | | **17-22 hours** |

---

*Plan created: 2025-12-17*
*Analysis based on: oph1.jpg, oph2.jpg, oph3.jpg, oph4.jpg, oph5.jpg*
