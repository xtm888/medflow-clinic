# MedFlow Frontend Pages & Workflows

## Overview

MedFlow's frontend is a React 18 SPA with 100+ pages and components organized into clinical workflows, administrative functions, and specialized modules. Built with Vite, Redux Toolkit for state management, and Tailwind CSS for styling.

---

## Architecture

### Technology Stack

| Technology | Purpose |
|------------|---------|
| React 18 | UI Framework with Suspense & lazy loading |
| Redux Toolkit | Global state management |
| Redux Persist | Persistent auth & UI state |
| React Router 6 | Client-side routing |
| Tailwind CSS | Utility-first styling |
| Vite | Build tool & dev server |
| Recharts | Data visualization |
| Lucide React | Icon library |
| React Toastify | Toast notifications |

### Application Structure

```
frontend/src/
├── App.jsx                 # Root component with routing
├── layouts/
│   ├── MainLayout.jsx      # Staff portal layout
│   └── PatientLayout.jsx   # Patient portal layout
├── pages/                  # 100+ page components
├── components/             # Reusable components
├── modules/                # Feature modules
├── contexts/               # React contexts
├── store/                  # Redux store & slices
├── services/               # API services
├── hooks/                  # Custom hooks
├── config/                 # Configuration
└── utils/                  # Utility functions
```

---

## Route Structure

### Public Routes (No Auth)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/login` | Login | Staff authentication |
| `/book` | PublicBooking | Patient self-booking |
| `/booking/confirmation` | BookingConfirmation | Booking confirmation |
| `/display-board` | QueueDisplayBoard | TV display for waiting room |
| `/patient/login` | PatientLogin | Patient portal auth |

### Staff Portal Routes

Protected by `<ProtectedRoute />` within `<MainLayout />`:

#### Core Navigation

| Route | Component | Description |
|-------|-----------|-------------|
| `/home` | HomeDashboard | Full-screen navigation launcher |
| `/dashboard` | Dashboard | KPI overview & widgets |
| `/patients` | Patients | Patient list & search |
| `/patients/:id` | PatientDetail | Single-page patient view |
| `/patients/:id/edit` | PatientEdit | Patient data editing |
| `/queue` | Queue | Real-time patient queue |
| `/queue/analytics` | QueueAnalytics | Queue statistics |
| `/appointments` | Appointments | Appointment calendar |

#### Clinical Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/ophthalmology` | OphthalmologyDashboard | Ophthalmology home |
| `/ophthalmology/consultation/:patientId` | NewConsultation | Multi-step exam workflow |
| `/ophthalmology/glasses-order/:examId` | GlassesOrder | Glasses prescription |
| `/glasses-orders` | GlassesOrderList | All glasses orders |
| `/glasses-orders/:id` | GlassesOrderDetail | Order details |
| `/glasses-orders/:id/delivery` | GlassesOrderDelivery | Delivery processing |
| `/prescriptions` | Prescriptions | Prescription management |
| `/prescription-queue` | PrescriptionQueue | Pharmacist worklist |

#### IVT (Intravitreal Injections)

| Route | Component | Description |
|-------|-----------|-------------|
| `/ivt` | IVTDashboard | IVT scheduling overview |
| `/ivt/new` | IVTInjectionForm | New injection form |
| `/ivt/edit/:id` | IVTInjectionForm | Edit injection |
| `/ivt/:id` | IVTDetail | Injection details |

#### Surgery Module

| Route | Component | Description |
|-------|-----------|-------------|
| `/surgery` | SurgeryDashboard | Surgery queue & agenda |
| `/surgery/:id` | SurgeryCheckIn | Pre-op check-in |
| `/surgery/:id/checkin` | SurgeryCheckIn | Patient check-in |
| `/surgery/:id/report` | SurgeryReportForm | Surgery report |

#### Laboratory

| Route | Component | Description |
|-------|-----------|-------------|
| `/laboratory` | Laboratory | Lab dashboard |
| `/laboratory/config` | LabConfiguration | Lab settings |
| `/lab-worklist` | LabTechWorklist | Technician worklist |
| `/lab-checkin` | LabCheckIn | Specimen collection |

#### Pharmacy

| Route | Component | Description |
|-------|-----------|-------------|
| `/pharmacy` | PharmacyDashboard | Inventory dashboard |
| `/pharmacy/new` | PharmacyDetail | Add medication |
| `/pharmacy/:id` | PharmacyDetail | Edit medication |

#### Device Integration

