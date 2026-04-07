#!/usr/bin/env powershell
# Restaurant Management App - Complete Startup
param([switch]$SkipBrowser)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $root "backend"
$schemaPath = Join-Path $backendDir "schema.sql"
$psqlPath = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
$createdbPath = "C:\Program Files\PostgreSQL\17\bin\createdb.exe"

Write-Host "`n===========================================" -ForegroundColor Cyan
Write-Host "  RESTAURANT MANAGEMENT APP - STARTUP" -ForegroundColor Cyan
Write-Host "===========================================`n" -ForegroundColor Cyan

Write-Host "Step 1: Checking PostgreSQL..." -ForegroundColor Yellow
$pgRunning = Get-Process postgres -ErrorAction SilentlyContinue
if (-not $pgRunning) {
    try {
        net start PostgreSQL-x64-17 | Out-Null
        Start-Sleep -Seconds 3
    } catch {
        Write-Host "Could not start PostgreSQL service automatically (admin rights may be required)." -ForegroundColor Yellow
    }
}

$pgRunning = Get-Process postgres -ErrorAction SilentlyContinue
if (-not $pgRunning) {
    Write-Host "PostgreSQL is not running. Start it first, then run START.ps1 again." -ForegroundColor Red
    exit 1
}
Write-Host "OK: PostgreSQL is running.`n" -ForegroundColor Green

if (-not (Test-Path $psqlPath) -or -not (Test-Path $createdbPath)) {
    Write-Host "PostgreSQL CLI tools not found at the default path." -ForegroundColor Red
    Write-Host "Expected: C:\Program Files\PostgreSQL\17\bin\psql.exe" -ForegroundColor Red
    exit 1
}

Write-Host "Step 2: Ensuring database and schema..." -ForegroundColor Yellow
Push-Location $backendDir
try {
    $env:PGPASSWORD = if ($env:PGPASSWORD) { $env:PGPASSWORD } else { "postgres" }

    $dbExists = (& $psqlPath -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='restaurant_db';").Trim()
    if ($dbExists -ne "1") {
        & $createdbPath -U postgres restaurant_db | Out-Null
    }
    & $psqlPath -U postgres -d restaurant_db -f $schemaPath | Out-Null
    & node init-db.js
    Write-Host "OK: Database ready.`n" -ForegroundColor Green
} catch {
    Write-Host "Database setup failed: $($_.Exception.Message)" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

Write-Host "Step 3: Starting backend server..." -ForegroundColor Yellow
Push-Location $backendDir
$backendProcess = Start-Process -FilePath powershell.exe `
    -ArgumentList "-NoExit", "-Command", "cd '$backendDir'; npm start" `
    -PassThru
Pop-Location
Start-Sleep -Seconds 3

try {
    $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get -TimeoutSec 5
    if ($health.status -ne "ok") { throw "Health check returned unexpected response." }
    Write-Host "OK: Backend started (PID: $($backendProcess.Id)).`n" -ForegroundColor Green
} catch {
    Write-Host "Backend failed health check. See backend terminal output." -ForegroundColor Red
    exit 1
}

Write-Host "App URL: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Test users (password: password123):" -ForegroundColor Cyan
Write-Host "  owner@restaurant.com" -ForegroundColor White
Write-Host "  manager@restaurant.com" -ForegroundColor White
Write-Host "  waiter@restaurant.com" -ForegroundColor White
Write-Host "  kitchen@restaurant.com`n" -ForegroundColor White

if (-not $SkipBrowser) {
    Start-Process "http://localhost:3000"
}

Write-Host "Startup complete." -ForegroundColor Green
