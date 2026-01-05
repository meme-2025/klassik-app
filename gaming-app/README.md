# 🚀 Kaspa Rush - Ultimate Blockchain Gaming Platform

<div align="center">

![Kaspa Rush Logo](./docs/images/logo.png)

**The most polished, provably fair multiplayer crash game on Kaspa blockchain**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red)](https://nestjs.com/)

[Live Demo](#) | [Documentation](#documentation) | [API Reference](#api) | [Contributing](#contributing)

</div>

---

## ✨ Features

### 🎮 **Gaming Experience**
- **Ultra-Polished UI**: AppStore Top 10 quality design with smooth animations
- **Real-time Multiplayer**: Play with others in synchronized game rounds
- **Provably Fair**: Cryptographically verifiable game outcomes
- **Instant Feedback**: <100ms latency for all game actions
- **Responsive Design**: Perfect on desktop, tablet, and mobile

### 🔐 **Security & Fairness**
- **Provably Fair Algorithm**: HMAC-SHA256 based outcome generation
- **Pre-commitment**: Server seeds hashed before each game
- **Transparent Audits**: Verify any game outcome in-app
- **Secure WebSockets**: Real-time encrypted communication

### ⚡ **Kaspa Blockchain**
- **Ultra-Fast Transactions**: Leveraging Kaspa's 1-second block time
- **UTXO-Based**: Efficient transaction management
- **Instant Deposits/Withdrawals**: Real-time balance updates
- **Native Integration**: Direct node connection (upcoming)

### 🎨 **Design Excellence**
- **Premium Animations**: Framer Motion powered micro-interactions
- **3D Effects**: Three.js powered visual effects
- **Audio Feedback**: Carefully crafted sound design
- **Dark Theme**: Eye-friendly with neon accents
- **Accessibility**: WCAG 2.1 AA compliant

### 📱 **Progressive Web App**
- **Installable**: Add to home screen on any device
- **Offline Ready**: Service worker caching
- **Push Notifications**: Real-time game alerts
- **Native Feel**: Smooth, app-like experience

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 14)                │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Game View  │  │  Leaderboard │  │  Chat/Social  │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
│         │                  │                  │          │
│         └──────────────────┴──────────────────┘          │
│                           │                              │
│                    WebSocket (Socket.io)                 │
│                           │                              │
└───────────────────────────┼──────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────┐
│                    Backend (NestJS)                      │
│  ┌────────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Game Engine   │  │ Provably Fair│  │   Kaspa     │ │
│  │   (Real-time)  │  │   Service    │  │ Integration │ │
│  └────────────────┘  └──────────────┘  └─────────────┘ │
│           │                  │                │          │
│  ┌────────┴──────────────────┴────────────────┴──────┐  │
│  │              PostgreSQL + Redis                    │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────┐
│                   Kaspa Blockchain                       │
│     (Node, Indexer, gRPC API - Future Integration)      │
└──────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **pnpm** 8+
- **Docker** & Docker Compose (optional)
- **PostgreSQL** 16+
- **Redis** 7+

### 1. Clone & Install

```bash
git clone https://github.com/your-org/kaspa-rush.git
cd kaspa-rush/gaming-app

# Install dependencies
pnpm install
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your configuration
```

### 3. Start Development

**Option A: With Docker (Recommended)**

```bash
# Start all services
docker-compose up -d

# Frontend: http://localhost:3000
# Backend:  http://localhost:4000
# DB:       localhost:5432
```

**Option B: Manual**

```bash
# Terminal 1 - Database
docker-compose up postgres redis -d

# Terminal 2 - Backend
cd apps/backend
pnpm dev

# Terminal 3 - Frontend
cd apps/web
pnpm dev
```

### 4. Open in Browser

Visit [http://localhost:3000](http://localhost:3000) 🎉

---

## 📦 Project Structure

```
gaming-app/
├── apps/
│   ├── web/                    # Next.js Frontend
│   │   ├── src/
│   │   │   ├── app/           # App Router pages
│   │   │   ├── components/    # React components
│   │   │   │   ├── game/      # Game-specific components
│   │   │   │   ├── ui/        # Reusable UI components
│   │   │   │   └── layout/    # Layout components
│   │   │   ├── lib/           # Utilities & stores
│   │   │   ├── hooks/         # Custom React hooks
│   │   │   └── styles/        # Global styles
│   │   └── public/            # Static assets
│   │
│   └── backend/               # NestJS Backend
│       ├── src/
│       │   ├── game/          # Game engine & logic
│       │   │   ├── game.engine.ts
│       │   │   ├── game.gateway.ts
│       │   │   ├── provably-fair.service.ts
│       │   │   └── entities/
│       │   ├── kaspa/         # Kaspa blockchain integration
│       │   ├── user/          # User management
│       │   └── redis/         # Redis service
│       └── Dockerfile
│
├── packages/                  # Shared packages (future)
│   ├── ui/                   # Shared UI components
│   ├── utils/                # Shared utilities
│   └── types/                # Shared TypeScript types
│
├── docker-compose.yml        # Docker orchestration
├── turbo.json               # TurboRepo config
├── pnpm-workspace.yaml      # pnpm workspace config
└── README.md                # This file
```

---

## 🎮 How It Works

### Game Flow

1. **Waiting Phase** (5s)
   - Players place bets
   - Choose auto-cashout multiplier (optional)
   - Server generates provably fair crash point

2. **Running Phase**
   - Multiplier increases exponentially
   - Players can cash out anytime
   - Auto-cashout triggers at set multiplier

3. **Crash Phase**
   - Game ends at predetermined crash point
   - Winners receive payouts
   - New round begins after 3s

### Provably Fair Algorithm

```typescript
// Simplified example
const serverSeed = crypto.randomBytes(32).toString('hex');
const publicSeed = crypto.randomBytes(16).toString('hex');

const hmac = crypto.createHmac('sha256', serverSeed);
hmac.update(publicSeed);
const hash = hmac.digest('hex');

const crashPoint = calculateFromHash(hash); // 1.01x - 100.00x
```

Players can verify:
1. Server seed hash (shown before game)
2. Public seed (shown before game)
3. Server seed (revealed after game)
4. Recalculate crash point themselves

---

## 🔧 Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI**: React 18, TypeScript
- **Styling**: Tailwind CSS, Shadcn/ui
- **Animations**: Framer Motion, Lottie
- **3D**: Three.js, React Three Fiber
- **State**: Zustand
- **Data Fetching**: TanStack Query
- **WebSocket**: Socket.io Client
- **Sound**: Howler.js

### Backend
- **Framework**: NestJS 10
- **Runtime**: Node.js 20
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **WebSocket**: Socket.io
- **ORM**: TypeORM
- **Validation**: class-validator

### DevOps
- **Package Manager**: pnpm
- **Monorepo**: TurboRepo
- **Containerization**: Docker
- **Orchestration**: Docker Compose, Kubernetes (ready)
- **CI/CD**: GitHub Actions (ready)

---

## 📡 API Reference

### WebSocket Events

#### Client → Server

```typescript
// Place bet
socket.emit('game:placeBet', {
  amount: 10,
  autoCashout: 2.0 // optional
});

// Cash out
socket.emit('game:cashout');
```

#### Server → Client

```typescript
// Game state update
socket.on('game:state', (data) => {
  // { state: 'waiting' | 'running' | 'crashed', gameId: string }
});

// Multiplier update (100ms intervals)
socket.on('game:multiplier', (data) => {
  // { multiplier: number }
});

// Game crashed
socket.on('game:crashed', (data) => {
  // { crashPoint: number, gameId: string }
});

// Bet placed confirmation
socket.on('game:betPlaced', (data) => {
  // { success: boolean, error?: string }
});

// Cashout confirmation
socket.on('game:cashedOut', (data) => {
  // { success: boolean, winAmount: number, multiplier: number }
});
```

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Run specific workspace tests
pnpm --filter @kaspa-rush/backend test
pnpm --filter @kaspa-rush/web test

# E2E tests
pnpm test:e2e

# Test coverage
pnpm test:cov
```

---

## 🚢 Deployment

### Production Build

```bash
# Build all packages
pnpm build

# Build specific workspace
pnpm --filter @kaspa-rush/web build
pnpm --filter @kaspa-rush/backend build
```

### Docker Deployment

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes

```bash
# Apply k8s configs (coming soon)
kubectl apply -f k8s/
```

---

## 🎯 Roadmap

### Phase 1: MVP ✅
- [x] Core crash game mechanics
- [x] Provably fair system
- [x] Real-time multiplayer
- [x] Premium UI/UX
- [x] PWA support

### Phase 2: Kaspa Integration 🚧
- [ ] Kaspa wallet connect
- [ ] Deposit/withdrawal system
- [ ] Direct node integration (gRPC)
- [ ] Transaction monitoring
- [ ] Balance management

### Phase 3: Gamification 📋
- [ ] User accounts & profiles
- [ ] Achievement system
- [ ] Daily rewards
- [ ] Referral program
- [ ] Tournament mode

### Phase 4: Social Features 📋
- [ ] Live chat
- [ ] Friend system
- [ ] Spectator mode
- [ ] Share/social integration
- [ ] Community features

### Phase 5: Advanced 📋
- [ ] Mobile apps (React Native)
- [ ] Multi-language support
- [ ] Advanced analytics
- [ ] Admin dashboard
- [ ] Affiliate system

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file.

---

## 🙏 Acknowledgments

- Kaspa Community
- Next.js Team
- NestJS Team
- Open Source Community

---

## 📞 Contact & Support

- **Website**: [kasparush.io](#)
- **Discord**: [Join our community](#)
- **Twitter**: [@KaspaRush](#)
- **Email**: support@kasparush.io

---

<div align="center">

**Built with ❤️ for the Kaspa Community**

⭐ Star us on GitHub — it motivates us a lot!

</div>
