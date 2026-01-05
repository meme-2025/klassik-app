# 🎮 Kaspa Rush - Development Guide

## 🏗️ Architecture Deep Dive

### Frontend Architecture

```
apps/web/src/
├── app/                        # Next.js 14 App Router
│   ├── layout.tsx             # Root layout with providers
│   ├── page.tsx               # Main game page
│   └── providers.tsx          # React Query, Toaster
│
├── components/
│   ├── game/                  # Core game components
│   │   ├── crash-game.tsx     # Main game container
│   │   ├── crash-graph.tsx    # Canvas-based graph
│   │   ├── bet-controls.tsx   # Betting interface
│   │   ├── player-list.tsx    # Active players
│   │   ├── game-stats.tsx     # Statistics display
│   │   ├── leaderboard.tsx    # Top players
│   │   └── chat-panel.tsx     # Live chat
│   │
│   ├── ui/                    # Shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── ...
│   │
│   └── layout/                # Layout components
│       └── game-header.tsx    # App header
│
├── lib/
│   ├── store/                 # Zustand stores
│   │   └── game-store.ts      # Game state management
│   └── utils.ts               # Utility functions
│
├── hooks/                     # Custom React hooks
│   ├── use-sound.ts          # Sound effects
│   └── use-websocket.ts      # WebSocket connection
│
└── styles/
    └── globals.css           # Global styles + Tailwind
```

### Backend Architecture

```
apps/backend/src/
├── game/                      # Game module
│   ├── game.module.ts
│   ├── game.engine.ts         # Core game loop
│   ├── game.gateway.ts        # WebSocket gateway
│   ├── game.service.ts        # Business logic
│   ├── provably-fair.service.ts  # Fairness algorithm
│   └── entities/
│       ├── game.entity.ts
│       └── bet.entity.ts
│
├── kaspa/                     # Kaspa integration
│   ├── kaspa.module.ts
│   └── kaspa.service.ts
│
├── redis/                     # Redis integration
│   ├── redis.module.ts
│   └── redis.service.ts
│
└── user/                      # User management
    └── user.module.ts
```

---

## 🎯 Game Engine Explained

### Game Loop

The game engine runs on a precise timing system:

```typescript
const TICK_RATE = 100;        // Update every 100ms
const WAITING_TIME = 5000;    // 5 seconds betting phase
```

**1. Waiting Phase (5 seconds)**
- Players can place bets
- Crash point generated using provably fair algorithm
- Server seed hashed and shown to players

**2. Running Phase (Variable duration)**
- Multiplier grows exponentially
- Updates broadcast every 100ms
- Players can cash out anytime
- Auto-cashout triggers checked

**3. Crashed Phase**
- Game ends at crash point
- Payouts processed
- New game starts after 3s delay

### Multiplier Calculation

```typescript
// Exponential growth formula
const elapsed = Date.now() - startTime;
const growthRate = 0.00006;
const multiplier = Math.pow(Math.E, elapsed * growthRate);
```

This creates a smooth curve from 1.00x upwards.

---

## 🔐 Provably Fair System

### How It Works

1. **Server generates two seeds:**
   ```typescript
   serverSeed = crypto.randomBytes(32).toString('hex');  // Secret
   publicSeed = crypto.randomBytes(16).toString('hex');  // Public
   ```

2. **Hash is shown to players BEFORE game:**
   ```typescript
   hash = SHA256(serverSeed);  // Players can verify later
   ```

3. **Crash point calculated:**
   ```typescript
   hmac = HMAC-SHA256(serverSeed, publicSeed);
   crashPoint = deterministicFunction(hmac);
   ```

4. **After game ends:**
   - Server seed revealed
   - Players can verify: `SHA256(serverSeed) === hash`
   - Players can recalculate crash point

### Verification

Any player can verify a game:

```typescript
// 1. Check server seed hash matches pre-commitment
const preCommitHash = SHA256(serverSeed);
assert(preCommitHash === hashShownBeforeGame);

// 2. Recalculate crash point
const calculatedCrash = provablyFair.calculateCrashPoint(
  serverSeed, 
  publicSeed
);
assert(calculatedCrash === actualCrashPoint);
```

---

## 🎨 UI/UX Principles

### Design System

**Color Palette:**
- Primary: `#00D9FF` (Kaspa Blue)
- Secondary: `#7B61FF` (Purple)
- Accent: `#FF006B` (Pink)
- Success: `#00FF88` (Neon Green)
- Warning: `#FFD700` (Gold)

**Typography:**
- Display: Orbitron (Futuristic, headings)
- Body: Inter (Readable, body text)
- Mono: JetBrains Mono (Numbers, stats)

**Animation Principles:**
- Duration: 200-300ms for micro-interactions
- Easing: `ease-in-out` for natural feel
- Purposeful: Every animation communicates state

### Micro-Interactions

1. **Button Hover**
   - Scale: 1.02
   - Glow effect
   - Duration: 200ms

2. **Bet Placement**
   - Success feedback
   - Sound effect
   - Visual confirmation

3. **Cashout**
   - Dramatic animation
   - Win sound
   - Profit display

4. **Crash**
   - Explosive effect
   - Screen shake
   - Red flash

