#!/bin/bash

# CareVision EMR - Complete Startup Script
# This script starts all CareVision services with optional verification

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse arguments
SKIP_FACE=false
SKIP_OCR=true  # OCR is OFF by default (slow)
SKIP_VERIFY=false
QUICK_START=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-face) SKIP_FACE=true; shift ;;
        --with-ocr) SKIP_OCR=false; shift ;;
        --skip-verify) SKIP_VERIFY=true; shift ;;
        --quick) QUICK_START=true; SKIP_VERIFY=true; shift ;;
        --help)
            echo "Usage: ./start-all.sh [options]"
            echo ""
            echo "Options:"
            echo "  --skip-face    Skip Face Recognition service"
            echo "  --with-ocr     Start OCR service (slow, off by default)"
            echo "  --skip-verify  Skip code verification checks"
            echo "  --quick        Quick start (skip verification)"
            echo "  --help         Show this help"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                 CareVision EMR Startup Script                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to check if a port is in use
check_port() {
    lsof -i :$1 >/dev/null 2>&1
    return $?
}

# Function to wait for service
wait_for_service() {
    local port=$1
    local name=$2
    local max_attempts=30
    local attempt=0

    echo -n "  Waiting for $name on port $port..."
    while ! check_port $port && [ $attempt -lt $max_attempts ]; do
        sleep 1
        attempt=$((attempt + 1))
        echo -n "."
    done

    if check_port $port; then
        echo -e " ${GREEN}✓${NC}"
        return 0
    else
        echo -e " ${RED}✗${NC}"
        return 1
    fi
}

