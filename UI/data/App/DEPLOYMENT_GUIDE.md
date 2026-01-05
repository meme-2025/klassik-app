# Rush Game v2.0 - Production Deployment Guide
## Kaspa Blockchain Integration (No Smart Contracts)

---

## 🚀 **QUICK START**

### 1️⃣ Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2️⃣ Configure Environment Variables

Create `.env` files in both backend and frontend directories:

**Backend `.env`:**
```bash
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://yourdomain.com

# Kaspa Configuration
KASPA_NETWORK=mainnet
KASPA_REST_API=https://api.kaspa.org
CASINO_KASPA_ADDRESS=your-casino-wallet-address
CASINO_WALLET_PRIVATE_KEY=your-private-key-KEEP-SECRET
REQUIRED_CONFIRMATIONS=6

# Game Settings
MIN_BUY_IN_KAS=0.1
MAX_BUY_IN_KAS=100
HOUSE_EDGE_PERCENT=1
MAX_PLAYERS_PER_LOBBY=10
```

**Frontend `.env`:**
```bash
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com
VITE_KASPA_NETWORK=mainnet
VITE_ENABLE_MOCK_WALLET=false
```

### 3️⃣ Start Services

**Development:**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

**Production:**
```bash
# Backend
cd backend
npm start

# Frontend (build first)
cd frontend
npm run build
npm run preview
```

---

## 💎 **KASPA BLOCKCHAIN SETUP**

### Casino Wallet Setup

1. **Create Kaspa Wallet:**
   - Download Kaspa wallet from https://kaspa.org
   - Create new wallet or import existing
   - **CRITICAL:** Backup your seed phrase securely

2. **Fund Casino Wallet:**
   - Transfer initial bankroll (recommended: 100+ KAS)
   - This covers player payouts
   - Monitor balance regularly

3. **Get Wallet Address & Private Key:**
   ```bash
   # In Kaspa CLI or wallet interface
   kaspa-wallet get-address
   kaspa-wallet export-private-key
   ```

4. **Configure in Backend:**
   ```bash
   CASINO_KASPA_ADDRESS=kaspa:qr25...your-address
   CASINO_WALLET_PRIVATE_KEY=your-private-key-here
   ```

### Transaction Monitoring

The backend automatically:
- ✅ Monitors incoming deposits to casino address
- ✅ Waits for required confirmations (default: 6 blocks)
- ✅ Auto-joins players to lobbies when deposit confirmed
- ✅ Processes instant payouts to winners

---

## 🎮 **GAME MECHANICS**

### How It Works

1. **Player Deposits:**
   - Player sends `MIN_BUY_IN_KAS` to casino address
   - Backend detects transaction via Kaspa API
   - After confirmations, player auto-joins next lobby

2. **Lobby Formation:**
   - Max 10 players per lobby
   - Game starts when 2+ players ready (15s countdown)
   - Each player contributes to pot

3. **Game Round:**
   - Multiplier starts at 1.00x
   - Grows exponentially: `1 + (t^1.8 * 0.1)`
   - Crash point generated provably fair
   - Players cash out before crash to win

4. **Payouts:**
   - Winners receive: `betAmount × cashOutMultiplier`
   - Automatic Kaspa transaction sent immediately
   - House keeps unclaimed pot (1% edge)

### Provably Fair System

```javascript
// Server generates seed before game
serverSeed = crypto.randomBytes(32).toString('hex')

// Client seeds from all player addresses
clientSeed = player1.address + player2.address + ...

// Combine and hash
combinedSeed = serverSeed + clientSeed
hash = SHA256(combinedSeed)

// Generate crash point
hashNumber = parseInt(hash.substring(0, 8), 16)
crashPoint = (1 - houseEdge) / (1 - (hashNumber / 0xFFFFFFFF))
```

**Verification:**
- Seed hash shown before game starts
- Players can verify after game ends
- Impossible to manipulate retroactively

---

## 🧪 **TESTING**

### Run Unit Tests
```bash
cd backend
npm test
```

**Tests Include:**
- ✅ Provably fair crash point generation
- ✅ Multiplier calculation accuracy
- ✅ Pot and payout calculations
- ✅ Player management (add/remove)
- ✅ Edge case handling

### Run Integration Tests
```bash
npm run test:integration
```

**Tests Include:**
- ✅ Kaspa API connection
- ✅ Transaction verification
- ✅ Payment monitoring system
- ✅ Payout processing

### Manual Testing Checklist

**Single Player Test:**
- [ ] Player connects wallet
- [ ] Sends deposit transaction
- [ ] Backend detects deposit
- [ ] Player joins lobby
- [ ] Game countdown starts
- [ ] Multiplier increases smoothly
- [ ] Player can cash out
- [ ] Payout received correctly

**Multi-Player Test:**
- [ ] 10 players can join same lobby
- [ ] All see synchronized multiplier
- [ ] Multiple cash-outs processed
- [ ] Losers don't receive payout
- [ ] Pot distributed correctly
- [ ] House profit calculated

**Edge Cases:**
- [ ] Player disconnects mid-game
- [ ] Transaction fails/delayed
- [ ] Network latency >1s
- [ ] Simultaneous cash-outs
- [ ] Casino wallet insufficient balance

---

## 📊 **MONITORING & ANALYTICS**

### Health Check Endpoint
```bash
curl http://localhost:3001/api/health
```

Response:
```json
{
  "status": "ok",
  "lobbies": 3,
  "kaspaMonitoring": {
    "isMonitoring": true,
    "pendingDeposits": 2,
    "pendingPayouts": 0,
    "processedTransactions": 47
  },
  "config": {
    "MAX_PLAYERS": 10,
    "BET_AMOUNT_KAS": 0.1,
    "HOUSE_EDGE": 0.01
  }
}
```

