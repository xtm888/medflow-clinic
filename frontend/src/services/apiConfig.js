import axios from 'axios';
import { toast } from 'react-toastify';

// Create axios instance with base configuration
// SECURITY: withCredentials enables HttpOnly cookies for XSS-safe authentication
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5001/api`,
  timeout: 60000, // Increased to 60 seconds for slow/unreliable connections
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // SECURITY: Enable HttpOnly cookie authentication
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

// Helper to get CSRF token from cookie
function getCsrfToken() {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Request interceptor for clinic context and CSRF (auth handled by HttpOnly cookies)
api.interceptors.request.use(
  (config) => {
    // SECURITY: Authentication handled by HttpOnly cookies (withCredentials: true)
    // No need to manually add Authorization header - cookies are sent automatically

    // SECURITY: Add CSRF token for state-changing requests
    // Token is read from XSRF-TOKEN cookie (set by server, readable by JS)
    if (!['GET', 'HEAD', 'OPTIONS'].includes(config.method?.toUpperCase())) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-XSRF-TOKEN'] = csrfToken;
      }
    }

    // Add clinic context header for multi-clinic support
    // Backend middleware reads X-Clinic-ID to filter data by clinic
    const selectedClinicId = localStorage.getItem('medflow_selected_clinic');
    if (selectedClinicId && selectedClinicId !== 'all') {
      config.headers['X-Clinic-ID'] = selectedClinicId;
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

    // Handle 401 Unauthorized - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Skip refresh attempt if this IS the refresh endpoint failing
      if (originalRequest.url?.includes('/auth/refresh')) {
        // Refresh token expired, redirect to login
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((success, refreshError) => {
            if (refreshError) {
              reject(refreshError);
            } else if (success) {
              // Retry with refreshed cookie (automatically sent)
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
        // SECURITY: Refresh token sent automatically via HttpOnly cookie
        await api.post('/auth/refresh');

        // Notify all waiting requests - token refreshed via cookie
        onTokenRefreshed(true);

        // Retry original request (new access token cookie sent automatically)
        return api(originalRequest);
      } catch (refreshError) {
        // Notify all waiting requests of failure
        onRefreshFailed(refreshError);

        // Refresh failed, redirect to login
        localStorage.removeItem('user');
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
