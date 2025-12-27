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
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
          'vendor-ui': ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
})
