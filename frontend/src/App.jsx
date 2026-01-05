import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import { AuthProvider } from './contexts/AuthContext';
import { PatientProvider } from './contexts/PatientContext';
import { PatientCacheProvider } from './contexts/PatientCacheContext';
import { ClinicProvider } from './contexts/ClinicContext';
import { StudioVisionModeProvider } from './contexts/StudioVisionModeContext';
import { useEffect, useState, lazy, Suspense } from 'react';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGuard from './components/RoleGuard';
// OfflineIndicator moved to MainLayout header
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import PreCacheManager from './components/PreCacheManager';
import ConflictResolutionModal from './components/ConflictResolutionModal';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';
import logger from './services/logger';
import syncService from './services/syncService';

// Lazy load pages for better performance (Code Splitting)
// Critical pages loaded immediately
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import MainLayout from './layouts/MainLayout';
import PatientLayout from './layouts/PatientLayout';
import RoleBasedLanding from './components/RoleBasedLanding';

// Lazy load all other pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Patients = lazy(() => import('./pages/Patients'));
const Queue = lazy(() => import('./pages/Queue'));
const QueueAnalytics = lazy(() => import('./pages/QueueAnalytics'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Prescriptions = lazy(() => import('./pages/Prescriptions'));
const Imaging = lazy(() => import('./pages/Imaging'));
const Notifications = lazy(() => import('./pages/Notifications'));
const AlertDashboard = lazy(() => import('./pages/AlertDashboard'));
const Financial = lazy(() => import('./pages/Financial'));
const Invoicing = lazy(() => import('./pages/Invoicing'));
const Services = lazy(() => import('./pages/Services'));
const Settings = lazy(() => import('./pages/Settings'));
const DocumentGeneration = lazy(() => import('./pages/DocumentGeneration'));
const Laboratory = lazy(() => import('./pages/Laboratory'));
const LabConfiguration = lazy(() => import('./pages/Laboratory/LabConfiguration'));
// Ophthalmology Pages
const OphthalmologyDashboard = lazy(() => import('./pages/ophthalmology/OphthalmologyDashboard'));
const GlassesOrder = lazy(() => import('./pages/ophthalmology/GlassesOrder'));
const NewConsultation = lazy(() => import('./pages/ophthalmology/NewConsultation'));
const StudioVisionConsultation = lazy(() => import('./pages/ophthalmology/StudioVisionConsultation'));
// Glasses Orders Management Pages - List is now a tab in OpticalShop
// Route /glasses-orders redirects to /optical-shop?tab=orders
const GlassesOrderDetail = lazy(() => import('./pages/GlassesOrders/GlassesOrderDetail'));
const GlassesOrderDelivery = lazy(() => import('./pages/GlassesOrders/GlassesOrderDelivery'));
// IVT Pages
const IVTDashboard = lazy(() => import('./pages/IVTDashboard'));
const IVTInjectionForm = lazy(() => import('./pages/IVTInjectionForm'));
const IVTDetail = lazy(() => import('./pages/IVTDetail'));
// Surgery Pages
const SurgeryDashboard = lazy(() => import('./pages/Surgery'));
const SurgeryCheckIn = lazy(() => import('./pages/Surgery/SurgeryCheckIn'));
const SurgeryReportForm = lazy(() => import('./pages/Surgery/SurgeryReportForm'));
const NewSurgeryCase = lazy(() => import('./pages/Surgery/NewSurgeryCase'));
const SurgeonView = lazy(() => import('./pages/Surgery/SurgeonView'));
// Pharmacy Pages
const PharmacyDashboard = lazy(() => import('./pages/PharmacyDashboard'));
const PharmacyDetail = lazy(() => import('./pages/PharmacyDetail'));
// Device Integration Pages - Status and Discovery are now tabs in DeviceManager
// Routes /devices/status and /devices/discovery redirect to tabs
const DeviceManager = lazy(() => import('./pages/DeviceManager'));
const DeviceDetail = lazy(() => import('./pages/DeviceDetail'));
const DeviceImport = lazy(() => import('./pages/DeviceImport'));
// OCR Import Pages
const ImportWizard = lazy(() => import('./pages/ImportWizard'));
const OCRReviewQueue = lazy(() => import('./pages/OCRReviewQueue'));
const PatientDetail = lazy(() => import('./pages/PatientDetail'));
const PatientEdit = lazy(() => import('./pages/PatientEdit'));
// Patient Portal Pages
const PatientLogin = lazy(() => import('./pages/patient/PatientLogin'));
const PatientDashboard = lazy(() => import('./pages/patient/PatientDashboard'));
const PatientAppointments = lazy(() => import('./pages/patient/PatientAppointments'));
const PatientPrescriptions = lazy(() => import('./pages/patient/PatientPrescriptions'));
const PatientBills = lazy(() => import('./pages/patient/PatientBills'));
const PatientResults = lazy(() => import('./pages/patient/PatientResults'));
const PatientMessages = lazy(() => import('./pages/patient/PatientMessages'));
const PatientProfile = lazy(() => import('./pages/patient/PatientProfile'));
// Public Booking Pages
const PublicBooking = lazy(() => import('./pages/PublicBooking'));
const BookingConfirmation = lazy(() => import('./pages/BookingConfirmation'));
// Queue Display Board (Public)
const QueueDisplayBoard = lazy(() => import('./pages/QueueDisplayBoard'));
// Orthoptic Pages
const OrthopticExams = lazy(() => import('./pages/OrthopticExams'));
const OrthopticExamForm = lazy(() => import('./pages/OrthopticExamForm'));
// Prescription Queue (Pharmacist) - Now a tab in PharmacyDashboard
// Route redirects to /pharmacy?tab=prescriptions
// Lab Tech Worklist & Check-in - Now tabs in Laboratory page
// Routes redirect to /laboratory?tab=worklist and /laboratory?tab=checkin
// Nurse Vitals Entry
const NurseVitalsEntry = lazy(() => import('./pages/NurseVitalsEntry'));
// Admin Pages
const AuditTrail = lazy(() => import('./pages/AuditTrail'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const BackupManagement = lazy(() => import('./pages/BackupManagement'));
// Procurement Pages
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const StockReconciliation = lazy(() => import('./pages/StockReconciliation'));
const WarrantyManagement = lazy(() => import('./pages/WarrantyManagement'));
const RepairTracking = lazy(() => import('./pages/RepairTracking'));
const RepairForm = lazy(() => import('./pages/RepairTracking/RepairForm'));
const RepairDetail = lazy(() => import('./pages/RepairTracking/RepairDetail'));
// Analytics Pages
const AnalyticsDashboard = lazy(() => import('./pages/analytics/AnalyticsDashboard'));
// Template Pages
const TemplateManager = lazy(() => import('./pages/templates/TemplateManager'));
const TemplateBuilder = lazy(() => import('./pages/templates/TemplateBuilder'));
const TemplatePreview = lazy(() => import('./pages/templates/TemplatePreview'));
// Companies & Approvals Pages
const Companies = lazy(() => import('./pages/Companies'));
const CompanyDetail = lazy(() => import('./pages/Companies/CompanyDetail'));
const Approvals = lazy(() => import('./pages/Approvals'));
// Visit Pages
const VisitDashboard = lazy(() => import('./pages/visits/VisitDashboard'));
const VisitTimeline = lazy(() => import('./pages/visits/VisitTimeline'));
const VisitDetail = lazy(() => import('./pages/visits/VisitDetail'));
// Home Dashboard (Full-screen navigation launcher)
const HomeDashboard = lazy(() => import('./pages/HomeDashboard'));
// Optical Inventory Pages - REMOVED (use UnifiedInventory with type param)
// Optical Shop Pages - Sub-pages are now tabs in OpticalShop main page
// Routes /optical-shop/verification, /external-orders, /performance redirect to tabs
const OpticalShopDashboard = lazy(() => import('./pages/OpticalShop'));
const OpticalShopNewSale = lazy(() => import('./pages/OpticalShop/NewSale'));
// Keep verification for detail route (/verification/:id)
const OpticalShopVerification = lazy(() => import('./pages/OpticalShop/TechnicianVerification'));
// Lab Inventory Pages - REMOVED (use UnifiedInventory with type param)
// Multi-Clinic Operations (Unified page with tabs)
// Routes /cross-clinic-inventory, /cross-clinic-dashboard, /consolidated-reports redirect to tabs
const MultiClinic = lazy(() => import('./pages/MultiClinic'));
// Ophthalmology Hub (Unified page with tabs: dashboard, orthoptic, ivt, surgery)
const OphthalmologyHub = lazy(() => import('./pages/OphthalmologyHub'));
// Finance Hub (Unified page with tabs: invoicing, reports, conventions, approvals, services)
const FinanceHub = lazy(() => import('./pages/FinanceHub'));
// External Facilities & Fulfillment Dispatch (Pay & Dispatch Externally)
const ExternalFacilities = lazy(() => import('./pages/ExternalFacilities'));
const DispatchDashboard = lazy(() => import('./pages/DispatchDashboard'));
// Imaging Orders Page - Disabled (requires MUI)
// const ImagingOrders = lazy(() => import('./pages/ImagingOrders'));
// Lab Orders Page - Disabled (requires MUI)
// const LabOrders = lazy(() => import('./pages/LabOrders'));
// Unified Inventory (All inventories in one page with tabs)
const UnifiedInventory = lazy(() => import('./pages/UnifiedInventory'));
// Role-Based Dashboard Views
const ReceptionistView = lazy(() => import('./pages/RoleViews/ReceptionistView'));
const PharmacistView = lazy(() => import('./pages/RoleViews/PharmacistView'));
const OpticianView = lazy(() => import('./pages/RoleViews/OpticianView'));
const LabTechView = lazy(() => import('./pages/RoleViews/LabTechView'));

function App() {
  // Conflict resolution state
  const [conflicts, setConflicts] = useState([]);
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  useEffect(() => {
    // Register service worker for offline functionality
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(registration => {
          logger.info('Service Worker registered:', registration);

          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60000); // Check every minute
        })
        .catch(error => {
          logger.error('Service Worker registration failed:', error);
        });
    }

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Listen for conflict events from syncService
  useEffect(() => {
    const handleConflict = (event, data) => {
      if (event === 'conflict' && data) {
        const conflict = {
          id: data.localData?.id || data.serverData?.id,
          entity: data.entity,
          entityId: data.localData?.id || data.serverData?.id,
          localData: data.localData,
          serverData: data.serverData,
          timestamp: new Date().toISOString()
        };

        setConflicts(prev => [...prev, conflict]);

        // Auto-open modal if manual resolution needed
        if (syncService.getConflictStrategy() === 'manual') {
          setSelectedConflict(conflict);
          setShowConflictModal(true);
        }
      }
    };

    const removeListener = syncService.addListener(handleConflict);
    return () => removeListener();
  }, []);

  // Handle conflict resolution
  const handleConflictResolved = async (conflictId) => {
    setConflicts(prev => prev.filter(c => c.id !== conflictId));
    setShowConflictModal(false);
    setSelectedConflict(null);
  };
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <BrowserRouter>
            <AuthProvider>
              <ClinicProvider>
              <StudioVisionModeProvider defaultMode="studiovision">
              <PreCacheManager />
              <PatientProvider>
              <PatientCacheProvider>
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
          {/* Login Page */}
          <Route path="/login" element={<Login />} />

          {/* Public Booking Pages (No Auth Required) */}
          <Route path="/book" element={<PublicBooking />} />
          <Route path="/booking/confirmation" element={<BookingConfirmation />} />

          {/* Queue Display Board (Public - for TV screens in waiting areas) */}
          <Route path="/display-board" element={<QueueDisplayBoard />} />

          {/* Protected Staff/Admin Portal */}
          <Route element={<ProtectedRoute />}>
            {/* Home Dashboard - Full-screen navigation launcher */}
            <Route path="/home" element={<HomeDashboard />} />

            <Route path="/" element={<MainLayout />}>
              <Route index element={<RoleBasedLanding />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="patients" element={<Patients />} />
              <Route path="patients/:patientId" element={<PatientDetail />} />
              <Route path="patients/:patientId/edit" element={<PatientEdit />} />
              <Route path="queue" element={<Queue />} />
              <Route path="queue/analytics" element={<QueueAnalytics />} />
              <Route path="appointments" element={<Appointments />} />
              <Route path="prescriptions" element={<Prescriptions />} />
              <Route path="prescriptions/:id" element={<Prescriptions />} />
              <Route path="imaging" element={<Imaging />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="alerts" element={<AlertDashboard />} />
              <Route path="financial" element={<Financial />} />
              <Route path="invoicing" element={<Invoicing />} />
              <Route path="services" element={<Services />} />
              <Route path="laboratory" element={<Laboratory />} />
              <Route path="laboratory/config" element={<LabConfiguration />} />
              <Route path="settings" element={
                <RoleGuard allowedRoles={['admin']} fallback="/home">
                  <Settings />
                </RoleGuard>
              } />
              <Route path="documents" element={<DocumentGeneration />} />
              {/* Visit Routes */}
              <Route path="visits/:id" element={<VisitDetail />} />
              <Route path="visits/:id/edit" element={<NewConsultation />} />
              <Route path="visits/new/:patientId" element={<NewConsultation />} />
              {/* Ophthalmology Routes */}
              <Route path="ophthalmology" element={<OphthalmologyDashboard />} />
              <Route path="ophthalmology/consultation" element={<NewConsultation />} />
              <Route path="ophthalmology/consultation/:patientId" element={<NewConsultation />} />
              <Route path="ophthalmology/refraction" element={<NewConsultation />} />
              <Route path="ophthalmology/exam/new" element={<NewConsultation />} />
              <Route path="ophthalmology/exam/:examId" element={<NewConsultation />} />
              <Route path="ophthalmology/glasses-order/:examId" element={<GlassesOrder />} />
              {/* StudioVision Native Consultation (Tab-based) */}
              <Route path="ophthalmology/studio/:patientId" element={<StudioVisionConsultation />} />
              {/* Glasses Orders Management Routes - List redirects to Optical Shop tab */}
              <Route path="glasses-orders" element={<Navigate to="/optical-shop?tab=orders" replace />} />
              <Route path="glasses-orders/:id" element={<GlassesOrderDetail />} />
              <Route path="glasses-orders/:id/delivery" element={<GlassesOrderDelivery />} />
              {/* IVT Routes */}
              <Route path="ivt" element={<IVTDashboard />} />
              <Route path="ivt/new" element={<IVTInjectionForm />} />
              <Route path="ivt/edit/:id" element={<IVTInjectionForm />} />
              <Route path="ivt/:id" element={<IVTDetail />} />
              {/* Surgery Routes */}
              <Route path="surgery" element={<SurgeryDashboard />} />
              <Route path="surgery/new" element={<NewSurgeryCase />} />
              <Route path="surgery/surgeon-view" element={<SurgeonView />} />
              <Route path="surgery/:id" element={<SurgeryCheckIn />} />
              <Route path="surgery/:id/checkin" element={<SurgeryCheckIn />} />
              <Route path="surgery/:id/report" element={<SurgeryReportForm />} />
              {/* Pharmacy Routes */}
              <Route path="pharmacy" element={<PharmacyDashboard />} />
              <Route path="pharmacy/new" element={<PharmacyDetail />} />
              <Route path="pharmacy/:id" element={<PharmacyDetail />} />
              {/* Device Integration Routes - Status and Discovery redirect to tabs */}
              <Route path="devices" element={<DeviceManager />} />
              <Route path="devices/status" element={<Navigate to="/devices?tab=status" replace />} />
              <Route path="devices/discovery" element={<Navigate to="/devices?tab=discovery" replace />} />
              <Route path="devices/:id" element={<DeviceDetail />} />
              <Route path="devices/:id/import" element={<DeviceImport />} />

              {/* OCR Import Routes */}
              <Route path="ocr/import" element={<ImportWizard />} />
              <Route path="ocr/review" element={<OCRReviewQueue />} />

              {/* Orthoptic Routes */}
              <Route path="orthoptic" element={<OrthopticExams />} />
              <Route path="orthoptic/new" element={<OrthopticExamForm />} />
              <Route path="orthoptic/:id" element={<OrthopticExamForm />} />

              {/* Prescription Queue - Redirect to Pharmacy page with tab */}
              <Route path="prescription-queue" element={<Navigate to="/pharmacy?tab=prescriptions" replace />} />

              {/* Lab Tech Worklist - Redirect to Laboratory page with tab */}
              <Route path="lab-worklist" element={<Navigate to="/laboratory?tab=worklist" replace />} />

              {/* Lab Check-in - Redirect to Laboratory page with tab */}
              <Route path="lab-checkin" element={<Navigate to="/laboratory?tab=checkin" replace />} />

              {/* Nurse Vitals Entry */}
              <Route path="nurse-vitals" element={<NurseVitalsEntry />} />

              {/* Unified Inventory (All inventories in tabbed view) */}
              <Route path="unified-inventory" element={<UnifiedInventory />} />

              {/* Role-Based Dashboard Views */}
              <Route path="receptionist" element={<ReceptionistView />} />
              <Route path="pharmacist-view" element={<PharmacistView />} />
              <Route path="optician-view" element={<OpticianView />} />
              <Route path="lab-tech-view" element={<LabTechView />} />

              {/* Lab Orders Management - Disabled (requires MUI) */}
              {/* <Route path="lab-orders" element={<LabOrders />} /> */}

              {/* Imaging Orders Management - Disabled (requires MUI) */}
              {/* <Route path="imaging-orders" element={<ImagingOrders />} /> */}

              {/* Admin Pages */}
              <Route path="audit" element={<AuditTrail />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="backups" element={<BackupManagement />} />

              {/* Procurement Routes */}
              <Route path="purchase-orders" element={<PurchaseOrders />} />
              <Route path="purchase-orders/new" element={<PurchaseOrders />} />
              <Route path="purchase-orders/:id" element={<PurchaseOrders />} />
              <Route path="purchase-orders/:id/edit" element={<PurchaseOrders />} />
              <Route path="stock-reconciliation" element={<StockReconciliation />} />
              <Route path="stock-reconciliation/new" element={<StockReconciliation />} />
              <Route path="stock-reconciliation/:id" element={<StockReconciliation />} />
              <Route path="stock-reconciliation/:id/count" element={<StockReconciliation />} />
              <Route path="warranties" element={<WarrantyManagement />} />
              <Route path="warranties/new" element={<WarrantyManagement />} />
              <Route path="warranties/:id" element={<WarrantyManagement />} />
              <Route path="warranties/:id/claim" element={<WarrantyManagement />} />
              <Route path="repairs" element={<RepairTracking />} />
              <Route path="repairs/new" element={<RepairForm />} />
              <Route path="repairs/:id" element={<RepairDetail />} />
              <Route path="repairs/:id/edit" element={<RepairForm />} />
              <Route path="repairs/:id/pickup" element={<RepairDetail />} />

              {/* Analytics Routes */}
              <Route path="analytics" element={<AnalyticsDashboard />} />

              {/* Template Management Routes */}
              <Route path="templates" element={<TemplateManager />} />
              <Route path="templates/new" element={<TemplateBuilder />} />
              <Route path="templates/:id" element={<TemplateBuilder />} />
              <Route path="templates/:id/preview" element={<TemplatePreview />} />

              {/* Visit Management Routes */}
              <Route path="visits" element={<VisitDashboard />} />
              <Route path="visits/:patientId/timeline" element={<VisitTimeline />} />

              {/* Companies & Convention Management */}
              <Route path="companies" element={<Companies />} />
              <Route path="companies/:id" element={<CompanyDetail />} />

              {/* Approvals (Délibérations) */}
              <Route path="approvals" element={<Approvals />} />

              {/* Audit Trail */}
              <Route path="audit" element={<AuditTrail />} />
              <Route path="audit-trail" element={<AuditTrail />} />

              {/* Financial Reports - alias for financial */}
              <Route path="financial-reports" element={<Financial />} />

              {/* Optical Inventory Routes - Redirect to UnifiedInventory */}
              <Route path="frame-inventory" element={<Navigate to="/unified-inventory?type=frame" replace />} />
              <Route path="contact-lens-inventory" element={<Navigate to="/unified-inventory?type=contact_lens" replace />} />
              <Route path="optical-lens-inventory" element={<Navigate to="/unified-inventory?type=optical_lens" replace />} />

              {/* Optical Shop Routes - Sub-pages redirect to tabs */}
              <Route path="optical-shop" element={<OpticalShopDashboard />} />
              <Route path="optical-shop/sale/:patientId" element={<OpticalShopNewSale />} />
              <Route path="optical-shop/verification" element={<Navigate to="/optical-shop?tab=verification" replace />} />
              <Route path="optical-shop/verification/:id" element={<OpticalShopVerification />} />
              <Route path="optical-shop/external-orders" element={<Navigate to="/optical-shop?tab=external" replace />} />
              <Route path="optical-shop/performance" element={<Navigate to="/optical-shop?tab=performance" replace />} />

              {/* Lab Inventory Routes - Redirect to UnifiedInventory */}
              <Route path="reagent-inventory" element={<Navigate to="/unified-inventory?type=reagent" replace />} />
              <Route path="lab-consumable-inventory" element={<Navigate to="/unified-inventory?type=lab_consumable" replace />} />

              {/* Multi-Clinic Operations (Unified page with tabs) */}
              <Route path="multi-clinic" element={<MultiClinic />} />

              {/* Ophthalmology Hub (Unified page with tabs) */}
              <Route path="eye-clinic" element={<OphthalmologyHub />} />

              {/* Finance Hub (Unified page with tabs) */}
              <Route path="finance" element={<FinanceHub />} />

              {/* Cross-Clinic Routes - Redirect to Multi-Clinic tabs */}
              <Route path="cross-clinic-inventory" element={<Navigate to="/multi-clinic?tab=inventory" replace />} />
              <Route path="cross-clinic-dashboard" element={<Navigate to="/multi-clinic?tab=dashboard" replace />} />
              <Route path="consolidated-reports" element={<Navigate to="/multi-clinic?tab=reports" replace />} />

              {/* External Facilities & Fulfillment Dispatch (Pay & Dispatch Externally) */}
              <Route path="external-facilities" element={<ExternalFacilities />} />
              <Route path="dispatch-dashboard" element={<DispatchDashboard />} />
            </Route>
          </Route>

          {/* Patient Portal */}
          <Route path="/patient/login" element={<PatientLogin />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/patient" element={<PatientLayout />}>
              <Route index element={<Navigate to="/patient/dashboard" replace />} />
              <Route path="dashboard" element={<PatientDashboard />} />
              <Route path="appointments" element={<PatientAppointments />} />
              <Route path="prescriptions" element={<PatientPrescriptions />} />
              <Route path="bills" element={<PatientBills />} />
              <Route path="results" element={<PatientResults />} />
              <Route path="messages" element={<PatientMessages />} />
              <Route path="profile" element={<PatientProfile />} />
            </Route>
          </Route>

          {/* 404 - Catch all unmatched routes */}
          <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
              />
              {/* Conflict Resolution Modal - Root Level */}
              {showConflictModal && selectedConflict && (
                <ConflictResolutionModal
                  isOpen={showConflictModal}
                  onClose={() => setShowConflictModal(false)}
                  conflict={selectedConflict}
                  onResolved={handleConflictResolved}
                />
              )}
              </PatientCacheProvider>
              </PatientProvider>
              </StudioVisionModeProvider>
              </ClinicProvider>
            </AuthProvider>
          </BrowserRouter>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;
// Force reload