| Route | Component | Description |
|-------|-----------|-------------|
| `/devices` | DeviceManager | Device list |
| `/devices/status` | DeviceStatusDashboard | Connection status |
| `/devices/discovery` | NetworkDiscovery | Network scan |
| `/devices/:id` | DeviceDetail | Device configuration |
| `/devices/:id/import` | DeviceImport | Import device data |

#### Financial

| Route | Component | Description |
|-------|-----------|-------------|
| `/financial` | Financial | Financial dashboard |
| `/invoicing` | Invoicing | Invoice creation |
| `/companies` | Companies | Corporate accounts |
| `/companies/:id` | CompanyDetail | Company details |
| `/approvals` | Approvals | Prior authorizations |

#### Inventory Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/frame-inventory` | FrameInventory | Optical frames |
| `/contact-lens-inventory` | ContactLensInventory | Contact lenses |
| `/reagent-inventory` | ReagentInventory | Lab reagents |
| `/lab-consumable-inventory` | LabConsumableInventory | Lab consumables |
| `/cross-clinic-inventory` | CrossClinicInventory | Multi-clinic stock |

#### Administrative

| Route | Component | Description |
|-------|-----------|-------------|
| `/settings` | Settings | System settings |
| `/templates` | TemplateManager | Document templates |
| `/templates/new` | TemplateBuilder | Create template |
| `/templates/:id` | TemplateBuilder | Edit template |
| `/audit` | AuditTrail | Audit logs |
| `/analytics` | AnalyticsDashboard | Business analytics |

### Patient Portal Routes

Protected within `<PatientLayout />`:

| Route | Component | Description |
|-------|-----------|-------------|
| `/patient/dashboard` | PatientDashboard | Patient home |
| `/patient/appointments` | PatientAppointments | View appointments |
| `/patient/prescriptions` | PatientPrescriptions | Prescription history |
| `/patient/bills` | PatientBills | Billing & payments |
| `/patient/results` | PatientResults | Lab/exam results |
| `/patient/messages` | PatientMessages | Secure messaging |
| `/patient/profile` | PatientProfile | Profile management |

---

## State Management

### Redux Store Architecture

```javascript
// store/index.js
const store = configureStore({
  reducer: {
    auth: persistedAuthReducer,      // User & token
    patient: patientReducer,         // Patient data
    appointment: appointmentReducer, // Appointments
    visit: visitReducer,             // Visits/exams
    prescription: prescriptionReducer,
    billing: billingReducer,
    document: documentReducer,
    ui: persistedUiReducer,          // Theme, sidebar
    notification: notificationReducer,
    queue: queueReducer              // Real-time queue
  }
});
```

### Redux Slices

| Slice | Persisted | Purpose |
|-------|-----------|---------|
| `authSlice` | Yes | User, tokens, permissions |
| `uiSlice` | Yes | Sidebar, theme, preferences |
| `patientSlice` | No | Active patient data |
| `appointmentSlice` | No | Appointment operations |
| `visitSlice` | No | Visit/exam data |
| `prescriptionSlice` | No | Prescription management |
| `billingSlice` | No | Invoice operations |
| `documentSlice` | No | Document generation |
| `notificationSlice` | No | Real-time notifications |
| `queueSlice` | No | Queue management |

### Context Providers

```jsx
// App.jsx provider hierarchy
<ErrorBoundary>
  <Provider store={store}>              {/* Redux */}
    <PersistGate persistor={persistor}> {/* Redux Persist */}
      <BrowserRouter>
        <AuthProvider>                  {/* Authentication */}
          <ClinicProvider>              {/* Multi-clinic */}
            <PatientProvider>           {/* Patient context */}
              <PatientCacheProvider>    {/* Patient cache */}
                {/* Routes */}
              </PatientCacheProvider>
            </PatientProvider>
          </ClinicProvider>
        </AuthProvider>
      </BrowserRouter>
    </PersistGate>
  </Provider>
</ErrorBoundary>
```

#### AuthContext

```javascript
// contexts/AuthContext.jsx
const AuthContext = {
  user,                    // Current user object
  loading,                 // Auth loading state
  error,                   // Auth error
  isAuthenticated,         // Boolean
  login(credentials),      // Login function
  register(userData),      // Registration
  logout(),               // Logout
  updateUser(updates),    // Profile updates
  updatePassword(pw),     // Password change
  hasRole(roles),         // Role check
  hasPermission(mod, act) // Permission check
};
```

#### PatientContext

```javascript
// Persistent patient selection across pages
const PatientContext = {
  selectedPatient,        // Currently selected patient
  selectPatient(patient), // Set patient
  clearPatient(),        // Clear selection
  hasPatient             // Boolean
};
```

#### ClinicContext

