# StudioVision Pending Features Design

Date: 2025-12-18

## Overview

This document specifies the implementation of three pending StudioVision features:
1. Orthoptie tab integration (simplified panel)
2. Device integration refinements (auto-import, real-time sync, additional devices)
3. Quick-action buttons (OD→OG, import last visit, print shortcuts, quick diagnosis, timer)

## 1. Orthoptie Tab Panel

### Component: `OrthoptieQuickPanel.jsx`

**Location**: `frontend/src/components/consultation/OrthoptieQuickPanel.jsx`

**Purpose**: Simplified orthoptic assessment panel for StudioVision consultation tab

**Tests Included**:
- Cover Test (distance + near)
- Near Point of Convergence (PPC)
- Stereopsis (Wirt + Lang tests)

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ 🟣 ORTHOPTIE                          [Bilan complet →]    │
├─────────────────────────────────────────────────────────────┤
│  ┌─ COVER TEST ──────────────┐  ┌─ PPC ─────────────────┐  │
│  │ Distance:  [____] [Ortho▼]│  │ Rupture:  [__] cm     │  │
│  │ Près:      [____] [Ortho▼]│  │ Récupér.: [__] cm     │  │
│  │ Mesure:    [____] Δ       │  │ Qualité:  [Bon ▼]     │  │
│  └───────────────────────────┘  └───────────────────────┘  │
│  ┌─ STÉRÉOSCOPIE ───────────────────────────────────────┐  │
│  │ Wirt: [✓]Mouche [✓]Animaux  Cercles: [40▼] → 40"arc  │  │
│  │ Lang: [✓]Chat [✓]Étoile [✓]Voiture  → 550"arc        │  │
│  └──────────────────────────────────────────────────────┘  │
│  Conclusion: [Phorie compensée ▼]  Notes: [___________]    │
└─────────────────────────────────────────────────────────────┘
```

**Data Model**: Links to OrthopticExam collection via visit reference

**Props**:
```typescript
interface OrthoptieQuickPanelProps {
  patientId: string;
  visitId?: string;
  value: OrthoptieData;
  onChange: (data: OrthoptieData) => void;
  onOpenFullExam: () => void;
}
```

## 2. Device Integration Enhancements

### A. Auto-Import Hook: `useDeviceSync.js`

**Location**: `frontend/src/hooks/useDeviceSync.js`

**Features**:
- Auto-detect available measurements on consultation start
- WebSocket subscription for real-time device updates
- Filter by patientId and clinic
- Toast notifications for new measurements

**API**:
```javascript
const {
  measurements,        // Available device measurements
  loading,            // Loading state
  hasNewMeasurements, // Boolean flag for new data
  importMeasurement,  // Function to import single measurement
  importAll,          // Function to import all measurements
  dismiss,            // Dismiss notification
} = useDeviceSync(patientId, clinicId);
```

### B. Inline Device Display Component

**Location**: `frontend/src/components/consultation/DeviceDataBanner.jsx`

**Features**:
- Dismissible banner above refraction grid
- Shows available device data with timestamps
- One-click "Apply" to fill form fields
- Visual diff when device data differs from manual entry

### C. Additional Device Types

| Device | Measurement Type | Data Fields | Target Tab |
|--------|-----------------|-------------|------------|
| OCT | oct | thickness, rnfl, gccAnalysis | Examen |
| Périmètre | perimeter | visualField, mdValue, psdValue | Examen |
| Pachymètre | pachymeter | centralThickness, thinnestPoint | Réfraction |
| Topographe | topographer | simK, eccentricity, irregularity | Lentilles |

## 3. Quick-Action Buttons

### Component: `QuickActionsBar.jsx`

**Location**: `frontend/src/components/consultation/QuickActionsBar.jsx`

**Buttons**:

| Button | Label | Action | Shortcut |
|--------|-------|--------|----------|
| copyODtoOG | OD→OG | Mirror refraction values (axis ±90°) | Ctrl+M |
| importLastVisit | Dernière visite | Load all data from previous visit | Ctrl+L |
| print | Imprimer | Dropdown with print options | Ctrl+P |
| quickDiagnosis | Diag rapide | Dropdown with common diagnoses | Ctrl+D |
| timer | Timer | Consultation duration tracker | Click |

**Print Options**:
- Ordonnance verres
- Ordonnance médicaments
- Certificat médical
- Fiche patient
- Résumé consultation

**Quick Diagnosis Options**:
- Réfraction: Myopie, Hypermétropie, Astigmatisme, Presbytie
- Pathologies: Cataracte, Glaucome, DMLA, Conjonctivite

**Timer Feature**:
- Auto-starts when consultation opens
- Displays elapsed time (MM:SS format)
- Click to pause/resume
- Stores duration in visit record

## Integration Points

### StudioVisionConsultation.jsx Changes

1. Import new components
2. Add QuickActionsBar below patient header
3. Replace Orthoptie placeholder with OrthoptieQuickPanel
4. Add useDeviceSync hook
5. Add DeviceDataBanner to Réfraction tab
6. Register keyboard shortcuts

### File Changes Summary

**New Files**:
- `frontend/src/components/consultation/OrthoptieQuickPanel.jsx`
- `frontend/src/components/consultation/QuickActionsBar.jsx`
- `frontend/src/components/consultation/DeviceDataBanner.jsx`
- `frontend/src/hooks/useDeviceSync.js`

**Modified Files**:
- `frontend/src/pages/ophthalmology/StudioVisionConsultation.jsx`
- `frontend/src/components/consultation/StudioVisionTabNavigation.jsx` (if needed)

## Success Criteria

1. Orthoptie tab shows functional Cover Test, PPC, and Stereopsis inputs
2. "Bilan complet" button navigates to full OrthopticExamForm
3. Device measurements auto-detected on consultation start
4. Real-time WebSocket updates show new measurements
5. All quick-action buttons functional with keyboard shortcuts
6. Timer tracks consultation duration
7. Print dropdown generates correct documents
8. Quick diagnosis adds ICD-10 coded diagnoses
