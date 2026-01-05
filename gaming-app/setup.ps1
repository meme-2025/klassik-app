# Kaspa Rush - Quick Start Script (Windows)
# Run this with: PowerShell -ExecutionPolicy Bypass -File setup.ps1

Write-Host "Kaspa Rush - Quick Start Setup" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node -v
    Write-Host "[OK] Node.js $nodeVersion detected" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed. Please install Node.js 20+" -ForegroundColor Red
    exit 1
}

# Check pnpm
try {
    $pnpmVersion = pnpm -v
    Write-Host "[OK] pnpm $pnpmVersion detected" -ForegroundColor Green
} catch {
    Write-Host "[INFO] Installing pnpm..." -ForegroundColor Yellow
    npm install -g pnpm@8.15.4
}

# Check Docker
try {
    docker --version | Out-Null
    Write-Host "[OK] Docker detected" -ForegroundColor Green
    $hasDocker = $true
} catch {
    Write-Host "[WARNING] Docker not found. Some features may not work." -ForegroundColor Yellow
    Write-Host "          Install Docker: https://docs.docker.com/get-docker/" -ForegroundColor Yellow
    $hasDocker = $false
}

# Install dependencies
Write-Host ""
Write-Host "[INFO] Installing dependencies..." -ForegroundColor Cyan
pnpm install

# Setup environment
if (!(Test-Path .env)) {
    Write-Host ""
    Write-Host "[INFO] Creating .env file..." -ForegroundColor Cyan
    Copy-Item .env.example .env
    Write-Host "[OK] .env created - please review and update values" -ForegroundColor Green
} else {
    Write-Host "[OK] .env already exists" -ForegroundColor Green
}

# Start Docker services
if ($hasDocker) {
    Write-Host ""
    $response = Read-Host "Start Docker services (PostgreSQL, Redis)? [Y/n]"
    if ($response -eq "" -or $response -eq "Y" -or $response -eq "y") {
        Write-Host "[INFO] Starting Docker services..." -ForegroundColor Cyan
        docker-compose up -d postgres redis
        Write-Host "[OK] Database and Redis started" -ForegroundColor Green
        
        Write-Host "[INFO] Waiting for database to be ready..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
}

Write-Host ""
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Review .env file and update configuration"
Write-Host "  2. Start development servers:"
Write-Host ""
Write-Host "     Terminal 1 - Backend:" -ForegroundColor Yellow
Write-Host "     PS> cd apps\backend; pnpm dev"
Write-Host ""
Write-Host "     Terminal 2 - Frontend:" -ForegroundColor Yellow
Write-Host "     PS> cd apps\web; pnpm dev"
Write-Host ""
Write-Host "  3. Open http://localhost:3000 in your browser"
Write-Host ""
Write-Host "Read DEVELOPMENT.md for detailed documentation" -ForegroundColor Cyan
Write-Host ""
Write-Host "Happy coding!" -ForegroundColor Magenta
