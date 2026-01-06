# Klassik Gaming Platform - Windows Startup Script
# Run this script to start the entire application

Write-Host "🎮 Klassik Gaming Platform - Starting..." -ForegroundColor Cyan
Write-Host ""

# Check if pnpm is installed
Write-Host "Checking dependencies..." -ForegroundColor Yellow
if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ pnpm not found. Installing..." -ForegroundColor Red
    npm install -g pnpm
    Write-Host "✅ pnpm installed" -ForegroundColor Green
}

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
try {
    docker ps | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Install dependencies if needed
if (!(Test-Path "node_modules")) {
    Write-Host ""
    Write-Host "📦 Installing dependencies (this may take a few minutes)..." -ForegroundColor Yellow
    pnpm install
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
}

# Copy .env if it doesn't exist
if (!(Test-Path ".env")) {
    Write-Host ""
    Write-Host "📝 Creating .env file..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "✅ .env created (you may want to edit it with your Kaspa wallet address)" -ForegroundColor Green
}

# Start database services
Write-Host ""
Write-Host "🐘 Starting PostgreSQL and Redis..." -ForegroundColor Yellow
docker-compose up -d postgres redis

Write-Host "Waiting for database to initialize (10 seconds)..." -ForegroundColor Gray
Start-Sleep -Seconds 10
Write-Host "✅ Database ready" -ForegroundColor Green

# Start applications
Write-Host ""
Write-Host "🚀 Starting Backend and Frontend..." -ForegroundColor Yellow
Write-Host ""
Write-Host "📡 Backend API will be at: http://localhost:3001/api" -ForegroundColor Cyan
Write-Host "🌐 Frontend will be at: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Gray
Write-Host ""

# Start development servers with Turbo
pnpm dev
