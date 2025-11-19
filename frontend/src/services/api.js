import axios from 'axios';
import logger from './logger';

// API Base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Send cookies with requests
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Track if we're already redirecting to prevent multiple redirects
let isRedirectingToLogin = false;

// Function to reset redirect flag (call after successful login)
export const resetRedirectFlag = () => {
  isRedirectingToLogin = false;
};

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    // Reset flag on successful response (user is authenticated)
    if (response.config.url?.includes('/auth/login')) {
      isRedirectingToLogin = false;
    }
    return response;
  },
  (error) => {
    if (error.response) {
      // Server responded with error status
      if (error.response.status === 401) {
        // Unauthorized - redirect to login only if not already redirecting
        // and not already on login page
        const isOnLoginPage = window.location.pathname === '/login';
        if (!isRedirectingToLogin && !isOnLoginPage) {
          isRedirectingToLogin = true;
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          // Use setTimeout to allow current operations to complete
          setTimeout(() => {
            window.location.href = '/login';
            // Reset flag after redirect to allow future redirects
            setTimeout(() => {
              isRedirectingToLogin = false;
            }, 500);
          }, 100);
        }
      } else if (error.response.status === 403) {
        // Forbidden - show permission error
        logger.error('Permission denied');
      } else if (error.response.status === 500) {
        // Server error
        logger.error('Server error:', error.response.data);
      }
    } else if (error.request) {
      // Request made but no response
      logger.error('Network error - no response from server');
    } else {
      // Something else happened
      logger.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;