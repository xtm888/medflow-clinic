# StudioVision Components Integration Plan

## Executive Summary

This document details the integration strategy for merging 7 StudioVision layout components (~5,357 lines) into MedFlow's ophthalmology consultation workflow while preserving all existing functionality and maintaining the same design principles.

## Current Consultation Architecture

### Flow Types
1. **Stepped Workflow** (`NewConsultation.jsx`) - 14 sequential steps
2. **Consolidated Dashboard** (`ConsultationDashboard.jsx`) - Single-page with collapsible modules
3. **Quick Follow-up** - Simplified 5-step workflow
4. **Refraction Only** - Focused 5-step workflow

### Current Step Components
| Step ID | Component | Current Lines | StudioVision Enhancement |
|---------|-----------|---------------|--------------------------|
| complaint | ChiefComplaintStep | ~150 | Minor - Add template support |
| vitals | VitalSignsStep | ~200 | None needed |
| visual_acuity | VisualAcuityStep | ~300 | **Replace with RefractionGrid** |
| objective_refraction | ObjectiveRefractionStep | ~250 | **Merge into RefractionGrid** |
| subjective_refraction | SubjectiveRefractionStep | ~300 | **Merge into RefractionGrid** |
| additional_tests | AdditionalTestsStep | ~200 | Add to RefractionQuickActions |
| keratometry | KeratometryStep | ~200 | **Merge into RefractionGrid** |
| examination | OphthalmologyExamStep | ~500 | Add DRStagingSelector |
| diagnosis | DiagnosisStep | ~400 | **Replace with PathologyPicker** |
| prescription | PrescriptionStep | ~600 | **Already has TreatmentBuilder** |
| summary | SummaryStep | ~760 | Enhance with ColumnLayout |

---

## Integration Strategy: "StudioVision Mode Toggle"

### Core Principle
Provide a **global toggle** between "Standard Mode" (current UI) and "StudioVision Mode" (multi-column layouts) at the consultation level. This:
- Preserves all existing functionality for users who prefer it
- Allows gradual adoption of new UI
- Makes testing and rollback simple
- Already partially implemented in MedicationPrescriptionTab

### Implementation Pattern
```jsx
// ConsultationDashboard.jsx
const [viewMode, setViewMode] = useState('standard'); // 'standard' | 'studiovision'

// Render different components based on mode
{viewMode === 'studiovision' ? (
  <StudioVisionRefractionGrid ... />
) : (
  <RefractionPanel ... />
)}
```

---

## Component-by-Component Integration

### 1. StudioVisionRefractionGrid (611 lines)
**Target:** Replace 4 separate refraction steps with unified 2-column OD/OG grid

**Current State:**
- RefractionPanel.jsx (857 lines) already has 3-column layout
- 4 separate workflow steps: visual_acuity, objective_refraction, subjective_refraction, keratometry

**Integration Point:** `ConsultationDashboard → RefractionPanel`

**Changes Required:**
```jsx
// In ConsultationDashboard/components/index.js
import StudioVisionRefractionGrid from '../../../../../components/refraction/StudioVisionRefractionGrid';

// Replace RefractionPanel with toggle
{viewMode === 'studiovision' ? (
  <StudioVisionRefractionGrid
    data={data.refraction}
    onChange={(refraction) => updateSection('refraction', refraction)}
    patient={patient}
  />
) : (
  <RefractionPanel
    data={data.refraction}
    onChange={(refraction) => updateSection('refraction', refraction)}
    patient={patient}
  />
)}
```

**Data Mapping:**
| StudioVisionRefractionGrid Field | Current RefractionPanel Field |
|----------------------------------|-------------------------------|
| visualAcuity.OD/OS | visualAcuity.OD/OS |
| autorefraction.OD/OS | objective.OD/OS |
| subjectiveRefraction.OD/OS | subjective.OD/OS |
| keratometry.OD/OS | keratometry.OD/OS |
| pupillaryDistance | subjective.pd |

**Preserved Features:**
- Monoyer/Snellen toggle (add to StudioVisionRefractionGrid)
- Previous exam loading (Alt+P shortcut)
- Copy OD→OS (Ctrl+D shortcut)
- Transposition calculator
- Spherical equivalent calculation

---

### 2. PathologyPicker (1,233 lines)
**Target:** Replace DiagnosisStep with 3-column category→pathology→selection picker

**Current State:**
- DiagnosticPanel.jsx (726 lines) has tabs: Diagnosis | Procedures | Surgery | Laboratory
- Uses quick diagnosis chips + searchable list

**Integration Point:** `ConsultationDashboard → DiagnosticPanel → Diagnosis tab`

