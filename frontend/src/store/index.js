import { configureStore } from '@reduxjs/toolkit';
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist';
import storage from 'redux-persist/lib/storage';

// Import slices
import authReducer from './slices/authSlice';
import patientReducer from './slices/patientSlice';
import appointmentReducer from './slices/appointmentSlice';
import visitReducer from './slices/visitSlice';
import prescriptionReducer from './slices/prescriptionSlice';
import billingReducer from './slices/billingSlice';
import documentReducer from './slices/documentSlice';
import uiReducer from './slices/uiSlice';
import notificationReducer from './slices/notificationSlice';
import queueReducer from './slices/queueSlice';

// Persist configurations
const authPersistConfig = {
  key: 'auth',
  storage,
  whitelist: ['user', 'token', 'isAuthenticated', 'rememberMe'],
};

const uiPersistConfig = {
  key: 'ui',
  storage,
  whitelist: ['sidebarCollapsed', 'theme', 'language', 'preferences'],
};

// Apply persist to specific reducers
const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);
const persistedUiReducer = persistReducer(uiPersistConfig, uiReducer);

// Configure store
export const store = configureStore({
  reducer: {
    auth: persistedAuthReducer,
    patient: patientReducer,
    appointment: appointmentReducer,
    visit: visitReducer,
    prescription: prescriptionReducer,
    billing: billingReducer,
    document: documentReducer,
    ui: persistedUiReducer,
    notification: notificationReducer,
    queue: queueReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
        // Ignore these field paths in all actions
        ignoredActionPaths: ['meta.arg', 'payload.timestamp'],
        // Ignore these paths in the state
        ignoredPaths: ['auth.user', 'ui.modals'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export const persistor = persistStore(store);

// Export types for TypeScript (optional but useful for future)
export const RootState = store.getState;
export const AppDispatch = store.dispatch;

export default store;