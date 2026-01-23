# MedFlow Deployment Script for SERVEUR (Windows Production Server)
# Run as Administrator
#
# Usage:
#   .\deploy-medflow.ps1 -SourcePath "\\DEV-PC\share\magloire"
#   .\deploy-medflow.ps1 -SkipFrontend -SkipNpmInstall
#
# Prerequisites:
#   - PM2 installed globally: npm install -g pm2
#   - PM2 Windows service configured (pm2-installer)
#   - Node.js 18+ installed
#   - MongoDB running on localhost:27017

[CmdletBinding()]
param(
    [Parameter(HelpMessage="Source path for code (network share or local path)")]
    [string]$SourcePath = ".",

    [Parameter(HelpMessage="Target path for backend")]
    [string]$TargetPath = "E:\MedFlow\matrix-backend",

    [Parameter(HelpMessage="Frontend path")]
    [string]$FrontendPath = "E:\MedFlow\frontend",

    [Parameter(HelpMessage="Scripts path for deployment utilities")]
    [string]$ScriptsPath = "E:\MedFlow\scripts",

    [Parameter(HelpMessage="Skip frontend build")]
    [switch]$SkipFrontend,

    [Parameter(HelpMessage="Skip npm install")]
    [switch]$SkipNpmInstall
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Info { param($Message) Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Success { param($Message) Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-Warning { param($Message) Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Failure { param($Message) Write-Host "[FAIL] $Message" -ForegroundColor Red }

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  MedFlow Production Deployment" -ForegroundColor Cyan
Write-Host "  Server: SERVEUR (100.73.34.191)" -ForegroundColor Cyan
Write-Host "  Target: $TargetPath" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Record start time
$startTime = Get-Date

# =============================================================================
# PREREQUISITES CHECK
# =============================================================================
Write-Info "Checking prerequisites..."

# Check PM2
try {
    $pm2Version = pm2 --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Success "PM2 installed: $pm2Version"
    } else {
        throw "PM2 not found"
    }
} catch {
    Write-Failure "PM2 is not installed. Run: npm install -g pm2"
    exit 1
}

# Check Node.js version
try {
    $nodeVersion = node --version 2>&1
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -ge 18) {
        Write-Success "Node.js version: $nodeVersion"
    } else {
        Write-Warning "Node.js $nodeVersion detected. Version 18+ recommended."
    }
} catch {
    Write-Failure "Node.js is not installed"
    exit 1
}

# Check PM2 Windows service
$pm2Service = Get-Service -Name "PM2" -ErrorAction SilentlyContinue
if (-not $pm2Service) {
    Write-Warning "PM2 Windows service not installed."
    Write-Warning "For auto-start after reboot, run: npm install -g @innomizetech/pm2-installer"
    Write-Warning "Then: pm2-service-install"
    Write-Host ""
} else {
    Write-Success "PM2 Windows service: $($pm2Service.Status)"
}

# Create required directories
$directories = @(
    "E:\MedFlow",
    "E:\MedFlow\logs",
    "E:\MedFlow\backups"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Info "Created directory: $dir"
    }
}

# =============================================================================
# STOP PM2 PROCESSES
# =============================================================================
Write-Host ""
Write-Info "Stopping PM2 processes..."

try {
    $pm2Status = pm2 jlist 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($pm2Status -and $pm2Status.Count -gt 0) {
        pm2 stop all 2>&1 | Out-Null
        Write-Success "PM2 processes stopped"
    } else {
        Write-Info "No PM2 processes running"
    }
} catch {
    Write-Info "PM2 list empty or not running"
}

# =============================================================================
# BACKUP CURRENT VERSION
# =============================================================================
Write-Host ""
Write-Info "Creating backup..."

$backupTimestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$backupPath = "E:\MedFlow\backups\$backupTimestamp"

if (Test-Path $TargetPath) {
    try {
        Copy-Item -Path $TargetPath -Destination $backupPath -Recurse -Force
        Write-Success "Backup created: $backupPath"
    } catch {
        Write-Warning "Backup failed: $($_.Exception.Message)"
        Write-Warning "Continuing without backup..."
    }
} else {
    Write-Info "No existing deployment to backup"
}

# =============================================================================
# SYNC BACKEND FILES
# =============================================================================
Write-Host ""
Write-Info "Syncing backend files..."

$backendSource = Join-Path $SourcePath "backend"

if (-not (Test-Path $backendSource)) {
    Write-Failure "Backend source not found: $backendSource"
    exit 1
}

# Use robocopy with /MIR for mirror, exclude node_modules, .env, logs
$robocopyArgs = @(
    $backendSource,
    $TargetPath,
    "/MIR",
    "/XD", "node_modules", "logs",
    "/XF", ".env", ".env.local",
    "/NFL", "/NDL", "/NJH",  # Reduce output noise
    "/R:3", "/W:5"  # Retry 3 times, wait 5 seconds
)

Write-Info "Running: robocopy $($robocopyArgs -join ' ')"
$robocopyResult = & robocopy @robocopyArgs

# Robocopy exit codes: 0-7 are success, 8+ are errors
if ($LASTEXITCODE -le 7) {
    Write-Success "Backend files synced"
} else {
    Write-Warning "Robocopy completed with warnings (exit code: $LASTEXITCODE)"
}

# =============================================================================
# SYNC SCRIPTS FOLDER
# =============================================================================
Write-Host ""
Write-Info "Syncing scripts folder..."

$scriptsSource = Join-Path $SourcePath "scripts"

if (Test-Path $scriptsSource) {
    $robocopyScriptsArgs = @(
        $scriptsSource,
        $ScriptsPath,
        "/MIR",
        "/NFL", "/NDL", "/NJH",
        "/R:3", "/W:5"
    )

    & robocopy @robocopyScriptsArgs | Out-Null

    if ($LASTEXITCODE -le 7) {
        Write-Success "Scripts folder synced"
    } else {
        Write-Warning "Scripts sync completed with warnings"
    }
} else {
    Write-Info "No scripts folder found, skipping"
}

# =============================================================================
# COPY ECOSYSTEM CONFIG
# =============================================================================
Write-Host ""
Write-Info "Copying ecosystem config..."

$ecosystemSource = Join-Path $SourcePath "ecosystem.production.config.js"
$ecosystemTarget = "E:\MedFlow\ecosystem.production.config.js"

if (Test-Path $ecosystemSource) {
    Copy-Item -Path $ecosystemSource -Destination $ecosystemTarget -Force
    Write-Success "Copied: ecosystem.production.config.js"
} else {
    Write-Warning "ecosystem.production.config.js not found in source"
    Write-Warning "Deployment will use existing config if present"
}

# =============================================================================
# INSTALL BACKEND DEPENDENCIES
# =============================================================================
if (-not $SkipNpmInstall) {
    Write-Host ""
    Write-Info "Installing backend dependencies..."

    Push-Location $TargetPath
    try {
        $npmInstallOutput = npm install --production 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Backend dependencies installed"
        } else {
            Write-Warning "npm install had warnings. Output: $npmInstallOutput"
        }
    } catch {
        Write-Warning "npm install failed: $($_.Exception.Message)"
    }
    Pop-Location
} else {
    Write-Info "Skipping npm install (--SkipNpmInstall)"
}