**Changes Required:**
```jsx
// In DiagnosticPanel.jsx
import PathologyPicker from '../../../components/pathology/PathologyPicker';

// Add view mode toggle at panel level
const [diagnosisViewMode, setDiagnosisViewMode] = useState('standard');

// In diagnosis tab content:
{activeTab === 'diagnosis' && (
  diagnosisViewMode === 'studiovision' ? (
    <PathologyPicker
      selectedPathologies={diagnosticData.diagnoses}
      onChange={(diagnoses) => {
        const newData = { ...diagnosticData, diagnoses };
        onChange?.(newData);
      }}
      showLaterality={true}
      categories={OPHTHALMOLOGY_PATHOLOGY_CATEGORIES}
    />
  ) : (
    // Current implementation
  )
)}
```

**Category Mapping:**
PathologyPicker's 19 categories map to common ophthalmology diagnoses:
| PathologyPicker Category | ICD-10 Codes |
|--------------------------|--------------|
| REFRACTION | H52.0-H52.4 (Myopie, Hypermétropie, Astigmatisme, Presbytie) |
| CORNEA | H16.x, H18.x (Kératite, Dystrophies) |
| CATARACT | H25.x, H26.x (Sénile, Nucléaire, Corticale) |
| GLAUCOMA | H40.x (POAG, Angle closure, Congénital) |
| RETINA | H35.x (DMLA, Rétinopathie) |
| DIABETIC_RETINOPATHY | E11.3x (with DRStagingSelector) |
| STRABISMUS | H50.x (Convergent, Divergent) |
| PEDIATRIC | H53.x (Amblyopie) |
| EXTERNAL | H10.x, H04.x (Conjonctivite, Sécheresse) |

**Preserved Features:**
- Quick diagnosis chips (keep above PathologyPicker)
- ICD-10 code display
- Primary diagnosis toggle
- Laterality selection (OD/OS/OU)
- Approval warnings integration

---

### 3. DRStagingSelector (556 lines)
**Target:** Add specialized ETDRS staging to examination step for diabetic patients

**Current State:**
- ExaminationPanel.jsx handles fundus examination
- No structured DR staging

**Integration Point:** `ConsultationDashboard → ExaminationPanel → Fundus section`

**Conditional Display Logic:**
```jsx
// Show DRStagingSelector when:
// 1. Patient has diabetes diagnosis (E10.x, E11.x, E13.x)
// 2. Diabetic retinopathy is selected as diagnosis
// 3. Manual trigger from fundus exam dropdown

const showDRStaging = useMemo(() => {
  const hasDiabetes = patient?.diagnoses?.some(d =>
    d.code?.startsWith('E10') ||
    d.code?.startsWith('E11') ||
    d.code?.startsWith('E13')
  );
  const hasDRDiagnosis = diagnosticData.diagnoses?.some(d =>
    d.code?.startsWith('E11.3') || d.code?.startsWith('H35.0')
  );
  return hasDiabetes || hasDRDiagnosis || data.examination?.fundus?.showDRStaging;
}, [patient, diagnosticData, data.examination]);

// In ExaminationPanel fundus section:
{showDRStaging && (
  <DRStagingSelector
    value={{
      OD: data.examination?.fundus?.OD?.drStaging,
      OS: data.examination?.fundus?.OS?.drStaging
    }}
    onChange={(staging) => {
      updateSection('examination', {
        ...data.examination,
        fundus: {
          ...data.examination?.fundus,
          OD: { ...data.examination?.fundus?.OD, drStaging: staging.OD },
          OS: { ...data.examination?.fundus?.OS, drStaging: staging.OS }
        }
      });
    }}
  />
)}
```

**Staging Categories:**
- **Retinopathy (R):** R0-R5 (Absence → Proliférante compliquée)
- **Maculopathy (M):** M0-M2 (Absence → OMD diffus)

**Preserved Features:**
- Existing fundus examination fields
- Notes and drawing capabilities
- OCT/Angiography linking

---

### 4. TreatmentBuilder (1,580 lines)
**Status:** Already integrated in MedicationPrescriptionTab.jsx

**Current Integration:**
```jsx
// MedicationPrescriptionTab.jsx line 228-247
{viewMode === 'studiovision' && (
  <div className="border-2 border-purple-200 rounded-lg overflow-hidden mb-4">
    <TreatmentBuilder
      value={{
        medications: medicationList.map(med => ({...})),
        activeTab: 0,
        prescriptionType: 'OPHTHALMIQUE'
      }}
      onChange={handleTreatmentBuilderChange}
      height={500}
    />
  </div>
)}
```