```javascript
// Multi-clinic support
const ClinicContext = {
  currentClinic,          // Active clinic
  clinics,               // Available clinics
  selectClinic(id),      // Switch clinic
  isMultiClinic          // Boolean
};
```

---

## Clinical Workflows

### Ophthalmology Consultation Workflow

The `NewConsultation` component supports 4 workflow modes:

#### 1. Consolidated Dashboard (Recommended)

Single-page view with all clinical data sections:

```javascript
const consolidatedDashboardWorkflowConfig = {
  id: 'consolidated_dashboard',
  name: 'Consultation Consolidée',
  mode: 'dashboard',
  defaultData: {
    complaint: {},
    vitals: {},
    refraction: { visualAcuity, objective, subjective, keratometry },
    examination: { iop, slitLamp, fundus, pupils },
    diagnostic: { diagnoses, procedures, laboratory },
    prescription: { type, glasses, medications, recommendations }
  }
};
```

#### 2. Full Workflow (12 Steps)

Step-by-step clinical examination:

| Step | Component | Required |
|------|-----------|----------|
| 1 | ChiefComplaintStep | Yes |
| 2 | VitalSignsStep | No |
| 3 | VisualAcuityStep | Yes |
| 4 | ObjectiveRefractionStep | Yes |
| 5 | SubjectiveRefractionStep | Yes |
| 6 | AdditionalTestsStep | No |
| 7 | KeratometryStep | No |
| 8 | OphthalmologyExamStep | Yes |
| 9 | DiagnosisStep | Yes |
| 10 | ProceduresStep | No |
| 11 | LaboratoryStep | No |
| 12 | PrescriptionStep | Yes |
| 13 | SummaryStep | No |

#### 3. Quick Follow-up (5 Steps)

Simplified for returning patients:
- Chief Complaint
- Visual Acuity
- Examination
- Diagnosis
- Prescription

#### 4. Refraction Only (5 Steps)

For glasses prescriptions:
- Visual Acuity
- Objective Refraction
- Subjective Refraction
- Keratometry
- Prescription

### Clinical Workflow Engine

```javascript
// modules/clinical/ClinicalWorkflow.jsx
<ClinicalWorkflow
  workflowConfig={config}           // Step definitions
  stepComponents={stepComponents}   // Component map
  saveService={saveService}         // Save handlers
  initialData={defaultData}         // Initial form data
  onComplete={handleComplete}       // Completion handler
  onCancel={handleCancel}          // Cancel handler
  showProgress={true}              // Progress indicator
  enableAutoSave={true}            // Auto-save feature
  autoSaveInterval={30000}         // 30 second interval
/>
```

### Face Verification Flow

For doctors accessing patient records:

```javascript
// Session-based verification
1. Check sessionStorage for `faceVerified_${patientId}`
2. If not verified AND patient has face encoding:
   - Show FaceVerification component
   - Use webcam to capture face
   - Call /api/face-recognition/verify
3. On success, store in sessionStorage
4. Admin can skip verification
```

---

## Queue Management

### Real-Time Queue System

```javascript
// pages/Queue.jsx features:
- WebSocket subscription to queue updates
- Real-time wait time calculation
- Priority-based coloring (VIP, pregnant, urgent, elderly)
- Room assignment modal
- Patient check-in workflow
- Audio announcements
- Keyboard shortcuts
```

### Queue States

| State | Color | Description |
|-------|-------|-------------|
| `checked-in` | Yellow | Waiting |
| `in-progress` | Blue | With provider |
| `completed` | Green | Visit done |
| `cancelled` | Red | Cancelled |

### Priority Levels

| Priority | Badge Color | Use Case |
|----------|-------------|----------|
| `vip` | Purple | VIP patients |
| `pregnant` | Pink | Pregnant women |
| `urgent` | Red | Urgent cases |
| `elderly` | Blue | Senior patients |
| `emergency` | Red | Emergencies |
| `normal` | Gray | Standard |

### WebSocket Events

```javascript
// Real-time queue updates
useQueueUpdates((data) => {
  // Event types:
  // - patient_checked_in
  // - patient_called
  // - patient_completed
  // - queue_reordered
});
```

---

## Patient Detail Page

### Single-Page Collapsible Sections

```javascript
// pages/PatientDetail/index.jsx
<CollapsibleSectionGroup>
  <PatientInfoSection />      // Demographics
  <OphthalmologySection />    // Eye exams
  <PrescriptionsSection />    // Rx history
  <AppointmentsSection />     // Appointments
  <ImagingSection />          // Medical images
  <LabSection />              // Lab results
  <BillingSection />          // Invoices
  <SurgeryHistorySection />   // Surgeries
  <TimelineSection />         // Visit timeline
</CollapsibleSectionGroup>
```

