# MedFlow Frontend Components Library

## Overview

MedFlow's frontend includes 80+ reusable components organized into functional categories. Components follow consistent patterns for styling, accessibility, and user interaction.

---

## Component Categories

| Category | Count | Purpose |
|----------|-------|---------|
| Layout & Containers | 8 | Page structure, sections |
| Biometric | 4 | Face recognition, photos |
| Documents | 5 | Document generation, viewing |
| Dashboard | 3 | Dashboard widgets |
| Panels | 5 | Information panels |
| Clinical | 6 | Clinical workflow |
| Templates | 4 | Template selectors |
| Pharmacy | 3 | Pharmacy operations |
| Laboratory | 1 | Lab operations |
| Settings | 4 | Configuration |
| Imaging | 1 | Image viewing |
| Forms & Inputs | 10 | Form controls |
| Modals & Dialogs | 6 | Modal dialogs |
| Navigation | 5 | Navigation components |
| Status & Feedback | 8 | Status indicators |
| Security | 4 | Permission controls |

---

## Layout Components

### CollapsibleSection

Reusable collapsible container for dashboard sections:

```jsx
import CollapsibleSection from '@components/CollapsibleSection';

<CollapsibleSection
  title="Patient Information"
  icon={User}
  iconColor="text-blue-600"
  gradient="from-blue-50 to-indigo-50"
  defaultExpanded={true}
  badge={<Badge count={5} />}
  headerExtra={<span>Last visit: Today</span>}
  actions={<Button>Edit</Button>}
  loading={false}
  onExpand={() => fetchData()}
>
  {/* Section content */}
</CollapsibleSection>
```

**Props:**
| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | string | required | Section title |
| `icon` | Component | - | Lucide icon |
| `iconColor` | string | `text-blue-600` | Tailwind color class |
| `gradient` | string | `from-gray-50 to-slate-50` | Header gradient |
| `defaultExpanded` | boolean | `true` | Initial state |
| `badge` | ReactNode | - | Header badge |
| `headerExtra` | ReactNode | - | Extra header content |
| `actions` | ReactNode | - | Action buttons |
| `loading` | boolean | `false` | Show loading state |
| `onExpand` | function | - | Called on expand (lazy loading) |

### CollapsibleSectionGroup

Container for multiple collapsible sections:

```jsx
<CollapsibleSectionGroup>
  <CollapsibleSection title="Section 1" />
  <CollapsibleSection title="Section 2" />
</CollapsibleSectionGroup>
```

### SectionStat / SectionEmptyState / SectionActionButton

Helper components for section content:

```jsx
// Quick stat in header
<SectionStat label="Total" value="42" color="text-green-600" />

// Empty state
<SectionEmptyState
  icon={FileText}
  message="Aucun document"
  action={<Button>Créer</Button>}
/>

// Action button
<SectionActionButton
  icon={Plus}
  variant="primary"
  size="sm"
  onClick={handleClick}
>
  Ajouter
</SectionActionButton>
```

---

## Security Components

### PermissionGate

Conditionally renders children based on user permissions:

```jsx
import PermissionGate from '@components/PermissionGate';

// Permission-based
<PermissionGate permission="manage_patients">
  <EditButton />
</PermissionGate>

// Role-based
<PermissionGate roles={['admin', 'doctor']}>
  <SensitiveData />
</PermissionGate>

// Menu item access
<PermissionGate menuItem="finance" fallback={<UpgradePrompt />}>
  <FinancialReport />
</PermissionGate>
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `permission` | string | Required permission |
| `roles` | string[] | Allowed roles |
| `menuItem` | string | Menu item key |
| `fallback` | ReactNode | Shown when denied |
| `children` | ReactNode | Content to protect |

### withPermission HOC

Higher-order component for permission-based rendering:

```jsx
import { withPermission } from '@components/PermissionGate';

const ProtectedComponent = withPermission(MyComponent, {
  permission: 'manage_patients'
});
```

### RoleGuard

Route-level access control:

```jsx
<RoleGuard allowedRoles={['admin', 'manager']}>
  <AdminPage />
</RoleGuard>
```

### ProtectedRoute

Router wrapper for authenticated routes:

```jsx
<Route element={<ProtectedRoute />}>
  <Route path="/dashboard" element={<Dashboard />} />
</Route>
```

---

## Biometric Components

### FaceVerification

Verifies patient identity via webcam:

```jsx
import { FaceVerification } from '@components/biometric';

