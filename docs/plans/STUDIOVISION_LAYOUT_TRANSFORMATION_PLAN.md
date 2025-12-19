# StudioVision Layout Transformation Plan

## Executive Summary

This document details the transformation required to make MedFlow match StudioVision XP's layout while retaining MedFlow's modern functionality. Each of the 5 key StudioVision screens (OPH1-5) is analyzed against the current MedFlow implementation.

---

## Visual Reference

Screenshots location: `/Users/xtm888/magloire/assets/ophthalmology-images/`
- `oph1.jpg` - Patient Summary (Fiche Patient)
- `oph2.jpg` - Refraction Module
- `oph3.jpg` - Contact Lens Module (Lentilles)
- `oph4.jpg` - Pathologies/Diagnosis Module
- `oph5.jpg` - Treatment/Prescription Module

---

## Design Philosophy Differences

| Aspect | StudioVision XP | MedFlow Current |
|--------|-----------------|-----------------|
| **Information Density** | High - everything visible | Low - spacious cards |
| **Layout** | Fixed 3-panel grid | Responsive flexbox |
| **Color Coding** | Heavy (Pink/Green/Yellow/Orange) | Minimal (gray/white) |
| **Navigation** | All sections visible | Collapsible/tabbed |
| **Typography** | Small (11-12px) | Larger (14-16px) |
| **Borders** | Thick colored borders | Subtle shadows |
| **Whitespace** | Minimal | Generous |

---

# SCREEN 1: Patient Summary (Fiche Patient) - OPH1

## StudioVision Layout Analysis

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER: StudioVision XP - [Fiche PATIENTS] - Date/Time                  │
│ MENU BAR: Fiches | Consultations | Documents | Chirurgie | etc.         │
│ TAB BAR: Fermer | Réfraction | Lentilles | Pathologies | Orthoptie | etc│
├───────────────────────────┬─────────────────────────────────────────────┤
│ PATIENT INFO (Left)       │ DATE HEADER: vendredi 31 mai 2013           │
│ ┌───────────────────────┐ ├─────────────────────────────────────────────┤
│ │ LAREC        [42 Ans] │ │ ➤ Réfraction (PINK BACKGROUND)              │
│ │ Doriane                │ │   OD= -1.75 (-0.25 à 170°)= 10/10; Add 1.00│
│ │ Madame LAREC Doriane   │ │   OG= -2.00 (-0.25 à 25°)= 10/10; Add 1.00 │
│ │ Né(e) le 19/04/1971    │ ├─────────────────────────────────────────────┤
│ │ 10 prom du Lac...      │ │ ➤ Tonométrie (GREEN BACKGROUND)            │
│ │ VINCENNES 94300        │ │   TOD=13 mm Hg  TOG=13 mm Hg               │
│ │ Tél 1: 01 48 18 49 18  │ ├─────────────────────────────────────────────┤
│ │ Tél 2: 06 03 25 02 48  │ │ ➤ Pathologies (YELLOW BACKGROUND)          │
│ │ N° SS: 2 51 04 99...   │ │   Chalazion Paupière sup Droite 1/3 externe│
│ │ Profes: Comptable      │ │   LAF: Segment antérieur = Normal O.D.G.   │
│ │                        │ │   FOGD: = Normal O.D.G.                    │
│ ├───────────────────────┤ ├─────────────────────────────────────────────┤
│ │ ANTECEDENTS:           │ │ ➤ Traitement (ORANGE BACKGROUND)           │
│ │ - Hypercholestérolémie │ │   - Appliquer un gant de toilette...       │
│ │ - Diabète type I       │ │   - STERDEX: 1 application matin et soir   │
│ │ - TT: ss Insuline      │ │   - DACUDOSES: pour laver les yeux         │
│ │ - Allergies: ras       │ │   - HYDROFTA: 2 gellules par jour          │
│ │ - Corresp 1: Dr Banner │ │                                             │
│ ├───────────────────────┤ │                              ** 28 € -- ESP │
│ │ Remarques:             │ ├─────────────────────────────────────────────┤
│ │ Ancienne fiche patient │ │ [Nouvelle consultation] [ICON]              │
│ │ (données extra méd.)   │ │                                             │
│ ├───────────────────────┤ │ ALD:☐  CMU:☐  Dossier Papier:☐              │
│ │ Important:             │ ├────────────────────────────────────────────┤
│ │ En rouge stabilo       │ │ VISIT HISTORY TABLE (Right side)           │
│ └───────────────────────┘ │ Date       | Dominante  | Dr                │
│                           │ 18/07/2009 | Lunettes   | CS | oph          │
│                           │ 23/05/2010 | Cataracte  | CS | oph          │
│                           │ 31/05/2013 | Chalazion  | CS | oph          │
│                           │ 04/06/2013 | Diabète    | CS | oph          │
│                           │ 05/06/2013 | Lentilles  | CS |              │
└───────────────────────────┴─────────────────────────────────────────────┘
│ BOTTOM TOOLBAR: Nouveau patient | Imprimer consultation | Imprimer fiche│
└─────────────────────────────────────────────────────────────────────────┘
```

## MedFlow Current State

**File**: `/frontend/src/pages/PatientDetail/index.jsx`

**Current Layout**:
- Sticky header with patient name/age/gender
- Collapsible section groups (PatientInfoSection, OphthalmologySection, etc.)
- Card-based design with generous padding
- View toggle (standard vs compact mode via `PatientCompactDashboard`)

**What Exists**:
| Feature | File | Status |
|---------|------|--------|
| Patient Info Display | `PatientInfoSection.jsx` | ✅ Exists but card layout |
| Medical History | `PatientInfoSection.jsx` | ✅ Exists |
| Alerts/Warnings | `PatientAlertsBanner.jsx` | ✅ Exists |
| Visit Timeline | `TimelineSection.jsx` | ✅ Exists but separate section |
| Compact View | `PatientCompactDashboard.jsx` | ✅ 3-column layout exists |

## Transformation Required

### 1. Create StudioVision Patient Summary Component

**New File**: `/frontend/src/pages/PatientDetail/StudioVisionFiche.jsx`

```jsx
// Layout structure needed:
<div className="sv-fiche grid grid-cols-[280px_1fr_250px] h-[calc(100vh-120px)]">
  {/* LEFT COLUMN - Patient Info */}
  <div className="sv-patient-info border-r">
    <PatientIdentityCard />      {/* Name, age, address, phones */}
    <AntecedentsBlock />         {/* Medical history */}
    <RemarquesBlock />           {/* Notes */}
    <ImportantBlock />           {/* Critical alerts in red */}
  </div>

  {/* CENTER COLUMN - Clinical Summary */}
  <div className="sv-clinical-data">
    <DateHeader />               {/* Current date */}
    <RefractionBlock />          {/* Pink background */}
    <TonometrieBlock />          {/* Green background */}
    <PathologiesBlock />         {/* Yellow background */}
    <TraitementBlock />          {/* Orange background */}
    <NewConsultationButton />
    <InsuranceCheckboxes />      {/* ALD, CMU, etc */}
  </div>

  {/* RIGHT COLUMN - Visit History */}
  <div className="sv-visit-history">
    <VisitHistoryTable />        {/* Date/Type/Doctor columns */}
    <DocumentsList />            {/* Schéma, Lettre, Son, etc. */}
  </div>
