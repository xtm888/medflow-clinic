import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './store';
import { AuthProvider } from './contexts/AuthContext';
import { useEffect } from 'react';
import ProtectedRoute from './components/ProtectedRoute';
import OfflineIndicator from './components/OfflineIndicator';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';
import PatientLayout from './layouts/PatientLayout';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Queue from './pages/Queue';
import Appointments from './pages/Appointments';
import Pharmacy from './pages/Pharmacy';
import Prescriptions from './pages/Prescriptions';
import Imaging from './pages/Imaging';
import Notifications from './pages/Notifications';
import Financial from './pages/Financial';
import Invoicing from './pages/Invoicing';
import Services from './pages/Services';
import Settings from './pages/Settings';
// Ophthalmology Pages
import OphthalmologyDashboard from './pages/ophthalmology/OphthalmologyDashboard';
import RefractionExam from './pages/ophthalmology/RefractionExam';
import OphthalmicPharmacy from './pages/ophthalmology/OphthalmicPharmacy';
// Patient Portal Pages
import PatientLogin from './pages/patient/PatientLogin';
import PatientDashboard from './pages/patient/PatientDashboard';
import PatientAppointments from './pages/patient/PatientAppointments';
import PatientPrescriptions from './pages/patient/PatientPrescriptions';
import PatientBills from './pages/patient/PatientBills';
import PatientResults from './pages/patient/PatientResults';
import PatientMessages from './pages/patient/PatientMessages';
import PatientProfile from './pages/patient/PatientProfile';
// Public Booking Pages
import PublicBooking from './pages/PublicBooking';
import BookingConfirmation from './pages/BookingConfirmation';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';

function App() {
  useEffect(() => {
    // Register service worker for offline functionality
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered:', registration);

          // Check for updates periodically
          setInterval(() => {
            registration.update();
          }, 60000); // Check every minute
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
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
              <Route path="queue" element={<Queue />} />
              <Route path="appointments" element={<Appointments />} />
              <Route path="pharmacy" element={<Pharmacy />} />
              <Route path="prescriptions" element={<Prescriptions />} />
              <Route path="imaging" element={<Imaging />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="financial" element={<Financial />} />
              <Route path="invoicing" element={<Invoicing />} />
              <Route path="services" element={<Services />} />
              <Route path="settings" element={<Settings />} />
              {/* Ophthalmology Routes */}
              <Route path="ophthalmology" element={<OphthalmologyDashboard />} />
              <Route path="ophthalmology/refraction" element={<RefractionExam />} />
              <Route path="ophthalmology/pharmacy" element={<OphthalmicPharmacy />} />
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
        <OfflineIndicator />
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
            </AuthProvider>
          </BrowserRouter>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
}

export default App;
