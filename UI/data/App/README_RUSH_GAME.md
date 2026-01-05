# 🎮 Rush Game - Kaspa BlockDAG Casino Game

Ein provably fair, Echtzeit-Multiplayer Casino-Spiel auf der Kaspa BlockDAG Blockchain.

## 🌟 Features

### Core Gameplay
- **10 Spieler pro Runde** - Intensive Multiplayer-Action
- **Echtzeit Multiplikator-Kurve** - Heatmap von Blau (sicher) → Gelb (riskant) → Rot (gefährlich)
- **Live Avatare** - Sehe alle Spieler in einem Kreis mit visuellen Animationen
- **Provably Fair** - Kryptografisch verifizierbare Spielergebnisse
- **Instant Cashout** - Sofortige Auszahlung via Smart Contract
- **Haptisches Feedback** - Vibration bei steigendem Risiko (Mobile)

### Technische Highlights
- **Kaspa BlockDAG Integration** - Ultra-schnelle Transaktionen (~1 Block/Sekunde)
- **WebSocket Echtzeit-Updates** - Flüssige, synchronisierte Spielerfahrung
- **Smart Contract** - Automatische, trustless Auszahlungen
- **Responsive Design** - Optimiert für Desktop & Mobile
- **TypeScript & React** - Moderne, typsichere Frontend-Entwicklung

## 📁 Projektstruktur

```
App/
├── frontend/                    # React + TypeScript Frontend
│   └── src/
│       ├── components/
│       │   └── games/
│       │       ├── RushGame.tsx          # Hauptspiel-Komponente
│       │       └── RushGame.css          # Styling & Animationen
│       └── services/
│           ├── kaspa.ts                  # Kaspa Wallet Integration
│           ├── provablyFair.ts           # Fairness-Algorithmus
│           └── rushSocket.ts             # WebSocket Client
│
├── KaspumpCasino/               # Backend Server
│   ├── rushGameServer.js                 # Game Server (Node.js + Socket.IO)
│   ├── package.json
│   └── scripts/
│       └── deployRushGame.js             # Smart Contract Deployment
│
└── contracts/
    └── RushGame.sol                      # Solidity Smart Contract
```

## 🚀 Quick Start

### 1. Installation

```bash
# Clone Repository
cd App

# Install Frontend Dependencies
cd frontend
npm install

# Install Backend Dependencies
cd ../KaspumpCasino
npm install
```

### 2. Backend Server Starten

```bash
cd KaspumpCasino
npm run dev:rush
```

Server läuft auf: `http://localhost:3001`

### 3. Frontend Starten

```bash
cd frontend
npm run dev
```

Frontend läuft auf: `http://localhost:5173`

### 4. Smart Contract Deployen (Optional)

```bash
cd KaspumpCasino
npm run compile
npm run deploy:rush
```

## 🎯 Spielablauf

### Phase 1: Lobby Beitreten (Waiting)
1. 10 Spieler treten bei, jeder zahlt 10 KAS
2. Gesamter Pot: 100 KAS
3. Spiel startet automatisch wenn voll

### Phase 2: Rush (Playing)
1. **Multiplikator steigt** - Beginnt bei 1.0x und steigt exponentiell
2. **Heatmap-Kurve** ändert Farbe:
   - 🔵 **Blau (1.0x - 1.5x)**: Sicher, geringe Gewinne
   - 🟡 **Gelb (1.5x - 3.0x)**: Riskant, moderate Gewinne
   - 🔴 **Rot (3.0x+)**: Gefährlich, hohe Gewinne

3. **Spieler cashen out**:
   - Spieler 1 @ 1.5x → +15 KAS ✅
   - Spieler 2 @ 2.0x → +20 KAS ✅
   - Spieler 3 @ 3.5x → +35 KAS ✅
   - ...

4. **Crash**: Spiel endet unerwartet
   - Verbleibende Spieler verlieren alles 💀
   - House nimmt restlichen Pot (1% Edge)

### Phase 3: Ergebnis (Finished)
- **Server Seed wird offenbart** - Spieler können Fairness verifizieren
- **Gewinner werden ausgezahlt** - Automatisch via Smart Contract
- **Neue Runde startet** - Nach 5 Sekunden Reset

## 🔐 Provably Fair System

