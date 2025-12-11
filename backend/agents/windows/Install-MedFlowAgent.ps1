# MedFlow Agent Installation Script (PowerShell)
# Run as Administrator
#
# Usage: .\Install-MedFlowAgent.ps1 -ServerUrl "http://192.168.4.1:5001" -DeviceId "your-device-id"

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerUrl,

    [Parameter(Mandatory=$true)]
    [string]$DeviceId,

    [string]$ApiKey = "",

    [string[]]$WatchFolders = @(),

    [string]$InstallPath = "C:\MedFlowAgent"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MedFlow Agent Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check for admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script requires Administrator privileges" -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
    exit 1
}

# Check if Node.js is installed
$nodeVersion = $null
try {
    $nodeVersion = node --version 2>$null
} catch {}

if (-not $nodeVersion) {
    Write-Host "Node.js not found. Installing..." -ForegroundColor Yellow

    # Download and install Node.js using winget if available
    $hasWinget = Get-Command winget -ErrorAction SilentlyContinue
    if ($hasWinget) {
        winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    } else {
        Write-Host "Please install Node.js manually from https://nodejs.org/" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Node.js $nodeVersion found" -ForegroundColor Green
}

# Create installation directory
Write-Host ""
Write-Host "Creating installation directory: $InstallPath" -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallPath | Out-Null

# Copy agent files (assuming they're in the same directory as the script)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "Copying agent files..." -ForegroundColor Yellow

Copy-Item "$scriptDir\medflow-agent.js" -Destination $InstallPath -Force
Copy-Item "$scriptDir\package.json" -Destination $InstallPath -Force
Copy-Item "$scriptDir\install-service.js" -Destination $InstallPath -Force
Copy-Item "$scriptDir\uninstall-service.js" -Destination $InstallPath -Force

# Create config.json
Write-Host "Creating configuration file..." -ForegroundColor Yellow

$config = @{
    apiUrl = $ServerUrl
    deviceId = $DeviceId
    apiKey = $ApiKey
    watchFolders = if ($WatchFolders.Count -gt 0) { $WatchFolders } else { @() }
    recursive = $true
    pollInterval = 5000
    stabilityDelay = 2000
    extensions = @(".xml", ".jpg", ".jpeg", ".png", ".bmp", ".dcm", ".dicom", ".pdf", ".csv")
    ignorePatterns = @("temp", "tmp", ".lock", "thumbs.db")
    batchSize = 10
    retryAttempts = 3
    retryDelay = 5000
    logFile = "medflow-agent.log"
    logLevel = "info"
}

$configPath = Join-Path $InstallPath "config.json"
$config | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding UTF8

Write-Host "Configuration saved to: $configPath" -ForegroundColor Green

# Install npm dependencies
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
Push-Location $InstallPath
npm install --production 2>&1 | Out-Null
Pop-Location

# Install as Windows service
Write-Host ""
Write-Host "Installing Windows service..." -ForegroundColor Yellow
Push-Location $InstallPath
node install-service.js
Pop-Location

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Installation path: $InstallPath" -ForegroundColor White
Write-Host "Configuration: $configPath" -ForegroundColor White
Write-Host ""

if ($WatchFolders.Count -eq 0) {
    Write-Host "IMPORTANT: Edit config.json to add your watch folders:" -ForegroundColor Yellow
    Write-Host "  Example: `"watchFolders`": [`"C:\\DeviceExports\\Zeiss`", `"D:\\NIDEK\\Export`"]" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Service commands:" -ForegroundColor White
Write-Host "  Start:   net start `"MedFlow Agent`"" -ForegroundColor Cyan
Write-Host "  Stop:    net stop `"MedFlow Agent`"" -ForegroundColor Cyan
Write-Host "  Status:  sc query `"MedFlow Agent`"" -ForegroundColor Cyan
Write-Host ""
