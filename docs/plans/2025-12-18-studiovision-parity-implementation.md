# StudioVision Complete Parity Implementation Plan

**Date:** December 18, 2025
**Priority:** HIGH - Core workflow optimization
**Estimated Scope:** Medium-Large (multiple files, new components)

---

## Executive Summary

After deep analysis of StudioVision XP screenshots (oph1-5.jpg) vs MedFlow implementation, this plan addresses:
1. **Missing features** that need implementation
2. **Workflow confusion** caused by multiple entry points
3. **UI/UX gaps** between the two systems

---

## Part 1: Gap Analysis

### ✅ ALREADY IMPLEMENTED (No work needed)

| Feature | Location | Status |
|---------|----------|--------|
| OD/OG Color Coding | `StudioVisionRefractionGrid.jsx` | ✅ Blue/Green |
| 3-Column Pathology Picker | `PathologyPicker.jsx` | ✅ Categories→Symptoms→Diagnostic |
| Multi-column Treatment Builder | `TreatmentBuilder.jsx` | ✅ 4 columns |
| Drug Categories (Maquettes, AINS, etc.) | `TreatmentBuilder.jsx` | ✅ 26 categories |
| Standard Treatment Protocols | `TreatmentBuilder.jsx` | ✅ POST-OP CATARACTE, etc. |
| Ordonnance Tabs (1, 2, Bi-zone) | `TreatmentBuilder.jsx` | ✅ Multiple tabs |
| Print Options (Simple/Dupli/Double/Cerfa) | `TreatmentBuilder.jsx` | ✅ All 5 types |
| Renouvellement Treatment | `TreatmentBuilder.jsx` | ✅ Renewal modal |
| Quick Actions Sidebar | `RefractionQuickActions.jsx` | ✅ History/Print/Device |
| DR Staging Selector | `DRStagingSelector.jsx` | ✅ ETDRS R0-R5, M0-M2 |
| Mode Toggle (Standard/StudioVision) | `StudioVisionModeContext.jsx` | ✅ Global + per-module |

### ⚠️ PARTIALLY IMPLEMENTED (Needs enhancement)

| Feature | Current State | Gap |
|---------|--------------|-----|
| Kératométrie | In RefractionPanel, buried | Not prominent like oph2 |
| Contact Lenses | Exists in step workflow | Not integrated in dashboard |
| Résumé (Summary) | Basic text display | Missing color-coded sections |
| Renouvellement Refraction | CopyPreviousButton exists | Not prominent "pré-remplie" button |

### ❌ NOT IMPLEMENTED (Needs new code)

| Feature | StudioVision Reference | Priority |
|---------|----------------------|----------|
| **Tab Navigation** | oph1 tabs (Réfraction\|Lentilles\|Pathologies...) | HIGH |
| **"Nouvelle réfraction pré-remplie"** | oph2 button | HIGH |
| **"Nouvelle réfraction vide"** | oph2 button | HIGH |
| **"Renouvellement pathologie précédente"** | oph4 button | MEDIUM |
| **ALD / CMU / Dossier Papier** | oph1 checkboxes | MEDIUM |
| **"Envoyer mesure au réfracteur"** | oph2 device buttons | LOW |
| **Règlement Tab** | oph1 payment integration | LOW |
| **Courriers Tab** | oph1 correspondence | LOW |

---

## Part 2: Workflow Simplification

### Current Problem: Multiple Entry Points

```
Current Flow (Confusing):
├── /ophthalmology/consultation (New consultation page)
│   ├── Type selection (Complète, Suivi, Réfraction)
│   ├── Patient search
│   └── Identity verification modal
├── /ophthalmology/:patientId/consultation (From patient detail)
├── /queue → Start consultation (From queue)
├── /visits/:id (From visits list)
└── 4 workflow types: dashboard, full, followup, refraction
```

### Proposed Flow (StudioVision-like)

```
Proposed Flow (Simplified):
├── /ophthalmology (Dashboard with patient search)
│   └── Click patient → Direct to consultation
├── /consultation/:patientId (Single entry point)
│   └── Tab-based interface (like StudioVision)
│       ├── Résumé (default)
│       ├── Réfraction
│       ├── Lentilles
│       ├── Pathologies
│       ├── Examen
│       ├── Traitement
│       └── Règlement
└── "Nouvelle consultation" button starts fresh
```

