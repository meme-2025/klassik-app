# 🚀 QUICK START - Live Monitoring System

## Sofortige Inbetriebnahme (3 Minuten)

### Schritt 1: Server starten

```bash
cd backend
npm start
```

Warte bis du siehst:
```
✅ Live Monitor initialized
🔌 WebSocket setup complete
Server running on http://localhost:3000
```

### Schritt 2: Monitor öffnen

Öffne in deinem Browser:

```
http://localhost:3000/monitor.html
```

Du solltest sehen:
- 🟢 Connected (grünes Signal oben rechts)
- Live Metriken (Besucher, Requests, Games, Payments)
- Event Stream (noch leer - warte auf Events)

### Schritt 3: Teste das System

#### Option A: API Quick Test (empfohlen)

```bash
cd backend
node test-api-quick.js
```

Das testet alle Endpoints und generiert Events im Monitor.

#### Option B: Manuell testen

In einem neuen Terminal:

```bash
# Test Health
curl http://localhost:3000/health

# Test API
curl http://localhost:3000/api/products

# Test Kaspa Stats
curl http://localhost:3000/api/kaspa/stats

# Test Diagnostics
curl http://localhost:3000/api/diagnostic/status
```

Jedes Request erscheint **sofort im Monitor**! 📡

### Schritt 4: Events generieren

Öffne deine Frontend-Seite und:

1. **Registriere einen User** → Siehst du ✅ "Neue Registrierung" im Event Stream
2. **Login** → Siehst du 🔐 "User Login" 
3. **Starte ein Game** → Siehst du 🎮 "Game gestartet"
4. **Sende Kaspa** → Siehst du 🔗 "Blockchain TX"

## Was du jetzt sehen kannst

### Live Metrics (Top Cards)

```
🌐 Live Besucher: 3
📊 API Requests: 247
🎮 Aktive Games: 1
💰 Zahlungen: 5
```

### Event Stream (Live Feed)

```
✅ Neue Registrierung
   User: john_doe | Wallet: kaspa:qr25...

🔐 User Login
   User: alice

🎮 Game gestartet
   User 42 | Game: klassik-slots

💰 Zahlung eingegangen
   Order 123 | 100 KAS

📡 API Request
   GET /api/products | 200 | 45ms
```

### Visitor List

```
👥 Live Besucher

🟢 User 42
   📍 Berlin, Germany
   🌐 /dashboard
   
🟡 Anonymous
   📍 London, UK
   🌐 /landing
```

## Troubleshooting

### Monitor zeigt "🔴 Disconnected"

**Problem:** WebSocket-Verbindung fehlgeschlagen

**Fix:**
```bash
# 1. Prüfe ob Server läuft
curl http://localhost:3000/health

# 2. Prüfe Console (F12 in Browser)
# Siehst du WebSocket errors?

# 3. Restart Server
cd backend
npm start
```

### Keine Events sichtbar

**Problem:** Events werden nicht getrackt

**Fix:**
```bash
# 1. Trigger Events manuell
curl http://localhost:3000/api/products

# 2. Check Server Logs
# Siehst du "📡 API request" logs?

# 3. Reload Monitor Page
# Press F5 im Browser
```

### "Authentication required" Error

**Problem:** WebSocket Auth

**Lösung:** Monitor verwendet speziellen Token. Kein User-Login nötig!  
Wenn du den Fehler siehst, ist die Integration kaputt.

**Fix:**
```bash
# Check index.js line ~220
# Sollte enthalten:
if (token === 'MONITOR_ACCESS') {
  socket.isMonitor = true;
  return next();
}
```

## API Diagnostics

### Quick Health Check

```bash
curl http://localhost:3000/api/diagnostic/status | json_pp
```

**Erwartete Response:**
```json
{
  "status": "healthy",
  "components": {
    "database": { "status": "healthy" },
    "users": { "status": "healthy", "totalUsers": 42 },
    "kaspaAPI": { "status": "healthy" }
  }
}
```

