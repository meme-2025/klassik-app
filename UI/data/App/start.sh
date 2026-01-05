#!/bin/bash

# Rush Game - Complete Startup Script
# Starts Backend, Frontend, and provides instructions for Smart Contract

echo "⚡ Rush Game - Starting All Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running in correct directory
if [ ! -d "KaspumpCasino" ] || [ ! -d "frontend" ]; then
    echo -e "${RED}❌ Error: Please run this script from the App directory${NC}"
    exit 1
fi

# Function to check if port is in use
check_port() {
    lsof -i:$1 > /dev/null 2>&1
    return $?
}

echo -e "${BLUE}📦 Checking Dependencies...${NC}"

# Check Backend Dependencies
if [ ! -d "KaspumpCasino/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Installing Backend Dependencies...${NC}"
    cd KaspumpCasino
    npm install
    cd ..
fi

# Check Frontend Dependencies
if [ ! -d "frontend/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Installing Frontend Dependencies...${NC}"
    cd frontend
    npm install
    cd ..
fi

echo -e "${GREEN}✅ Dependencies Ready${NC}"
echo ""

# Check if ports are available
echo -e "${BLUE}🔍 Checking Ports...${NC}"

if check_port 3001; then
    echo -e "${RED}❌ Port 3001 is already in use${NC}"
    echo "   Please stop the service using port 3001 or change the port in rushGameServer.js"
    exit 1
fi

if check_port 5173; then
    echo -e "${RED}❌ Port 5173 is already in use${NC}"
    echo "   Please stop the service using port 5173 or change the port in vite.config.ts"
    exit 1
fi

echo -e "${GREEN}✅ Ports Available${NC}"
echo ""

# Start Backend Server
echo -e "${BLUE}🚀 Starting Backend Server...${NC}"
cd KaspumpCasino
npm run dev:rush > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
sleep 3

if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}✅ Backend Server Started (PID: $BACKEND_PID)${NC}"
    echo -e "   ${GREEN}→${NC} http://localhost:3001"
    echo -e "   ${GREEN}→${NC} ws://localhost:3001"
else
    echo -e "${RED}❌ Backend Server Failed to Start${NC}"
    echo "   Check logs/backend.log for details"
    exit 1
fi

echo ""

# Start Frontend Dev Server
echo -e "${BLUE}🎨 Starting Frontend Server...${NC}"
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for frontend to start
sleep 3

if ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${GREEN}✅ Frontend Server Started (PID: $FRONTEND_PID)${NC}"
    echo -e "   ${GREEN}→${NC} http://localhost:5173"
else
    echo -e "${RED}❌ Frontend Server Failed to Start${NC}"
    echo "   Check logs/frontend.log for details"
    kill $BACKEND_PID
    exit 1
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Rush Game is Running!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📌 Service URLs:${NC}"
echo -e "   🎮 Game UI:      ${GREEN}http://localhost:5173${NC}"
echo -e "   🔌 WebSocket:    ${GREEN}ws://localhost:3001${NC}"
echo -e "   📡 REST API:     ${GREEN}http://localhost:3001/api${NC}"
echo ""
echo -e "${BLUE}🔧 Process IDs:${NC}"
echo -e "   Backend:  ${BACKEND_PID}"
echo -e "   Frontend: ${FRONTEND_PID}"
echo ""
echo -e "${BLUE}📊 Logs:${NC}"
echo -e "   Backend:  ${YELLOW}tail -f logs/backend.log${NC}"
echo -e "   Frontend: ${YELLOW}tail -f logs/frontend.log${NC}"
echo ""
echo -e "${BLUE}🛑 To Stop All Services:${NC}"
echo -e "   ${YELLOW}kill $BACKEND_PID $FRONTEND_PID${NC}"
echo -e "   or run: ${YELLOW}./stop.sh${NC}"
echo ""

# Smart Contract Instructions
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}⚙️  Smart Contract Deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📝 To deploy the smart contract:${NC}"
echo ""
echo -e "   1. Configure Kaspa Network in hardhat.config.js"
echo -e "   2. Set PRIVATE_KEY in .env"
echo -e "   3. Run: ${GREEN}cd KaspumpCasino && npm run deploy:rush${NC}"
echo ""
echo -e "${YELLOW}📝 For local development:${NC}"
echo -e "   The app runs in MOCK mode without smart contract"
echo -e "   All transactions are simulated"
echo ""

# Save PIDs for cleanup
echo "$BACKEND_PID" > .pids/backend.pid
echo "$FRONTEND_PID" > .pids/frontend.pid

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}🎉 Happy Gaming!${NC}"
echo ""

# Keep script running and monitor processes
trap "echo ''; echo -e '${YELLOW}🛑 Shutting down...${NC}'; kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM

# Wait for processes
wait
