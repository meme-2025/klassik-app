# 🏗️ Klassik Backend Architecture - Complete Analysis

## 📊 Datenfluss-Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Browser)                            │
│  kaspa-explorerv5.21.html + kaspa-explorer.js                   │
│                                                                   │
│  Zeigt an: Blocks, Transactions, Network Stats, Price Data      │
└─────────────────┬───────────────────────────────────────────────┘
                  │ HTTP Requests
                  │ fetch('https://klassik.99pace.space/api/...')
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│              KLASSIK BACKEND (Node.js/Express)                   │
│              Läuft auf: klassik.99pace.space:3000                │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ CORS Middleware                                           │  │
│  │ • Erlaubt: klassik.99pace.space, localhost:3000          │  │
│  │ • Blockt: Alle anderen Origins                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ API Routes:                                               │  │
│  │                                                           │  │
│  │ /api/kaspa-enhanced/stats        ← Primary Stats         │  │
│  │ /api/kaspa-enhanced/blocks       ← Latest Blocks         │  │
│  │ /api/kaspa-enhanced/transactions ← Latest Txs            │  │
│  │ /api/kaspa-enhanced/kaspad-info  ← Node Info             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Redis Cache Layer (30s cache)                            │  │
│  │ • Reduziert API-Calls                                     │  │
│  │ • Schnellere Antworten                                    │  │
│  │ • Fallback: In-Memory Cache                              │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────┬───────────────────────────────────────────────┘
                  │
                  │ Holt Daten von:
                  │
      ┌───────────┴──────────┬─────────────────┬────────────────┐
      ▼                      ▼                 ▼                ▼
┌──────────────┐  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐
│ kaspa-rest-  │  │ Public Kaspa   │  │ CoinGecko    │  │ PostgreSQL   │
│ server       │  │ APIs           │  │ API          │  │ Database     │
│ (localhost)  │  │ (Fallback)     │  │              │  │              │
│              │  │                │  │              │  │              │
│ Port: 8080   │  │ api.kaspa.org  │  │ Preisdaten   │  │ User/Events  │
│              │  │ api.kas.pa     │  │ Marktdaten   │  │ Bookings     │
└──────┬───────┘  └────────┬───────┘  └──────┬───────┘  └──────────────┘
       │                   │                  │
       │ Verbindet zu:     │                  │
       ▼                   │                  │
┌──────────────────────────┴──────────────────┘
│
│  KASPAD (Kaspa Node Daemon)
│  ═══════════════════════════════════════════
│  
│  ┌─────────────────────────────────────────┐
│  │ Was ist kaspad?                         │
│  │                                         │
│  │ • Vollständige Kaspa Blockchain Node    │
│  │ • Synchronisiert mit Kaspa-Netzwerk     │
│  │ • Speichert komplette Blockchain        │
│  │ • Validiert alle Transaktionen          │
│  │ • Bietet RPC Interface                  │
│  └─────────────────────────────────────────┘
│
│  Port: 16110 (RPC)
│  Datenbank: ~/.kaspad/ (Blockchain Daten)
│  
│  Bietet Endpoints:
│  • /info/blockdag            → DAG Struktur
│  • /info/virtual-chain-blue-score → Block Height
│  • /info/network             → Network Info
│  • /blocks/...               → Block Daten
│  • /transactions/...         → Transaction Daten
│
└────────────────────────────────────────────┘
```

## 🔄 Wie läuft der Datenfluss?

### 1️⃣ Frontend Request
```javascript
// Frontend macht Request:
fetch('https://klassik.99pace.space/api/kaspa-enhanced/stats')
```

### 2️⃣ Backend empfängt Request
```javascript
// backend/src/routes/kaspa-enhanced.js
router.get('/stats', async (req, res) => {
  // Prüft Redis Cache (30s)
  const statsData = await getCachedData('kaspa-enhanced-stats', async () => {
    // Wenn Cache abgelaufen → Fetch new data
  });
});
```

### 3️⃣ Backend fragt Datenquellen ab
```javascript
// STRATEGIE: localhost FIRST, dann Fallback

