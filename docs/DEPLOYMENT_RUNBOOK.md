# MedFlow Deployment Runbook

This runbook provides operational procedures for deploying and maintaining MedFlow on the production server (SERVEUR).

---

## 1. Overview

### Server Details

| Property | Value |
|----------|-------|
| Hostname | SERVEUR |
| IP Address | 100.73.34.191 (via NordVPN Meshnet) |
| OS | Windows 10 |
| Backend Port | 5002 |
| MongoDB Port | 27017 |
| Process Manager | PM2 |

### Components

| Component | Technology | Location |
|-----------|------------|----------|
| Backend API | Node.js 20.x / Express | `E:\MedFlow\matrix-backend` |
| Frontend | React / Vite build | `E:\MedFlow\frontend\dist` |
| Database | MongoDB 7.0.5 | localhost:27017 |
| Process Manager | PM2 | Windows Service |

### Architecture

```
                    +-----------------+
   Internet  ---->  |    SERVEUR      |
   (Meshnet)        |  100.73.34.191  |
                    +-----------------+
                           |
                           v
                    +-----------------+
                    |  PM2 Service    |
                    | (Windows)       |
                    +-----------------+
                           |
              +------------+------------+
              |                         |
              v                         v
    +------------------+      +------------------+
    | medflow-backend  |      | MongoDB          |
    | Port 5002        |<---->| Port 27017       |
    | (serves frontend)|      +------------------+
    +------------------+
```

---

## 2. Prerequisites

### System Requirements

- Node.js 18+ installed
- MongoDB 7.x running as Windows Service
- PM2 installed globally: `npm install -g pm2`
- NordVPN Meshnet for remote access

### PM2 Windows Service Setup (CRITICAL)

PM2 must run as a Windows Service to survive reboots and user logouts.

```powershell
# 1. Install pm2-installer (as Administrator)
npm install -g @innomizetech/pm2-installer

# 2. Install PM2 as Windows service
pm2-service-install

# 3. Verify service installed
Get-Service -Name "PM2"

# 4. Set to auto-start on boot
Set-Service -Name "PM2" -StartupType Automatic

# 5. Verify service is running
Get-Service -Name "PM2" | Select-Object Name, Status, StartType
```

**Expected output:**
```
Name Status  StartType
---- ------  ---------
PM2  Running Automatic
```

### Log Rotation Setup

Prevent disk exhaustion with pm2-logrotate:

```powershell
# Install logrotate module
pm2 install pm2-logrotate

# Configure settings
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 10
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss

# Verify configuration
pm2 show pm2-logrotate
```

---

## 3. Deployment Procedure

### Automated Deployment (Recommended)

Use the deployment script from a machine with network access to SERVEUR:

```powershell
# On SERVEUR as Administrator
E:\MedFlow\scripts\deploy-medflow.ps1
```

### Manual Deployment Steps

If the script is unavailable, follow these manual steps:

```powershell
# 1. Stop PM2 processes
pm2 stop all

# 2. Backup current version
$date = Get-Date -Format "yyyy-MM-dd_HHmm"
Copy-Item E:\MedFlow\matrix-backend E:\MedFlow\backups\$date -Recurse

# 3. Sync backend files (from network share or USB)
# Example with robocopy from network share:
robocopy \\SOURCE\magloire\backend E:\MedFlow\matrix-backend /MIR /XD node_modules /XF .env

# 4. Install dependencies (if package.json changed)
Set-Location E:\MedFlow\matrix-backend
npm install --production

# 5. Build frontend
Set-Location E:\MedFlow\frontend
npm install
npm run build

# 6. Verify frontend build exists
Test-Path E:\MedFlow\frontend\dist\index.html

# 7. Start PM2 processes
Set-Location E:\MedFlow
pm2 start ecosystem.production.config.js

# 8. Save PM2 state (for auto-restart on reboot)
pm2 save

# 9. Verify health
Start-Sleep -Seconds 10
Invoke-RestMethod http://localhost:5002/health
```

### Frontend Build Instructions

The frontend is built locally and served by the backend via express.static:

