<#
.SYNOPSIS
    MedFlow 24-hour stability monitoring script.

.DESCRIPTION
    Monitors the MedFlow backend health endpoint for a configurable duration,
    collecting memory metrics, detecting potential leaks, and generating summary reports.

.PARAMETER DurationHours
    Duration to run the stability test (default: 24 hours).

.PARAMETER IntervalMinutes
    Interval between health checks (default: 5 minutes).

.PARAMETER BaseUrl
    Base URL for the MedFlow backend (default: http://localhost:5002).

.PARAMETER LogPath
    Path to store log files (default: E:\MedFlow\logs).

.EXAMPLE
    .\stability-monitor.ps1 -DurationHours 4 -IntervalMinutes 5
    Run a 4-hour stability test with 5-minute intervals.

.NOTES
    Author: MedFlow Team
    Version: 1.0.0
    Requires: PowerShell 5.1+
#>

param(
    [int]$DurationHours = 24,
    [int]$IntervalMinutes = 5,
    [string]$BaseUrl = 'http://localhost:5002',
    [string]$LogPath = 'E:\MedFlow\logs'
)

# Configuration
$MemoryWarningThresholdMB = 400  # 80% of PM2's 500MB limit
$TrendWindowSize = 10            # Number of readings to analyze for leak detection

# Initialize data collection
$checks = [System.Collections.ArrayList]::new()
$startTime = Get-Date
$endTime = $startTime.AddHours($DurationHours)
$logDate = Get-Date -Format 'yyyy-MM-dd'
$logFile = Join-Path $LogPath "stability-$logDate.log"

# Ensure log directory exists
if (-not (Test-Path $LogPath)) {
    New-Item -ItemType Directory -Path $LogPath -Force | Out-Null
}

# Function to write to both console and log file
function Write-Log {
    param(
        [string]$Message,
        [string]$Level = 'INFO'
    )
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $logEntry = "[$timestamp] [$Level] $Message"

    switch ($Level) {
        'ERROR'   { Write-Host $logEntry -ForegroundColor Red }
        'WARNING' { Write-Host $logEntry -ForegroundColor Yellow }
        'SUCCESS' { Write-Host $logEntry -ForegroundColor Green }
        default   { Write-Host $logEntry }
    }

    Add-Content -Path $logFile -Value $logEntry
}

# Function to detect memory leak trend
function Test-MemoryLeakTrend {
    param(
        [System.Collections.ArrayList]$Checks,
        [int]$WindowSize
    )

    if ($Checks.Count -lt $WindowSize) {
        return $false
    }

    # Get last N readings
    $recentChecks = $Checks | Select-Object -Last $WindowSize
    $heapValues = $recentChecks | ForEach-Object { $_.HeapMB }

    # Check if heap is consistently increasing
    $increasingCount = 0
    for ($i = 1; $i -lt $heapValues.Count; $i++) {
        if ($heapValues[$i] -gt $heapValues[$i - 1]) {
            $increasingCount++
        }
    }

    # If 80% or more readings are increasing, consider it a trend
    $threshold = [math]::Floor($WindowSize * 0.8)
    return $increasingCount -ge $threshold
}

# Function to generate summary statistics
function Get-StabilitySummary {
    param(
        [System.Collections.ArrayList]$Checks
    )

    if ($Checks.Count -eq 0) {
        return @{
            TotalChecks = 0
            HealthyChecks = 0
            DegradedChecks = 0
            FailedChecks = 0
            MaxHeapMB = 0
            MinHeapMB = 0
            AvgHeapMB = 0
            MaxRSSMB = 0
            FinalUptime = 'N/A'
        }
    }

    $heapValues = $Checks | Where-Object { $null -ne $_.HeapMB } | ForEach-Object { $_.HeapMB }
    $rssValues = $Checks | Where-Object { $null -ne $_.RSSMB } | ForEach-Object { $_.RSSMB }

    $summary = @{
        TotalChecks = $Checks.Count
        HealthyChecks = ($Checks | Where-Object { $_.Status -eq 'healthy' }).Count
        DegradedChecks = ($Checks | Where-Object { $_.Status -eq 'degraded' }).Count
        FailedChecks = ($Checks | Where-Object { $_.Status -eq 'FAIL' -or $_.Status -eq 'unhealthy' }).Count
        MaxHeapMB = if ($heapValues.Count -gt 0) { ($heapValues | Measure-Object -Maximum).Maximum } else { 0 }
        MinHeapMB = if ($heapValues.Count -gt 0) { ($heapValues | Measure-Object -Minimum).Minimum } else { 0 }
        AvgHeapMB = if ($heapValues.Count -gt 0) { [math]::Round(($heapValues | Measure-Object -Average).Average, 2) } else { 0 }
        MaxRSSMB = if ($rssValues.Count -gt 0) { ($rssValues | Measure-Object -Maximum).Maximum } else { 0 }
        FinalUptime = if ($Checks.Count -gt 0) { $Checks[-1].Uptime } else { 'N/A' }
    }

    return $summary
}

# Function to print summary table
function Write-SummaryTable {
    param(
        [hashtable]$Summary,
        [datetime]$StartTime,
        [datetime]$EndTime
    )

    $duration = $EndTime - $StartTime

    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host "        STABILITY MONITORING SUMMARY         " -ForegroundColor Cyan
    Write-Host "=============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Duration:        $([math]::Round($duration.TotalHours, 2)) hours"
    Write-Host "Start Time:      $($StartTime.ToString('yyyy-MM-dd HH:mm:ss'))"
    Write-Host "End Time:        $($EndTime.ToString('yyyy-MM-dd HH:mm:ss'))"
    Write-Host ""
    Write-Host "--- Health Check Results ---" -ForegroundColor Yellow
    Write-Host "Total Checks:    $($Summary.TotalChecks)"
    Write-Host "Healthy:         $($Summary.HealthyChecks)" -ForegroundColor Green
    Write-Host "Degraded:        $($Summary.DegradedChecks)" -ForegroundColor Yellow
    Write-Host "Failed:          $($Summary.FailedChecks)" -ForegroundColor $(if ($Summary.FailedChecks -gt 0) { 'Red' } else { 'Gray' })
    Write-Host ""
    Write-Host "--- Memory Statistics ---" -ForegroundColor Yellow
    Write-Host "Min Heap:        $($Summary.MinHeapMB) MB"
    Write-Host "Max Heap:        $($Summary.MaxHeapMB) MB $(if ($Summary.MaxHeapMB -gt $MemoryWarningThresholdMB) { '[WARNING: Above 80% threshold]' })" -ForegroundColor $(if ($Summary.MaxHeapMB -gt $MemoryWarningThresholdMB) { 'Yellow' } else { 'Gray' })
    Write-Host "Avg Heap:        $($Summary.AvgHeapMB) MB"
    Write-Host "Max RSS:         $($Summary.MaxRSSMB) MB"
    Write-Host ""
    Write-Host "--- Service Status ---" -ForegroundColor Yellow
    Write-Host "Final Uptime:    $($Summary.FinalUptime)"
    Write-Host ""

    # Calculate success rate
    if ($Summary.TotalChecks -gt 0) {
        $successRate = [math]::Round(($Summary.HealthyChecks / $Summary.TotalChecks) * 100, 1)
        $statusColor = if ($successRate -ge 99) { 'Green' } elseif ($successRate -ge 95) { 'Yellow' } else { 'Red' }
        Write-Host "Success Rate:    $successRate%" -ForegroundColor $statusColor
    }

    Write-Host ""
    Write-Host "=============================================" -ForegroundColor Cyan
}

# Cleanup handler for Ctrl+C
$global:MonitoringStopped = $false

Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    $global:MonitoringStopped = $true
} | Out-Null

