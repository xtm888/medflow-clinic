// PM2 Ecosystem Configuration for MedFlow
// Usage: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      name: 'medflow-backend',
      cwd: './backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'medflow-face-service',
      cwd: './face-service',
      script: 'venv/bin/gunicorn',
      args: '--bind 127.0.0.1:5002 --workers 2 --timeout 120 app:app',
      interpreter: 'none',
      watch: false,
      max_memory_restart: '300M',
      env: {
        PYTHONUNBUFFERED: '1'
      },
      error_file: './logs/face-error.log',
      out_file: './logs/face-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