```powershell
# Navigate to frontend directory
Set-Location E:\MedFlow\frontend

# Install dependencies
npm install

# Build production bundle
npm run build

# Verify build output
Get-ChildItem E:\MedFlow\frontend\dist

# Backend serves from FRONTEND_PATH environment variable
# Verify in ecosystem config
```

### PM2 Ecosystem Configuration

Location: `E:\MedFlow\ecosystem.production.config.js`

Key settings:
- `FRONTEND_PATH`: Points to `E:\MedFlow\frontend\dist` for static file serving
- `max_memory_restart`: Set to 500MB
- `error_file` / `out_file`: Log file paths

---

## 4. Common Operations

### 4.1 View Status

```powershell
# Quick status overview
pm2 status

# Detailed list with memory usage
pm2 list

# Full details for backend
pm2 describe medflow-backend
```

### 4.2 View Logs

```powershell
# Stream all logs (real-time)
pm2 logs

# View last 200 lines of backend logs
pm2 logs medflow-backend --lines 200

# View error logs only
pm2 logs medflow-backend --err --lines 100

# Direct file access
Get-Content E:\MedFlow\logs\backend-out.log -Tail 100
Get-Content E:\MedFlow\logs\backend-error.log -Tail 100
```

### 4.3 Restart Service

```powershell
# Graceful reload (preferred - zero downtime)
pm2 reload medflow-backend

# Hard restart
pm2 restart medflow-backend

# Restart all processes
pm2 restart all
```

### 4.4 Stop/Start

```powershell
# Stop backend
pm2 stop medflow-backend

# Start backend
pm2 start medflow-backend

# Stop all
pm2 stop all

# Start from ecosystem file
pm2 start E:\MedFlow\ecosystem.production.config.js
```

### 4.5 Health Check

```powershell
# Basic health check
Invoke-RestMethod http://localhost:5002/health

# Detailed health check (with memory, services)
Invoke-RestMethod http://localhost:5002/health/detailed | ConvertTo-Json -Depth 5

# Using health check script
.\scripts\health-check.ps1
```

### 4.6 Verify Frontend Serving

```powershell
# Check root URL returns HTML
$response = Invoke-WebRequest http://localhost:5002/ -UseBasicParsing
$response.Content.Substring(0, 200)
# Should show: <!DOCTYPE html> or <html>

# Check static assets load
Invoke-WebRequest http://localhost:5002/assets/ -UseBasicParsing -Method Head
```

---

## 5. Troubleshooting

### 5.1 Service Not Starting

**Symptoms:** PM2 shows process as "stopped" or "errored"

**Steps:**
```powershell
# Check error logs
pm2 logs medflow-backend --err --lines 100

# Verify MongoDB is running
Get-Service MongoDB
mongosh --eval "db.stats()"

# Check port availability
netstat -an | findstr 5002

# Verify .env exists
Test-Path E:\MedFlow\matrix-backend\.env

# Verify Node.js version
node -v

# Try manual start for detailed errors
Set-Location E:\MedFlow\matrix-backend
node server.js
```

### 5.2 High Memory Usage

**Symptoms:** Slow responses, memory > 400MB in PM2 status

**Steps:**
```powershell
# Check current memory
pm2 describe medflow-backend | Select-String memory

# Force restart if > 400MB (PM2 limit is 500MB)
pm2 reload medflow-backend

# Check health endpoint for heap details
(Invoke-RestMethod http://localhost:5002/health/detailed).memory

# Run stability monitor to track trend
.\scripts\stability-monitor.ps1 -DurationHours 4 -IntervalMinutes 5
```

### 5.3 MongoDB Connection Issues

**Symptoms:** "MongoNetworkError" or "MongooseServerSelectionError" in logs

**Steps:**
```powershell
# Check MongoDB service
Get-Service MongoDB
sc query MongoDB

# Test connection
mongosh --eval "db.adminCommand('ping')"

# Verify connection string in .env
Get-Content E:\MedFlow\matrix-backend\.env | Select-String MONGODB

# Restart MongoDB if needed
Restart-Service MongoDB
```

### 5.4 WebSocket Issues

**Symptoms:** Real-time updates not working, queue not refreshing