<FaceVerification
  patient={patient}        // Patient with photoUrl
  onVerified={() => {}}    // Success callback
  onSkip={() => {}}        // Admin skip callback
  onCancel={() => {}}      // Cancel callback
  allowSkip={false}        // Admin-only skip
/>
```

**Flow:**
1. Initialize webcam
2. Capture face image
3. Call `/api/face-recognition/verify`
4. Compare with patient's registered photo
5. Call onVerified on match

### PatientPhotoAvatar

Displays patient photo with fallback:

```jsx
import { PatientPhotoAvatar } from '@components/biometric';

<PatientPhotoAvatar
  patient={patient}
  size="lg"                // sm, md, lg, xl
  showBiometricBadge={true}
  onClick={handleClick}
/>
```

### WebcamCapture

Generic webcam capture component:

```jsx
import { WebcamCapture } from '@components/biometric';

<WebcamCapture
  onCapture={(imageBlob) => {}}
  width={640}
  height={480}
  facingMode="user"
/>
```

### FacialDuplicateCheck

Checks for duplicate patients by face:

```jsx
import { FacialDuplicateCheck } from '@components/biometric';

<FacialDuplicateCheck
  faceData={capturedFace}
  onDuplicateFound={(matches) => {}}
  onNoDuplicate={() => {}}
/>
```

---

## Document Components

### DocumentGenerator

Modal for generating documents from templates:

```jsx
import DocumentGenerator from '@components/documents/DocumentGenerator';

<DocumentGenerator
  patientId={patientId}
  visitId={visitId}
  onClose={() => setOpen(false)}
  onDocumentGenerated={(doc) => {}}
/>
```

**Features:**
- Template category filtering
- Search templates
- Live preview
- Custom data fields
- Save to visit option
- Progress indicator

**Generation Steps:**
1. Prepare data
2. Generate document
3. Save
4. Complete

### DocumentViewer

Displays documents with actions:

```jsx
import DocumentViewer from '@components/documents/DocumentViewer';

<DocumentViewer
  document={document}
  onClose={() => {}}
  onPrint={() => {}}
  onDownload={() => {}}
/>
```

### DocumentManager

Full document management interface:

```jsx
import DocumentManager from '@components/documents/DocumentManager';

<DocumentManager
  patientId={patientId}
  visitId={visitId}
  onSelect={(doc) => {}}
/>
```

### AudioRecorder

Records audio for consultation notes:

```jsx
import AudioRecorder from '@components/documents/AudioRecorder';

<AudioRecorder
  onRecordingComplete={(audioBlob) => {}}
  maxDuration={300}  // 5 minutes
/>
```

---

## Dashboard Widgets

### TodayTasksWidget

Shows role-specific tasks for today:

```jsx
import TodayTasksWidget from '@components/dashboard/TodayTasksWidget';

<TodayTasksWidget
  userRole="doctor"
  tasks={tasks}
/>
```

### RecentPatientsWidget

Shows recently accessed patients:

```jsx
import RecentPatientsWidget from '@components/dashboard/RecentPatientsWidget';

<RecentPatientsWidget
  userRole="doctor"
  patients={recentPatients}
/>
```

### PendingActionsWidget

Shows items needing attention:

```jsx
import PendingActionsWidget from '@components/dashboard/PendingActionsWidget';

<PendingActionsWidget
  userRole="doctor"
  actions={pendingActions}
/>
```

---

## Panel Components

### ClinicalSummaryPanel

All-in-one clinical summary sidebar:

```jsx
import { ClinicalSummaryPanel } from '@components/panels';

<ClinicalSummaryPanel
  patient={patient}
  patientId={patientId}
  variant="sidebar"        // sidebar, modal, card
  onClose={() => {}}
  onNavigateToProfile={(id) => navigate(`/patients/${id}`)}
  showOphthalmology={true} // Show IOP/refraction
/>
```

**Displays:**
- Patient demographics
- Allergies & warnings
- Current medications
- Drug interactions
- Recent visits
- IOP history (ophthalmology)
- Lab results
- Vital signs trends

**Drug Interaction Database:**
```javascript
const DRUG_INTERACTIONS = {
  'warfarin': ['aspirin', 'ibuprofen', 'naproxen'],
  'timolol': ['verapamil', 'diltiazem', 'beta-blockers'],
  'latanoprost': ['nsaids', 'thimerosal'],
  // ... more interactions
};
```

### PatientMedicalSummary

Compact medical summary:

```jsx
import { PatientMedicalSummary } from '@components/panels';