**Enhancements Needed:**
1. Wire up 50+ treatment protocols to backend TreatmentProtocol collection
2. Add protocol favorites system
3. Connect tapering schedules to prescription model
4. Add protocol suggestions based on selected diagnoses

**Backend Integration:**
```javascript
// treatmentProtocolService.js
export const getProtocolsByDiagnosis = async (diagnosisCodes) => {
  const protocols = await api.get('/treatment-protocols', {
    params: { diagnosisCodes: diagnosisCodes.join(',') }
  });
  return protocols.data;
};
```

---

### 5. RefractionQuickActions (517 lines)
**Target:** Add quick actions sidebar to refraction module

**Integration Point:** `ConsultationDashboard → Floating sidebar or RefractionPanel header`

**Implementation Options:**

**Option A: Floating Sidebar (Recommended)**
```jsx
// In ConsultationDashboard.jsx
const [showQuickActions, setShowQuickActions] = useState(true);

<div className="flex">
  <div className="flex-1">
    {/* Main content */}
    <CollapsibleModuleWrapper title="Module Réfraction" ...>
      {viewMode === 'studiovision' ? (
        <StudioVisionRefractionGrid ... />
      ) : (
        <RefractionPanel ... />
      )}
    </CollapsibleModuleWrapper>
  </div>

  {showQuickActions && (
    <div className="w-64 ml-4 sticky top-20">
      <RefractionQuickActions
        patientId={patient?._id}
        onLoadPreviousExam={(exam) => {
          updateSection('refraction', exam.refraction);
        }}
        onPrint={() => handlePrint()}
        onSendToDevice={(deviceId) => sendToDevice(deviceId)}
        onCopyToClipboard={() => copyRefractionToClipboard()}
      />
    </div>
  )}
</div>
```

**Option B: Integrated into Module Header**
```jsx
// Add actions to CollapsibleModuleWrapper header
<CollapsibleModuleWrapper
  title="Module Réfraction"
  icon={Glasses}
  quickActions={[
    { icon: History, label: 'Précédent', onClick: loadPreviousExam },
    { icon: Printer, label: 'Imprimer', onClick: handlePrint },
    { icon: Send, label: 'Appareil', onClick: sendToDevice }
  ]}
>
```

---

### 6. ColumnLayout (463 lines)
**Target:** Foundation component for all multi-column UIs

**Integration:** Wrap all StudioVision components with consistent layout

**Usage Pattern:**
```jsx
import { ColumnLayout, Column, SubColumns, SectionHeader } from '../layout/ColumnLayout';

<ColumnLayout columns={3} responsive={true}>
  <Column variant="category" title="Catégories">
    {/* Category list */}
  </Column>
  <Column variant="selection" title="Sélection">
    <SubColumns split="2">
      {/* Sub-content */}
    </SubColumns>
  </Column>
  <Column variant="summary" title="Résumé">
    {/* Summary content */}
  </Column>
</ColumnLayout>
```

**Responsive Behavior:**
- Desktop (>1024px): Full multi-column layout
- Tablet (768-1024px): Stacked columns or 2-column
- Mobile (<768px): Tabbed interface

---

### 7. designTokens.js (397 lines)
**Target:** Centralized design system for consistent styling

**Integration:** Import and use throughout all components

