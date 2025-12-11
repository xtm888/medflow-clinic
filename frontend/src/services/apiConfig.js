import axios from 'axios';
import { toast } from 'react-toastify';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5001/api`,
  timeout: 60000, // Increased to 60 seconds for slow/unreliable connections
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token refresh state management - prevents race conditions
let isRefreshing = false;
let refreshSubscribers = [];

// Subscribe a request to wait for token refresh
const subscribeTokenRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

// Notify all waiting requests that token has been refreshed
const onTokenRefreshed = (newToken) => {
  refreshSubscribers.forEach(callback => callback(newToken));
  refreshSubscribers = [];
};

// Notify all waiting requests that refresh failed
const onRefreshFailed = (error) => {
  refreshSubscribers.forEach(callback => callback(null, error));
  refreshSubscribers = [];
};

// Request interceptor for authentication and clinic context
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add clinic context header for multi-clinic support
    // Backend middleware reads X-Clinic-ID to filter data by clinic
    const selectedClinicId = localStorage.getItem('medflow_selected_clinic');
    console.log('🏥 API Interceptor - Selected Clinic ID:', selectedClinicId);
    if (selectedClinicId && selectedClinicId !== 'all') {
      config.headers['X-Clinic-ID'] = selectedClinicId;
      console.log('✅ Setting X-Clinic-ID header:', selectedClinicId);
    } else {
      console.log('ℹ️ No clinic filter (All Clinics mode)');
    }

    // Add loading indicator for long requests
    if (config.showLoader !== false) {
      window.dispatchEvent(new CustomEvent('api-request-start'));
    }

    return config;
  },
  (error) => {
    window.dispatchEvent(new CustomEvent('api-request-end'));
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    window.dispatchEvent(new CustomEvent('api-request-end'));
    return response;
  },
  async (error) => {
    window.dispatchEvent(new CustomEvent('api-request-end'));

    const originalRequest = error.config;

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        // No refresh token, redirect to login
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((newToken, refreshError) => {
            if (refreshError) {
              reject(refreshError);
            } else if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(api(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      // Start refresh process
      isRefreshing = true;

      try {
        const response = await api.post('/auth/refresh', { refreshToken });

        const { token } = response.data;
        localStorage.setItem('token', token);

        // Notify all waiting requests
        onTokenRefreshed(token);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Notify all waiting requests of failure
        onRefreshFailed(refreshError);

        // Refresh failed, redirect to login
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle other errors
    if (error.response) {
      const message = error.response.data?.message || error.response.data?.error || 'Une erreur est survenue';

      switch (error.response.status) {
        case 400:
          toast.error(`Requête invalide : ${message}`);
          break;
        case 403:
          // Silent redirect on permission denial - no toast notification
          // If user sees this, it means:
          // 1. They're manipulating URLs/API calls (attacker)
          // 2. There's a bug in our permission gates (developer error)
          // Either way, don't give them any information
          if (window.location.pathname !== '/dashboard') {
            window.location.href = '/dashboard';
          }
          break;
        case 404:
          toast.error('Ressource demandée introuvable');
          break;
        case 422:
          // Validation errors
          if (error.response.data?.errors) {
            Object.values(error.response.data.errors).forEach(err => {
              toast.error(err);
            });
          } else {
            toast.error(message);
          }
          break;
        case 500:
          toast.error('Erreur serveur. Veuillez réessayer plus tard.');
          break;
        default:
          toast.error(message);
      }
    } else if (error.request) {
      toast.error('Erreur réseau. Veuillez vérifier votre connexion.');
    } else {
      toast.error('Une erreur inattendue est survenue');
    }

    return Promise.reject(error);
  }
);

// Helper functions for common API calls
export const apiHelpers = {
  // GET request
  get: (url, config = {}) => api.get(url, config),

  // POST request
  post: (url, data = {}, config = {}) => api.post(url, data, config),

  // PUT request
  put: (url, data = {}, config = {}) => api.put(url, data, config),

  // DELETE request
  delete: (url, config = {}) => api.delete(url, config),

  // File upload
  upload: (url, formData, onProgress) => {
    return api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });
  },

  // Batch requests
  batch: (requests) => Promise.all(requests),
};

export default api;
