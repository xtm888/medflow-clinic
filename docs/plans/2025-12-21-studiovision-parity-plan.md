# StudioVision Feature Parity Plan - Congo Edition

## Overview
Implementation plan for remaining StudioVision features relevant to Congolese ophthalmology practice.

**Excluded (not relevant for Congo or per user request):**
- Send to Refractor Device (one-way devices common in Congo)
- Lens Recommendation Engine (Essilor/French brands not available)
- Audio Recording/Dictation
- Scanner Integration
- Secure Messaging (Apicrypt)
- Sesam-Vitale (French health card)
- Currency Converter (already have CDF/USD/EUR)
- Social Security Number (French system)

---

## Phase 1: Patient Context Enhancement (Priority: HIGH)

### 1.1 Patient Photo in Consultation Header
**Location:** `StudioVisionConsultation.jsx`, `PatientCompactDashboard.jsx`

**Task:** Display patient photo prominently in consultation header (like oph1.jpg shows photo icon)

**Implementation:**
- Add patient photo thumbnail (40x40px) next to name in header bar
- Click to view full photo
- If no photo, show placeholder with camera icon to capture
- Leverage existing face recognition photo storage

**Files to modify:**
- `frontend/src/pages/ophthalmology/StudioVisionConsultation.jsx`
- `frontend/src/components/patient/PatientCompactDashboard.jsx`

### 1.2 Profession Field Display
**Location:** Resume tab, Patient header

**Task:** Show patient's profession in consultation view

**Implementation:**
- Add profession badge/text below patient name
- Useful for: screen workers (computer eye strain), outdoor workers (UV exposure), drivers (vision requirements)
- Field already exists in Patient model

**Files to modify:**
- `frontend/src/components/consultation/tabs/ResumeTab.jsx`
- `frontend/src/components/patient/PatientCompactDashboard.jsx`

### 1.3 Referring Doctor Display
**Location:** Resume tab

**Task:** Show "Médecin Référent: Dr [Name]" in patient summary

**Implementation:**
- Display referring doctor name with specialty
- Link to referrer details
- Show referral date and reason if available

**Files to modify:**
- `frontend/src/components/consultation/tabs/ResumeTab.jsx`

---

## Phase 2: Eye Drawing/Schema Tool (Priority: HIGH)

### 2.1 Create EyeSchemaCanvas Component
**New Component:** `frontend/src/components/ophthalmology/EyeSchemaCanvas.jsx`

**Task:** Canvas-based eye diagram annotation tool

**Features:**
- Pre-loaded eye diagram templates:
  - Anterior segment (front view)
  - Fundus (posterior view)
  - External eye
  - Cross-section
- Drawing tools:
  - Pen (freehand)
  - Line
  - Circle/oval
  - Arrow
  - Text annotation
- Colors: Red, Blue, Green, Yellow, Black
- Undo/Redo
- Clear
- Save as image (attach to exam)
- Load from previous exam

**Technical approach:**
- Use HTML5 Canvas or fabric.js for drawing
- SVG base images for eye templates
- Store drawings as base64 or image files
- Link to OphthalmologyExam document

**Files to create:**
- `frontend/src/components/ophthalmology/EyeSchemaCanvas.jsx`
- `frontend/src/components/ophthalmology/EyeSchemaModal.jsx`
- `frontend/src/components/ophthalmology/eyeTemplates/` (SVG templates)

### 2.2 Integrate Schema Button
**Location:** Quick Actions Bar, Pathologies tab

**Task:** Add "Schéma" button to open drawing modal

**Files to modify:**
- `frontend/src/components/consultation/QuickActionsBar.jsx`
- `frontend/src/components/pathology/PathologyPicker.jsx`

---

## Phase 3: Visit History Enhancement (Priority: HIGH)

### 3.1 Rich Visit History Table
**Location:** Resume tab right panel

**Task:** Convert simple timeline to rich table like oph1.jpg

**Columns:**
| Date | Description | Dominante | Dr | Image | Texte |
|------|-------------|-----------|-----|-------|-------|
| 18/07/2009 | Lunettes | OD | oph | 📷 | 📄 |

**Implementation:**
- Date: Visit date (DD/MM/YYYY format)
- Description: Consultation type (Lunettes, Cataracte, Diabète, etc.)
- Dominante: Which eye was primary focus (OD/OS/OU)
- Dr: Examiner initials
- Image: Icon if imaging attached (click to view)
- Texte: Icon if documents attached (click to view)

**Files to modify:**
- `frontend/src/components/consultation/tabs/ResumeTab.jsx`
- Create: `frontend/src/components/consultation/VisitHistoryTable.jsx`

---

## Phase 4: Clinical Enhancements (Priority: MEDIUM)

### 4.1 K Range Visual Indicators
**Location:** Refraction tab, Keratometry section

**Task:** Color-coded K value range display

**Ranges (for contact lens fitting):**
- Green: 7.40 <= Km <= 8.10 (normal)
- Yellow: Outside normal but acceptable
- Red: Extreme values requiring special lenses

**Visual:**
```
K Values:  [====|====|====]
           7.2  7.6  8.0  8.4
                 ▲
              Current: 7.85 ✓
```

**Files to modify:**
- `frontend/src/components/ophthalmology/KeratometryInput.jsx`
- `frontend/src/components/contactLens/ContactLensFittingTab.jsx`

### 4.2 Binocular Balance Section
**Location:** Refraction tab