# Handle Ctrl+C gracefully
$null = [Console]::TreatControlCAsInput = $false
trap {
    $global:MonitoringStopped = $true
    Write-Log "Received interrupt signal, generating summary..." "WARNING"

    $actualEndTime = Get-Date
    $summary = Get-StabilitySummary -Checks $checks
    Write-SummaryTable -Summary $summary -StartTime $startTime -EndTime $actualEndTime

    # Write summary to log file
    Add-Content -Path $logFile -Value ""
    Add-Content -Path $logFile -Value "=== STABILITY SUMMARY (Interrupted) ==="
    Add-Content -Path $logFile -Value "Duration: $([math]::Round(($actualEndTime - $startTime).TotalHours, 2)) hours"
    Add-Content -Path $logFile -Value "Total Checks: $($summary.TotalChecks)"
    Add-Content -Path $logFile -Value "Healthy: $($summary.HealthyChecks)"
    Add-Content -Path $logFile -Value "Degraded: $($summary.DegradedChecks)"
    Add-Content -Path $logFile -Value "Failed: $($summary.FailedChecks)"
    Add-Content -Path $logFile -Value "Max Heap: $($summary.MaxHeapMB) MB"
    Add-Content -Path $logFile -Value "Avg Heap: $($summary.AvgHeapMB) MB"
    Add-Content -Path $logFile -Value "Final Uptime: $($summary.FinalUptime)"

    exit
}

# Main monitoring banner
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "     MedFlow Stability Monitor v1.0.0        " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Log "Starting $DurationHours-hour stability monitoring"
Write-Log "Interval: Every $IntervalMinutes minutes"
Write-Log "Target: $BaseUrl/health/detailed"
Write-Log "Log file: $logFile"
Write-Log "Memory warning threshold: ${MemoryWarningThresholdMB}MB (80% of PM2 limit)"
Write-Host ""