<PatientMedicalSummary patient={patient} />
```

### PatientIOPHistory

IOP trend chart:

```jsx
import { PatientIOPHistory } from '@components/panels';

<PatientIOPHistory
  patientId={patientId}
  limit={20}
/>
```

### MedicationChecker

Drug interaction checker:

```jsx
import { MedicationChecker } from '@components/panels';

<MedicationChecker
  currentMedications={medications}
  newMedication="aspirin"
  onInteractionFound={(interactions) => {}}
/>
```

### PanelBase

Base components for building panels:

```jsx
import { Panel, SectionCard, StatBox, AlertBadge, MiniList, MiniSparkline, VIPBadge } from '@components/panels/PanelBase';

<Panel title="Summary" onClose={onClose}>
  <SectionCard title="Vitals">
    <StatBox label="BP" value="120/80" />
    <AlertBadge type="warning">High IOP</AlertBadge>
    <MiniSparkline data={iopData} />
  </SectionCard>
</Panel>
```

---

## Form Components

### NumberInputWithArrows

Numeric input with increment/decrement buttons:

```jsx
import NumberInputWithArrows from '@components/NumberInputWithArrows';

<NumberInputWithArrows
  value={value}
  onChange={setValue}
  min={0}
  max={100}
  step={0.25}
  precision={2}
  label="IOP"
  suffix="mmHg"
/>
```

### DateOfBirthInput

Smart date input with age calculation:

```jsx
import DateOfBirthInput from '@components/DateOfBirthInput';

<DateOfBirthInput
  value={dob}
  onChange={setDob}
  showAge={true}
/>
```

### PatientSelector

Patient search and selection:

```jsx
import { PatientSelector } from '@modules/patient';

// Dropdown mode
<PatientSelector
  mode="dropdown"
  value={patient}
  onChange={setPatient}
  showCreateButton={true}
  onCreateNew={() => navigate('/patients?new=true')}
/>

// Search mode (header bar)
<PatientSelector mode="search" className="w-full" />
```

### MedicationEntryForm

Complete medication entry with dosage:

```jsx
import MedicationEntryForm from '@components/MedicationEntryForm';

<MedicationEntryForm
  onAdd={(medication) => {}}
  onCancel={() => {}}
  suggestions={medicationList}
/>
```

### MedicationTemplateSelector

Select from pre-defined medication templates:

```jsx
import MedicationTemplateSelector from '@components/MedicationTemplateSelector';

<MedicationTemplateSelector
  category="ophthalmology"
  onSelect={(template) => {}}
/>
```

### PathologyQuickPick

Quick selection for pathology findings:

```jsx
import PathologyQuickPick from '@components/PathologyQuickPick';

<PathologyQuickPick
  category="anterior_segment"
  onSelect={(finding) => {}}
/>
```

### QuickTreatmentBuilder

Build treatment protocols quickly:

```jsx
import QuickTreatmentBuilder from '@components/QuickTreatmentBuilder';

<QuickTreatmentBuilder
  diagnosis="glaucoma"
  onBuild={(treatment) => {}}
/>
```

---

## Modal Components

### ConfirmationModal

Generic confirmation dialog:

```jsx
import ConfirmationModal from '@components/ConfirmationModal';

<ConfirmationModal
  isOpen={isOpen}
  title="Confirmer la suppression"
  message="Êtes-vous sûr de vouloir supprimer?"
  type="warning"          // info, warning, danger
  confirmText="Supprimer"
  cancelText="Annuler"
  onConfirm={handleDelete}
  onCancel={() => setIsOpen(false)}
/>
```

### AccessibleModal

Base modal with accessibility features:

```jsx
import AccessibleModal from '@components/AccessibleModal';

<AccessibleModal
  isOpen={isOpen}
  onClose={onClose}
  title="Modal Title"
  size="md"               // sm, md, lg, xl
  closeOnOverlay={true}
  closeOnEscape={true}
>
  {children}
</AccessibleModal>
```

### PrescriptionSafetyModal

Drug interaction warnings:

```jsx
import PrescriptionSafetyModal from '@components/PrescriptionSafetyModal';