async function callKaspaAPI(endpoint) {
  // 1. Versuch: Lokaler kaspa-rest-server
  try {
    response = await axios.get('http://localhost:8080' + endpoint);
    return response.data; // ✅ ERFOLG
  } catch (error) {
    // Lokaler Server nicht erreichbar
  }
  
  // 2. Versuch: Public APIs
  for (const api of ['api.kaspa.org', 'api.kas.pa']) {
    try {
      response = await axios.get(api + endpoint);
      return response.data; // ✅ ERFOLG
    } catch (error) {
      // Weiter zum nächsten
    }
  }
  
  throw new Error('All APIs failed');
}
```

### 4️⃣ kaspa-rest-server verbindet zu kaspad
```bash
# kaspa-rest-server ist ein Proxy
# Er übersetzt REST → RPC Calls

kaspa-rest-server --kaspad-address=localhost:16110
                 --bind-address=0.0.0.0:8080

# Wenn Frontend /info/blockdag anfrägt:
# kaspa-rest-server → kaspad RPC → Blockchain Daten
```

### 5️⃣ kaspad liefert Blockchain-Daten
```
kaspad (Die Kaspa Node)
├── Läuft permanent im Hintergrund
├── Synchronisiert mit Kaspa-Netzwerk
├── Speichert komplette Blockchain (~200GB+)
├── Validiert Blöcke in Echtzeit
└── Beantwortet RPC Anfragen
```

## 📦 Was ist kaspad?

**kaspad** ist die **Kaspa Node Software** - vergleichbar mit bitcoind oder geth:

### Funktionen:
- **Full Node**: Speichert komplette Blockchain
- **Block Validation**: Validiert alle Blöcke
- **Transaction Broadcasting**: Sendet Transaktionen ins Netzwerk
- **RPC Server**: Bietet Daten für andere Apps (via kaspa-rest-server)

### Daten die kaspad liefert:
```json
{
  "blockdag": {
    "networkName": "kaspa-mainnet",
    "blockCount": 45000000,
    "headerCount": 45000000,
    "tipHashes": ["..."],
    "difficulty": 1234567890,
    "pastMedianTime": 1736086800,
    "virtualParentHashes": ["..."]
  },
  "virtualChainBlueScore": 45123456,
  "network": {
    "mempoolSize": 150,
    "connectedPeers": 45,
    "isUtxoIndexed": true,
    "isSynced": true
  }
}
```

## 🚀 Wie startet man das Backend lokal?

### **Option 1: Backend ohne kaspad (nur Public APIs)**

```powershell
# 1. Backend-Verzeichnis öffnen
cd C:\Users\TUF-s\Desktop\git\Klassik\backend

# 2. Dependencies installieren (falls noch nicht)
npm install

# 3. .env Datei erstellen
Copy-Item .env.example .env

# 4. .env bearbeiten
notepad .env
```

**Minimale .env Konfiguration:**
```env
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000
CORS_ORIGIN=*

# Keine kaspad → nutzt Public APIs als Fallback
KASPA_REST_SERVER=http://localhost:8080  # Wird skippen wenn nicht erreichbar

# Database (optional für Kaspa-Explorer)
DATABASE_URL=postgresql://klassik:password@localhost:5432/klassik
```

```powershell
# 5. Backend starten
npm run dev

# ✅ Backend läuft auf http://localhost:3000
# Frontend kann jetzt localhost:3000 statt klassik.99pace.space nutzen
```

### **Option 2: Backend MIT kaspad (volle lokale Node)**

Wenn Sie eine **eigene Kaspa Node** betreiben wollen:

#### Schritt 1: kaspad installieren
```powershell
# Download kaspad von GitHub:
# https://github.com/kaspanet/kaspad/releases

# Beispiel: Windows Binary
Invoke-WebRequest -Uri "https://github.com/kaspanet/kaspad/releases/download/v0.12.15/kaspad-v0.12.15-windows-amd64.zip" -OutFile kaspad.zip
Expand-Archive kaspad.zip -DestinationPath C:\kaspa
```

#### Schritt 2: kaspad starten
```powershell
# kaspad mit RPC Server starten
cd C:\kaspa
.\kaspad.exe --rpclisten=0.0.0.0:16110 --utxoindex