---

## Part 3: Implementation Tasks

### Phase 1: Core Tab Navigation (HIGH PRIORITY)

#### Task 1.1: Create StudioVisionTabNavigation Component
```
File: frontend/src/components/consultation/StudioVisionTabNavigation.jsx

Features:
- Horizontal tabs: Résumé | Réfraction | Lentilles | Pathologies | Orthoptie | Examen | Traitement | Règlement
- Active tab indicator
- Keyboard navigation (arrow keys)
- Badge for unsaved changes per tab
```

#### Task 1.2: Create StudioVisionConsultationLayout
```
File: frontend/src/pages/ophthalmology/StudioVisionConsultation.jsx

Structure:
- Fixed patient header (like oph1 top bar)
- Tab navigation
- Tab content area
- Bottom action bar (Sauvegarder, Imprimer, Terminer)
```

#### Task 1.3: Create RésuméTab Component
```
File: frontend/src/components/consultation/tabs/ResumeTab.jsx

Layout (matching oph1):
- Left: Patient demographics + medical history
- Center: Color-coded sections
  - PINK: Réfraction summary
  - GREEN: Tonométrie summary
  - YELLOW: Pathologies summary
  - BLUE: Traitement summary
- Right: Consultation history table
```

### Phase 2: Renouvellement Buttons (HIGH PRIORITY)

#### Task 2.1: Add "Nouvelle réfraction pré-remplie/vide" buttons
```
Location: RefractionPanel.jsx or RefractionTab.jsx

Buttons:
- "Nouvelle réfraction pré-remplie" → Load previous exam data
- "Nouvelle réfraction vide" → Clear all fields
```

#### Task 2.2: Add "Renouvellement pathologie précédente" button
```
Location: DiagnosticPanel.jsx or PathologyTab.jsx

Button:
- "Renouvellement de la pathologie précédente" → Load previous diagnoses
```

### Phase 3: Contact Lenses Integration (MEDIUM PRIORITY)

#### Task 3.1: Create LentillesTab Component
```
File: frontend/src/components/consultation/tabs/LentillesTab.jsx

Features:
- Dual column: Lentille droite | Lentille gauche
- Import from refraction
- Brand selection
- Care instructions
- Integrate existing ContactLensFitting component
```

### Phase 4: French Healthcare Specifics (MEDIUM PRIORITY)

#### Task 4.1: Add ALD/CMU/Dossier Papier Checkboxes
```
Location: Patient header or Règlement tab

Fields:
- ALD (Affection Longue Durée) checkbox
- CMU (Couverture Maladie Universelle) checkbox
- Dossier Papier checkbox
```

### Phase 5: Enhanced Kératométrie (MEDIUM PRIORITY)

#### Task 5.1: Create dedicated Kératométrie section
```
Location: Within RefractionPanel or as separate component

Fields (matching oph2):
- ROD / ROG (rayon de courbure)
- Axes
- "Rédiger la kératométrie" button
```

---

## Part 4: File Changes Required

### New Files to Create

```
frontend/src/components/consultation/
├── StudioVisionTabNavigation.jsx        # Tab bar component
├── tabs/
│   ├── ResumeTab.jsx                    # Color-coded summary (oph1)
│   ├── RefractionTab.jsx                # Refraction with keratometry (oph2)
│   ├── LentillesTab.jsx                 # Contact lenses (oph3)
│   ├── PathologiesTab.jsx               # Diagnosis (oph4)
│   ├── TraitementTab.jsx                # Treatment (oph5)
│   ├── ExamenTab.jsx                    # Clinical exam
│   └── ReglementTab.jsx                 # Payment/billing
├── RenouvellementButtons.jsx            # Copy previous data buttons
└── HealthcareCheckboxes.jsx             # ALD/CMU/Dossier Papier
```

### Files to Modify

```
frontend/src/pages/ophthalmology/
├── NewConsultation.jsx                  # Add StudioVision tab mode option
├── components/panels/
│   ├── RefractionPanel.jsx              # Add renouvellement buttons
│   ├── DiagnosticPanel.jsx              # Add renouvellement buttons
│   └── ConsultationDashboard/
│       └── ConsultationDashboard.jsx    # Optional: integrate tab navigation
```