**Task:** Add binocular balance testing section

**Fields:**
- Binocular balance method (Humphriss, Fogging, etc.)
- Balance achieved: Yes/No
- Notes

**Files to modify:**
- `frontend/src/pages/ophthalmology/components/SubjectiveRefractionStep.jsx`
- `frontend/src/components/ophthalmology/RefractionPanel.jsx`

### 4.3 "Important" Red Alert Notes
**Location:** Resume tab, Patient header

**Task:** Prominent red highlighted critical notes (like "En rouge stabilo")

**Implementation:**
- Red bordered card at top of Resume
- Bold red text for critical alerts
- Examples: Drug allergies, Surgery alerts, Payment issues
- Easy add/edit interface

**Files to modify:**
- `frontend/src/components/consultation/tabs/ResumeTab.jsx`
- `frontend/src/components/patient/PatientCompactDashboard.jsx`
- Create: `frontend/src/components/patient/CriticalAlertBanner.jsx`

---

## Phase 5: Quick Access Buttons (Priority: MEDIUM)

### 5.1 Bottom Toolbar Completion
**Location:** StudioVision bottom bar

**Current buttons:** Nouveau patient, Imprimer consultation, etc.

**Add missing:**
- **Schéma** - Opens eye drawing tool (Phase 2)
- **Résumé autre patient** - Quick patient switcher
- **Agenda Jour** - Today's appointments quick view

**Files to modify:**
- `frontend/src/pages/ophthalmology/StudioVisionConsultation.jsx`

---

## Implementation Order

### Sprint 1 (Phase 1 + 3): Patient Context & History
1. Patient photo in header
2. Profession display
3. Referring doctor display
4. Rich visit history table

**Estimated effort:** 2-3 days

### Sprint 2 (Phase 2): Eye Drawing Tool
1. Create EyeSchemaCanvas component
2. SVG eye templates
3. Drawing tools implementation
4. Integration with Quick Actions

**Estimated effort:** 3-4 days

### Sprint 3 (Phase 4 + 5): Clinical Enhancements
1. K range visual indicators
2. Binocular balance section
3. Critical alert banner
4. Bottom toolbar completion

**Estimated effort:** 2-3 days

---

## Technical Notes

### Eye Schema Storage
```javascript
// In OphthalmologyExam model, add:
schemas: [{
  type: { type: String, enum: ['anterior', 'fundus', 'external', 'crossSection'] },
  imageData: String, // base64 or file path
  annotations: [{
    tool: String,
    color: String,
    points: [{ x: Number, y: Number }],
    text: String
  }],
  createdAt: Date,
  createdBy: ObjectId
}]
```

### Visit History Query
```javascript
// Aggregate visits with attachments
const visits = await Visit.aggregate([
  { $match: { patient: patientId } },
  { $lookup: { from: 'documents', localField: '_id', foreignField: 'visit' } },
  { $lookup: { from: 'imagingstudies', localField: '_id', foreignField: 'visit' } },
  { $project: {
    date: 1,
    type: 1,
    dominantEye: 1,
    examiner: 1,
    hasImages: { $gt: [{ $size: '$imagingstudies' }, 0] },
    hasDocuments: { $gt: [{ $size: '$documents' }, 0] }
  }}
]);
```

---

## Success Criteria

- [x] Patient photo visible in consultation header ✅ (Phase 1 - Dec 21)
- [x] Profession and referring doctor displayed ✅ (Phase 1 - Dec 21)
- [x] Eye drawing tool functional with save/load ✅ (Phase 2 - Dec 21)
- [x] Visit history shows rich table with icons ✅ (Phase 3 - Dec 21)
- [x] K values have visual range indicator ✅ (Phase 4.1 - Dec 21)
- [x] Critical alerts prominently displayed in red ✅ (Phase 4.3 - Dec 21)
- [x] All features work in French ✅

---

## Completed Phases

### Phase 1: Patient Context Enhancement ✅ COMPLETE
- Patient photo in consultation header with fallback placeholder
- Profession field displayed in demographics
- Referring doctor with "Dr" prefix handling
- Fixed field name mappings (photoUrl/photo, occupation/profession)

### Phase 2: Eye Drawing/Schema Tool ✅ COMPLETE
- Created 4 SVG eye templates (AnteriorSegment, Fundus, ExternalEye, CrossSection)
- EyeSchemaCanvas with drawing tools (pen, line, circle, arrow, text)
- Color palette with 5 colors
- Undo/redo, clear, save, download functionality
- EyeSchemaModal wrapper with fullscreen toggle
- Schema button added to QuickActionsBar (Ctrl+Shift+S)

### Phase 3: Visit History Enhancement ✅ COMPLETE
- Rich visit history table with columns: Date, Description, Dominante, Dr, Image, Texte
- Icons for imaging/documents attached
- Click to select visit functionality

### Phase 4: Clinical Enhancements ✅ COMPLETE
- **4.1 K Range Visual Indicators**: KRangeIndicator component with color-coded range bar (green/yellow/red zones), contact lens fitting guide, visual position marker
- **4.2 Binocular Balance Section**: Enhanced with method selection (Humphriss, Fogging, Prism dissociation, etc.), dominant eye toggle, balance achieved status, notes field
- **4.3 Critical Alert Banner**: CriticalAlertBanner component with category-based alerts (allergy, surgery, medical, payment, important), compact view for header, full banner for demographics, edit/add/delete functionality
