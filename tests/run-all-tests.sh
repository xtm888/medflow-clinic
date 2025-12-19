#!/bin/bash

# MedFlow Master Test Runner
# Runs all test suites: Backend, Frontend, E2E

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   MedFlow Test Suite Runner${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Track results
BACKEND_RESULT=0
FRONTEND_RESULT=0
E2E_RESULT=0

# Parse arguments
RUN_BACKEND=true
RUN_FRONTEND=true
RUN_E2E=true
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-only) RUN_FRONTEND=false; RUN_E2E=false ;;
        --frontend-only) RUN_BACKEND=false; RUN_E2E=false ;;
        --e2e-only) RUN_BACKEND=false; RUN_FRONTEND=false ;;
        --no-e2e) RUN_E2E=false ;;
        --verbose|-v) VERBOSE=true ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --backend-only    Run only backend tests"
            echo "  --frontend-only   Run only frontend tests"
            echo "  --e2e-only        Run only E2E tests"
            echo "  --no-e2e          Skip E2E tests"
            echo "  --verbose, -v     Show full test output"
            echo "  --help, -h        Show this help"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

# Backend Tests
if [ "$RUN_BACKEND" = true ]; then
    echo -e "${YELLOW}[1/3] Running Backend Tests (Jest)...${NC}"
    cd "$PROJECT_ROOT/backend"

    if [ "$VERBOSE" = true ]; then
        npm test 2>&1 || BACKEND_RESULT=$?
    else
        npm test 2>&1 | tail -20 || BACKEND_RESULT=$?
    fi

    if [ $BACKEND_RESULT -eq 0 ]; then
        echo -e "${GREEN}✓ Backend tests passed${NC}"
    else
        echo -e "${RED}✗ Backend tests failed (exit code: $BACKEND_RESULT)${NC}"
    fi
    echo ""
fi

# Frontend Tests
if [ "$RUN_FRONTEND" = true ]; then
    echo -e "${YELLOW}[2/3] Running Frontend Tests (Vitest)...${NC}"
    cd "$PROJECT_ROOT/frontend"

    if [ "$VERBOSE" = true ]; then
        npm run test:run 2>&1 || FRONTEND_RESULT=$?
    else
        npm run test:run 2>&1 | tail -30 || FRONTEND_RESULT=$?
    fi

    if [ $FRONTEND_RESULT -eq 0 ]; then
        echo -e "${GREEN}✓ Frontend tests passed${NC}"
    else
        echo -e "${RED}✗ Frontend tests failed (exit code: $FRONTEND_RESULT)${NC}"
    fi
    echo ""
fi

# E2E Tests
if [ "$RUN_E2E" = true ]; then
    echo -e "${YELLOW}[3/3] Running E2E Tests (Playwright)...${NC}"
    cd "$PROJECT_ROOT/tests/playwright"

    # Check if servers are running
    if ! curl -s http://localhost:5001/api/health > /dev/null 2>&1; then
        echo -e "${RED}Warning: Backend server not running on port 5001${NC}"
        echo "Start with: cd backend && npm run dev"
        E2E_RESULT=1
    elif ! curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${RED}Warning: Frontend server not running on port 3000${NC}"
        echo "Start with: cd frontend && npm run dev"
        E2E_RESULT=1
    else
        if [ "$VERBOSE" = true ]; then
            timeout 600 python3 test_comprehensive.py 2>&1 || E2E_RESULT=$?
        else
            timeout 600 python3 test_comprehensive.py 2>&1 | tail -50 || E2E_RESULT=$?
        fi
    fi

    if [ $E2E_RESULT -eq 0 ]; then
        echo -e "${GREEN}✓ E2E tests passed${NC}"
    else
        echo -e "${RED}✗ E2E tests failed (exit code: $E2E_RESULT)${NC}"
    fi
    echo ""
fi

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"

TOTAL_FAILURES=0

if [ "$RUN_BACKEND" = true ]; then
    if [ $BACKEND_RESULT -eq 0 ]; then
        echo -e "Backend:  ${GREEN}PASSED${NC}"
    else
        echo -e "Backend:  ${RED}FAILED${NC}"
        ((TOTAL_FAILURES++))
    fi
fi

if [ "$RUN_FRONTEND" = true ]; then
    if [ $FRONTEND_RESULT -eq 0 ]; then
        echo -e "Frontend: ${GREEN}PASSED${NC}"
    else
        echo -e "Frontend: ${RED}FAILED${NC}"
        ((TOTAL_FAILURES++))
    fi
fi

if [ "$RUN_E2E" = true ]; then
    if [ $E2E_RESULT -eq 0 ]; then
        echo -e "E2E:      ${GREEN}PASSED${NC}"
    else
        echo -e "E2E:      ${RED}FAILED${NC}"
        ((TOTAL_FAILURES++))
    fi
fi

echo ""

if [ $TOTAL_FAILURES -eq 0 ]; then
    echo -e "${GREEN}All test suites passed!${NC}"
    exit 0
else
    echo -e "${RED}$TOTAL_FAILURES test suite(s) failed${NC}"
    exit 1
fi