---

## Part 5: Implementation Order

### Week 1: Foundation
1. ✅ Create StudioVisionTabNavigation component
2. ✅ Create ResumeTab with color-coded sections
3. ✅ Wire up tab routing in consultation

### Week 2: Core Modules
4. Create RefractionTab with keratometry section
5. Add renouvellement buttons to refraction
6. Create LentillesTab with dual columns

### Week 3: Diagnostic & Treatment
7. Create PathologiesTab with renouvellement button
8. Verify TraitementTab has all features
9. Add ALD/CMU checkboxes

### Week 4: Polish
10. Create ReglementTab (payment integration)
11. Add keyboard shortcuts
12. Testing and bug fixes

---

## Part 6: Workflow Optimization Decision

### Option A: Replace Current Dashboard
Transform ConsultationDashboard from collapsible modules → tab navigation

**Pros:** Single codebase, less confusion
**Cons:** Major refactor, risk of breaking existing flows

### Option B: Add New "StudioVision Full" Mode
Keep existing dashboard, add new `/consultation/studio/:patientId` route

**Pros:** Non-breaking, users can choose
**Cons:** Two codebases to maintain

### Option C: Enhance Existing Dashboard (RECOMMENDED)
Add tab navigation INSIDE the existing dashboard as an alternative view mode

**Pros:** Reuses existing components, toggle between views
**Cons:** More complex state management

---

## Implementation Completed ✅

### Created Files:
1. **`frontend/src/components/consultation/StudioVisionTabNavigation.jsx`**
   - Tab navigation with 8 tabs (Résumé, Réfraction, Lentilles, Pathologies, Orthoptie, Examen, Traitement, Règlement)
   - Keyboard navigation (arrow keys, number keys 1-8)
   - Color-coded active states
   - Unsaved changes indicators

2. **`frontend/src/components/consultation/tabs/ResumeTab.jsx`**
   - Color-coded summary sections (Pink=Réfraction, Green=Tonométrie, Yellow=Pathologies, Blue=Traitement)
   - Patient demographics panel (left)
   - Consultation history table (right)
   - ALD/CMU/Dossier Papier checkboxes
   - French formatting with date-fns/fr locale

3. **`frontend/src/components/consultation/RenouvellementButtons.jsx`**
   - `RefractionRenouvellementButtons`: "Nouvelle réfraction pré-remplie" / "vide" + device send
   - `PathologyRenouvellementButton`: "Renouvellement de la pathologie précédente"
   - `PrescriptionRenouvellementButton`: Wrapper for treatment renewal
   - `GlassesRenouvellementButtons`: All glasses prescription options
   - `RenouvellementActionsBar`: Combined horizontal bar

4. **`frontend/src/pages/ophthalmology/StudioVisionConsultation.jsx`**
   - Complete tab-based consultation page
   - Integrates all StudioVision components
   - Keyboard shortcuts (Ctrl+S to save, Escape to cancel)
   - Auto-save functionality
   - Patient header with age badge
   - Save/Print/Complete actions

5. **`frontend/src/components/consultation/index.js`**
   - Exports all consultation components

### Route Added:
- `/ophthalmology/studio/:patientId` - StudioVision native consultation

### Access the New Consultation:
Navigate to `/ophthalmology/studio/[PATIENT_ID]` to use the new tab-based interface.

## Still Pending

1. **Orthoptie Tab** - Placeholder added, needs integration with orthoptic components
2. **Règlement Tab** - Links to invoicing module, could add inline billing
3. **Device Integration** - "Envoyer au réfracteur" needs device connection
4. **Print Optimization** - CSS print styles for consultation summary

## Immediate Next Steps

1. **Test with real workflow** - Verify improvement
2. **Add link from patient detail** - Quick access to StudioVision consultation
3. **Polish UI details** - Match exact StudioVision XP styling

---

## Success Criteria

- [ ] Tab navigation matches StudioVision XP tabs
- [ ] Résumé shows color-coded sections (pink/green/yellow/blue)
- [ ] "Nouvelle réfraction pré-remplie" button works
- [ ] "Renouvellement pathologie" button works
- [ ] Contact lenses accessible in tab flow
- [ ] Single clear entry point for consultations
- [ ] Workflow takes <5 clicks from patient search to entering data