**Key Token Usage:**
```jsx
import { colors, spacing, typography, columnLayouts } from '../styles/designTokens';

// Column backgrounds
const columnStyles = {
  category: { backgroundColor: colors.studio.category },   // Purple
  selection: { backgroundColor: colors.studio.selection }, // Yellow
  summary: { backgroundColor: colors.studio.summary }      // Gray
};

// Medical laterality colors
const eyeStyles = {
  OD: { borderColor: colors.medical.od },  // Blue (#3B82F6)
  OS: { borderColor: colors.medical.os },  // Green (#10B981)
  OU: { borderColor: colors.medical.ou }   // Purple (#8B5CF6)
};
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create global view mode context (`StudioVisionModeContext`)
- [ ] Add view mode toggle to ConsultationDashboard header
- [ ] Integrate designTokens.js across existing components
- [ ] Add ColumnLayout as optional wrapper for existing panels

### Phase 2: Refraction Module (Week 2)
- [ ] Integrate StudioVisionRefractionGrid with data mapping
- [ ] Add RefractionQuickActions sidebar
- [ ] Preserve Monoyer/Snellen toggle
- [ ] Preserve keyboard shortcuts (Ctrl+D, Alt+P)
- [ ] Test data persistence across mode switches

### Phase 3: Diagnostic Module (Week 3)
- [ ] Integrate PathologyPicker for diagnosis step
- [ ] Add DRStagingSelector to examination step
- [ ] Wire PathologyPicker categories to ICD-10 codes
- [ ] Maintain approval warnings integration
- [ ] Test laterality handling

### Phase 4: Prescription Module (Week 4)
- [ ] Enhance TreatmentBuilder with backend protocols
- [ ] Connect treatment protocols to diagnosis suggestions
- [ ] Add protocol favorites system
- [ ] Wire tapering schedules to prescription model

### Phase 5: Polish & Testing (Week 5)
- [ ] Responsive behavior testing on all screen sizes
- [ ] Mode persistence in user preferences
- [ ] Performance optimization (lazy loading)
- [ ] A/B testing framework setup

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ConsultationDashboard                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                 StudioVisionModeContext                        │  │
│  │  viewMode: 'standard' | 'studiovision'                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│     ┌────────────────────────┼────────────────────────┐             │
│     ▼                        ▼                        ▼             │
│  ┌─────────┐          ┌─────────────┐          ┌───────────┐        │
│  │Refraction│          │ Diagnostic  │          │Prescription│       │
│  │  Panel   │          │   Panel     │          │   Panel   │        │
│  └────┬────┘          └──────┬──────┘          └─────┬─────┘        │
│       │                      │                       │               │
│   viewMode?              viewMode?               viewMode?           │
│       │                      │                       │               │
│  ┌────┴────┐            ┌────┴────┐            ┌────┴────┐          │
│  │standard │studiovision│standard │studiovision│standard │studiovision
│  ▼         ▼            ▼         ▼            ▼         ▼          │
│ Refraction  StudioVision DiagPanel PathologyPck Medication Treatment│
│  Panel      RefractionGrd          + DRStaging  Template  Builder   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Changes Summary

### New Files to Create
1. `frontend/src/contexts/StudioVisionModeContext.jsx` - Global view mode context
2. `frontend/src/hooks/useStudioVisionMode.js` - Hook for accessing/setting mode

### Files to Modify
| File | Changes |
|------|---------|
| ConsultationDashboard.jsx | Add mode toggle, conditional rendering |
| RefractionPanel.jsx | Add StudioVisionRefractionGrid alternative |
| DiagnosticPanel.jsx | Add PathologyPicker alternative |
| ExaminationPanel.jsx | Add DRStagingSelector for diabetic patients |
| MedicationPrescriptionTab.jsx | Enhance TreatmentBuilder integration |
| SummaryStep.jsx | Add ColumnLayout wrapper |

### Files Already Complete
- `TreatmentBuilder.jsx` - Already integrated with mode toggle
- `PathologyPicker.jsx` - Ready to use
- `DRStagingSelector.jsx` - Ready to use
- `StudioVisionRefractionGrid.jsx` - Ready to use
- `RefractionQuickActions.jsx` - Ready to use
- `ColumnLayout.jsx` - Ready to use
- `designTokens.js` - Ready to use

---

## Migration Strategy: Zero Downtime

### User Preference Storage
```javascript
// userPreferencesService.js
const PREFERENCES_KEY = 'medflow_user_preferences';

export const getUserViewMode = () => {
  const prefs = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}');
  return prefs.consultationViewMode || 'standard';
};

export const setUserViewMode = (mode) => {
  const prefs = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}');
  prefs.consultationViewMode = mode;
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
};
```

### Rollback Strategy
1. View mode stored in localStorage per user
2. Default to 'standard' for all users
3. Admin can set default mode per clinic
4. Feature flag for global enable/disable

---

## Testing Checklist

### Functional Testing
- [ ] All refraction data persists when switching modes
- [ ] All diagnoses persist when switching modes
- [ ] All prescriptions persist when switching modes
- [ ] Keyboard shortcuts work in both modes
- [ ] Print/export functions work in both modes

### UI/UX Testing
- [ ] Responsive layout on desktop (1920x1080)
- [ ] Responsive layout on laptop (1366x768)
- [ ] Responsive layout on tablet (1024x768)
- [ ] Responsive layout on mobile (375x812)
- [ ] Color contrast meets WCAG 2.1 AA

### Performance Testing
- [ ] Initial load time < 2s
- [ ] Mode switch time < 500ms
- [ ] No memory leaks on repeated mode switches
- [ ] Lazy loading works for inactive modes

---

## Success Metrics

1. **User Adoption:** 50%+ users try StudioVision mode within 2 weeks
2. **Retention:** 30%+ users stick with StudioVision mode after 1 month
3. **Efficiency:** 20% reduction in consultation completion time
4. **Errors:** No increase in data entry errors
5. **Satisfaction:** NPS score improvement of 10+ points
