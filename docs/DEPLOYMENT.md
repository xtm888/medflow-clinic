# MedFlow Deployment Guide

## Deployment Options

### Option 1: Single Server (Small Clinic)
- All services on one machine
- Suitable for < 100 concurrent users
- Simple setup and maintenance

### Option 2: Multi-Server (Multi-Clinic)
- Separate frontend, backend, database servers
- Central sync server for data replication
- Horizontal scaling capability

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 50 GB SSD | 200+ GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

### Software Requirements

```bash
# Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# MongoDB 7
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Redis
sudo apt-get install -y redis-server

# Nginx
sudo apt-get install -y nginx

# PM2 (Process Manager)
sudo npm install -g pm2
```

## Production Setup

### 1. Clone and Build

```bash
# Clone repository
git clone <repository-url> /opt/medflow
cd /opt/medflow

# Backend
cd backend
npm ci --production
cp .env.production .env
# Edit .env with production values

# Frontend
cd ../frontend
npm ci
npm run build
```

### 2. Environment Configuration

Create `/opt/medflow/backend/.env`:

```env
# Server
NODE_ENV=production
PORT=5001

# Database
MONGO_URI=mongodb://localhost:27017/medflow

# Authentication (generate strong secrets!)
JWT_SECRET=your-256-bit-secret-key-here
JWT_EXPIRE=15m
REFRESH_TOKEN_SECRET=your-different-256-bit-secret-here
REFRESH_TOKEN_EXPIRE=30d
SESSION_SECRET=your-session-secret-here

# Redis
REDIS_URL=redis://localhost:6379

# Email
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=noreply@example.com
EMAIL_PASS=email-password
EMAIL_FROM=MedFlow <noreply@example.com>

# SMS (Twilio)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# File Storage
UPLOAD_DIR=/opt/medflow/uploads
MAX_FILE_SIZE=50000000

# Clinic
CLINIC_NAME=My Clinic
CLINIC_ID=clinic-identifier
```

### 3. MongoDB Configuration

Edit `/etc/mongod.conf`:

```yaml
storage:
  dbPath: /var/lib/mongodb
  journal:
    enabled: true

systemLog:
  destination: file
  path: /var/log/mongodb/mongod.log
  logAppend: true

net:
  port: 27017
  bindIp: 127.0.0.1

security:
  authorization: enabled

replication:
  replSetName: rs0
```

Initialize replica set (required for transactions):

```bash
mongosh

rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "localhost:27017" }]
})
```

Create database user:

```javascript
use medflow

db.createUser({
  user: "medflow",
  pwd: "secure-password",
  roles: [{ role: "readWrite", db: "medflow" }]
})
```

### 4. PM2 Process Management

Create `/opt/medflow/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'medflow-api',
      cwd: '/opt/medflow/backend',
      script: 'server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      },
      max_memory_restart: '1G',
      error_file: '/var/log/medflow/api-error.log',
      out_file: '/var/log/medflow/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'medflow-face-service',
      cwd: '/opt/medflow/face-service',
      script: 'venv/bin/uvicorn',
      args: 'app:app --host 0.0.0.0 --port 5002',
      instances: 1,
      env: {
        PYTHON_ENV: 'production'
      }
    }
  ]
};
```

Start services:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Nginx Configuration

Create `/etc/nginx/sites-available/medflow`:

```nginx
upstream medflow_api {
    least_conn;
    server 127.0.0.1:5001;
}

server {
    listen 80;
    server_name medflow.example.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name medflow.example.com;

    # SSL certificates (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/medflow.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/medflow.example.com/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend (static files)
    root /opt/medflow/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API proxy
    location /api {
        proxy_pass http://medflow_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;

        # File uploads
        client_max_body_size 50M;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://medflow_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Health check
    location /health {
        proxy_pass http://medflow_api/api/health;
    }
}
```

Enable and restart:

```bash
sudo ln -s /etc/nginx/sites-available/medflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. SSL Certificates

Using Let's Encrypt:

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d medflow.example.com
```

### 7. Firewall Configuration

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

## Backup Strategy

### Database Backup

Create `/opt/medflow/scripts/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup
mongodump --uri="mongodb://localhost:27017/medflow" \
  --out="$BACKUP_DIR/$DATE" \
  --gzip

# Upload to S3 (optional)
# aws s3 sync "$BACKUP_DIR/$DATE" "s3://your-bucket/backups/$DATE"

# Clean old backups
find $BACKUP_DIR -type d -mtime +$RETENTION_DAYS -exec rm -rf {} +
```

Schedule with cron:

```bash
crontab -e
# Add:
0 2 * * * /opt/medflow/scripts/backup.sh >> /var/log/medflow/backup.log 2>&1
```

### File Backup

```bash
# Backup uploads directory
rsync -avz /opt/medflow/uploads/ /backups/uploads/
```

## Monitoring

### PM2 Monitoring

```bash
pm2 monit           # Real-time dashboard
pm2 logs            # View logs
pm2 status          # Process status
```

### Health Checks

```bash
# API health
curl http://localhost:5001/api/health

# MongoDB
mongosh --eval "db.adminCommand('ping')"

# Redis
redis-cli ping
```

### Log Files

| Service | Log Location |
|---------|--------------|
| API | /var/log/medflow/api-*.log |
| MongoDB | /var/log/mongodb/mongod.log |
| Nginx | /var/log/nginx/*.log |
| PM2 | ~/.pm2/logs/ |

## Scaling

### Horizontal Scaling

1. **Add API Instances**
```bash
pm2 scale medflow-api +2
```

2. **Load Balancer**
Add more upstream servers in Nginx:
```nginx
upstream medflow_api {
    least_conn;
    server 127.0.0.1:5001;
    server 192.168.1.10:5001;
    server 192.168.1.11:5001;
}
```

3. **Database Replica Set**
```javascript
rs.add("mongodb-secondary:27017")
rs.add({ host: "mongodb-arbiter:27017", arbiterOnly: true })
```

### Redis Cluster

For high availability:

```bash
# Install Redis Sentinel
sudo apt-get install redis-sentinel
```

## Troubleshooting

### Common Issues

**API Not Starting**
```bash
pm2 logs medflow-api --lines 50
# Check for port conflicts, missing env vars
```

**MongoDB Connection Failed**
```bash
sudo systemctl status mongod
mongosh --eval "rs.status()"
```

**502 Bad Gateway**
```bash
# Check if API is running
pm2 status
# Check Nginx upstream
sudo nginx -t
```

**High Memory Usage**
```bash
pm2 monit
# Restart with memory limit
pm2 restart medflow-api --max-memory-restart 1G
```

### Recovery Procedures

**Restore Database**
```bash
mongorestore --uri="mongodb://localhost:27017/medflow" \
  --gzip \
  /backups/mongodb/YYYYMMDD_HHMMSS/medflow
```

**Rollback Deployment**
```bash
cd /opt/medflow
git checkout <previous-tag>
npm ci --production
pm2 restart all
```

## Security Checklist

- [ ] Strong JWT secrets (256-bit)
- [ ] MongoDB authentication enabled
- [ ] Redis password protected
- [ ] HTTPS enforced
- [ ] Firewall configured
- [ ] Rate limiting active
- [ ] Regular backups scheduled
- [ ] Security headers configured
- [ ] Audit logging enabled
- [ ] 2FA available for admin users