### Wie es funktioniert

```typescript
// 1. Server generiert geheimen Seed vor Spiel
serverSeed = crypto.randomBytes(32).hex();

// 2. Hash wird an Spieler gesendet
seedHash = SHA256(serverSeed);

// 3. Client generiert eigenen Seed
clientSeed = crypto.randomBytes(16).hex();

// 4. Crash Point wird berechnet
crashPoint = calculateCrashPoint(serverSeed, clientSeed, nonce);

// 5. Nach Spiel: Server Seed wird offenbart
// Spieler können verifizieren:
calculatedHash = SHA256(revealedSeed);
if (calculatedHash === seedHash) {
  // ✅ Fair!
}
```

### Verifikation

Jedes Spielergebnis kann extern verifiziert werden:
```
https://verify.rushgame.io/?serverSeed=...&clientSeed=...&crashPoint=...
```

## 💰 Wirtschaftsmodell

### Pot-Verteilung

**Beispiel: 10 Spieler à 10 KAS = 100 KAS Pot**

| Spieler | Cash Out @ | Gewinn | Verbleibender Pot |
|---------|------------|--------|------------------|
| #1      | 1.2x       | 12 KAS | 88 KAS          |
| #2      | 1.5x       | 15 KAS | 73 KAS          |
| #3      | 2.0x       | 20 KAS | 53 KAS          |
| #4      | 2.5x       | 25 KAS | 28 KAS          |
| #5      | 3.0x       | 30 KAS | -2 KAS ⚠️       |
| **CRASH @ 3.2x** |    |        |                 |
| #6-10   | Lost       | 0 KAS  | House nimmt Rest |

**House Edge**: 1% vom initialen Pot = 1 KAS

### Auszahlungslogik

```solidity
// Smart Contract berechnet Gewinn
winAmount = betAmount * cashOutMultiplier;

// Prüfung: Ist genug im Pot?
require(pot >= winAmount, "Insufficient pot");

// Sofortige Auszahlung
player.transfer(winAmount);
pot -= winAmount;
```

## 🎨 UI/UX Design

### Heatmap-Kurve Visualisierung

```javascript
// Farbe basiert auf Multiplikator
if (multiplier < 1.5) {
  gradient = "Blau → Cyan" // Sicher
} else if (multiplier < 3.0) {
  gradient = "Gelb → Orange" // Warnung
} else {
  gradient = "Rot → Glühend Rot" // Gefahr
  startVibration();
}
```

### Avatar-Animationen

- **Aktiv**: Pulsierender Schatten
- **Cashed Out**: Explosion in Goldmünzen 💰
- **Lost**: Verblassen zu Graustufen 💀

### Responsive Breakpoints

```css
/* Desktop: Volle Features */
@media (min-width: 1024px) { ... }

/* Tablet: Kompakte Ansicht */
@media (min-width: 768px) and (max-width: 1023px) { ... }

/* Mobile: Touch-optimiert */
@media (max-width: 767px) { ... }
```

## 🔧 API Referenz

### WebSocket Events

#### Client → Server

```typescript
// Lobby beitreten
socket.emit('lobby:join', {
  lobbyId: string,
  address: string,
  betAmount: number
});

// Cash Out
socket.emit('game:cashout', {
  lobbyId: string,
  multiplier: number
});

// Lobby verlassen
socket.emit('lobby:leave', { lobbyId: string });
```

#### Server → Client

```typescript
// Game Update (50ms Intervall)
socket.on('game:update', (data: {
  lobbyId: string,
  currentMultiplier: number,
  pot: number,
  players: Player[],
  elapsedTime: number
}) => { ... });

// Spieler ist beigetreten
socket.on('player:joined', (player: PlayerUpdate) => { ... });

// Spieler hat cashed out
socket.on('player:cashedOut', (player: PlayerUpdate) => { ... });

// Spiel ist gecrashed
socket.on('game:crashed', (data: {
  crashPoint: number,
  serverSeed: string,
  players: Player[]
}) => { ... });
```

### REST API

```bash
# Alle Lobbies abrufen
GET /api/lobbies

# Einzelne Lobby Info
GET /api/lobby/:id

# Server Health Check
GET /health
```

## 🧪 Testing

### Unit Tests