# ⚠️ WICHTIG: Erste Sync dauert STUNDEN (lädt komplette Blockchain ~200GB)
# kaspad muss dauerhaft laufen bleiben!
```

#### Schritt 3: kaspa-rest-server installieren
```powershell
# Download kaspa-rest-server:
# https://github.com/kaspanet/kaspa-rest-server/releases

# Oder via Go installieren:
go install github.com/kaspanet/kaspa-rest-server@latest
```

#### Schritt 4: kaspa-rest-server starten
```powershell
# Verbindet zu kaspad und bietet REST API
kaspa-rest-server --kaspad-address=localhost:16110 --bind-address=0.0.0.0:8080

# ✅ REST API verfügbar auf http://localhost:8080
```

#### Schritt 5: Backend verbinden
```powershell
# Backend nutzt automatisch localhost:8080 wenn verfügbar
npm run dev

# Backend erkennt:
# ✅ localhost:8080 erreichbar → nutzt lokale Node
# ❌ localhost:8080 nicht erreichbar → Public APIs
```

## 🧪 Testen ob alles läuft

### Test 1: Backend Health Check
```powershell
curl http://localhost:3000/health

# Erwartete Antwort:
# {
#   "status": "ok",
#   "timestamp": "2026-01-05T...",
#   "environment": "development"
# }
```

### Test 2: Kaspa Stats
```powershell
curl http://localhost:3000/api/kaspa-enhanced/stats

# Sollte Daten zurückgeben (entweder von localhost:8080 oder Public APIs)
```

### Test 3: Frontend mit lokalem Backend
```html
<!-- kaspa-explorer.js ändern: -->
<script>
const API = {
    // Statt Production:
    // BASE_URL: 'https://klassik.99pace.space',
    
    // Für lokales Testen:
    BASE_URL: 'http://localhost:3000',
    ENDPOINTS: {
        STATS: '/api/kaspa-enhanced/stats',
        // ...
    }
};
</script>
```

## 🎯 Empfehlung für Sie

**Für Entwicklung/Testing:**
```
Frontend → localhost:3000 (Backend) → api.kaspa.org (Public)
```

**Keine eigene kaspad Node nötig!** Public APIs reichen.

**Für Production (wie aktuell):**
```
Frontend → klassik.99pace.space (Backend) → api.kaspa.org (Public)
```

**Nur wenn Sie VOLLE Kontrolle wollen:**
```
Frontend → Backend → kaspa-rest-server → kaspad (eigene Node)
                                           ↓
                                    Kaspa Blockchain
```

## 🔧 Aktuelles CSP-Problem lösen

Das Problem ist **NICHT kaspad** - das Problem ist:

```javascript
// ❌ FALSCH: Frontend versucht direkten CoinGecko-Call via CORS Proxy
fetch('https://api.allorigins.win/raw?url=...coingecko...')
// CSP blockt api.allorigins.win!

// ✅ RICHTIG: Backend holt CoinGecko-Daten, Frontend fragt Backend
fetch('https://klassik.99pace.space/api/kaspa-enhanced/stats')
// CSP erlaubt klassik.99pace.space!
// Backend response enthält bereits:
// { price: { usd: 0.123, usd_24h_change: 5.2 }, ... }
```

**Lösung:**
1. Frontend: Entferne `api.allorigins.win` Calls
2. Frontend: Nutze `statsData.price` vom Backend
3. Backend: Holt bereits CoinGecko-Daten (schon implementiert!)

## 📝 Nächste Schritte

1. **CSP-Fix implementieren** (fetchNetworkInfo umbauen)
2. **Backend lokal testen** (npm run dev)
3. **Frontend mit localhost:3000 testen**
4. **Dann auf Production deployen**

Soll ich jetzt:
- A) CSP-Fix in kaspa-explorer.js machen?
- B) Backend lokal starten und testen?
- C) Beide parallel machen?
