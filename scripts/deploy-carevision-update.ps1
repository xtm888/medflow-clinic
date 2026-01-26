# MedFlow CareVision Update Deployment Script
# Run this script ON SERVEUR (Windows Server) as Administrator
#
# This deploys the CareVision replacement fixes including:
# - Granular update pattern for consultation saves
# - CareVision data import scripts
# - Frontend integration for StudioVision
# - Treatment protocol templates
#
# Usage:
#   .\deploy-carevision-update.ps1
#   .\deploy-carevision-update.ps1 -SkipFrontendBuild
#   .\deploy-carevision-update.ps1 -GitBranch "main"

[CmdletBinding()]
param(
    [Parameter(HelpMessage="Git branch to deploy (default: auto-claude/001-complete-the-project)")]
    [string]$GitBranch = "auto-claude/001-complete-the-project",

    [Parameter(HelpMessage="Skip frontend npm install and build")]
    [switch]$SkipFrontendBuild,

    [Parameter(HelpMessage="Skip backend npm install")]
    [switch]$SkipNpmInstall
)

$ErrorActionPreference = "Stop"

# Configuration
$BackendPath = "E:\MedFlow\matrix-backend"
$FrontendPath = "E:\MedFlow\frontend"
$LogsPath = "E:\MedFlow\logs"
$GitRepoUrl = "https://github.com/xtm888/medflow-clinic.git"

# Colors for output
function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Failure { param($Message) Write-Host "[FAIL] $Message" -ForegroundColor Red }

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  MedFlow CareVision Update Deployment" -ForegroundColor Cyan
Write-Host "  Branch: $GitBranch" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

$startTime = Get-Date

# =============================================================================
# STEP 1: Check prerequisites
# =============================================================================
Write-Info "Checking prerequisites..."

# Check PM2
try {
    $null = pm2 --version 2>&1
    Write-Success "PM2 is installed"
} catch {
    Write-Failure "PM2 is not installed. Run: npm install -g pm2"
    exit 1
}

# Check Git
try {
    $null = git --version 2>&1
    Write-Success "Git is installed"
} catch {
    Write-Failure "Git is not installed"
    exit 1
}

# =============================================================================
# STEP 2: Stop PM2 processes
# =============================================================================
Write-Host ""
Write-Info "Stopping PM2 processes..."

try {
    pm2 stop all 2>&1 | Out-Null
    Write-Success "PM2 processes stopped"
} catch {
    Write-Info "No PM2 processes to stop"
}

# =============================================================================
# STEP 3: Update backend code
# =============================================================================
Write-Host ""
Write-Info "Updating backend code..."

Push-Location $BackendPath
try {
    # Fetch latest
    Write-Info "Fetching from origin..."
    git fetch origin 2>&1 | Out-Null

    # Checkout and pull the branch
    Write-Info "Checking out branch: $GitBranch"
    git checkout $GitBranch 2>&1 | Out-Null
    git pull origin $GitBranch 2>&1 | Out-Null

    Write-Success "Backend code updated"
} catch {
    Write-Failure "Failed to update backend: $($_.Exception.Message)"
    Pop-Location
    exit 1
}
Pop-Location

# =============================================================================
# STEP 4: Update frontend code
# =============================================================================
Write-Host ""
Write-Info "Updating frontend code..."

Push-Location $FrontendPath
try {
    # Fetch latest
    Write-Info "Fetching from origin..."
    git fetch origin 2>&1 | Out-Null

    # Checkout and pull the branch
    Write-Info "Checking out branch: $GitBranch"
    git checkout $GitBranch 2>&1 | Out-Null
    git pull origin $GitBranch 2>&1 | Out-Null

    Write-Success "Frontend code updated"
} catch {
    Write-Failure "Failed to update frontend: $($_.Exception.Message)"
    Pop-Location
    exit 1
}
Pop-Location

