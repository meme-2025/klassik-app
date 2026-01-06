# Klassik Gaming Platform - Quick Start Guide

## 🚀 Quick Start (5 Minutes)

### Step 1: Install Dependencies

```powershell
# Install pnpm (if not already installed)
npm install -g pnpm

# Install all dependencies
pnpm install
```

### Step 2: Start Database

```powershell
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Wait 10 seconds for database to initialize
Start-Sleep -Seconds 10
```

### Step 3: Configure Environment

```powershell
# Copy environment file
Copy-Item .env.example .env

# Edit .env and set your Kaspa wallet address
# For testing, you can use testnet values
```

### Step 4: Start Applications

```powershell
# Option A: Start both apps with Turbo
pnpm dev

# Option B: Start individually in separate terminals

# Terminal 1 - Backend
cd apps/backend
pnpm install
pnpm dev

# Terminal 2 - Frontend
cd apps/web
pnpm install
pnpm dev
```

### Step 5: Access the App

1. Open your main Klassik page: `c:\Users\TUF-s\Desktop\git\Klassik\frontend\index.html`
2. Click **"Launch App Suite"** button
3. The gaming app will open at `http://localhost:3000`

---

## 📋 What's Running?

- **Frontend**: http://localhost:3000 - Next.js gaming interface
- **Backend API**: http://localhost:3001/api - NestJS API
- **WebSocket**: ws://localhost:3001 - Real-time game updates
- **PostgreSQL**: localhost:5432 - Database
- **Redis**: localhost:6379 - Cache & sessions

---

## 🎮 How to Play

1. **Connect Wallet**: Install KasWare or compatible Kaspa wallet
2. **Click "Connect Wallet"** in the gaming app
3. **Join Lobby**: Click "Play Now" to enter a game lobby
4. **Pay Entry**: Send 0.1 KAS to join the game
5. **Watch Multiplier**: Game starts when 2+ players join
6. **Cash Out**: Click cash out before crash to win!

---

## 🛠️ Troubleshooting

### Database Connection Error

```powershell
# Stop and restart database
docker-compose down
docker-compose up -d postgres redis
```

### Port Already in Use

```powershell
# Change ports in .env
BACKEND_PORT=3002
# Frontend: Edit apps/web/package.json dev script to use -p 3001
```

### Wallet Not Detected

1. Install KasWare extension: https://kasware.xyz
2. Create or import a Kaspa wallet
3. Make sure you have some KAS for testing

### Dependencies Issues

```powershell
# Clean install
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force apps/backend/node_modules
Remove-Item -Recurse -Force apps/web/node_modules
pnpm install
```

---

## 📦 Project Structure

```
Klassik/
├── apps/
│   ├── backend/        # NestJS API + WebSocket server
│   └── web/            # Next.js frontend
├── db/                 # Database initialization
├── docker-compose.yml  # Docker services
└── package.json        # Monorepo root
```

---

## 🔧 Development Commands

```powershell
# Install dependencies
pnpm install

# Start development servers
pnpm dev

# Build for production
pnpm build

# Start production
pnpm start

# Run linter
pnpm lint

# Clean build artifacts
pnpm clean

# Backend only
pnpm backend:dev

# Frontend only
pnpm web:dev
```

---

## 🌐 Kaspa Network Configuration

### Testnet (Default for Development)

```env
KASPA_NETWORK=testnet-10
KASPA_REST_API=https://api.kaspa.org
```

### Mainnet (Production)

```env
KASPA_NETWORK=mainnet
KASPA_REST_API=https://api.kaspa.org
CASINO_KASPA_ADDRESS=your-real-casino-wallet-address
CASINO_WALLET_PRIVATE_KEY=your-private-key-KEEP-SECRET
```

---

## 📝 Environment Variables

Required in `.env`:

```env
# Backend
BACKEND_PORT=3001
CORS_ORIGIN=http://localhost:3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=klassik
DB_PASSWORD=klassik_dev_password_change_in_production
DB_DATABASE=klassik_gaming

# Kaspa
KASPA_NETWORK=testnet-10
KASPA_REST_API=https://api.kaspa.org
CASINO_KASPA_ADDRESS=kaspa:qz...your_address
REQUIRED_CONFIRMATIONS=6

# Game
MIN_BUY_IN_KAS=0.1
HOUSE_EDGE_PERCENT=2
MAX_PLAYERS_PER_LOBBY=10
```

---

## 🚢 Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment guide.

---

## 🤝 Support

- **Documentation**: See `/docs` folder
- **Issues**: Create GitHub issue
- **Kaspa Community**: https://discord.gg/kaspa

---

**Happy Gaming! 🎮⚡**