<PrescriptionSafetyModal
  isOpen={hasInteractions}
  interactions={interactions}
  onConfirm={() => {}}
  onCancel={() => {}}
/>
```

### PrescriptionWarningModal

Prescription validation warnings:

```jsx
import PrescriptionWarningModal from '@components/PrescriptionWarningModal';

<PrescriptionWarningModal
  warnings={warnings}
  onProceed={() => {}}
  onCancel={() => {}}
/>
```

### PriorAuthorizationModal

Insurance prior auth workflow:

```jsx
import PriorAuthorizationModal from '@components/PriorAuthorizationModal';

<PriorAuthorizationModal
  patient={patient}
  service={service}
  onSubmit={(auth) => {}}
  onClose={() => {}}
/>
```

---

## Navigation Components

### GlobalSearch

Command palette / global search:

```jsx
import GlobalSearch from '@components/GlobalSearch';

<GlobalSearch
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
/>
```

**Features:**
- Patient search
- Appointment search
- Quick navigation actions
- Recent searches
- Keyboard navigation (↑↓ Enter)

**Quick Actions:**
- Dashboard
- Patients
- Queue
- Appointments
- Prescriptions

### NotificationBell

Notification dropdown in header:

```jsx
import NotificationBell from '@components/NotificationBell';

<NotificationBell />
```

### ClinicSelector

Multi-clinic selector:

```jsx
import ClinicSelector from '@components/ClinicSelector';

<ClinicSelector />
```

### KeyboardShortcutsHelp

Shortcuts help modal (F1 or ?):

```jsx
import KeyboardShortcutsHelp from '@components/KeyboardShortcutsHelp';

<KeyboardShortcutsHelp
  isOpen={showHelp}
  onClose={() => setShowHelp(false)}
/>
```

---

## Status Components

### LoadingSpinner

Loading indicator:

```jsx
import LoadingSpinner from '@components/LoadingSpinner';

<LoadingSpinner />
<LoadingSpinner size="lg" />
<LoadingSpinner message="Chargement..." />
```

### EmptyState

Empty state with call to action:

```jsx
import EmptyState from '@components/EmptyState';

<EmptyState
  icon={Users}
  title="Aucun patient"
  description="Commencez par ajouter un patient"
  actionLabel="Ajouter un patient"
  onAction={() => navigate('/patients?new=true')}
/>
```

### OfflineIndicator

Offline status in header:

```jsx
import OfflineIndicator from '@components/OfflineIndicator';

<OfflineIndicator />
```

### SyncStatusIndicator

Data sync status:

```jsx
import SyncStatusIndicator from '@components/SyncStatusIndicator';

<SyncStatusIndicator />
```

### AutoSaveIndicator

Auto-save status:

```jsx
import AutoSaveIndicator from '@components/AutoSaveIndicator';

<AutoSaveIndicator
  saving={isSaving}
  lastSaved={lastSaveTime}
/>
```

### SessionTimeoutWarning

Session expiry warning:

```jsx
import SessionTimeoutWarning from '@components/SessionTimeoutWarning';

<SessionTimeoutWarning />
```

### ApprovalWarningBanner

Prior authorization banner:

```jsx
import ApprovalWarningBanner from '@components/ApprovalWarningBanner';

<ApprovalWarningBanner
  patientId={patientId}
  service="surgery"
/>
```

### ProviderBadge

Provider/doctor badge:

```jsx
import ProviderBadge from '@components/ProviderBadge';

<ProviderBadge
  provider={provider}
  size="sm"
/>
```

---

## Financial Components

### MultiCurrencyPayment

Payment form with currency conversion:

```jsx
import MultiCurrencyPayment from '@components/MultiCurrencyPayment';

<MultiCurrencyPayment
  invoiceId={invoiceId}
  amountDue={50000}
  baseCurrency="CDF"
  onPaymentComplete={(result) => {}}
  onCancel={() => {}}
/>
```

**Supported Currencies:**
- CDF (Congolese Franc) - base
- USD (US Dollar)
- EUR (Euro)
- XAF (CFA Franc)

### CurrencyConverter

Currency conversion utility:

```jsx
import CurrencyConverter from '@components/CurrencyConverter';

<CurrencyConverter
  amount={100}
  fromCurrency="USD"
  toCurrency="CDF"
/>
```

---

## Device Integration Components

### DeviceImageSelector

Select images from device:

```jsx
import DeviceImageSelector from '@components/DeviceImageSelector';