**Steps:**
```powershell
# Check WebSocket status via health endpoint
(Invoke-RestMethod http://localhost:5002/health/detailed).checks.websocket

# Check connected clients count
(Invoke-RestMethod http://localhost:5002/health/detailed).checks.websocket.details.connectedClients

# Verify firewall allows port 5002
Get-NetFirewallRule -DisplayName "*5002*"

# If missing, add firewall rule
New-NetFirewallRule -DisplayName "MedFlow Backend 5002" -Direction Inbound -Port 5002 -Protocol TCP -Action Allow

# Check CORS in backend logs
pm2 logs medflow-backend --lines 50 | Select-String -Pattern "CORS|cors"
```

### 5.5 Frontend Not Loading

**Symptoms:** API works but browser shows 404 or blank page

**Steps:**
```powershell
# Verify FRONTEND_PATH in ecosystem config
Get-Content E:\MedFlow\ecosystem.production.config.js | Select-String FRONTEND_PATH

# Check dist directory exists
Test-Path E:\MedFlow\frontend\dist\index.html
Get-ChildItem E:\MedFlow\frontend\dist

# Check server logs for static file serving
pm2 logs medflow-backend | Select-String -Pattern "static|frontend|Serving"

# Rebuild frontend if needed
Set-Location E:\MedFlow\frontend
npm run build

# Restart backend to pick up new build
pm2 reload medflow-backend
```

### 5.6 CareVision SQL Not Connecting

**Symptoms:** Legacy patient data not loading, SQL connection errors

**Steps:**
```powershell
# Verify Meshnet is active
ping 100.73.34.191

# Test SQL Server port
Test-NetConnection -ComputerName 100.73.34.191 -Port 1433

# Check credentials in .env
Get-Content E:\MedFlow\matrix-backend\.env | Select-String CAREVISION_SQL

# Verify in health dependencies endpoint
Invoke-RestMethod http://localhost:5002/health/dependencies | ConvertTo-Json -Depth 3
```

---

## 6. Backup and Recovery

### 6.1 Manual Backup

```powershell
# Create timestamped backup
$date = Get-Date -Format "yyyy-MM-dd_HHmm"
$backupPath = "E:\MedFlow\backups\$date"

# Backup backend (excluding node_modules)
Copy-Item E:\MedFlow\matrix-backend $backupPath\matrix-backend -Recurse -Exclude node_modules

# Backup frontend build
Copy-Item E:\MedFlow\frontend\dist $backupPath\frontend-dist -Recurse

# Backup ecosystem config
Copy-Item E:\MedFlow\ecosystem.production.config.js $backupPath\

# List backups
Get-ChildItem E:\MedFlow\backups | Sort-Object LastWriteTime -Descending
```

### 6.2 Rollback Procedure

```powershell
# 1. Stop services
pm2 stop all

# 2. Identify backup to restore
Get-ChildItem E:\MedFlow\backups | Sort-Object LastWriteTime -Descending

# 3. Remove current version
Remove-Item E:\MedFlow\matrix-backend -Recurse -Force

# 4. Restore from backup (replace <backup-folder> with actual name)
Copy-Item E:\MedFlow\backups\<backup-folder>\matrix-backend E:\MedFlow\matrix-backend -Recurse

# 5. Restore frontend if needed
Copy-Item E:\MedFlow\backups\<backup-folder>\frontend-dist E:\MedFlow\frontend\dist -Recurse -Force

# 6. Start services
pm2 start E:\MedFlow\ecosystem.production.config.js
pm2 save

# 7. Verify health
Start-Sleep -Seconds 10
Invoke-RestMethod http://localhost:5002/health
```

---

## 7. Log Rotation

### Configuration

PM2 logrotate is configured with:
- **Max size:** 50MB per log file
- **Retention:** 10 files
- **Compression:** Enabled (gzip)

### Verify Configuration

```powershell
# Show logrotate settings
pm2 show pm2-logrotate

# List current log files
Get-ChildItem E:\MedFlow\logs -Recurse | Select-Object Name, Length, LastWriteTime
```

### Manual Log Management

```powershell
# Flush all logs (clear log files)
pm2 flush

# View disk usage
Get-ChildItem E:\MedFlow\logs -Recurse | Measure-Object -Property Length -Sum
```