### Alle Endpoints testen

```bash
curl http://localhost:3000/api/diagnostic/endpoints | json_pp
```

**Erwartete Response:**
```json
{
  "summary": {
    "total": 10,
    "passing": 10,
    "failing": 0,
    "successRate": "100%"
  }
}
```

### Häufige Probleme

```bash
curl http://localhost:3000/api/diagnostic/common-issues | json_pp
```

Listet alle bekannten Probleme + Lösungen.

## Integration in deine App

### Track Custom Events

```javascript
const liveMonitor = require('./middleware/live-monitor');

// In deinem Code:
liveMonitor.logEvent({
  type: 'custom_event',
  message: 'User completed purchase',
  userId: 123,
  amount: 500
});
```

Das erscheint **sofort** im Monitor! 🎉

### Track Game Sessions

```javascript
// Game Start
app.post('/api/game/start', authMiddleware, (req, res) => {
  liveMonitor.trackGameStart(req.user.id, 'my-game');
  // ... your code
});

// Game End
app.post('/api/game/end', authMiddleware, (req, res) => {
  liveMonitor.trackGameEnd(req.user.id);
  // ... your code
});
```

### Track Payments

```javascript
// On payment received
liveMonitor.trackPayment({
  orderId: order.id,
  amount: 100,
  currency: 'KAS',
  txHash: tx.hash
});
```

## Production Deployment

### Umgebungsvariablen

```bash
# In .env oder /etc/klassik/klassik1.env

# Optional: Monitoring Config
ENABLE_MONITORING=true
MONITOR_MAX_EVENTS=100
MONITOR_STATS_INTERVAL=5000
```

### Security

⚠️ **Wichtig:** Monitor ist aktuell öffentlich!

**Quick Fix für Production:**

```bash
# Rename monitor.html
cd frontend
mv monitor.html admin-monitor-secret-xyz.html
```

Dann öffnen via:
```
https://klassik.99pace.space/admin-monitor-secret-xyz.html
```

**Bessere Lösung (TODO):**
- JWT-Auth für Monitor
- IP Whitelist
- Separater Admin-Token

## Next Steps

1. ✅ Server läuft
2. ✅ Monitor connected
3. ✅ Events werden getrackt

**Jetzt:**
- Teste alle Features in deiner App
- Beobachte Live-Events im Monitor
- Nutze `/api/diagnostic/*` für Debugging
- Integriere eigene Events

## Support

### Logs checken

```bash
# Server Logs
pm2 logs

# Oder direkt in Console
cd backend
npm start
```

### Browser Console

Press `F12` → Console Tab  
Siehst du Errors?

### Server nicht erreichbar?

```bash
# Check Port
netstat -an | grep 3000

# Check Process
ps aux | grep node

# Restart
pm2 restart all
# oder
npm start
```

## Features im Überblick

✅ **Automatisches Tracking**
- Jeder HTTP Request
- Response Status & Latency
- User Info (falls eingeloggt)

✅ **Event Tracking**
- User Registration
- User Login
- Game Sessions
- Payments
- Wallet Transactions
- Custom Events

✅ **WebSocket Notifications**
- Real-time Updates
- No Polling
- Low Latency (<100ms)

✅ **Diagnostic Tools**
- Health Checks
- Endpoint Tests
- Database Status
- Common Issues Guide

✅ **Live Dashboard**
- Besucher in Echtzeit
- Event Stream
- Metrics
- Top Endpoints

## Weitere Dokumentation

- **Vollständige Doku:** [LIVE_MONITORING_README.md](LIVE_MONITORING_README.md)
- **API Docs:** GET /api/diagnostic/common-issues
- **Test Suite:** `node backend/test-api-quick.js`

---

**Status:** ✅ Production Ready  
**Setup Zeit:** ~3 Minuten  
**Dependencies:** Keine zusätzlichen (geoip-lite optional)

Bei Fragen: Check `/api/diagnostic/common-issues` 🚀