</div>
```

### 2. Color-Coded Section Styling

**New File**: `/frontend/src/styles/studiovision.css`

```css
/* StudioVision Color Scheme */
.sv-section-refraction {
  background: linear-gradient(to right, #ffcccc, #ffe6e6);
  border: 2px solid #ff9999;
  border-left: 4px solid #cc0000;
}

.sv-section-tonometrie {
  background: linear-gradient(to right, #ccffcc, #e6ffe6);
  border: 2px solid #99ff99;
  border-left: 4px solid #00cc00;
}

.sv-section-pathologies {
  background: linear-gradient(to right, #ffffcc, #ffffe6);
  border: 2px solid #ffff99;
  border-left: 4px solid #cccc00;
}

.sv-section-traitement {
  background: linear-gradient(to right, #ffcc99, #ffe6cc);
  border: 2px solid #ff9966;
  border-left: 4px solid #cc6600;
}

/* Dense typography */
.sv-text {
  font-size: 11px;
  line-height: 1.3;
}

.sv-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}
```

### 3. Specific Component Changes

| Component | Current | Transform To |
|-----------|---------|--------------|
| Patient Name | `text-xl font-bold` | `text-base font-bold uppercase` with age badge |
| Address | Separate lines | Compact single block |
| Phone Numbers | Icons with text | `Tél 1:` / `Tél 2:` prefix style |
| Antecedents | Bullet list | Dash-prefixed compact list |
| Refraction | Hidden in collapsible | Always visible pink block |
| IOP | Hidden in collapsible | Always visible green block |
| Visit History | TimelineSection | Right-side table with columns |

---

# SCREEN 2: Refraction Module - OPH2

## StudioVision Layout Analysis

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER: REFRACTION de Madame LAREC Doriane, 42 Ans - du mardi 4 juin 13 │
├─────────────────────────────────────────────────────────────────────────┤
│ TAB BAR: Fermer | Réfraction | Lentilles | Pathologies | etc.           │
├──────────────────┬─────────────────────────────────────────────────────┤
│ DATE LIST (Left) │  ┌─────────────────────────────────────────────────┐ │
│ Date: Ref:Ker:   │  │         [OD]    65    [OG]                      │ │
│ 23/05/2010  1    │  │  Tension  TOD [13 ▼]  [11 ▼] TOG               │ │
│ 31/05/2013  1  X │  ├─────────────────────────────────────────────────┤ │
│ 04/06/2013  1  X │  │  X Réfraction    │  Réfraction subjective      │ │
│                  │  │    [-1.75 ▼]     │    Sphère    [-2.00 ▼]      │ │
│ Réfractions du   │  │    [-0.25 ▼]     │    Cylindre ± [-0.25 ▼]     │ │
│ 04/06/2013 de    │  │    [170  ▼]      │    Axe                      │ │
│ type↓            │  │    = 6 /10 ▼     │    AV de loin = 5 /10 ▼    │ │
│ Réfraction subj  │  │    Add 1.00 ▼    │    Addition   Add 1.00 ▼   │ │
│        →         │  │    [P 2    ▼]    │    Parinaud   [=P 2    ▼]  │ │
│                  │  │           Binoculaire                          │ │
│ [Nouvelle réfr.] │  ├─────────────────────────────────────────────────┤ │
│ [Nouvelle vide]  │  │  ◉ Kératométrie                                │ │
│                  │  │  ROD [7,9 ] [7,8 ]  [8,01] [7,91] ROG          │ │
│ Envoyer au réfr: │  │  Axes[165 ] [75  ]  [14  ] [104 ] Axes         │ │
│ [->mem.LM][RM]   │  ├─────────────────────────────────────────────────┤ │
├──────────────────┤  │ PRESCRIPTION DROPDOWN AREA                      │ │
│ ☐ Renvoi auto    │  │ [Verres prescrits ▼] → Varilux Computer options│ │
│                  │  │ [Verres non prescrits ▼]                        │ │
│                  │  │ [Verres prescrits de loin ▼]                   │ │
│ [Perso.][Vidal]  │  │ [Verres prescrits de près (1) ▼]               │ │
│ [Imprimer]       │  │ [Verres prescrits de près (2) ▼]               │ │
│ [Voir ordonn.]   │  │ [Verres prescrits 2 paires ▼]                  │ │
│ [Externe...]     │  │ [Verres prescrits en progressifs ▼]            │ │
│                  │  │ [Verres prescrits en bifocaux ▼]               │ │
│ [Renouvellement] │  └─────────────────────────────────────────────────┘ │
├──────────────────┴─────────────────────────────────────────────────────┤
│ RIGHT PANEL: Rédaction de la fiche: Auto-generated prescription text   │
│ OD= -1,75 (-0,25 à 170°)= 6/10; Add 1,00 =P 2                          │
│ OG= -2,00 (-0,25 à 30°)= 5/10; Add 1,00 =P 2                           │
│ Kératométrie: ROD= 7,90/7,80  Km= 7,85 AXES OD= 165°/75°...            │
└─────────────────────────────────────────────────────────────────────────┘
```

## MedFlow Current State

**Files**:
- `/frontend/src/pages/ophthalmology/components/SubjectiveRefractionStep.jsx`
- `/frontend/src/pages/ophthalmology/components/ObjectiveRefractionStep.jsx`
- `/frontend/src/pages/ophthalmology/components/KeratometryStep.jsx`
- `/frontend/src/pages/ophthalmology/components/panels/RefractionPanel.jsx`

**Current Layout**:
- Wizard steps (separate screens for each measurement)
- Modern card-based inputs
- OD/OS as separate sections (not side-by-side grid)
- No auto-generated prescription text panel

**What Exists**:
| Feature | Status | Gap |
|---------|--------|-----|
| Subjective refraction inputs | ✅ | Not side-by-side OD/OG |
| Keratometry inputs | ✅ | Separate step, not integrated |
| History list | ❌ | Missing left panel |
| Auto-prescription text | ❌ | Missing right panel |
| Prescription type dropdowns | Partial | Different UI pattern |

## Transformation Required

### 1. Create StudioVision Refraction Panel

**New File**: `/frontend/src/pages/ophthalmology/StudioVisionRefraction.jsx`

```jsx
<div className="sv-refraction grid grid-cols-[200px_1fr_300px] h-full">
  {/* LEFT: History & Actions */}
  <div className="sv-history-panel border-r bg-gray-50">
    <RefractionHistoryList />      {/* Date/Ref/Ker columns */}
    <div className="sv-actions">
      <button>Nouvelle réfraction pré-remplie</button>
      <button>Nouvelle réfraction vide</button>
    </div>
    <RefractometerSendButtons />   {/* -> mem.LM, -> mem.RM */}
    <QuickActionButtons />         {/* Perso, Vidal, Imprimer, etc */}
  </div>

  {/* CENTER: OD/OG Grid Entry */}
  <div className="sv-entry-grid">
    <TensionRow />                 {/* TOD/TOG inputs */}
    <ODOGRefractionGrid />         {/* Side-by-side Sph/Cyl/Axe */}
    <KeratometryGrid />            {/* ROD/ROG with axes */}
    <PrescriptionTypeDropdowns />  {/* All lens types */}
  </div>

  {/* RIGHT: Auto-generated Text */}
  <div className="sv-prescription-text bg-gray-100">
    <h3>Rédaction de la fiche:</h3>
    <AutoGeneratedPrescription />  {/* Live-updating text */}
    <h3>Commentaires réfraction:</h3>
    <CommentsSection />
  </div>
</div>
```

### 2. OD/OG Side-by-Side Grid Component

**Key Visual**: The OD and OG inputs MUST be in adjacent columns:

```jsx
<div className="grid grid-cols-[1fr_60px_1fr] items-center">
  {/* OD Column */}
  <div className="text-center">
    <div className="font-bold text-blue-800 text-lg">OD</div>
    <input className="sv-input" value={refraction.od.sphere} />
  </div>

  {/* Separator */}
  <div className="text-center text-gray-400">65</div>

  {/* OG Column */}
  <div className="text-center">
    <div className="font-bold text-blue-800 text-lg">OG</div>
    <input className="sv-input" value={refraction.og.sphere} />
  </div>
</div>
```

### 3. Auto-Text Generation Service

**New File**: `/frontend/src/utils/refractionTextGenerator.js`

```javascript
export function generateRefractionText(data) {
  const { od, og, keratometry } = data;

  let text = 'Réfraction subjective:\n';
  text += `OD= ${od.sphere} (${od.cylinder} à ${od.axis}°)= ${od.va}; Add ${od.add} =${od.parinaud}\n`;
  text += `OG= ${og.sphere} (${og.cylinder} à ${og.axis}°)= ${og.va}; Add ${og.add} =${og.parinaud}\n\n`;

  if (keratometry) {
    text += 'Kératométrie:\n';
    text += `ROD= ${keratometry.rod.k1}/${keratometry.rod.k2} Km= ${keratometry.rod.mean} AXES OD= ${keratometry.rod.axis1}°/${keratometry.rod.axis2}°\n`;
    // ... etc
  }

  return text;
}
```

---

# SCREEN 3: Contact Lens Module (Lentilles) - OPH3

## StudioVision Layout Analysis

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER: LENTILLES de Madame LAREC Doriane, 42 Ans - mercredi 5 juin 13  │
├─────────────────────────────────────────────────────────────────────────┤
│ TAB BAR: Fermer | Réfraction | Lentilles | Pathologies | etc.           │
├──────────────────┬──────────────────────────┬───────────────────────────┤
│ DATE LIST (Left) │ LENS PARAMETERS (Center) │ AUTO-TEXT (Right)         │
│ 23/05/2010  1    │ ┌──────────┬──────────┐  │ Rédaction de la fiche:    │
│ 31/05/2013  1  X │ │Lent.drte │Lent.gche │  │ K - OD: 7.9/7.8 165°/75°  │
│ 04/06/2013  1  X │ ├──────────┼──────────┤  │ OG: 8.01/7.91 14°/104°    │
│ 05/06/2013  1  X │ │Laboratoire:          │  │                           │
│                  │ │[OPHTALMIC▼][OPHTALMIC▼] │ Lentilles d'essai 1/10:  │
│ Lentilles du     │ │Lentille:             │  │ OD: OPHTALMIC HR PROG...  │
│ 05/06/2013  1  X │ │[OPHTALMIC HR▼][...]  │  │ OG: OPHTALMIC HR PROG...  │
│                  │ │Rx:                   │  │                           │
│ Prescription     │ │[8,70][14,20][8,70][14,20]│ => Lentilles Prescrites │
│ ┌──────────────┐ │ │Prescription [Lot]    │  │                           │
│ │Réfraction:   │ │ ├──────────┴──────────┤  │ Entretien:                │
│ │  __ | + | __ │ │ │    Sphère  [-2,00 ▼] │  │ - Ophtalmic: JAZZ...     │
│ │  __ | Cyl± |_│ │ │    Cylindre [-0,25▼] │  │                           │
│ │SIAM|  Axe  |_│ │ │    AV de loin [LOW▼] │  │ - Important: Entretenir  │
│ │    |Addition|_│ │ │    Addition [LOW ▼] │  │   vos lentilles avec soin│
│ │    |Parinaud|_│ │ │    Parinaud         │  │                           │
│ └──────────────┘ │ ├────────────────────────┤ │ Prescription:            │
│                  │ │ K-READING BAR:        │  │ LENTILLES DE CONTACT     │
│ [Nouvelles pré-] │ │ 7.40<=Km<=8.10       │  │ - OEIL DROIT: OPHTALMIC  │
│ [Nouvelles vide] │ │ LOW: jusqu'à +2.25d  │  │   Rx: 8.70 / D: 14.20... │
│                  │ │ HIGH: +2.25d à +3.00d │  │ - OEIL GAUCHE: OPHTALMIC │
│ [Importer réfr.] │ ├────────────────────────┤ │   Rx: 8.70 / D: 14.20... │
│ [Lunettes+Equiv] │ │ [Rédiger cet essai]   │  │                           │
├──────────────────┤ ├────────────────────────┤ │ Commentaire d'adaptation:│
│ INVENTORY LIST   │ │ Entretien | Commentaires│ │                          │
│ Aquarest         │ │ [Long list of care    │  │                           │
│ Artelac          │ │  instructions and     │  │                           │
│ CooperVision...  │ │  wear schedules]      │  │                           │
│ Dacryoserum      │ │                       │  │                           │
│ [scrollable]     │ │ Port: quotidien/mens. │  │ [Products Used List]     │
└──────────────────┴──────────────────────────┴───────────────────────────┘
```

## MedFlow Current State

**Files**:
- `/frontend/src/pages/ophthalmology/components/ContactLensFittingStep.jsx` (wrapper)
- `/frontend/src/components/contactLens/ContactLensFitting.jsx` (main component)

**Current Layout**:
- Tab-based interface (Trial Lenses / Final Prescription)
- Modern form inputs
- No left-panel inventory list
- No auto-generated prescription text

**What Exists**:
| Feature | Status | Gap |
|---------|--------|-----|
| OD/OG lens parameters | ✅ | Different layout |
| Base curve/diameter inputs | ✅ | Not side-by-side |
| K-reading reference | ❌ | Missing visual bar |
| Lens inventory list | ❌ | Missing left panel |
| Care instructions | Partial | Not pre-built text blocks |
| Auto-prescription text | ❌ | Missing right panel |

## Transformation Required

### 1. Create StudioVision Contact Lens Panel

**New File**: `/frontend/src/pages/ophthalmology/StudioVisionLentilles.jsx`

```jsx
<div className="sv-lentilles grid grid-cols-[200px_1fr_280px] h-full">
  {/* LEFT: History & Inventory */}
  <div className="sv-left-panel">
    <LensHistoryList />
    <PrescriptionBlock />          {/* Current refraction display */}
    <LensInventoryList />          {/* Scrollable brand list */}
    <CommandButtons />             {/* Prescrire, Imprimer, etc */}
  </div>

  {/* CENTER: Lens Parameters */}
  <div className="sv-lens-params">
    <ODOGLensGrid />               {/* Lentille droite | Lentille gauche tabs */}
    <LensParameterInputs />        {/* Rx, Diameter, BC */}
    <KReadingBar />                {/* Visual 7.40<=Km<=8.10 indicator */}
    <CareInstructionsPanel />      {/* Entretien / Commentaires tabs */}
    <WearScheduleOptions />        {/* Port quotidien, mensuel, etc */}
  </div>

  {/* RIGHT: Auto-generated Prescription */}
  <div className="sv-prescription-output">
    <PrescriptionTextBlock />      {/* K readings, lens details */}
    <CareInstructionsText />       {/* Pre-built care text */}
    <ProductsUsedList />           {/* Products checkbox list */}
  </div>
</div>
```

### 2. K-Reading Visual Bar Component

```jsx
function KReadingBar({ km }) {
  // Visual indicator showing where patient's Km falls in range
  const position = ((km - 7.40) / (8.10 - 7.40)) * 100;

  return (
    <div className="sv-k-bar relative h-6 bg-gradient-to-r from-red-200 via-green-200 to-red-200">
      <div className="absolute text-xs" style={{ left: '0%' }}>7.40</div>
      <div className="absolute text-xs" style={{ left: '50%' }}>7.75</div>
      <div className="absolute text-xs" style={{ right: '0%' }}>8.10</div>
      <div
        className="absolute w-2 h-full bg-blue-600"
        style={{ left: `${position}%` }}
      />
    </div>
  );
}
```

---

# SCREEN 4: Pathologies/Diagnosis Module - OPH4

## StudioVision Layout Analysis

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER: PATHOLOGIES de Madame LAREC Doriane, 42 Ans - mardi 4 juin 2013 │
├─────────────────────────────────────────────────────────────────────────┤
│ TAB BAR: Fermer | Réfraction | Lentilles | Pathologie | Orthoptie | etc │
├──────────────────┬──────────────────────────┬───────────────────────────┤
│ CONDITION LIST   │ TOD: [13 ▼] ← [→] [11▼] TOG [Heure]                  │
│ (Left sidebar)   │                          │ [Renouvellement de la    │
│                  │                          │  pathologie précédente]  │
│ ┌──────────────┐ ├──────────────────────────┴───────────────────────────┤
│ │Dominante ▼   │ │ Maquettes    │ Symptomes           │ Description     │
│ │[Diabète    ] │ │              │                     │                 │
│ ├──────────────┤ │ OCT          │ F.O: Stade R.D non  │ -Maculopathie   │
│ │Maquettes     │ │ Lasik        │   proliferative     │   exsudative    │
│ │              │ │ Voies Lacry. │ Debutante: Micro-   │ -Maculopathie   │
│ │OCT           │ │ Vitré        │   anévrysmes < 5    │   oedémateuse   │
│ │Lasik         │ │ Surveillance │ Moyenne: Micro-     │ = R.A.S.        │
│ │Voies Lacrym. │ │   APS        │   anévrysmes > 5 ou │ claire, négatif │
│ │Vitré         │ │ PKE+ICP      │ Exsudats            │   à la fluor.   │
│ │Surveillance  │ │ Exploration  │ Hémorragies Ponct.  │ -Absence de...  │
│ │PKE+ICP       │ │   vision     │ Stade R.D pré       │ Ronde et régul. │
│ │Exploration   │ │ Motif Consult│   proliférative     │                 │
│ │vision couleur│ │ Normal       │ Modérée: Nodules    │ [Oeil droit]    │
│ │Motif Consult │ │ Conjonctivite│   cotonneux < 2     │ [OD et OG]      │
│ │Normal        │ │ Traumato.    │ Sévère: Nodules     │ [Oeil gauche]   │
│ │Conjonctivite │ │ Cataracte    │   cotonneux > 2     │                 │
│ │Traumatologie │ │ Glaucome     │ Hémorragie dissém.  │ foréolaire      │
│ │Cataracte     │ │ Rétine Centr │ Veines moniliformes │ -Oedème macul.  │
│ │Glaucome      │ │ Rétine Périph│ Stade R.D prolif.   │   cystoide      │
│ │Rétine Centrale│ │ Paupière    │ Modérée: néovaiss.  │ -Oedème rétinien│
│ │Rétine Périph │ │ Cornée       │   prérétiniens      │                 │
│ │Paupière      │ │ Uvéite       │ Sévère: néovaiss.   │ pôle postérieur │
│ │Cornée        │ │ [Diabète]    │   prépapillaires    │ périphérie      │
│ │Uvéite        │ │ HTA          │ Maculopathie:       │                 │
│ │[Diabète]←SEL │ │ Résultats    │ Modérée: oedème mac │ -Hémorragie     │
│ │HTA           │ │   d'examens  │   focal             │   intra rétin.  │
│ │Résultats exam│ │ Chirurgie    │ Sévère: oedème mac. │ -Hémorragie pré │
│ │Chirurgie cat.│ │   cataracte  │   cystoïde          │ -Hémorragie sous│
│ └──────────────┘ │              │                     │   rétinienne    │
├──────────────────┴──────────────┴─────────────────────┴─────────────────┤
│ DIAGNOSTIC PANEL (Right side):                                          │
│ ○ Rétinopathie Diabétique Proliférative                                │
│ ○ Rétinopathie Diabétique Pre-Proliférative                            │
│ ○ Rétinopathie Diabétique Ischémique                                   │
│ ○ Rétinopathie Diabétique Oedémateuse                                  │
│ ○ Rétinopathie Diabétique non Proliférative                            │
│ ○ Absence de Rétinopathie diabétique                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ Rédaction de l'observation:                                             │
│ LAF: Cornée Claire O.D.G | Chambre antérieure Calme et profonde        │
│ Pupille Ronde et régulière sans rubéose irienne O.D.G                  │
│ F.O. dilaté: =Discrète Cataracte en cupule postérieure O.D > G         │
│ V3M: Modérée: Nodules cotonneux < 2 | Hémorragie disséminées           │
│ Veines moniliformes | Stade R.D pré proliférative OD et OG             │
│                                                     [faire angio et oct]│
└─────────────────────────────────────────────────────────────────────────┘
```

## MedFlow Current State

**Files**:
- `/frontend/src/pages/ophthalmology/components/DiagnosisStep.jsx`
- `/frontend/src/components/pathology/PathologyPicker.jsx`
- `/frontend/src/components/pathology/PathologySummary.jsx`

**Current Layout**:
- ICD-10 search-based diagnosis entry
- Common diagnoses quick-select
- Toggle between standard and "studiovision" view mode (exists!)
- PathologyPicker component exists but may need enhancement

**What Exists**:
| Feature | Status | Notes |
|---------|--------|-------|
| Condition categories list | ✅ | PathologyPicker has categories |
| Symptom selection | ✅ | PathologyPicker.jsx |
| Description auto-population | ✅ | PathologyPicker.jsx |
| Diabetic staging system | Partial | Needs structured R.D. stages |
| Observation text generation | Partial | autoText field exists |
| Diagnostic radio buttons | ❌ | Need to add right panel |

## Transformation Required

### 1. Enhance PathologyPicker for Full StudioVision Parity

The component exists but needs:

```jsx
// Add to PathologyPicker.jsx
<div className="sv-pathology grid grid-cols-[180px_1fr_1fr_250px]">
  {/* Column 1: Dominante dropdown + Category list */}
  <div className="sv-categories">
    <select className="sv-dominante">{/* Diabète, Glaucome, etc */}</select>
    <ul className="sv-category-list">{/* Scrollable */}</ul>
  </div>

  {/* Column 2: Maquettes/Templates */}
  <div className="sv-maquettes">
    <TemplateList category={selectedCategory} />
  </div>

  {/* Column 3: Symptoms + Description */}
  <div className="sv-symptoms-desc">
    <SymptomChecklist />
    <DescriptionOptions />
    <LateralitySelector />  {/* OD, OG, OD et OG */}
  </div>

  {/* Column 4: Diagnostic Radio + Observation */}
  <div className="sv-diagnostic">
    <DiagnosticRadioList />       {/* Pre-built diagnosis options */}
    <ObservationTextArea />       {/* Auto-generated + editable */}
  </div>
</div>
```

### 2. Diabetic Retinopathy Staging System

**New File**: `/frontend/src/components/pathology/DiabeticRetinopathyStaging.jsx`

```jsx
const DR_STAGES = {
  nonProliferative: {
    debutante: ['Microanévrysmes < 5'],
    moyenne: ['Microanévrysmes > 5', 'Exsudats', 'Hémorragies Ponctuées'],
    severe: ['Nodules cotonneux > 2', 'Hémorragie disséminées', 'Veines moniliformes']
  },
  proliferative: {
    moderee: ['Néovaisseaux prérétiniens'],
    severe: ['Néovaisseaux prépapillaires']
  },
  maculopathy: {
    moderee: ['Oedème maculaire focal'],
    severe: ['Oedème maculaire cystoïde']
  }
};
```

---

# SCREEN 5: Treatment/Prescription Module - OPH5

## StudioVision Layout Analysis

```
┌─────────────────────────────────────────────────────────────────────────┐
│ HEADER: TRAITEMENT de Madame LAREC Doriane, 42 Ans - vendredi 31 mai 13 │
├─────────────────────────────────────────────────────────────────────────┤
│ TAB BAR: Fermer | Réfraction | Lentilles | Pathologies | etc.           │
├────────────────┬──────────────────────────────┬─────────────────────────┤
│ DRUG CATEGORIES│ DRUGS + DOSING GRID          │ STANDARD TREATMENTS     │
│ (Purple bg)    │ (Multi-column)               │ (Gray bg)               │
│                │                              │                         │
│ ┌────────────┐ │ ┌────────────────────────┐   │ Traitements Standards:  │
│ │Liste globale│ │ │Maquettes │Vidal       │   │ ┌─────────────────────┐ │
│ │des médica. │ │ │          │            │   │ │ESACINE 1            │ │
│ │↓           │ │ │Dexafrese │            │   │ │>2                   │ │
│ │[Search box]│ │ │DEXAMATHAS│            │   │ │Angio Allergie       │ │
│ ├────────────┤ │ │FLUCON COL│            │   │ │Atropine 0,5 %       │ │
│ │A.I.N.S Gen.│ │ │MAXIDEX   │            │   │ │Atropine 1,0 %       │ │
│ │Antalgiques │ │ │MEDRYSONE │            │   │ │Blépharite           │ │
│ │Antibio.Gen.│ │ │SOLUCORT  │            │   │ │Capsulotomie au laser│ │
│ │Anti-catarac│ │ │[Sterdex] │            │   │ │Chalazion            │ │
│ │Anti-glauco │ │ │VEXOL     │            │   │ │Conjonctivite Bactér.│ │
│ │Anti-histam.│ │ └──────────┴────────────┘   │ │Corps Étranger       │ │
│ │Antioxydants│ │                              │ │Correctol            │ │
│ │Antisept+vas│ │ Dose:    │Posologie│Détails │ │Dacryocystite aigue  │ │
│ │Antisept-vas│ │ à 3 lavag│le matin │dans œil│ │DIOPARINE            │ │
│ │Anti-viraux │ │ Une goutt│à midi   │droit   │ │Facture Edf          │ │
│ │Cicatrisants│ │ Deux gout│l'après  │gauche  │ │FRAKIDEX             │ │
│ │Collyres AIN│ │ Une appli│le soir  │les deux│ │Glaucome néovasculair│ │
│ │Collyres Ant│ │ Un lavage│matin+soi│concerné│ │GOUGEROT JOGREN      │ │
│ │Collyres A/C│ │ Un compri│3x/jour  │paupière│ │ICP DRT              │ │
│ │Collyres Ant│ │ Deux comp│4x/jour  │racine  │ │ICP GCHE             │ │
│ │Collyres Ant│ │ Un sachet│5x/jour  │cils    │ │Injection intra vitr.│ │
│ │Collyres Bet│ │ Une ampou│ttes heur│repas   │ │Irving Gass          │ │
│ │Collyres ATB│ │ Une gélul│ttes 2h  │au révei│ │Kératite épithéliale │ │
│ │[Cortico loc│ │ Deux gélu│ttes 3h  │coucher │ │Kératite et Kérato-Uvé│
│ │Divers OPH  │ │ Une pipet│ttes 4h  │irritati│ │Opticare: Applicateur│ │
│ │Larmes Lotio│ │ Une boîte│ttes 6h  │hygiène │ │PHAKAN               │ │
│ │Magnésium   │ │ Deux boît│1jr/2    │        │ │ROSACEE              │ │
│ │Hydratantes │ │ Un tube  │1jr/3    │        │ │SOLUCORT             │ │
│ │Pommades A/C│ │ Deux tube│1x/semain│        │ │TILAVIST             │ │
│ │Pommades Ant│ │ Un flacon│         │        │ │Titre                │ │
│ │Potassium   │ │ Deux flac│         │        │ └─────────────────────┘ │
│ │Vasculotrope│ │          │         │        │                         │
│ │vasodilatat.│ │ Durée:                      │ PROCHAIN RENDEZ-VOUS LE:│
│ └────────────┘ │ pendant un jour. │          │ Recontacter le médecin  │
│                │ pendant deux jours│          │ en cas d'intolérance... │
│                │ pendant trois jours          │ NE JAMAIS ARRETER LE    │
│                │ pendant une semaine          │ TRAITEMENT SANS AVIS... │
│                │ pendant un mois   │          │ A RENOUVELER 1 FOIS     │
│                │ pendant trois mois│          │ A RENOUVELER 2 FOIS     │
├────────────────┴──────────────────────────────┴─────────────────────────┤
│ PRESCRIPTION DISPLAY (Cyan background):                                 │
│ Ordonnance 1 │ Ordonnance 2 │ 1 & 2 ou Bi-zone │                       │
│                                                                         │
│ - Appliquer un gant de toilette imprégné de l'eau chaude du robinet    │
│   sur les paupières 10 minutes matin et soir.                          │
│                                                                         │
│ Puis laver les yeux avec une lingette de Bléphaclean.                  │
│                                                                         │
│ - STERDEX : 1 application matin et soir sur la paupière concernée      │
│   pendant huit jours.                                                   │
│ - DACUDOSES: pour laver les yeux.                                       │
│ - HYDROFTA : 2 gellules par jour en cure de 3 mois                     │
│                                                                         │
│ Liste personnelle:        ├─────────────────────────────────────────────┤
│ [1 Flacon               ] │ [Simple] [Dupli(1)] [Double(2)] [Gras]     │
│                           │ ○ Imprimer   ○ Voir                        │
│                           │ [Renouvellement du traitement précédent]   │
│                           │ [Enregistrer en tant que traitement standard│
│                           │ [100% Cerfa]                    Notes:     │
│                           │                            QSP 3 MOIS      │
│                           │                            QSP 6 MOIS      │
└─────────────────────────────────────────────────────────────────────────┘
```

## MedFlow Current State

**Files**:
- `/frontend/src/pages/ophthalmology/components/PrescriptionStep.jsx`
- `/frontend/src/pages/ophthalmology/components/prescription/MedicationPrescriptionTab.jsx`
- `/frontend/src/components/treatment/TreatmentBuilder.jsx` ⭐ KEY COMPONENT

**Current Layout**:
- **TreatmentBuilder.jsx already has 4-column StudioVision layout!**
- Uses ColumnLayout component
- Has medication categories, drug database, dosing options
- Has standard treatments list

**What Exists**:
| Feature | Status | Notes |
|---------|--------|-------|
| Drug category sidebar | ✅ | MEDICATION_CATEGORIES in TreatmentBuilder |
| Drug brand list (Vidal) | ✅ | DRUG_DATABASE in TreatmentBuilder |
| Dose options | ✅ | DOSE_OPTIONS array |
| Posologie options | ✅ | POSOLOGIE_OPTIONS array |
| Duration options | ✅ | DURATION_OPTIONS array |
| Standard treatments | ✅ | STANDARD_TREATMENTS array |
| Ordonnance tabs | Partial | Needs 1/2/Bi-zone tabs |
| Print options | Partial | Needs Simple/Dupli/Double/Gras |
| 100% Cerfa | ✅ | cerfaGenerator.js exists |

## Transformation Required

### 1. TreatmentBuilder is 80% Complete!

**Minor Enhancements Needed**:

```jsx
// Add to TreatmentBuilder.jsx

// 1. Ordonnance Tabs
<div className="sv-ordonnance-tabs">
  <button className={tab === 1 ? 'active' : ''}>Ordonnance 1</button>
  <button className={tab === 2 ? 'active' : ''}>Ordonnance 2</button>
  <button className={tab === 'bizone' ? 'active' : ''}>1 & 2 ou Bi-zone</button>
</div>

// 2. Print Format Options
<div className="sv-print-options">
  <label><input type="radio" name="format" value="simple" /> Simple</label>
  <label><input type="radio" name="format" value="dupli" /> Dupli (1)</label>
  <label><input type="radio" name="format" value="double" /> Double (2)</label>
  <label><input type="radio" name="format" value="gras" /> Gras</label>
  <button className="sv-btn-cerfa">100% Cerfa</button>
</div>

// 3. Renewal Options
<div className="sv-renewal">
  <button>Renouvellement du traitement précédent</button>
  <button>Enregistrer en tant que traitement standard</button>
</div>

// 4. QSP Duration
<div className="sv-qsp">
  <label>Notes:</label>
  <select>
    <option>QSP 3 MOIS</option>
    <option>QSP 6 MOIS</option>
  </select>
</div>
```

### 2. Color-Code the Columns

```css
/* Already partially implemented, enhance: */
.sv-treatment-col-1 { background: #e6d5f2; }  /* Purple - Categories */
.sv-treatment-col-2 { background: #d5f2d5; }  /* Green - Drugs */
.sv-treatment-col-3 { background: #f2f2d5; }  /* Yellow - Dosing */
.sv-treatment-col-4 { background: #e6e6e6; }  /* Gray - Standard/Options */
.sv-treatment-bottom { background: #d5f2f2; } /* Cyan - Prescription display */
```

---

# Implementation Priority

## Phase 1: Quick Wins (TreatmentBuilder Enhancement)
- [ ] Add Ordonnance tabs (1, 2, Bi-zone)
- [ ] Add print format radio buttons
- [ ] Add renewal/save as standard buttons
- [ ] Apply StudioVision color scheme
- **Effort**: 2-4 hours
- **Impact**: OPH5 screen fully StudioVision-compatible

## Phase 2: Patient Summary (Fiche Patient)
- [ ] Create StudioVisionFiche.jsx component
- [ ] Implement 3-column fixed layout
- [ ] Add color-coded clinical blocks
- [ ] Add visit history table (right panel)
- [ ] Create studiovision.css
- **Effort**: 8-12 hours
- **Impact**: Main patient view matches StudioVision

## Phase 3: Refraction Panel
- [ ] Create StudioVisionRefraction.jsx
- [ ] Implement OD/OG side-by-side grid
- [ ] Add history list (left panel)
- [ ] Add auto-prescription text generator (right panel)
- [ ] Add prescription type dropdowns
- **Effort**: 8-12 hours
- **Impact**: Core clinical workflow matches

## Phase 4: Contact Lens Panel
- [ ] Create StudioVisionLentilles.jsx
- [ ] Add K-reading visual bar
- [ ] Add lens inventory left panel
- [ ] Add care instructions text blocks
- [ ] Add auto-prescription output
- **Effort**: 6-8 hours
- **Impact**: Contact lens workflow matches

## Phase 5: Pathology Panel Enhancement
- [ ] Enhance PathologyPicker for 4-column layout
- [ ] Add diabetic retinopathy staging system
- [ ] Add diagnostic radio button panel
- [ ] Add auto-observation text generator
- **Effort**: 6-8 hours
- **Impact**: Diagnosis workflow matches

---

# Files to Create/Modify Summary

## New Files
```
/frontend/src/pages/PatientDetail/StudioVisionFiche.jsx
/frontend/src/pages/ophthalmology/StudioVisionRefraction.jsx
/frontend/src/pages/ophthalmology/StudioVisionLentilles.jsx
/frontend/src/styles/studiovision.css
/frontend/src/utils/refractionTextGenerator.js
/frontend/src/components/pathology/DiabeticRetinopathyStaging.jsx
```

## Files to Modify
```
/frontend/src/components/treatment/TreatmentBuilder.jsx (minor)
/frontend/src/components/pathology/PathologyPicker.jsx (enhance)
/frontend/src/pages/PatientDetail/index.jsx (add view toggle)
/frontend/src/pages/ophthalmology/NewConsultation.jsx (integrate new panels)
```

---

# Testing Checklist

For each transformed screen:
- [ ] Layout matches StudioVision screenshot pixel-for-pixel
- [ ] All data entry fields functional
- [ ] Auto-text generation works correctly
- [ ] Color scheme applied correctly
- [ ] Print functionality works
- [ ] Data saves to backend correctly
- [ ] Existing MedFlow features still accessible

---

*Document created: 2025-12-17*
*Based on StudioVision XP screenshots in /assets/ophthalmology-images/*