```bash
# Frontend Tests
cd frontend
npm test

# Backend Tests
cd KaspumpCasino
npm test
```

### Smart Contract Tests

```bash
cd KaspumpCasino
npm run test:contract
```

### Provably Fair Verification

```typescript
import { provablyFair } from './services/provablyFair';

// Generiere 1000 Test-Spiele
const results = provablyFair.generateTestResults(1000);

// Statistiken
const stats = provablyFair.calculateStatistics(results);
console.log(stats);
// {
//   averageCrashPoint: 2.12,
//   medianCrashPoint: 1.89,
//   distribution: { ... }
// }

// Verifiziere einzelnes Ergebnis
const isValid = provablyFair.verifyGameResult(results[0]);
// true ✅
```

## 📊 Performance Optimierung

### Frontend
- **Canvas Rendering**: Hardware-beschleunigt
- **WebSocket Batching**: Updates alle 50ms
- **React.memo**: Verhindert unnötige Re-renders
- **Lazy Loading**: Code-Splitting für Spiele

### Backend
- **Event-Driven**: Asynchrone Verarbeitung
- **In-Memory Lobbies**: Schnelle Zugriffe
- **Connection Pooling**: WebSocket Management
- **Load Balancing**: Horizontal skalierbar

### Blockchain
- **Gas Optimierung**: Effiziente Storage-Nutzung
- **Batch Operations**: Mehrere Cashouts pro Block
- **Event Emission**: Minimale On-Chain-Daten

## 🛡️ Sicherheit

### Smart Contract
- ✅ **ReentrancyGuard**: Verhindert Reentrancy-Angriffe
- ✅ **Pausable**: Notfall-Stop Mechanismus
- ✅ **Ownable**: Access Control
- ✅ **Audited Code**: OpenZeppelin Contracts

### Backend
- ✅ **Input Validation**: Sanitisierung aller Inputs
- ✅ **Rate Limiting**: DoS-Schutz
- ✅ **CORS Policy**: Zugriffskontrolle
- ✅ **Error Handling**: Sichere Fehlerbehandlung

### Frontend
- ✅ **XSS Protection**: React Auto-Escaping
- ✅ **HTTPS Only**: Verschlüsselte Verbindung
- ✅ **Wallet Security**: Signierte Transaktionen
- ✅ **CSP Headers**: Content Security Policy

## 🚀 Deployment

### Production Checklist

- [ ] Smart Contract deployed & verified
- [ ] Backend Server auf VPS deployed
- [ ] Frontend auf CDN deployed
- [ ] SSL Zertifikate konfiguriert
- [ ] Environment Variables gesetzt
- [ ] Monitoring & Logging aktiviert
- [ ] Backup-Strategie implementiert

### Environment Variables

```bash
# Backend (.env)
PORT=3001
NODE_ENV=production
CONTRACT_ADDRESS=kaspa:qr...
OWNER_PRIVATE_KEY=...

# Frontend (.env)
VITE_API_URL=https://api.rushgame.io
VITE_WS_URL=wss://api.rushgame.io
VITE_CONTRACT_ADDRESS=kaspa:qr...
```

## 📈 Roadmap

### Phase 1: MVP ✅
- [x] Core Game Mechanik
- [x] Provably Fair System
- [x] WebSocket Integration
- [x] Smart Contract
- [x] Basic UI

### Phase 2: Enhancement 🚧
- [ ] Mobile App (React Native)
- [ ] Tournament Mode
- [ ] Leaderboards
- [ ] Achievement System
- [ ] Social Features

### Phase 3: Advanced Features 📅
- [ ] Multi-Currency Support
- [ ] NFT Avatare
- [ ] Live Streaming Integration
- [ ] AI Bot Detection
- [ ] Advanced Analytics

## 🤝 Contributing

Contributions sind willkommen! Bitte erstelle einen Fork und einen Pull Request.

## 📄 Lizenz

MIT License - siehe LICENSE Datei

## 💬 Support

- Discord: https://discord.gg/rushgame
- Telegram: @rushgame
- Email: support@rushgame.io

## 🎊 Credits

Entwickelt mit ❤️ für die Kaspa Community

**Powered by:**
- Kaspa BlockDAG
- React & TypeScript
- Socket.IO
- Solidity
- OpenZeppelin
