// PM2 Production Ecosystem Configuration for MedFlow
// Usage on SERVEUR: pm2 start ecosystem.production.config.js
//
// Production server: SERVEUR (Windows 10)
// IP: 100.73.34.191 (via Meshnet)
// Backend port: 5002
// MongoDB: localhost:27017

module.exports = {
  apps: [
    {
      name: 'medflow-backend',
      cwd: 'E:\\MedFlow\\matrix-backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5002,
        FRONTEND_PATH: 'E:\\MedFlow\\frontend\\dist'
      },
      // Log configuration
      error_file: 'E:\\MedFlow\\logs\\backend-error.log',
      out_file: 'E:\\MedFlow\\logs\\backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // Graceful shutdown configuration
      kill_timeout: 10000,
      wait_ready: true,
      listen_timeout: 30000,
      // Restart behavior
      autorestart: true,
      max_restarts: 10,
      restart_delay: 4000
    }
  ]
};
