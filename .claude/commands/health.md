---
name: health
description: Quick health check of all MedFlow services
---

# MedFlow Health Check

Run a comprehensive health check of all services:

```bash
echo "=== Backend API ==="
curl -s http://localhost:5001/health 2>/dev/null && echo "UP" || echo "DOWN"

echo ""
echo "=== MongoDB ==="
mongosh medflow --eval "db.adminCommand('ping')" 2>/dev/null && echo "UP" || echo "DOWN"

echo ""
echo "=== Redis ==="
redis-cli ping 2>/dev/null && echo "UP" || echo "DOWN"

echo ""
echo "=== Processes ==="
pgrep -f "node server.js" > /dev/null && echo "Backend process: RUNNING" || echo "Backend process: NOT RUNNING"
pgrep -f "vite" > /dev/null && echo "Frontend dev: RUNNING" || echo "Frontend dev: NOT RUNNING"

echo ""
echo "=== Ports ==="
lsof -i :5001 > /dev/null 2>&1 && echo "Port 5001 (API): LISTENING" || echo "Port 5001 (API): NOT LISTENING"
lsof -i :5173 > /dev/null 2>&1 && echo "Port 5173 (Frontend): LISTENING" || echo "Port 5173 (Frontend): NOT LISTENING"
lsof -i :27017 > /dev/null 2>&1 && echo "Port 27017 (MongoDB): LISTENING" || echo "Port 27017 (MongoDB): NOT LISTENING"
lsof -i :6379 > /dev/null 2>&1 && echo "Port 6379 (Redis): LISTENING" || echo "Port 6379 (Redis): NOT LISTENING"
```

Report any issues found and suggest fixes.