# Main monitoring loop
$checkNumber = 0
while ((Get-Date) -lt $endTime -and -not $global:MonitoringStopped) {
    $checkNumber++
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'

    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/health/detailed" -Method Get -TimeoutSec 30

        # Extract metrics
        $record = [PSCustomObject]@{
            CheckNumber = $checkNumber
            Timestamp = $timestamp
            Status = $response.status
            Uptime = $response.uptimeFormatted
            HeapMB = $response.memory.heapUsedMB
            RSSMB = $response.memory.rssMB
            MongoDB = $response.checks.mongodb.status
            WebSocketClients = if ($response.checks.websocket.details) { $response.checks.websocket.details.connectedClients } else { 0 }
        }

        [void]$checks.Add($record)

        # Log the check
        $logMessage = "Check #$checkNumber | Status: $($record.Status) | Heap: $($record.HeapMB)MB | RSS: $($record.RSSMB)MB | Uptime: $($record.Uptime) | MongoDB: $($record.MongoDB) | WS Clients: $($record.WebSocketClients)"

        # Determine log level based on status
        $level = 'INFO'
        if ($record.Status -eq 'unhealthy') {
            $level = 'ERROR'
        } elseif ($record.Status -eq 'degraded') {
            $level = 'WARNING'
        }

        Write-Log $logMessage $level

        # Memory warning check
        if ($record.HeapMB -gt $MemoryWarningThresholdMB) {
            Write-Log "MEMORY WARNING: Heap usage ($($record.HeapMB)MB) exceeds 80% of PM2 limit (${MemoryWarningThresholdMB}MB). Consider restart." "WARNING"
        }

        # Memory leak trend detection (after sufficient samples)
        if ($checks.Count -ge $TrendWindowSize) {
            $hasLeakTrend = Test-MemoryLeakTrend -Checks $checks -WindowSize $TrendWindowSize
            if ($hasLeakTrend) {
                Write-Log "POTENTIAL MEMORY LEAK: Heap usage consistently increasing over last $TrendWindowSize readings." "WARNING"
            }
        }

    } catch {
        $record = [PSCustomObject]@{
            CheckNumber = $checkNumber
            Timestamp = $timestamp
            Status = 'FAIL'
            Uptime = 'N/A'
            HeapMB = $null
            RSSMB = $null
            MongoDB = 'unknown'
            WebSocketClients = 0
        }

        [void]$checks.Add($record)

        Write-Log "Check #$checkNumber | FAILED: $($_.Exception.Message)" "ERROR"
    }

    # Wait for next interval (unless this is the last check)
    if ((Get-Date).AddMinutes($IntervalMinutes) -lt $endTime) {
        Start-Sleep -Seconds ($IntervalMinutes * 60)
    } else {
        # If less than one interval remaining, just wait until end
        $remaining = ($endTime - (Get-Date)).TotalSeconds
        if ($remaining -gt 0) {
            Start-Sleep -Seconds $remaining
        }
    }
}

# Generate final summary
$actualEndTime = Get-Date
$summary = Get-StabilitySummary -Checks $checks

# Display summary
Write-SummaryTable -Summary $summary -StartTime $startTime -EndTime $actualEndTime

# Write summary to log file
Add-Content -Path $logFile -Value ""
Add-Content -Path $logFile -Value "=== STABILITY SUMMARY ==="
Add-Content -Path $logFile -Value "Duration: $DurationHours hours"
Add-Content -Path $logFile -Value "Total Checks: $($summary.TotalChecks)"
Add-Content -Path $logFile -Value "Healthy: $($summary.HealthyChecks)"
Add-Content -Path $logFile -Value "Degraded: $($summary.DegradedChecks)"
Add-Content -Path $logFile -Value "Failed: $($summary.FailedChecks)"
Add-Content -Path $logFile -Value "Min Heap: $($summary.MinHeapMB) MB"
Add-Content -Path $logFile -Value "Max Heap: $($summary.MaxHeapMB) MB"
Add-Content -Path $logFile -Value "Avg Heap: $($summary.AvgHeapMB) MB"
Add-Content -Path $logFile -Value "Max RSS: $($summary.MaxRSSMB) MB"
Add-Content -Path $logFile -Value "Final Uptime: $($summary.FinalUptime)"

if ($summary.TotalChecks -gt 0) {
    $successRate = [math]::Round(($summary.HealthyChecks / $summary.TotalChecks) * 100, 1)
    Add-Content -Path $logFile -Value "Success Rate: $successRate%"
}

Write-Log "Stability monitoring complete. Log saved to: $logFile" "SUCCESS"