<DeviceImageSelector
  deviceId={deviceId}
  patientId={patientId}
  onSelect={(images) => {}}
/>
```

### DeviceImageViewer

View device images:

```jsx
import DeviceImageViewer from '@components/DeviceImageViewer';

<DeviceImageViewer
  images={images}
  onClose={() => {}}
/>
```

### DeviceMeasurementSelector

Select measurements from device data:

```jsx
import DeviceMeasurementSelector from '@components/DeviceMeasurementSelector';

<DeviceMeasurementSelector
  deviceId={deviceId}
  measurementType="refraction"
  onSelect={(measurement) => {}}
/>
```

### NetworkShareBrowser

Browse SMB network shares:

```jsx
import NetworkShareBrowser from '@components/NetworkShareBrowser';

<NetworkShareBrowser
  devicePath="//192.168.1.100/Share"
  onSelect={(file) => {}}
/>
```

---

## Pharmacy Components

### DispenseDialog

Medication dispensing:

```jsx
import DispenseDialog from '@components/pharmacy/DispenseDialog';

<DispenseDialog
  prescription={prescription}
  medication={medication}
  onDispense={(result) => {}}
  onClose={() => {}}
/>
```

### BatchManager

Inventory batch management:

```jsx
import BatchManager from '@components/pharmacy/BatchManager';

<BatchManager
  medicationId={medicationId}
  onUpdate={() => {}}
/>
```

### ReorderPanel

Reorder suggestions:

```jsx
import ReorderPanel from '@components/pharmacy/ReorderPanel';

<ReorderPanel
  lowStockItems={items}
  onReorder={(items) => {}}
/>
```

---

## Laboratory Components

### SpecimenTracking

Specimen barcode tracking:

```jsx
import SpecimenTracking from '@components/laboratory/SpecimenTracking';

<SpecimenTracking
  visitId={visitId}
  onSpecimenRegistered={(specimen) => {}}
/>
```

---

## Template Components

### ExaminationSelector

Select examination templates:

```jsx
import ExaminationSelector from '@components/templates/ExaminationSelector';

<ExaminationSelector
  category="ophthalmology"
  onSelect={(template) => {}}
/>
```

### LaboratoryTestSelector

Select lab test templates:

```jsx
import LaboratoryTestSelector from '@components/templates/LaboratoryTestSelector';

<LaboratoryTestSelector
  onSelect={(tests) => {}}
/>
```

### MedicationAutocomplete

Medication search with autocomplete:

```jsx
import MedicationAutocomplete from '@components/templates/MedicationAutocomplete';

<MedicationAutocomplete
  value={medication}
  onChange={setMedication}
  category="eye_drops"
/>
```

### PathologyFindingSelector

Select pathology findings:

```jsx
import PathologyFindingSelector from '@components/templates/PathologyFindingSelector';

<PathologyFindingSelector
  category="retina"
  onSelect={(finding) => {}}
/>
```

---

## Imaging Components

### ImageComparisonViewer

Side-by-side image comparison:

```jsx
import ImageComparisonViewer from '@components/imaging/ImageComparisonViewer';

<ImageComparisonViewer
  leftImage={previousScan}
  rightImage={currentScan}
  onClose={() => {}}
/>
```

---

## Settings Components

### CalendarIntegration

Google/Outlook calendar sync:

```jsx
import CalendarIntegration from '@components/settings/CalendarIntegration';

<CalendarIntegration
  onConnect={(provider) => {}}
  onDisconnect={() => {}}
/>
```

### LISIntegration

Lab Information System settings:

```jsx
import LISIntegration from '@components/settings/LISIntegration';

<LISIntegration
  onSave={(config) => {}}
/>
```

### ReferrerManagement

Manage referring doctors:

```jsx
import ReferrerManagement from '@components/settings/ReferrerManagement';

<ReferrerManagement />
```

### RolePermissionsManager

Admin role configuration:

```jsx
import RolePermissionsManager from '@components/settings/RolePermissionsManager';

<RolePermissionsManager />
```

---

## Utility Components

### ErrorBoundary

Error boundary wrapper:

```jsx
import ErrorBoundary from '@components/ErrorBoundary';

<ErrorBoundary>
  <App />
</ErrorBoundary>
```

### PreCacheManager

PWA cache management:

```jsx
import PreCacheManager from '@components/PreCacheManager';

