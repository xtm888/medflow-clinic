import { useDispatch, useSelector } from 'react-redux';
import { bindActionCreators } from '@reduxjs/toolkit';
import * as authActions from '../store/slices/authSlice';
import * as patientActions from '../store/slices/patientSlice';
import * as appointmentActions from '../store/slices/appointmentSlice';
import * as visitActions from '../store/slices/visitSlice';
import * as uiActions from '../store/slices/uiSlice';
import * as notificationActions from '../store/slices/notificationSlice';

// Custom hook for dispatch
export const useAppDispatch = () => useDispatch();

// Custom hook for selector
export const useAppSelector = useSelector;

// Auth hooks
export const useAuth = () => {
  const dispatch = useDispatch();
  const auth = useSelector((state) => state.auth);
  const actions = bindActionCreators(authActions, dispatch);

  return {
    ...auth,
    ...actions,
    isLoggedIn: auth.isAuthenticated,
    hasPermission: (permission) => {
      if (!auth.permissions) return false;
      const [module, action] = permission.split('.');
      return auth.permissions[module]?.[action] === true;
    },
    hasRole: (role) => auth.user?.role === role,
  };
};

// Patient hooks
export const usePatients = () => {
  const dispatch = useDispatch();
  const patients = useSelector((state) => state.patient);
  const actions = bindActionCreators(patientActions, dispatch);

  return {
    ...patients,
    ...actions,
  };
};

// Appointment hooks
export const useAppointments = () => {
  const dispatch = useDispatch();
  const appointments = useSelector((state) => state.appointment);
  const actions = bindActionCreators(appointmentActions, dispatch);

  return {
    ...appointments,
    ...actions,
  };
};

// Visit hooks
export const useVisits = () => {
  const dispatch = useDispatch();
  const visits = useSelector((state) => state.visit);
  const actions = bindActionCreators(visitActions, dispatch);

  return {
    ...visits,
    ...actions,
  };
};

// UI hooks
export const useUI = () => {
  const dispatch = useDispatch();
  const ui = useSelector((state) => state.ui);
  const actions = bindActionCreators(uiActions, dispatch);

  return {
    ...ui,
    ...actions,
    isDarkMode: ui.theme === 'dark',
    isSidebarOpen: !ui.sidebarCollapsed,
  };
};

// Notification hooks
export const useNotifications = () => {
  const dispatch = useDispatch();
  const notifications = useSelector((state) => state.notification);
  const actions = bindActionCreators(notificationActions, dispatch);

  return {
    ...notifications,
    ...actions,
    hasUnread: notifications.unreadCount > 0,
  };
};

// Combined hook for common operations
export const useStore = () => {
  return {
    auth: useAuth(),
    patients: usePatients(),
    appointments: useAppointments(),
    visits: useVisits(),
    ui: useUI(),
    notifications: useNotifications(),
  };
};

// Specific selector hooks
export const useCurrentUser = () => useSelector((state) => state.auth.user);
export const useCurrentPatient = () => useSelector((state) => state.patient.currentPatient);
export const useCurrentAppointment = () => useSelector((state) => state.appointment.currentAppointment);
export const useCurrentVisit = () => useSelector((state) => state.visit.currentVisit);
export const useIsLoading = () => {
  const authLoading = useSelector((state) => state.auth.isLoading);
  const patientLoading = useSelector((state) => state.patient.isLoading);
  const appointmentLoading = useSelector((state) => state.appointment.isLoading);
  const visitLoading = useSelector((state) => state.visit.isLoading);
  const globalLoading = useSelector((state) => state.ui.loading.global);

  return authLoading || patientLoading || appointmentLoading || visitLoading || globalLoading;
};

export default {
  useAppDispatch,
  useAppSelector,
  useAuth,
  usePatients,
  useAppointments,
  useVisits,
  useUI,
  useNotifications,
  useStore,
  useCurrentUser,
  useCurrentPatient,
  useCurrentAppointment,
  useCurrentVisit,
  useIsLoading,
};