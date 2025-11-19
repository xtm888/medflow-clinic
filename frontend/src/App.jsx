import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import { AuthProvider } from './contexts/AuthContext';
import { PatientProvider } from './contexts/PatientContext';
import { useEffect, lazy, Suspense } from 'react';
import ProtectedRoute from './components/ProtectedRoute';
// OfflineIndicator moved to MainLayout header
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';
import logger from './services/logger';

// Lazy load pages for better performance (Code Splitting)
// Critical pages loaded immediately
import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';
import PatientLayout from './layouts/PatientLayout';

// Lazy load all other pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Patients = lazy(() => import('./pages/Patients'));
const Queue = lazy(() => import('./pages/Queue'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Prescriptions = lazy(() => import('./pages/Prescriptions'));
const Imaging = lazy(() => import('./pages/Imaging'));
const Notifications = lazy(() => import('./pages/Notifications'));
const AlertDashboard = lazy(() => import('./pages/AlertDashboard'));
const Financial = lazy(() => import('./pages/Financial'));
const Invoicing = lazy(() => import('./pages/Invoicing'));
const Services = lazy(() => import('./pages/Services'));
const Settings = lazy(() => import('./pages/Settings'));
const PatientVisit = lazy(() => import('./pages/PatientVisit'));
const DocumentGeneration = lazy(() => import('./pages/DocumentGeneration'));
const Laboratory = lazy(() => import('./pages/Laboratory'));
// Ophthalmology Pages
const OphthalmologyDashboard = lazy(() => import('./pages/ophthalmology/OphthalmologyDashboard'));
const RefractionExam = lazy(() => import('./pages/ophthalmology/RefractionExam'));
const GlassesOrder = lazy(() => import('./pages/ophthalmology/GlassesOrder'));
const NewConsultation = lazy(() => import('./pages/ophthalmology/NewConsultation'));
// IVT Pages
const IVTDashboard = lazy(() => import('./pages/IVTDashboard'));
const IVTInjectionForm = lazy(() => import('./pages/IVTInjectionForm'));
const IVTDetail = lazy(() => import('./pages/IVTDetail'));
// Pharmacy Pages
const PharmacyDashboard = lazy(() => import('./pages/PharmacyDashboard'));
const PharmacyDetail = lazy(() => import('./pages/PharmacyDetail'));
// Device Integration Pages
const DeviceManager = lazy(() => import('./pages/DeviceManager'));
const DeviceDetail = lazy(() => import('./pages/DeviceDetail'));
const DeviceImport = lazy(() => import('./pages/DeviceImport'));
const DeviceStatusDashboard = lazy(() => import('./pages/DeviceStatusDashboard'));
const PatientDetail = lazy(() => import('./pages/PatientDetail'));
const PatientSummary = lazy(() => import('./pages/PatientSummary'));
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

function App() {
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
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <BrowserRouter>
            <AuthProvider>
              <PatientProvider>
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
          {/* Login Page */}
          <Route path="/login" element={<Login />} />

          {/* Public Booking Pages (No Auth Required) */}
          <Route path="/book" element={<PublicBooking />} />
          <Route path="/booking/confirmation" element={<BookingConfirmation />} />

          {/* Protected Staff/Admin Portal */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="patients" element={<Patients />} />
              <Route path="patients/:patientId" element={<PatientDetail />} />
              <Route path="patients/:patientId/summary" element={<PatientSummary />} />
              <Route path="queue" element={<Queue />} />
              <Route path="appointments" element={<Appointments />} />
              <Route path="prescriptions" element={<Prescriptions />} />
              <Route path="imaging" element={<Imaging />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="alerts" element={<AlertDashboard />} />
              <Route path="financial" element={<Financial />} />
              <Route path="invoicing" element={<Invoicing />} />
              <Route path="services" element={<Services />} />
              <Route path="laboratory" element={<Laboratory />} />
              <Route path="settings" element={<Settings />} />
              <Route path="documents" element={<DocumentGeneration />} />
              {/* Visit Routes */}
              <Route path="visits/:id" element={<PatientVisit />} />
              <Route path="visits/new/:patientId" element={<PatientVisit />} />
              {/* Ophthalmology Routes */}
              <Route path="ophthalmology" element={<OphthalmologyDashboard />} />
              <Route path="ophthalmology/consultation" element={<NewConsultation />} />
              <Route path="ophthalmology/refraction" element={<RefractionExam />} />
              <Route path="ophthalmology/glasses-order/:examId" element={<GlassesOrder />} />
              {/* IVT Routes */}
              <Route path="ivt" element={<IVTDashboard />} />
              <Route path="ivt/new" element={<IVTInjectionForm />} />
              <Route path="ivt/edit/:id" element={<IVTInjectionForm />} />
              <Route path="ivt/:id" element={<IVTDetail />} />
              {/* Pharmacy Routes */}
              <Route path="pharmacy" element={<PharmacyDashboard />} />
              <Route path="pharmacy/new" element={<PharmacyDetail />} />
              <Route path="pharmacy/:id" element={<PharmacyDetail />} />
              {/* Device Integration Routes */}
              <Route path="devices" element={<DeviceManager />} />
              <Route path="devices/status" element={<DeviceStatusDashboard />} />
              <Route path="devices/:id" element={<DeviceDetail />} />
              <Route path="devices/:id/import" element={<DeviceImport />} />
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
              </PatientProvider>
            </AuthProvider>
          </BrowserRouter>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;
// Force reload