# =============================================================================
# BUILD FRONTEND
# =============================================================================
if (-not $SkipFrontend) {
    Write-Host ""
    Write-Info "Building frontend..."

    $frontendSource = Join-Path $SourcePath "frontend"

    if (Test-Path $frontendSource) {
        # Sync frontend source files (exclude node_modules, dist)
        $robocopyFrontendArgs = @(
            $frontendSource,
            $FrontendPath,
            "/MIR",
            "/XD", "node_modules", "dist",
            "/NFL", "/NDL", "/NJH",
            "/R:3", "/W:5"
        )

        & robocopy @robocopyFrontendArgs | Out-Null
        Write-Success "Frontend files synced"

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
        Write-Warning "Frontend source not found: $frontendSource"
    }
} else {
    Write-Info "Skipping frontend build (--SkipFrontend)"
}

# =============================================================================
# START PM2 PROCESSES
# =============================================================================
Write-Host ""
Write-Info "Starting PM2 processes..."

Push-Location "E:\MedFlow"
try {
    if (Test-Path $ecosystemTarget) {
        pm2 start $ecosystemTarget 2>&1 | Out-Null
        Write-Success "PM2 started with ecosystem.production.config.js"
    } else {
        Write-Failure "ecosystem.production.config.js not found at $ecosystemTarget"
        Pop-Location
        exit 1
    }

    # Save PM2 state for resurrection after reboot
    pm2 save 2>&1 | Out-Null
    Write-Success "PM2 state saved"

} catch {
    Write-Failure "PM2 start failed: $($_.Exception.Message)"
    Pop-Location
    exit 1
}
Pop-Location

# =============================================================================
# VERIFY HEALTH
# =============================================================================
Write-Host ""
Write-Info "Waiting 10 seconds for startup..."
Start-Sleep -Seconds 10

Write-Info "Verifying health..."

$healthCheckScript = Join-Path $ScriptsPath "health-check.ps1"
if (Test-Path $healthCheckScript) {
    & $healthCheckScript -BaseUrl "http://localhost:5002" -Timeout 30
} else {
    # Inline health check
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:5002/health" -TimeoutSec 30
        if ($health.status -eq "ok" -or $health.status -eq "degraded") {
            Write-Success "Health check passed: $($health.status)"
        } else {
            Write-Warning "Health status: $($health.status)"
        }
    } catch {
        Write-Failure "Health check failed: $($_.Exception.Message)"
    }
}

# =============================================================================
# SUMMARY
# =============================================================================
$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  Deployment Complete" -ForegroundColor Green
Write-Host "  Duration: $($duration.ToString('mm\:ss'))" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# Show PM2 status
Write-Info "PM2 Status:"
pm2 status

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Verify frontend at http://localhost:5002/" -ForegroundColor White
Write-Host "  2. Verify API at http://localhost:5002/health/detailed" -ForegroundColor White
Write-Host "  3. Check logs: pm2 logs medflow-backend" -ForegroundColor White
Write-Host "  4. Run stability monitor: .\stability-monitor.ps1" -ForegroundColor White
Write-Host ""
