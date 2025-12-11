#!/bin/bash

# ============================================================================
# MedFlow Unified Test Runner
# ============================================================================
#
# Runs all test suites:
# 1. Backend unit/integration tests (Jest)
# 2. Frontend unit tests (Vitest)
# 3. E2E API tests (Python + Requests)
#
# Usage:
#   ./run_all_tests.sh              # Run all tests
#   ./run_all_tests.sh --backend    # Run backend tests only
#   ./run_all_tests.sh --frontend   # Run frontend tests only
#   ./run_all_tests.sh --e2e        # Run E2E tests only
#   ./run_all_tests.sh --quick      # Run quick tests (skip E2E)
#   ./run_all_tests.sh --coverage   # Run with coverage reports
#
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project root
PROJECT_ROOT="/Users/xtm888/magloire"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
E2E_DIR="$PROJECT_ROOT/tests/playwright"

# Test results
BACKEND_RESULT=0
FRONTEND_RESULT=0
E2E_RESULT=0

# Options
RUN_BACKEND=true
RUN_FRONTEND=true
RUN_E2E=true
WITH_COVERAGE=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --backend)
      RUN_FRONTEND=false
      RUN_E2E=false
      ;;
    --frontend)
      RUN_BACKEND=false
      RUN_E2E=false
      ;;
    --e2e)
      RUN_BACKEND=false
      RUN_FRONTEND=false
      ;;
    --quick)
      RUN_E2E=false
      ;;
    --coverage)
      WITH_COVERAGE=true
      ;;
    --help)
      echo "MedFlow Unified Test Runner"
      echo ""
      echo "Usage: ./run_all_tests.sh [options]"
      echo ""
      echo "Options:"
      echo "  --backend    Run backend tests only"
      echo "  --frontend   Run frontend tests only"
      echo "  --e2e        Run E2E tests only"
      echo "  --quick      Run quick tests (skip E2E)"
      echo "  --coverage   Run with coverage reports"
      echo "  --help       Show this help message"
      exit 0
      ;;
  esac
done

# Header
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    MEDFLOW UNIFIED TEST RUNNER                     ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Started at: $(date)${NC}"
echo ""

# ============================================================================
# BACKEND TESTS (Jest)
# ============================================================================
if [ "$RUN_BACKEND" = true ]; then
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}                         BACKEND TESTS (Jest)                       ${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  cd "$BACKEND_DIR"

  if [ "$WITH_COVERAGE" = true ]; then
    npm test -- --coverage 2>&1 && BACKEND_RESULT=0 || BACKEND_RESULT=$?
  else
    npm test 2>&1 && BACKEND_RESULT=0 || BACKEND_RESULT=$?
  fi

  if [ $BACKEND_RESULT -eq 0 ]; then
    echo -e "${GREEN}✓ Backend tests passed${NC}"
  else
    echo -e "${RED}✗ Backend tests failed${NC}"
  fi
  echo ""
fi

# ============================================================================
# FRONTEND TESTS (Vitest)
# ============================================================================
if [ "$RUN_FRONTEND" = true ]; then
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}                        FRONTEND TESTS (Vitest)                     ${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  cd "$FRONTEND_DIR"

  if [ "$WITH_COVERAGE" = true ]; then
    npm run test -- --coverage 2>&1 && FRONTEND_RESULT=0 || FRONTEND_RESULT=$?
  else
    npm run test 2>&1 && FRONTEND_RESULT=0 || FRONTEND_RESULT=$?
  fi

  if [ $FRONTEND_RESULT -eq 0 ]; then
    echo -e "${GREEN}✓ Frontend tests passed${NC}"
  else
    echo -e "${RED}✗ Frontend tests failed${NC}"
  fi
  echo ""
fi

# ============================================================================
# E2E TESTS (Python + Requests)
# ============================================================================
if [ "$RUN_E2E" = true ]; then
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}                          E2E TESTS (Python)                        ${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  # Check if server is running
  echo -e "${BLUE}Checking if backend server is running...${NC}"
  if curl -s http://localhost:5001/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend server is running${NC}"
    echo ""

    cd "$E2E_DIR"

    # List of E2E test files
    E2E_TESTS=(
      "test_cascade_architecture_e2e.py"
      "test_verified_systems_e2e.py"
      "test_complete_workflow_e2e.py"
      "test_convention_calculations_e2e.py"
      "test_approval_workflow_e2e.py"
      "test_cascade_verification_e2e.py"
      "test_crud_verification_e2e.py"
      "test_deep_business_logic_e2e.py"
      "test_full_patient_journey_e2e.py"
    )

    PASSED=0
    FAILED=0

    for test_file in "${E2E_TESTS[@]}"; do
      if [ -f "$test_file" ]; then
        echo -e "${BLUE}Running: $test_file${NC}"
        if python3 "$test_file" 2>&1; then
          ((PASSED++))
          echo -e "${GREEN}  ✓ $test_file passed${NC}"
        else
          ((FAILED++))
          echo -e "${RED}  ✗ $test_file failed${NC}"
          E2E_RESULT=1
        fi
        echo ""
      else
        echo -e "${YELLOW}  ⚠ $test_file not found, skipping${NC}"
      fi
    done

    echo -e "${BLUE}E2E Summary: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
  else
    echo -e "${RED}✗ Backend server is not running on http://localhost:5001${NC}"
    echo -e "${YELLOW}  Start the server with: cd backend && npm run dev${NC}"
    E2E_RESULT=1
  fi
  echo ""
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}                              SUMMARY                                ${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

TOTAL_RESULT=0

if [ "$RUN_BACKEND" = true ]; then
  if [ $BACKEND_RESULT -eq 0 ]; then
    echo -e "  Backend Tests:  ${GREEN}✓ PASSED${NC}"
  else
    echo -e "  Backend Tests:  ${RED}✗ FAILED${NC}"
    TOTAL_RESULT=1
  fi
fi

if [ "$RUN_FRONTEND" = true ]; then
  if [ $FRONTEND_RESULT -eq 0 ]; then
    echo -e "  Frontend Tests: ${GREEN}✓ PASSED${NC}"
  else
    echo -e "  Frontend Tests: ${RED}✗ FAILED${NC}"
    TOTAL_RESULT=1
  fi
fi

if [ "$RUN_E2E" = true ]; then
  if [ $E2E_RESULT -eq 0 ]; then
    echo -e "  E2E Tests:      ${GREEN}✓ PASSED${NC}"
  else
    echo -e "  E2E Tests:      ${RED}✗ FAILED${NC}"
    TOTAL_RESULT=1
  fi
fi

echo ""
echo -e "${BLUE}Completed at: $(date)${NC}"
echo ""

if [ $TOTAL_RESULT -eq 0 ]; then
  echo -e "${GREEN}╔════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║                      ALL TESTS PASSED! ✓                           ║${NC}"
  echo -e "${GREEN}╚════════════════════════════════════════════════════════════════════╝${NC}"
else
  echo -e "${RED}╔════════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║                      SOME TESTS FAILED ✗                           ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════════════════════════════════╝${NC}"
fi
echo ""

exit $TOTAL_RESULT
