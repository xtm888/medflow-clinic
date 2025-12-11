#!/bin/bash

# MedFlow OCR Service Startup Script
# Run without Docker for local development

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  MedFlow OCR Service"
echo "=========================================="

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -q -r requirements.txt

# Check Redis
echo ""
echo "Checking Redis..."
if redis-cli ping > /dev/null 2>&1; then
    echo "  ✓ Redis is running"
else
    echo "  ⚠ Redis not running. Starting with brew..."
    brew services start redis 2>/dev/null || echo "  Please start Redis manually"
fi

# Create thumbnail cache directory
mkdir -p /tmp/medflow_thumbnails

# Start Celery worker in background
echo ""
echo "Starting Celery worker..."
celery -A app.celery_app worker --loglevel=info --concurrency=2 > /tmp/ocr-worker.log 2>&1 &
WORKER_PID=$!
echo "  Worker PID: $WORKER_PID"

# Wait for worker to start
sleep 3

# Start FastAPI server
echo ""
echo "Starting OCR API server..."
echo ""
echo "=========================================="
echo "  OCR Service: http://localhost:5003"
echo "  API Docs:    http://localhost:5003/docs"
echo "=========================================="
echo ""
echo "Press Ctrl+C to stop"
echo ""

uvicorn app.main:app --host 0.0.0.0 --port 5003 --reload

# Cleanup on exit
trap "kill $WORKER_PID 2>/dev/null" EXIT