# ============================================================================
# CODE VERIFICATION SECTION
# ============================================================================
if [ "$SKIP_VERIFY" = false ]; then
    echo -e "${CYAN}[0/7] Running Code Verification...${NC}"
    ISSUES_FOUND=0

    # Issue #1: Appointments.jsx - getPatientById doesn't exist
    if grep -q "getPatientById" "$SCRIPT_DIR/frontend/src/pages/Appointments.jsx" 2>/dev/null; then
        echo -e "  ${RED}✗${NC} Appointments.jsx:184 - getPatientById() should be getPatient()"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        echo -e "  ${GREEN}✓${NC} Appointments.jsx - patientService calls OK"
    fi

    # Issue #2: Invoicing.jsx - wrong PDF endpoint
    if grep -q "api.get(\`/invoices/\${.*}/pdf\`" "$SCRIPT_DIR/frontend/src/pages/Invoicing.jsx" 2>/dev/null; then
        echo -e "  ${RED}✗${NC} Invoicing.jsx:247 - PDF endpoint should be /billing/invoices/\${id}/pdf"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        echo -e "  ${GREEN}✓${NC} Invoicing.jsx - PDF endpoint OK"
    fi

    # Issue #3: Invoicing.jsx - wrong send method
    if grep -q "api.post(\`/invoices/\${.*}/send\`" "$SCRIPT_DIR/frontend/src/pages/Invoicing.jsx" 2>/dev/null; then
        echo -e "  ${RED}✗${NC} Invoicing.jsx:329 - send should use PUT not POST"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        echo -e "  ${GREEN}✓${NC} Invoicing.jsx - send method OK"
    fi

    # Issue #4: Invoicing.jsx - wrong cancel method
    if grep -q "api.patch(\`/invoices/" "$SCRIPT_DIR/frontend/src/pages/Invoicing.jsx" 2>/dev/null; then
        echo -e "  ${RED}✗${NC} Invoicing.jsx:352 - cancel should use PUT /invoices/\${id}/cancel"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        echo -e "  ${GREEN}✓${NC} Invoicing.jsx - cancel method OK"
    fi

    # Issue #5: GlassesOrder.jsx - undefined ToastContainer
    if grep -q "ToastContainer toasts={toasts}" "$SCRIPT_DIR/frontend/src/pages/ophthalmology/GlassesOrder.jsx" 2>/dev/null; then
        echo -e "  ${RED}✗${NC} GlassesOrder.jsx:700 - ToastContainer has undefined props"
        ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
        echo -e "  ${GREEN}✓${NC} GlassesOrder.jsx - Toast handling OK"
    fi

    # Issue #6: Queue.jsx - missing assign-room endpoint
    if grep -q "assign-room" "$SCRIPT_DIR/frontend/src/pages/Queue.jsx" 2>/dev/null; then
        if ! grep -q "assign-room" "$SCRIPT_DIR/backend/routes/queue.js" 2>/dev/null; then
            echo -e "  ${RED}✗${NC} Queue.jsx:281 - /assign-room endpoint doesn't exist in backend"
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
        else
            echo -e "  ${GREEN}✓${NC} Queue.jsx - assign-room endpoint OK"
        fi
    else
        echo -e "  ${GREEN}✓${NC} Queue.jsx - room assignment OK"
    fi

    # Issue #7: PatientCacheContext - useCallback should be useEffect
    if grep -A1 "useCallback(async" "$SCRIPT_DIR/frontend/src/contexts/PatientCacheContext.jsx" 2>/dev/null | grep -q "patientId"; then
        echo -e "  ${YELLOW}⚠${NC} PatientCacheContext.jsx:151 - useCallback should be useEffect (non-blocking)"
        # Don't increment - this is a warning, not blocking
    else
        echo -e "  ${GREEN}✓${NC} PatientCacheContext.jsx - hooks OK"
    fi

    # Issue #8: Services.jsx - stub implementations
    if grep -q "// This would send to backend" "$SCRIPT_DIR/frontend/src/pages/Services.jsx" 2>/dev/null; then
        echo -e "  ${YELLOW}⚠${NC} Services.jsx:118-133 - save/delete are stubs (non-blocking)"
    else
        echo -e "  ${GREEN}✓${NC} Services.jsx - implementations OK"
    fi

    # Issue #9: face-service requirements
    if [ -f "$SCRIPT_DIR/face-service/requirements.txt" ]; then
        if ! grep -q "deepface" "$SCRIPT_DIR/face-service/requirements.txt" 2>/dev/null; then
            echo -e "  ${YELLOW}⚠${NC} face-service/requirements.txt - missing deepface (face service may fail)"
        else
            echo -e "  ${GREEN}✓${NC} face-service/requirements.txt - dependencies OK"
        fi
    fi

    # Issue #10: Controllers without asyncHandler
    for controller in authController pharmacyController templateCatalogController; do
        if [ -f "$SCRIPT_DIR/backend/controllers/${controller}.js" ]; then
            if ! grep -q "asyncHandler" "$SCRIPT_DIR/backend/controllers/${controller}.js" 2>/dev/null; then
                echo -e "  ${YELLOW}⚠${NC} ${controller}.js - no asyncHandler (errors may not propagate)"
            fi
        fi
    done

    echo ""
    if [ $ISSUES_FOUND -gt 0 ]; then
        echo -e "  ${RED}Found $ISSUES_FOUND blocking issues!${NC}"
        echo -e "  ${YELLOW}Run with --skip-verify to start anyway${NC}"
        echo ""
        read -p "  Continue anyway? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo -e "  ${GREEN}✓ All critical checks passed${NC}"
    fi
    echo ""
fi

# Kill existing processes
echo -e "${YELLOW}[1/7] Cleaning up existing processes...${NC}"
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "nodemon" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "python.*app.py" 2>/dev/null || true
pkill -f "uvicorn" 2>/dev/null || true
sleep 2
echo -e "  ${GREEN}✓${NC} Existing processes cleaned"

# Check MongoDB
echo ""
echo -e "${YELLOW}[2/7] Checking MongoDB...${NC}"
if mongosh --quiet --eval "db.adminCommand('ping').ok" >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} MongoDB is running"
else
    echo -e "  ${RED}✗${NC} MongoDB is not running"
    echo -e "  ${YELLOW}Please start MongoDB first:${NC}"
    echo -e "    brew services start mongodb-community  (macOS)"
    echo -e "    sudo systemctl start mongod           (Linux)"
    exit 1
fi

# Check Redis (optional)
echo ""
echo -e "${YELLOW}[3/7] Checking Redis (optional)...${NC}"
if redis-cli ping >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Redis is running"
    REDIS_AVAILABLE=true
else
    echo -e "  ${YELLOW}⚠${NC} Redis not running (using in-memory fallback)"
    REDIS_AVAILABLE=false
fi