<PreCacheManager />
```

### ConflictResolver

Data conflict resolution:

```jsx
import ConflictResolver from '@components/ConflictResolver';

<ConflictResolver
  localData={localData}
  serverData={serverData}
  onResolve={(resolvedData) => {}}
/>
```

### PrintManager

Print queue management:

```jsx
import PrintManager from '@components/PrintManager';

<PrintManager
  documents={documentsToPrint}
  onPrint={(doc) => {}}
/>
```

---

## Wizard Component

Multi-step form wizard:

```jsx
import Wizard from '@components/Wizard';

<Wizard
  steps={[
    { id: 'personal', label: 'Personal Info', component: PersonalStep },
    { id: 'medical', label: 'Medical History', component: MedicalStep },
    { id: 'confirm', label: 'Confirmation', component: ConfirmStep }
  ]}
  initialData={{}}
  onComplete={(data) => {}}
  onCancel={() => {}}
/>
```

### PatientRegistrationWizard

Pre-built patient registration:

```jsx
import PatientRegistrationWizard from '@components/PatientRegistrationWizard';

<PatientRegistrationWizard
  onComplete={(patient) => {}}
  onCancel={() => {}}
/>
```

---

## Clinical Components

### CopyPreviousButton

Copy data from previous visit:

```jsx
import CopyPreviousButton from '@components/CopyPreviousButton';

<CopyPreviousButton
  patientId={patientId}
  dataType="refraction"
  onCopy={(previousData) => {}}
/>
```

### RefractionComparisonView

Compare refraction results:

```jsx
import RefractionComparisonView from '@components/RefractionComparisonView';

<RefractionComparisonView
  current={currentRefraction}
  previous={previousRefraction}
/>
```

### PatientTimeline

Visit timeline visualization:

```jsx
import PatientTimeline from '@components/PatientTimeline';

<PatientTimeline
  patientId={patientId}
  onSelectVisit={(visit) => {}}
/>
```

### PatientPreviewCard

Hover preview card:

```jsx
import PatientPreviewCard from '@components/PatientPreviewCard';

<PatientPreviewCard
  patient={patient}
  position={{ x, y }}
  onClose={() => {}}
/>
```

### OrthopticSummaryCard

Orthoptic exam summary:

```jsx
import OrthopticSummaryCard from '@components/OrthopticSummaryCard';

<OrthopticSummaryCard
  exam={orthopticExam}
/>
```

### ProviderAvailabilityPanel

Show provider schedule:

```jsx
import ProviderAvailabilityPanel from '@components/ProviderAvailabilityPanel';

<ProviderAvailabilityPanel
  providerId={providerId}
  date={selectedDate}
/>
```

---

## Component Design Patterns

### Consistent Props

All components follow these patterns:

```jsx
// Loading state
loading={boolean}

// Close/Cancel
onClose={() => {}}
onCancel={() => {}}

// Success callback
onComplete={() => {}}
onSave={() => {}}

// Error handling
onError={(error) => {}}

// Variant/Size
variant="primary" | "secondary" | "ghost"
size="sm" | "md" | "lg"
```

### Tailwind Classes

Components use consistent Tailwind patterns:

```jsx
// Cards
"bg-white rounded-xl border border-gray-200 shadow-sm"

// Buttons - Primary
"bg-blue-600 text-white hover:bg-blue-700 rounded-lg"

// Buttons - Secondary
"bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg"

// Input fields
"border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"

// Status badges
"px-2 py-1 text-xs font-medium rounded-full"
```

### French Localization

All user-facing text in French:

```jsx
// Labels
"Chargement..."        // Loading...
"Enregistrer"          // Save
"Annuler"              // Cancel
"Fermer"               // Close
"Rechercher..."        // Search...
"Aucun résultat"       // No results
```

---

## Import Conventions

### Path Aliases

```javascript
// Absolute imports via vite.config.js aliases
import Component from '@components/Component';
import { useApi } from '@hooks';
import patientService from '@services/patientService';
import { useAuth } from '@contexts/AuthContext';
```

### Barrel Exports

```javascript
// components/panels/index.js
export { default as ClinicalSummaryPanel } from './ClinicalSummaryPanel';
export { default as PatientMedicalSummary } from './PatientMedicalSummary';
export * from './PanelBase';

// Usage
import { ClinicalSummaryPanel, Panel, StatBox } from '@components/panels';
```
