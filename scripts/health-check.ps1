# MedFlow Health Check Script
# Verifies all health endpoints respond correctly
#
# Usage:
#   .\health-check.ps1
#   .\health-check.ps1 -BaseUrl "http://192.168.1.100:5002"
#   .\health-check.ps1 -Timeout 60

[CmdletBinding()]
param(
    [Parameter(HelpMessage="Base URL for health checks")]
    [string]$BaseUrl = "http://localhost:5002",

    [Parameter(HelpMessage="Timeout in seconds for each request")]
    [int]$Timeout = 30
)

# Counters
$passed = 0
$failed = 0
$warnings = 0

# Colors for output
function Write-Pass { param($Message) Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warn { param($Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Fail { param($Message) Write-Host "[FAIL] $Message" -ForegroundColor Red }

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  MedFlow Health Check" -ForegroundColor Cyan
Write-Host "  URL: $BaseUrl" -ForegroundColor Cyan
Write-Host "  Timeout: ${Timeout}s" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# =============================================================================
# CHECK 1: Frontend serving at root URL (/)
# =============================================================================
Write-Host "Checking frontend at root URL..." -ForegroundColor White

try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/" -UseBasicParsing -TimeoutSec $Timeout
    $contentType = $response.Headers["Content-Type"]

    # Check if it's HTML content
    $isHtml = ($contentType -match "text/html") -and ($response.Content -match "<!DOCTYPE html|<html")

    if ($isHtml) {
        Write-Pass "/ (frontend): HTML served correctly"
        $passed++
    } else {
        Write-Warn "/ (frontend): Response received but Content-Type is $contentType"
        $warnings++
    }
} catch {
    Write-Fail "/ (frontend): $($_.Exception.Message)"
    $failed++
}

# =============================================================================
# CHECK 2: /health - Basic health check
# =============================================================================
Write-Host "Checking /health..." -ForegroundColor White

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec $Timeout

    if ($response.status -eq "ok") {
        Write-Pass "/health: status = $($response.status)"
        $passed++
    } elseif ($response.status -eq "degraded") {
        Write-Warn "/health: status = $($response.status) (MongoDB OK but other services degraded)"
        $warnings++
    } else {
        Write-Fail "/health: status = $($response.status)"
        $failed++
    }

    # Show connection status
    if ($response.connections) {
        $mongoStatus = $response.connections.mongodb
        $redisStatus = $response.connections.redis
        Write-Host "       MongoDB: $mongoStatus | Redis: $redisStatus" -ForegroundColor Gray
    }
} catch {
    Write-Fail "/health: $($_.Exception.Message)"
    $failed++
}

# =============================================================================
# CHECK 3: /health/ready - Readiness probe
# =============================================================================
Write-Host "Checking /health/ready..." -ForegroundColor White

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/health/ready" -TimeoutSec $Timeout

    if ($response.status -eq "ready") {
        Write-Pass "/health/ready: status = $($response.status)"
        $passed++
    } elseif ($response.status -eq "not_ready") {
        Write-Fail "/health/ready: status = $($response.status)"
        $failed++
    } else {
        Write-Warn "/health/ready: status = $($response.status)"
        $warnings++
    }
} catch {
    Write-Fail "/health/ready: $($_.Exception.Message)"
    $failed++
}

# =============================================================================
# CHECK 4: /health/detailed - Detailed health with metrics
# =============================================================================
Write-Host "Checking /health/detailed..." -ForegroundColor White

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/health/detailed" -TimeoutSec $Timeout

    if ($response.status -eq "healthy") {
        Write-Pass "/health/detailed: status = $($response.status)"
        $passed++
    } elseif ($response.status -eq "degraded") {
        Write-Warn "/health/detailed: status = $($response.status)"
        $warnings++
    } else {
        Write-Fail "/health/detailed: status = $($response.status)"
        $failed++
    }

    # Extract and display useful metrics
    if ($response.uptime) {
        $uptimeFormatted = if ($response.uptimeFormatted) { $response.uptimeFormatted } else { "$($response.uptime)s" }
        Write-Host "       Uptime: $uptimeFormatted" -ForegroundColor Gray
    }

    if ($response.memory) {
        Write-Host "       Memory: Heap $($response.memory.heapUsedMB)MB / $($response.memory.heapTotalMB)MB, RSS $($response.memory.rssMB)MB" -ForegroundColor Gray
    }

    if ($response.checks) {
        # MongoDB status
        if ($response.checks.mongodb) {
            $mongoStatus = $response.checks.mongodb.status
            $mongoTime = $response.checks.mongodb.responseTimeMs
            Write-Host "       MongoDB: $mongoStatus (${mongoTime}ms)" -ForegroundColor Gray
        }

        # WebSocket clients
        if ($response.checks.websocket -and $response.checks.websocket.details) {
            $wsClients = $response.checks.websocket.details.connectedClients
            Write-Host "       WebSocket clients: $wsClients" -ForegroundColor Gray
        }
    }
} catch {
    Write-Fail "/health/detailed: $($_.Exception.Message)"
    $failed++
}

# =============================================================================
# CHECK 5: /api/auth/session - API routes work (should return 401)
# =============================================================================
Write-Host "Checking /api/auth/session (expect 401)..." -ForegroundColor White

try {
    # We expect this to fail with 401 since we're not authenticated
    $response = Invoke-WebRequest -Uri "$BaseUrl/api/auth/session" -UseBasicParsing -TimeoutSec $Timeout -ErrorAction Stop
    # If we get here without error, something is wrong
    Write-Warn "/api/auth/session: Expected 401, got $($response.StatusCode)"
    $warnings++
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__

    if ($statusCode -eq 401) {
        Write-Pass "/api/auth/session: Returns 401 (API routes working)"
        $passed++
    } elseif ($statusCode -eq 403) {
        Write-Pass "/api/auth/session: Returns 403 (API routes working, CSRF active)"
        $passed++
    } elseif ($null -eq $statusCode) {
        Write-Fail "/api/auth/session: Connection failed - $($_.Exception.Message)"
        $failed++
    } else {
        Write-Warn "/api/auth/session: Returns $statusCode"
        $warnings++
    }
}

# =============================================================================
# SUMMARY
# =============================================================================
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Health Check Summary" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$total = $passed + $failed + $warnings

Write-Host "  Passed:   $passed" -ForegroundColor Green
Write-Host "  Warnings: $warnings" -ForegroundColor Yellow
Write-Host "  Failed:   $failed" -ForegroundColor Red
Write-Host "  Total:    $total checks" -ForegroundColor White
Write-Host ""

# Critical checks: /health and /health/ready must pass
# If frontend check fails, it's a warning (backend still works)
if ($failed -gt 0) {
    Write-Host "RESULT: UNHEALTHY - $failed check(s) failed" -ForegroundColor Red
    exit 1
} elseif ($warnings -gt 0) {
    Write-Host "RESULT: DEGRADED - All critical checks pass, $warnings warning(s)" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "RESULT: HEALTHY - All checks passed" -ForegroundColor Green
    exit 0
}