### Role-Based Permissions

```javascript
const canEditPatient = ['admin', 'doctor', 'ophthalmologist', 'nurse', 'receptionist'];
const canCreatePrescription = ['admin', 'doctor', 'ophthalmologist', 'optometrist'];
const canViewBilling = ['admin', 'receptionist', 'accountant', 'manager'];
const canProcessPayment = ['admin', 'receptionist', 'accountant'];
const canCreateInvoice = ['admin', 'receptionist', 'accountant'];
const canCreateExam = ['admin', 'doctor', 'ophthalmologist', 'optometrist', 'orthoptist'];
const canSignVisit = ['admin', 'doctor', 'ophthalmologist'];
const canUploadImaging = ['admin', 'doctor', 'ophthalmologist', 'radiologist', 'technician'];
const canGenerateDocuments = ['admin', 'doctor', 'ophthalmologist', 'nurse'];
```

---

## Dashboard System

### Main Dashboard (`/dashboard`)

```javascript
// Priority-tiered loading for performance
Tier 1 (Critical - loads first):
  - Stats (today's patients, queue, revenue, pending Rx)
  - Queue data

Tier 2 (Secondary - loads after):
  - Today's tasks
  - Recent patients
  - Pending actions
  - Revenue charts
  - Alerts
```

### Dashboard Widgets

| Widget | Data Source | Purpose |
|--------|-------------|---------|
| `TodayTasksWidget` | `/api/dashboard/tasks` | Role-specific tasks |
| `RecentPatientsWidget` | `/api/dashboard/recent-patients` | Recent activity |
| `PendingActionsWidget` | `/api/dashboard/pending-actions` | Items needing attention |

### StatCard Component

```jsx
<StatCard
  title="Patients aujourd'hui"
  value={stats.todayPatients}
  icon={Users}
  color="blue"
  trend="up"
  trendValue="+12%"
/>
```

### Charts

- **Revenue Trend**: LineChart showing monthly revenue
- **Revenue by Service**: PieChart of service categories

---

## Navigation & Layout

### MainLayout Features

```javascript
// layouts/MainLayout.jsx
Features:
- Responsive sidebar (desktop fixed, mobile drawer)
- Role-based menu filtering
- Submenu support with auto-expand
- Patient search in header
- Clinic selector (multi-clinic)
- Sync status indicator
- Offline indicator
- Notification bell
- Session timeout warning
- Keyboard shortcuts
```

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+H` or `H` | Go to Home |
| `Ctrl+P` | Go to Patients |
| `Ctrl+Q` | Go to Queue |
| `Ctrl+A` | Go to Appointments |
| `Ctrl+F` or `Ctrl+K` | Open Global Search |
| `F1` or `?` | Show Shortcuts Help |

### Role-Based Menu Items

Menus loaded from database via `authService.getRolePermissions()`:

```javascript
// config/rolePermissions.js
const menuConfigurations = {
  dashboard: { label: 'Tableau de bord', path: '/dashboard', icon: 'LayoutDashboard' },
  patients: { label: 'Patients', path: '/patients', icon: 'Users' },
  queue: { label: 'File d\'attente', path: '/queue', icon: 'Clock' },
  appointments: { label: 'Rendez-vous', path: '/appointments', icon: 'Calendar' },
  ophthalmology: { label: 'Ophtalmologie', icon: 'Eye', subItems: [...] },
  pharmacy: { label: 'Pharmacie', icon: 'Pill', subItems: [...] },
  laboratory: { label: 'Laboratoire', icon: 'FlaskConical', subItems: [...] },
  // ... more menu items
};
```

---

## Custom Hooks

### API Hooks

```javascript
// hooks/useApi.js
const { data, loading, error, refetch } = useApi('/endpoint');

// hooks/useAbortController.js
const { signal, abort, reset } = useAbortController();

// hooks/usePaginatedApi.js
const { data, page, setPage, totalPages } = usePaginatedApi('/endpoint');
```

### Real-Time Hooks

```javascript
// hooks/useWebSocket.js
const { connected, service } = useWebSocket();
const { subscribeToQueue, subscribeToPatient } = useQueueUpdates(callback);
```

### Auto-Save Hook

```javascript
// hooks/useAutoSave.js
useAutoSave({
  data: formData,
  onSave: async (data) => await api.save(data),
  interval: 30000,      // 30 seconds
  debounce: 1000,       // 1 second debounce
  enabled: true
});
```

### Permission Hook

```javascript
// hooks/usePermissions.js
const { can, canAny, canAll, userRole } = usePermissions();

