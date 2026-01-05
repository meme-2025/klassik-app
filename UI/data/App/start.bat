@echo off
REM Rush Game v2.0 - Kaspa Blockchain Integration
REM No Smart Contracts - Direct Kaspa Payments

echo.
echo ════════════════════════════════════════════
echo   🎰 RUSH GAME v2.0 - KASPA CASINO
echo ════════════════════════════════════════════
echo.

REM Check if running in correct directory
if not exist "backend" (
    echo ❌ Error: backend directory not found
    echo Please run this script from the App directory
    pause
    exit /b 1
)

if not exist "frontend" (
    echo ❌ Error: frontend directory not found
    echo Please run this script from the App directory
    pause
    exit /b 1
)

echo 📦 Checking Dependencies...
echo.

REM Check Backend Dependencies
if not exist "backend\node_modules" (
    echo ⚠️  Installing Backend Dependencies...
    cd backend
    call npm install
    cd ..
)

REM Check Frontend Dependencies
if not exist "frontend\node_modules" (
    echo ⚠️  Installing Frontend Dependencies...
    cd frontend
    call npm install
    cd ..
)

echo ✅ Dependencies Ready
echo.

REM Check .env files
if not exist "backend\.env" (
    echo ⚠️  Backend .env not found - copying from .env.example
    copy backend\.env.example backend\.env
    echo ⚠️  IMPORTANT: Edit backend\.env with your Kaspa wallet details!
)

if not exist "frontend\.env" (
    echo ⚠️  Frontend .env not found - copying from .env.example
    copy frontend\.env.example frontend\.env
)

echo.

REM Create logs directory if it doesn't exist
if not exist "logs" mkdir logs

REM Start Backend Server
echo 🚀 Starting Backend Server (Kaspa Payment Service)...
cd backend
start "Rush Game Backend" cmd /k "node rushGameServer.js"
cd ..
timeout /t 3 /nobreak >nul

echo ✅ Backend Server Started
echo    → REST API:    http://localhost:3001/api
echo    → WebSocket:   ws://localhost:3001
echo    → Kaspa Monitor: ACTIVE
echo.

REM Start Frontend Dev Server
echo 🎨 Starting Frontend Server...
cd frontend
start "Rush Game Frontend" cmd /k "npm run dev"
cd ..
timeout /t 3 /nobreak >nul

echo ✅ Frontend Server Started
echo    → Game UI: http://localhost:5173
echo.

echo ════════════════════════════════════════════
echo ✅ RUSH GAME v2.0 IS RUNNING!
echo ════════════════════════════════════════════
echo.
echo 📌 Service URLs:
echo    🎮 Game UI:      http://localhost:5173/game/rush
echo    🔌 WebSocket:    ws://localhost:3001
echo    📡 REST API:     http://localhost:3001/api
echo    📊 Health:       http://localhost:3001/api/health
echo    📈 Stats:        http://localhost:3001/api/stats
echo.
echo 💎 Kaspa Integration:
echo    ✓ Direct blockchain payments (NO smart contracts)
echo    ✓ UTXO transaction monitoring
echo    ✓ Automatic deposit detection
echo    ✓ Instant payout processing
echo.
echo 📊 Two terminal windows opened:
echo    - Backend Server (port 3001)
echo    - Frontend Server (port 5173)
echo.
echo 🛑 To Stop All Services:
echo    Close both terminal windows
echo    or press Ctrl+C in each window
echo.
echo ════════════════════════════════════════════
echo ⚙️  CONFIGURATION CHECKLIST
echo ════════════════════════════════════════════
echo.
echo 📝 Before production deployment:
echo.
echo    1. ✓ Edit backend\.env with YOUR casino wallet:
echo       - CASINO_KASPA_ADDRESS
echo       - CASINO_WALLET_PRIVATE_KEY
echo.
echo    2. ✓ Fund casino wallet with bankroll (100+ KAS)
echo.
echo    3. ✓ Set KASPA_NETWORK=mainnet for production
echo.
echo    4. ✓ Configure CORS_ORIGIN with your domain
echo.
echo 📚 See DEPLOYMENT_GUIDE.md for complete setup
echo.
echo ════════════════════════════════════════════
echo.
echo 🎉 Ready to Test!
echo.
echo Press any key to open the game in your browser...
pause >nul

REM Open browser
start http://localhost:5173/game/rush

echo.
echo ✅ Game opened in browser
echo.
echo Press any key to exit this window (servers will keep running)...
pause >nul
pause >nul