# =============================================================================
# STEP 5: Install backend dependencies
# =============================================================================
if (-not $SkipNpmInstall) {
    Write-Host ""
    Write-Info "Installing backend dependencies..."

    Push-Location $BackendPath
    try {
        npm install --production 2>&1 | Out-Null
        Write-Success "Backend dependencies installed"
    } catch {
        Write-Warning "npm install had warnings"
    }
    Pop-Location
} else {
    Write-Info "Skipping npm install (--SkipNpmInstall)"
}

# =============================================================================
# STEP 6: Build frontend
# =============================================================================
if (-not $SkipFrontendBuild) {
    Write-Host ""
    Write-Info "Building frontend..."

    Push-Location $FrontendPath
    try {
        Write-Info "Installing frontend dependencies..."
        npm install 2>&1 | Out-Null

        Write-Info "Running build..."
        npm run build 2>&1 | Out-Null

        if (Test-Path (Join-Path $FrontendPath "dist")) {
            Write-Success "Frontend build complete"
        } else {
            Write-Warning "Frontend build may have failed - dist folder not found"
        }
    } catch {
        Write-Warning "Frontend build failed: $($_.Exception.Message)"
    }
    Pop-Location
} else {
    Write-Info "Skipping frontend build (--SkipFrontendBuild)"
}

# =============================================================================
# STEP 7: Start PM2 processes
# =============================================================================
Write-Host ""
Write-Info "Starting PM2 processes..."

Push-Location "E:\MedFlow"
try {
    $ecosystemConfig = "E:\MedFlow\ecosystem.production.config.js"
    if (Test-Path $ecosystemConfig) {
        pm2 start $ecosystemConfig 2>&1 | Out-Null
        Write-Success "PM2 started"

        # Save PM2 state
        pm2 save 2>&1 | Out-Null
        Write-Success "PM2 state saved"
    } else {
        Write-Failure "ecosystem.production.config.js not found"
        Pop-Location
        exit 1
    }
} catch {
    Write-Failure "PM2 start failed: $($_.Exception.Message)"
    Pop-Location
    exit 1
}
Pop-Location

# =============================================================================
# STEP 8: Verify health
# =============================================================================
Write-Host ""
Write-Info "Waiting 10 seconds for startup..."
Start-Sleep -Seconds 10

Write-Info "Verifying health..."
try {
    $health = Invoke-RestMethod -Uri "http://localhost:5002/health" -TimeoutSec 30
    if ($health.status -eq "ok" -or $health.status -eq "degraded") {
        Write-Success "Health check passed: $($health.status)"
    } else {
        Write-Warning "Health status: $($health.status)"
    }
} catch {
    Write-Warning "Health check failed: $($_.Exception.Message)"
    Write-Info "Check logs: pm2 logs medflow-backend"
}

# =============================================================================
# SUMMARY
# =============================================================================
$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  Deployment Complete" -ForegroundColor Green
Write-Host "  Duration: $($duration.ToString('mm\:ss'))" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""

# Show PM2 status
Write-Info "PM2 Status:"
pm2 status

Write-Host ""
Write-Host "What's New in This Update:" -ForegroundColor Yellow
Write-Host "  - Granular update pattern for consultation saves" -ForegroundColor White
Write-Host "  - PUT /api/visits/:id/refraction endpoint" -ForegroundColor White
Write-Host "  - PUT /api/visits/:id/diagnosis endpoint" -ForegroundColor White
Write-Host "  - PUT /api/visits/:id/treatment endpoint" -ForegroundColor White
Write-Host "  - PUT /api/visits/:id/iop endpoint" -ForegroundColor White
Write-Host "  - CareVision data import scripts" -ForegroundColor White
Write-Host "  - Treatment protocol templates (27 protocols)" -ForegroundColor White
Write-Host "  - StudioVision auto-save on tab change" -ForegroundColor White
Write-Host ""
Write-Host "Verify at:" -ForegroundColor Cyan
Write-Host "  http://localhost:5002/health" -ForegroundColor White
Write-Host "  http://localhost:5002/health/detailed" -ForegroundColor White
Write-Host ""