---

## 🚀 Performance Optimization

### Frontend

**Code Splitting:**
```typescript
// Lazy load heavy components
const ThreeJsEffect = dynamic(() => import('./3d-effect'), {
  ssr: false,
});
```

**Image Optimization:**
- Next.js Image component
- WebP/AVIF formats
- Lazy loading

**Bundle Size:**
- Tree shaking enabled
- Dynamic imports for routes
- Optimized dependencies

### Backend

**WebSocket Optimization:**
- Binary protocol for updates
- Compression enabled
- Connection pooling

**Database:**
- Indexed queries
- Connection pooling
- Query optimization

**Caching:**
- Redis for session data
- In-memory for game state
- CDN for static assets

---

## 🧪 Testing Strategy

### Unit Tests

```bash
# Frontend
pnpm --filter @kaspa-rush/web test

# Backend
pnpm --filter @kaspa-rush/backend test
```

### Integration Tests

Test WebSocket communication:

```typescript
describe('Game Engine', () => {
  it('should complete a full game cycle', async () => {
    const game = await engine.startNewGame();
    await engine.placeBet(userId, 'Player1', 10, null);
    
    // Wait for game to run
    await waitFor(() => game.state === 'running');
    
    // Cash out
    const winAmount = await engine.cashoutBet(userId);
    expect(winAmount).toBeGreaterThan(10);
  });
});
```

### E2E Tests

Full user flow testing with Playwright:

```typescript
test('User can play a complete game', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Place bet
  await page.fill('input[name="betAmount"]', '10');
  await page.click('button:has-text("PLACE BET")');
  
  // Wait for game to run
  await page.waitForSelector('text=/running/i');
  
  // Cash out
  await page.click('button:has-text("CASH OUT")');
  
  // Verify win
  await expect(page.locator('text=/won/i')).toBeVisible();
});
```

---

## 📊 Monitoring & Analytics

### Application Metrics

**Key Performance Indicators:**
- WebSocket latency
- Game completion rate
- Average bet size
- Player retention
- Crash point distribution

**Tools:**
- Sentry for error tracking
- PostHog for analytics
- Prometheus for metrics
- Grafana for visualization

### Database Monitoring

```sql
-- Query performance
SELECT * FROM pg_stat_statements
ORDER BY total_time DESC
LIMIT 10;

-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Cache hit ratio
SELECT 
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) 
  AS cache_hit_ratio
FROM pg_statio_user_tables;
```

---

## 🔒 Security Best Practices

### Frontend Security

1. **Input Validation**
   - Sanitize all user inputs
   - Validate bet amounts
   - Prevent XSS attacks

2. **WebSocket Security**
   - Verify message origin
   - Rate limiting
   - Authentication tokens

### Backend Security

1. **Authentication**
   - JWT tokens
   - Secure session management
   - Password hashing (bcrypt)

2. **Rate Limiting**
   ```typescript
   // Max 10 bets per minute
   @Throttle(10, 60)
   async placeBet() { }
   ```

3. **Database Security**
   - Parameterized queries
   - Connection encryption
   - Regular backups

---

## 🌐 Kaspa Integration (Upcoming)

### Direct Node Connection

```typescript
// gRPC connection to Kaspa node
const client = new KaspadClient(
  process.env.KASPA_NODE_GRPC_URL
);

// Subscribe to new blocks
const blockStream = client.subscribeBlocks();
blockStream.on('data', (block) => {
  processBlock(block);
});

// Monitor address
const utxoStream = client.subscribeUTXOs({
  addresses: [userDepositAddress]
});
```

### Payment Flow

1. **Deposit:**
   - User sends KAS to deposit address
   - Backend monitors blockchain
   - Balance updated on confirmation

2. **Withdrawal:**
   - User requests withdrawal
   - Backend creates transaction
   - Broadcast to network
   - Monitor confirmation

---

## 📱 Mobile Optimization

### Touch Gestures

```typescript
// Swipe to adjust bet
const bind = useGesture({
  onDrag: ({ movement: [mx] }) => {
    setBetAmount(prev => prev + (mx / 10));
  }
});
```

### PWA Features

- Add to home screen
- Push notifications
- Offline mode
- Background sync

### Performance

- 60 FPS animations
- Touch-optimized UI
- Reduced bundle size
- Image optimization

---

## 🚢 Deployment Checklist

### Pre-Deployment

- [ ] Run all tests
- [ ] Build production bundle
- [ ] Update environment variables
- [ ] Database migrations
- [ ] SSL certificates
- [ ] CDN configuration

### Deployment

- [ ] Deploy database
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Verify WebSocket connectivity
- [ ] Test game flow
- [ ] Monitor error logs

### Post-Deployment

- [ ] Performance monitoring
- [ ] Error tracking
- [ ] User feedback
- [ ] Analytics review

---

## 🤝 Contributing Guidelines

See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Code style guide
- Commit message format
- Pull request process
- Issue reporting

---

## 📞 Support

- **Documentation**: [docs.kasparush.io](#)
- **Discord**: [Join community](#)
- **GitHub Issues**: [Report bugs](#)
- **Email**: dev@kasparush.io