# Start Backend
echo ""
echo -e "${YELLOW}[4/7] Starting Backend API...${NC}"
cd "$SCRIPT_DIR/backend"
if [ ! -f ".env" ]; then
    echo -e "  ${RED}✗${NC} Missing .env file in backend/"
    exit 1
fi
nohup node server.js > /tmp/carevision-backend.log 2>&1 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"
wait_for_service 5001 "Backend API"

# Start Face Recognition Service (optional)
echo ""
if [ "$SKIP_FACE" = true ]; then
    echo -e "${YELLOW}[5/7] Face Recognition Service...${NC} ${YELLOW}SKIPPED${NC}"
else
    echo -e "${YELLOW}[5/7] Starting Face Recognition Service...${NC}"
    cd "$SCRIPT_DIR/face-service"
    if [ -d "venv" ]; then
        source venv/bin/activate
        nohup python app.py > /tmp/carevision-face.log 2>&1 &
        FACE_PID=$!
        deactivate
        echo "  Face Service PID: $FACE_PID"
        wait_for_service 5002 "Face Recognition"
    else
        echo -e "  ${YELLOW}⚠${NC} Face service venv not found, skipping"
        echo -e "  ${YELLOW}  To setup: cd face-service && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt${NC}"
    fi
fi

# Start OCR Service (optional - OFF by default)
echo ""
if [ "$SKIP_OCR" = true ]; then
    echo -e "${YELLOW}[6/7] OCR Service...${NC} ${YELLOW}SKIPPED (use --with-ocr to enable)${NC}"
else
    echo -e "${YELLOW}[6/7] Starting OCR Service...${NC}"
    cd "$SCRIPT_DIR/ocr-service"
    if [ -d "venv" ]; then
        if [ "$REDIS_AVAILABLE" = true ]; then
            source venv/bin/activate
            nohup uvicorn app.main:app --host 0.0.0.0 --port 5003 > /tmp/carevision-ocr.log 2>&1 &
            OCR_PID=$!
            deactivate
            echo "  OCR Service PID: $OCR_PID"
            wait_for_service 5003 "OCR Service"
        else
            echo -e "  ${YELLOW}⚠${NC} OCR service requires Redis - skipping"
        fi
    else
        echo -e "  ${YELLOW}⚠${NC} OCR service venv not found, skipping"
        echo -e "  ${YELLOW}  To setup: cd ocr-service && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt${NC}"
    fi
fi

# Start Frontend (development mode)
echo ""
echo -e "${YELLOW}[7/7] Starting Frontend...${NC}"
cd "$SCRIPT_DIR/frontend"
nohup npm run dev > /tmp/carevision-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"
wait_for_service 5173 "Frontend"

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    All Services Started!                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Services:${NC}"
echo -e "  • Backend API:     http://localhost:5001"
echo -e "  • Frontend:        http://localhost:5173"
if [ "$SKIP_FACE" = false ]; then
    echo -e "  • Face Service:    http://localhost:5002"
fi
if [ "$SKIP_OCR" = false ]; then
    echo -e "  • OCR Service:     http://localhost:5003"
fi
echo -e "  • WebSocket:       ws://localhost:5001"
echo ""
echo -e "${GREEN}Logs:${NC}"
echo -e "  • Backend:   tail -f /tmp/carevision-backend.log"
if [ "$SKIP_FACE" = false ]; then
    echo -e "  • Face:      tail -f /tmp/carevision-face.log"
fi
if [ "$SKIP_OCR" = false ]; then
    echo -e "  • OCR:       tail -f /tmp/carevision-ocr.log"
fi
echo -e "  • Frontend:  tail -f /tmp/carevision-frontend.log"
echo ""
echo -e "${GREEN}Default Login:${NC}"
echo -e "  • Email:    admin@medflow.com"
echo -e "  • Password: MedFlow\$ecure1"
echo ""
echo -e "${YELLOW}Startup Options:${NC}"
echo -e "  --quick        Fast start (skip verification)"
echo -e "  --with-ocr     Enable OCR service"
echo -e "  --skip-face    Skip face recognition"
echo ""
echo -e "${YELLOW}To stop all services:${NC}"
echo -e "  pkill -f 'node.*server.js'; pkill -f 'vite'; pkill -f 'python.*app.py'; pkill -f 'uvicorn'"
