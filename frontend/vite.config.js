import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@modules': path.resolve(__dirname, './src/modules'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@services': path.resolve(__dirname, './src/services'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  server: {
    port: 5173,
    hmr: {
      port: 5173,
      host: 'localhost',
    },
    proxy: {
      // Proxy static assets served by backend
      // Only proxy paths that are clearly asset directories, not frontend routes
      '/datasets': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      // /imaging/dicom and /imaging/oct are backend static assets
      // but /imaging alone is a frontend route
      '/imaging/dicom': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/imaging/oct': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/images_ophta': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  build: {
    // CRITICAL: Disable source maps in production to prevent code exposure
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Node modules chunking strategy
          if (id.includes('node_modules')) {
            // React core - loaded on every page
            if (id.includes('react-dom') || id.includes('/react/')) {
              return 'vendor-react';
            }
            // React Router - navigation
            if (id.includes('react-router')) {
              return 'vendor-router';
            }
            // Redux ecosystem
            if (id.includes('@reduxjs/toolkit') || id.includes('react-redux') || id.includes('redux-persist') || id.includes('/redux/')) {
              return 'vendor-redux';
            }
            // Charting library (large, only needed on dashboards/analytics)
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            // Data fetching and caching
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            // Offline/IndexedDB
            if (id.includes('dexie')) {
              return 'vendor-offline';
            }
            // Real-time communication
            if (id.includes('socket.io-client')) {
              return 'vendor-socket';
            }
            // Date utilities
            if (id.includes('date-fns')) {
              return 'vendor-date';
            }
            // Form validation
            if (id.includes('yup')) {
              return 'vendor-validation';
            }
            // HTTP client
            if (id.includes('axios')) {
              return 'vendor-http';
            }
            // UI components (icons, toasts)
            if (id.includes('lucide-react') || id.includes('react-toastify')) {
              return 'vendor-ui';
            }
            // Security (DOMPurify, sanitization)
            if (id.includes('dompurify')) {
              return 'vendor-security';
            }
            // Error monitoring (can load async)
            if (id.includes('@sentry')) {
              return 'vendor-monitoring';
            }
            // Service workers / PWA
            if (id.includes('workbox')) {
              return 'vendor-pwa';
            }
            // Virtualization for long lists
            if (id.includes('@tanstack/react-virtual')) {
              return 'vendor-virtual';
            }
            // All other node_modules go to a common vendor chunk
            return 'vendor-common';
          }

          // Application code chunking by feature/module
          // Large pages that should be lazy-loaded
          if (id.includes('/pages/Settings')) {
            return 'page-settings';
          }
          // Ophthalmology - split into sub-modules for better loading
          if (id.includes('/pages/ophthalmology/GlassesOrder')) {
            return 'page-ophtha-glasses';
          }
          if (id.includes('/pages/ophthalmology/StudioVision') || id.includes('StudioVisionConsultation')) {
            return 'page-ophtha-studio';
          }
          if (id.includes('/pages/ophthalmology/NewConsultation')) {
            return 'page-ophtha-newconsult';
          }
          if (id.includes('/pages/ophthalmology/components/IOL')) {
            return 'page-ophtha-iol';
          }
          if (id.includes('/pages/ophthalmology/') || id.includes('/pages/Ophthalmology')) {
            return 'page-ophthalmology';
          }
          // Contact lens fitting is large
          if (id.includes('/pages/ContactLensFitting')) {
            return 'page-contactlens';
          }
          if (id.includes('/pages/Laboratory')) {
            return 'page-laboratory';
          }
          if (id.includes('/pages/Pharmacy')) {
            return 'page-pharmacy';
          }
          if (id.includes('/pages/Billing') || id.includes('/pages/Invoicing')) {
            return 'page-billing';
          }
          if (id.includes('/pages/Reports') || id.includes('/pages/Analytics')) {
            return 'page-analytics';
          }
          if (id.includes('/pages/Surgery')) {
            return 'page-surgery';
          }
          if (id.includes('/pages/Inventory')) {
            return 'page-inventory';
          }
          // Patients is also large
          if (id.includes('/pages/Patients')) {
            return 'page-patients';
          }
        },
      },
    },
    // Increase limit slightly since we have many small chunks now
    chunkSizeWarningLimit: 600,
  },
})
