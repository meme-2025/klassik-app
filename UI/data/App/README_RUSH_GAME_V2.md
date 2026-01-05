# 🎰 Rush Game v2.0 - Kaspa Blockchain Casino

**Modernes Multiplayer Casino-Spiel mit echter Kaspa-Blockchain-Integration**

[![Kaspa](https://img.shields.io/badge/Kaspa-Blockchain-blue)](https://kaspa.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

---

## ✨ Features

### 🎮 **Gameplay**
- ⚡ **Multiplayer:** Bis zu 10 Spieler pro Lobby
- 📈 **Exponentieller Multiplikator:** Startend bei 1.00x
- 💰 **Echtzeit-Auszahlungen:** Sofortige Kaspa-Transaktionen
- 🎲 **Provably Fair:** Kryptografisch verifizierbare Fairness

### 💎 **Kaspa Integration**
- ✅ **Direkte Blockchain-Zahlungen** (KEINE Smart Contracts benötigt)
- ✅ **UTXO-basiertes Tracking** für präzise Transaktionsverfolgung
- ✅ **Automatische Deposit-Erkennung** mit Bestätigungen
- ✅ **Instant Payouts** an Gewinner

### 🎨 **Design**
- 🌈 **Glassmorphism UI** mit modernen Farbverläufen
- 🔵➡️🟡➡️🔴 **Farbwechselnde Heatmap-Kurve**
- 👥 **Live-Avatare** im Kreis um das Spielfeld
- 📱 **Responsive Design** für Desktop & Mobile
- ✨ **Smooth Animationen** mit 60 FPS

### 🔒 **Sicherheit**
- 🛡️ **Provably Fair System** mit SHA-256 Hashing
- 🔐 **Sichere Wallet-Integration**
- ⚖️ **1% House Edge** für nachhaltige Wirtschaftlichkeit
- 📊 **Transparente Transaktionen** auf der Blockchain

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18.0.0
- **npm** oder **yarn**
- **Kaspa Wallet** mit Testnet/Mainnet KAS

### Installation

```bash
# Clone Repository
git clone https://github.com/your-repo/rush-game.git
cd rush-game

# Dependencies installieren (automatisch via start.bat)
# Oder manuell:
cd backend && npm install
cd ../frontend && npm install
```

### Konfiguration

1. **Backend `.env` erstellen:**
```bash
cd backend
cp .env.example .env
nano .env
```

2. **Wichtige Einstellungen:**
```env
CASINO_KASPA_ADDRESS=your-wallet-address
CASINO_WALLET_PRIVATE_KEY=your-private-key
KASPA_NETWORK=testnet  # oder mainnet
```

3. **Frontend `.env` erstellen:**
```bash
cd ../frontend
cp .env.example .env
```

### Starten

**Windows:**
```bash
start.bat
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

**Manuell:**
```bash
# Terminal 1 - Backend
cd backend
node rushGameServer.js

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Öffnen

- **Game UI:** http://localhost:5173/game/rush
- **API Health:** http://localhost:3001/api/health
- **Stats:** http://localhost:3001/api/stats

---

## 📁 Projektstruktur

```
rush-game/
├── backend/
│   ├── rushGameServer.js          # Hauptserver mit WebSocket
│   ├── kaspa-payment-service.js   # Kaspa-Blockchain-Integration
│   ├── tests/
│   │   ├── game-logic.unit.test.js
│   │   └── kaspa-payment.integration.test.js
│   ├── package.json
│   ├── .env.example
│   └── jest.config.js
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── games/
│   │   │       ├── RushGame.tsx   # Hauptkomponente
│   │   │       └── RushGame-v2.css # Next-Level Design
│   │   ├── services/
│   │   │   ├── kaspa.ts           # Wallet-Integration
│   │   │   ├── rushSocket.ts      # WebSocket-Client
│   │   │   └── provablyFair.ts    # Fairness-Verifikation
│   │   └── App.tsx
│   ├── package.json
│   └── .env.example
│
├── .env.example                    # Master-Konfiguration
├── DEPLOYMENT_GUIDE.md             # Vollständige Deployment-Anleitung
├── README.md                       # Diese Datei
├── start.bat                       # Windows-Startskript
└── start.sh                        # Linux/Mac-Startskript
```

---

## 🎮 Wie es funktioniert

### 1️⃣ **Spieler tritt bei**

```
Spieler → Sendet 0.1 KAS an Casino-Wallet
Backend → Erkennt Transaktion via Kaspa API
Backend → Wartet auf 6 Bestätigungen (~6 Sekunden)
Backend → Spieler wird automatisch zur Lobby hinzugefügt
```

### 2️⃣ **Lobby füllt sich**

- Maximal **10 Spieler** pro Lobby
- **15 Sekunden Countdown** wenn ≥2 Spieler
- **Pot** = Summe aller Buy-Ins (z.B. 10 × 0.1 = 1.0 KAS)

### 3️⃣ **Spiel startet**

```javascript
// Multiplikator steigt exponentiell
multiplier = 1 + (time^1.8 × 0.1)

// Beispiele:
// t=1s  → 1.10x
// t=5s  → 2.44x
// t=10s → 7.31x
```

### 4️⃣ **Crash Point (Provably Fair)**

```javascript
// Server generiert Seed vor dem Spiel
serverSeed = crypto.randomBytes(32).toString('hex')

// Client Seeds = Adressen aller Spieler
clientSeed = player1.address + player2.address + ...

// Kombiniert und gehasht
hash = SHA256(serverSeed + clientSeed)

// Crash Point berechnet
crashPoint = (1 - houseEdge) / (1 - (hashNumber / MAX))
```

### 5️⃣ **Spieler casht out**

```
Spieler → Klick auf "CASH OUT" Button
Backend → Berechnet Gewinn = betAmount × currentMultiplier
Backend → Sendet sofort Kaspa-Transaktion
Spieler → Erhält KAS in Wallet
```

### 6️⃣ **Spiel crasht**

- Multiplikator erreicht vorher berechneten Crash Point
- Alle verbleibenden Spieler verlieren ihren Einsatz
- Gewinner haben bereits ausgezahlt bekommen
- House behält Differenz (durchschnittlich 1%)

---

## 💰 Wirtschaftsmodell

### Buy-In & Pot

| Spieler | Buy-In | Pot Total |
|---------|--------|-----------|
| 1       | 0.1 KAS| 0.1 KAS   |
| 5       | 0.5 KAS| 0.5 KAS   |
| 10      | 1.0 KAS| 1.0 KAS   |

### Beispiel-Runde (10 Spieler, 1.0 KAS Pot)

| Spieler | Cash-Out | Multiplier | Gewinn    | Profit   |
|---------|----------|------------|-----------|----------|
| A       | ✅       | 1.5x       | 0.15 KAS  | +0.05    |
| B       | ✅       | 2.0x       | 0.20 KAS  | +0.10    |
| C       | ✅       | 3.5x       | 0.35 KAS  | +0.25    |
| D-J     | ❌       | -          | 0.00 KAS  | -0.10    |

**Gesamtrechnung:**
- Pot: 1.0 KAS
- Auszahlungen: 0.70 KAS
- House Profit: **0.30 KAS (30%)**

**Langzeit-Durchschnitt:**
- Durch 1% House Edge im Provably Fair System
- Langfristig: ~1% des Pots geht an House
- Kurzfristig: Varianz möglich

---

## 🧪 Testing

### Unit Tests ausführen

```bash
cd backend
npm test
```

**Tests umfassen:**
- ✅ Provably Fair Crash Point Generation
- ✅ Multiplikator-Berechnungen
- ✅ Pot & Payout-Logik
- ✅ Player Management
- ✅ Edge Cases

### Integration Tests

```bash
npm run test:integration
```

**Tests umfassen:**
- ✅ Kaspa API Verbindung
- ✅ Transaktionsverifizierung
- ✅ Payment Monitoring
- ✅ Payout Processing

### Test Coverage

```bash
npm test -- --coverage
```

---

## 📊 API Dokumentation

### REST Endpoints

#### GET `/api/health`

**Response:**
```json
{
  "status": "ok",
  "lobbies": 2,
  "kaspaMonitoring": {
    "isMonitoring": true,
    "pendingDeposits": 3,
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

#### GET `/api/stats`

**Response:**
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

### WebSocket Events

#### Client → Server

```javascript
// Join lobby with deposit transaction
socket.emit('join:request', {
  address: 'kaspa:qr25pe5pfa...',
  txId: 'a1b2c3d4...'
});

// Cash out
socket.emit('cashout:request');

// Get lobby list
socket.emit('lobby:list');
```

#### Server → Client

```javascript
// Join confirmed
socket.on('join:success', (data) => {
  // data: { lobbyId, position, betAmount }
});

// Game update (every 50ms)
socket.on('game:update', (data) => {
  // data: { multiplier, time, crashed }
});

// Game crashed
socket.on('game:crashed', (data) => {
  // data: { crashPoint, seedHash, winners, pot }
});

// Cash out success
socket.on('cashout:success', (data) => {
  // data: { multiplier, winAmount }
});

// Payout sent
socket.on('payout:sent', (data) => {
  // data: { txId, amount, address }
});
```

---

## 🔧 Konfiguration

### Backend Environment Variables

```env
# Server
NODE_ENV=development|production
PORT=3001
CORS_ORIGIN=http://localhost:5173

# Kaspa
KASPA_NETWORK=testnet|mainnet
KASPA_REST_API=https://api.kaspa.org
CASINO_KASPA_ADDRESS=kaspa:qr25...
CASINO_WALLET_PRIVATE_KEY=your-private-key

# Transaction Settings
REQUIRED_CONFIRMATIONS=6
KASPA_POLL_INTERVAL_MS=1000

# Game Configuration
MIN_BUY_IN_KAS=0.1
MAX_BUY_IN_KAS=100
HOUSE_EDGE_PERCENT=1
MAX_PLAYERS_PER_LOBBY=10
```

### Frontend Environment Variables

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
VITE_KASPA_NETWORK=testnet
VITE_ENABLE_MOCK_WALLET=true
```

---

## 🚀 Production Deployment

Siehe vollständige Anleitung in **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**

**Schnell-Checklist:**
- [ ] Kaspa Mainnet Wallet erstellt
- [ ] Casino Wallet mit Bankroll gefunded (100+ KAS)
- [ ] `.env` Dateien mit Produktionswerten konfiguriert
- [ ] HTTPS/WSS mit SSL-Zertifikat
- [ ] Firewall konfiguriert (Port 3001)
- [ ] PM2 für Prozess-Management
- [ ] Nginx als Reverse Proxy
- [ ] Monitoring (Sentry, Grafana)
- [ ] Backups eingerichtet
- [ ] Tests erfolgreich durchgeführt

---

## 🐛 Troubleshooting

### Problem: "Transaction not detected"

**Lösung:**
```bash
# 1. Prüfe Backend-Logs
pm2 logs rush-game-backend

# 2. Teste Kaspa API manuell
curl https://api.kaspa.org/addresses/YOUR_CASINO_ADDRESS/utxos

# 3. Verifiziere .env Konfiguration
cat backend/.env | grep CASINO_KASPA_ADDRESS
```

### Problem: "Payout failed"

**Lösung:**
```bash
# 1. Prüfe Casino Wallet Balance
curl http://localhost:3001/api/stats

# 2. Teste Kaspa-Verbindung
node -e "const axios = require('axios'); axios.get('https://api.kaspa.org/info').then(r => console.log(r.data))"
```

### Problem: "WebSocket disconnects"

**Lösung:**
- Prüfe Firewall-Einstellungen
- Erhöhe Socket.IO Timeout
- Verifiziere CORS-Konfiguration
- Checke Netzwerkstabilität

---

## 📈 Performance

### Zielwerte

| Metrik              | Ziel      | Aktuell |
|---------------------|-----------|---------|
| WebSocket Latency   | <50ms     | ✅      |
| Game Updates        | 60 FPS    | ✅      |
| Cash-Out Response   | <100ms    | ✅      |
| TX Confirmation     | <10s      | ✅ 6s   |
| Concurrent Players  | 100+      | 🧪      |

### Optimierungen

- ✅ **Canvas-basiertes Rendering** für Hardware-Beschleunigung
- ✅ **Redis Caching** für Game State
- ✅ **WebSocket Multiplexing** für effiziente Kommunikation
- ✅ **UTXO-Optimierung** für schnelle Transaktionen

---

## 🤝 Contributing

Contributions sind willkommen!

1. Fork das Repository
2. Erstelle deinen Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit deine Changes (`git commit -m 'Add AmazingFeature'`)
4. Push zum Branch (`git push origin feature/AmazingFeature`)
5. Öffne einen Pull Request

---

## 📄 License

MIT License - siehe [LICENSE](LICENSE) für Details

---

## 🙏 Credits

- **Kaspa Blockchain:** https://kaspa.org
- **Socket.IO:** Echtzeit-Kommunikation
- **React + TypeScript:** Frontend Framework
- **Express:** Backend Server

---

## 📞 Support

- **Discord:** [Join Kaspa Discord](https://discord.gg/kaspa)
- **Issues:** [GitHub Issues](https://github.com/your-repo/rush-game/issues)
- **Email:** support@yourdomain.com

---

## 🎉 **Ready to Play!**

```
npm install
start.bat (Windows) oder ./start.sh (Linux/Mac)
→ Browser: http://localhost:5173/game/rush
```

**Viel Erfolg beim Testen und viel Gewinn! 🚀💰**
