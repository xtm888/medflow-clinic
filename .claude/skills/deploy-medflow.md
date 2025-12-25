---
name: deploy-medflow
description: Use when deploying MedFlow to production or staging, or when preparing a release
invocable: true
---

# Deploy MedFlow

## Pre-Deployment Checklist

### 1. Code Verification
```bash
# Ensure on main branch with latest
cd /Users/xtm888/magloire
git status
git pull origin main

# Run full test suite
cd frontend && npm run test:run
cd ../backend && npm test
```

### 2. Build Artifacts
```bash
# Build frontend
cd /Users/xtm888/magloire/frontend
npm run build

# Verify build output
ls -la dist/
```

### 3. Database Backup
```bash
# Create timestamped backup
BACKUP_DIR="/backup/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR
mongodump --db medflow --out $BACKUP_DIR
echo "Backup created at: $BACKUP_DIR"
```

### 4. Run Migrations/Seeds (if needed)
```bash
cd /Users/xtm888/magloire/backend

# Check for pending migrations
# Run setup if needed
npm run setup
```

### 5. Deploy
```bash
# Stop services gracefully
pkill -SIGTERM -f "node server.js"

# Wait for graceful shutdown
sleep 5

# Start services
./start-all.sh
```

### 6. Post-Deployment Verification
```bash
# Health check
curl http://localhost:5001/health

# Test critical endpoints
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"***"}' | jq -r '.token')

# Test patients API
curl -s http://localhost:5001/api/patients?limit=1 \
  -H "Authorization: Bearer $TOKEN" | jq '.pagination'

# Test queue API
curl -s http://localhost:5001/api/queue \
  -H "Authorization: Bearer $TOKEN" | jq 'length'
```

### 7. Monitor for 15 minutes
- Watch error logs
- Check response times
- Verify device sync resumes

## Rollback Procedure

If issues detected:
```bash
# 1. Stop services
pkill -f "node server.js"

# 2. Restore previous version
git checkout HEAD~1

# 3. Restore database if needed
mongorestore --db medflow $BACKUP_DIR/medflow

# 4. Restart
./start-all.sh

# 5. Verify
curl http://localhost:5001/health
```