### Stats Endpoint
```bash
curl http://localhost:3001/api/stats
```

Response:
```json
{
  "casinoBalance": 125.43,
  "kaspaPrice": 0.145,
  "activeLobbies": 2,
  "paymentStats": {
    "isMonitoring": true,
    "pendingDeposits": 1,
    "pendingPayouts": 0,
    "processedTransactions": 52
  }
}
```

### Production Monitoring

**Recommended Tools:**
- **PM2** - Process management
- **Grafana** - Metrics visualization
- **Sentry** - Error tracking
- **LogRocket** - Session replay

**Key Metrics to Track:**
- Casino wallet balance
- Average players per lobby
- Total volume (KAS)
- House profit margin
- Average game duration
- Transaction confirmation times

---

## 🔒 **SECURITY BEST PRACTICES**

### Critical Security Measures

1. **Private Key Storage:**
   ```bash
   # ❌ NEVER commit to git
   # ❌ NEVER store in code
   # ✅ Use environment variables
   # ✅ Use secret management (AWS Secrets Manager, HashiCorp Vault)
   ```

2. **Rate Limiting:**
   - Limit API requests per IP
   - Prevent spam deposits
   - DDoS protection

3. **Input Validation:**
   - Verify Kaspa addresses
   - Check transaction amounts
   - Sanitize all user inputs

4. **WebSocket Security:**
   - Validate all socket events
   - Prevent injection attacks
   - Rate limit socket connections

5. **Casino Wallet Security:**
   - Use cold storage for majority of funds
   - Keep only operational bankroll in hot wallet
   - Regular balance audits

### Audit Checklist

- [ ] Environment variables never logged
- [ ] Private keys encrypted at rest
- [ ] HTTPS/WSS only in production
- [ ] CORS properly configured
- [ ] Input validation on all endpoints
- [ ] Rate limiting enabled
- [ ] Error messages don't leak sensitive data
- [ ] Regular dependency updates
- [ ] Penetration testing completed

---

## 🚦 **DEPLOYMENT**

### Production Deployment Steps

1. **Server Setup (Ubuntu 22.04):**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js 18+
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   
   # Install PM2
   sudo npm install -g pm2
   
   # Install Nginx (reverse proxy)
   sudo apt install -y nginx
   ```

2. **Clone Repository:**
   ```bash
   cd /var/www
   git clone https://github.com/your-repo/rush-game.git
   cd rush-game
   ```

3. **Configure Environment:**
   ```bash
   # Backend
   cd backend
   cp .env.example .env
   nano .env  # Edit with production values
   npm install --production
   
   # Frontend
   cd ../frontend
   cp .env.example .env
   nano .env  # Edit with production values
   npm install
   npm run build
   ```

4. **Start with PM2:**
   ```bash
   # Backend
   cd backend
   pm2 start rushGameServer.js --name "rush-game-backend"
   
   # Save PM2 configuration
   pm2 save
   pm2 startup
   ```

5. **Configure Nginx:**
   ```nginx
   # /etc/nginx/sites-available/rush-game
   server {
       listen 80;
       server_name api.yourdomain.com;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
       
       # WebSocket support
       location /socket.io/ {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
       }
   }
   ```

6. **Enable HTTPS (Let's Encrypt):**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d api.yourdomain.com
   ```

7. **Monitor Logs:**
   ```bash
   pm2 logs rush-game-backend
   pm2 monit
   ```

---

## 🐛 **TROUBLESHOOTING**

### Common Issues

**Issue: "Transaction not detected"**
- ✅ Check Kaspa network status
- ✅ Verify casino address correct
- ✅ Wait for required confirmations
- ✅ Check backend logs: `pm2 logs`

**Issue: "Payout failed"**
- ✅ Check casino wallet balance
- ✅ Verify recipient address valid
- ✅ Check Kaspa network congestion
- ✅ Review error logs

**Issue: "WebSocket disconnects"**
- ✅ Check firewall settings
- ✅ Verify CORS configuration
- ✅ Increase timeout limits
- ✅ Check network stability

**Issue: "Players out of sync"**
- ✅ Verify server time accurate (NTP)
- ✅ Check game loop interval (50ms)
- ✅ Monitor server CPU/RAM usage
- ✅ Reduce player count if needed

---

## 📈 **PERFORMANCE OPTIMIZATION**

### Backend Optimization

- **Redis Caching:** Cache game state for faster reads
- **Connection Pooling:** Optimize database connections
- **Worker Threads:** Offload heavy computation
- **Load Balancing:** Horizontal scaling with multiple instances

### Frontend Optimization

- **Canvas Rendering:** Use requestAnimationFrame
- **Code Splitting:** Lazy load components
- **Asset Optimization:** Compress images/fonts
- **CDN:** Serve static assets from CDN

### Target Performance Metrics

- ⚡ WebSocket latency: <50ms
- ⚡ Game updates: 60 FPS (16.67ms per frame)
- ⚡ Cash-out response: <100ms
- ⚡ Transaction confirmation: <10 seconds (6 blocks)
- ⚡ Concurrent users: 100+ simultaneous players

---

## 📞 **SUPPORT & RESOURCES**

### Documentation
- Kaspa API: https://api.kaspa.org
- Socket.IO: https://socket.io/docs/
- React: https://react.dev

### Community
- Kaspa Discord: https://discord.gg/kaspa
- GitHub Issues: Report bugs and feature requests

### License
MIT License - See LICENSE file

---

**Ready to launch! 🚀 Test thoroughly and may the odds be ever in your favor!**
