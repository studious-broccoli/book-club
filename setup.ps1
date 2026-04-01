# Book Club - One-time setup script
# Run this once before using the app for the first time

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "   Book Club Setup" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# Check Python
Write-Host "Checking Python..." -ForegroundColor Cyan
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "ERROR: Python is not installed." -ForegroundColor Red
    Write-Host "Download it from https://python.org/downloads" -ForegroundColor Yellow
    Write-Host "Make sure to check 'Add Python to PATH' during installation." -ForegroundColor Yellow
    exit 1
}
$pythonVersion = python --version
Write-Host "  Found $pythonVersion" -ForegroundColor Green

# Check Node / npm
Write-Host "Checking Node.js..." -ForegroundColor Cyan
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "ERROR: Node.js is not installed." -ForegroundColor Red
    Write-Host "Download it from https://nodejs.org (use the LTS version)" -ForegroundColor Yellow
    exit 1
}
$nodeVersion = node --version
$npmVersion = npm --version
Write-Host "  Found Node $nodeVersion / npm $npmVersion" -ForegroundColor Green

# Backend setup
Write-Host ""
Write-Host "Setting up backend..." -ForegroundColor Cyan

Set-Location "$PSScriptRoot\backend"

if (-not (Test-Path "venv")) {
    Write-Host "  Creating Python virtual environment..."
    python -m venv venv
}

Write-Host "  Installing Python dependencies..."
& ".\venv\Scripts\pip.exe" install -r requirements.txt --quiet

if (-not (Test-Path ".env")) {
    Write-Host "  Creating .env from example..."
    Copy-Item ".env.example" ".env"
    Write-Host "  .env created - open backend\.env to change the club password" -ForegroundColor Yellow
}

Write-Host "  Backend ready!" -ForegroundColor Green

# Frontend setup
Write-Host ""
Write-Host "Setting up frontend..." -ForegroundColor Cyan

Set-Location "$PSScriptRoot\frontend"

Write-Host "  Installing npm packages (this may take a minute)..."
npm install --silent

Write-Host "  Frontend ready!" -ForegroundColor Green

# Done
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "   Setup complete!" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "To start the app, run:" -ForegroundColor White
Write-Host "   .\start.ps1" -ForegroundColor Cyan
Write-Host ""