if (can('view_financial_reports')) {
  // Show financial data
}
```

---

## Module Architecture

### Clinical Module

```javascript
// modules/clinical/index.js
export {
  ClinicalWorkflow,                    // Workflow orchestrator
  useClinicalSession,                  // Session management hook
  ophthalmologyWorkflowConfig,         // Full workflow config
  quickFollowUpWorkflowConfig,         // Follow-up config
  refractionOnlyWorkflowConfig,        // Refraction config
  consolidatedDashboardWorkflowConfig  // Dashboard config
};
```

### Patient Module

```javascript
// modules/patient/index.js
export {
  PatientSelector,     // Patient search dropdown
  PatientCard,         // Patient info card
  PatientQuickView     // Hover preview
};
```

---

## Services Architecture

### API Configuration

```javascript
// services/apiConfig.js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  withCredentials: true
});

// Interceptors handle:
// - Token injection
// - Token refresh on 401
// - Error transformation
// - Offline queue
```

### Core Services

| Service | Purpose |
|---------|---------|
| `authService` | Authentication |
| `patientService` | Patient CRUD |
| `appointmentService` | Appointments |
| `visitService` | Visits/exams |
| `prescriptionService` | Prescriptions |
| `billingService` | Invoicing |
| `queueService` | Queue operations |
| `ophthalmologyService` | Eye exams |
| `pharmacyInventoryService` | Pharmacy stock |
| `laboratoryService` | Lab tests |
| `deviceService` | Device integration |
| `surgeryService` | Surgery module |

### Offline Support

```javascript
// services/offlineService.js
- Detects offline status
- Queues failed requests
- Syncs when online
- Shows offline indicator
```

---

## Performance Optimizations

### Code Splitting

```javascript
// Lazy load all pages except Login & NotFound
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Patients = lazy(() => import('./pages/Patients'));
// ... all other pages
```

### Caching

```javascript
// Dashboard caching
const CACHE_TTL = 60000; // 1 minute
const dashboardCache = { data: null, timestamp: 0 };

// Check cache before fetching
if (Date.now() - dashboardCache.timestamp < CACHE_TTL) {
  return dashboardCache.data;
}
```

### Memoization

```javascript
// Memoize expensive computations
const activeQueueItems = useMemo(() =>
  queueData.filter(q => q.status !== 'completed'),
  [queueData]
);
```

### Request Cancellation

```javascript
// Cancel in-flight requests on unmount
useEffect(() => {
  const controller = new AbortController();
  fetchData({ signal: controller.signal });
  return () => controller.abort();
}, []);
```

---

## French Localization

All UI text is in French:

```javascript
// Examples throughout the codebase:
'Tableau de bord'          // Dashboard
'File d\'attente'          // Queue
'Rendez-vous'              // Appointments
'Patients aujourd\'hui'    // Today's patients
'Prescriptions en attente' // Pending prescriptions
'Nouvelle consultation'    // New consultation
'Déconnexion'              // Logout
```

### Date Formatting

```javascript
new Date().toLocaleDateString('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});
// Output: "07 déc. 2025"
```

---

## Error Handling

### Error Boundary

```jsx
// components/ErrorBoundary.jsx
<ErrorBoundary>
  <App />
</ErrorBoundary>

// Catches render errors and shows fallback UI
```

### API Error Handling

```javascript
// services/apiConfig.js interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Try token refresh
    }
    // Transform error for UI
    return Promise.reject(error);
  }
);
```

### Toast Notifications

```javascript
import { toast } from 'react-toastify';

toast.success('Enregistré avec succès');
toast.error('Erreur lors de l\'enregistrement');
toast.warning('Attention: données incomplètes');
toast.info('Mise à jour disponible');
```

---

## PWA Features

### Service Worker

```javascript
// Registered in App.jsx
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(registration => {
      // Check for updates every minute
      setInterval(() => registration.update(), 60000);
    });
}
```

### Pre-Caching

```jsx
// components/PreCacheManager.jsx
- Caches critical assets
- Enables offline access
- Shows update notifications
```

### Notifications

```javascript
// Request permission on load
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}
```

---

## File Summary

| Directory | File Count | Purpose |
|-----------|------------|---------|
| `pages/` | ~100 | Page components |
| `pages/ophthalmology/` | 20+ | Eye exam components |
| `pages/patient/` | 8 | Patient portal |
| `components/` | 50+ | Reusable components |
| `services/` | 30+ | API services |
| `hooks/` | 15+ | Custom hooks |
| `store/slices/` | 10 | Redux slices |
| `contexts/` | 5 | React contexts |
| `modules/` | 2 | Feature modules |