---

## 8. Server Restart Recovery

### Automatic Recovery

If PM2 was properly configured as a Windows Service:
1. PM2 service auto-starts on boot
2. PM2 resurrects saved process list from dump file

### Verify After Reboot

```powershell
# Check PM2 service is running
Get-Service -Name "PM2"

# Check processes were restored
pm2 status

# Verify health
Invoke-RestMethod http://localhost:5002/health
```

### Manual Recovery (if auto-start fails)

```powershell
# Check if PM2 service exists
Get-Service -Name "PM2"

# Start PM2 service manually
Start-Service -Name "PM2"

# If processes not running, resurrect from saved state
pm2 resurrect

# If resurrect fails, start from ecosystem file
pm2 start E:\MedFlow\ecosystem.production.config.js
pm2 save
```

### Troubleshooting Auto-Start

```powershell
# Verify dump file exists (contains saved process list)
Test-Path "$env:PM2_HOME\dump.pm2"
# Or if PM2_HOME not set:
Test-Path "$env:USERPROFILE\.pm2\dump.pm2"

# Re-save process list
pm2 save

# Verify PM2 service is set to Automatic
Get-Service -Name "PM2" | Select-Object Name, Status, StartType
```

---

## 9. Contact and Escalation

### File Locations

| Purpose | Path |
|---------|------|
| Backend code | `E:\MedFlow\matrix-backend` |
| Frontend build | `E:\MedFlow\frontend\dist` |
| Environment config | `E:\MedFlow\matrix-backend\.env` |
| PM2 ecosystem | `E:\MedFlow\ecosystem.production.config.js` |
| Application logs | `E:\MedFlow\logs\` |
| Backups | `E:\MedFlow\backups\` |

### Remote Access

- **Method:** NordVPN Meshnet
- **IP:** 100.73.34.191
- **RDP:** Port 3389 (if enabled)

### When to Escalate

| Issue | Action |
|-------|--------|
| Service won't start after restart | Check logs, then escalate |
| Memory > 400MB repeatedly | Monitor trend, schedule maintenance |
| MongoDB connection failure | Verify service, then escalate |
| Data inconsistency | Do NOT attempt fix, escalate immediately |
| Security incident | Stop services, preserve logs, escalate |

---

## 10. Quick Reference Card

### Essential Commands

| Task | Command |
|------|---------|
| Check status | `pm2 status` |
| View logs | `pm2 logs medflow-backend --lines 100` |
| Restart (graceful) | `pm2 reload medflow-backend` |
| Restart (hard) | `pm2 restart medflow-backend` |
| Stop service | `pm2 stop medflow-backend` |
| Start service | `pm2 start medflow-backend` |
| Health check | `Invoke-RestMethod http://localhost:5002/health` |
| Detailed health | `Invoke-RestMethod http://localhost:5002/health/detailed` |
| Check WebSocket | `(Invoke-RestMethod http://localhost:5002/health/detailed).checks.websocket` |
| Check memory | `(Invoke-RestMethod http://localhost:5002/health/detailed).memory` |

### PM2 Service Commands

| Task | Command |
|------|---------|
| Check PM2 service | `Get-Service -Name "PM2"` |
| Start PM2 service | `Start-Service -Name "PM2"` |
| Stop PM2 service | `Stop-Service -Name "PM2"` |
| Save PM2 state | `pm2 save` |
| Restore PM2 state | `pm2 resurrect` |
| Clear logs | `pm2 flush` |

### Stability Testing

| Task | Command |
|------|---------|
| 24-hour test | `.\scripts\stability-monitor.ps1` |
| 4-hour quick test | `.\scripts\stability-monitor.ps1 -DurationHours 4` |
| Custom interval | `.\scripts\stability-monitor.ps1 -IntervalMinutes 10` |

### Emergency Commands

| Situation | Command |
|-----------|---------|
| Kill all processes | `pm2 kill` |
| Force restart | `pm2 restart medflow-backend --force` |
| View real-time metrics | `pm2 monit` |
| Reset PM2 | `pm2 kill && pm2 start ecosystem.production.config.js` |

---

*Last updated: 2026-01-24*
*Version: 1.0.0*
