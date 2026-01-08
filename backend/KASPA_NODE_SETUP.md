# 🚀 KASPA LOCAL NODE SETUP

## WARUM LOKALER NODE?

✅ **Vorteile:**
- Keine API Rate Limits
- Keine DDoS/Security Blocks  
- Schnellste Response-Zeit
- Volle Kontrolle
- Keine Abhängigkeit von externen Services

## 📋 INSTALLATION

### **Option 1: Kaspa Node (Full Node)**

```bash
# 1. Download Kaspa Node
wget https://github.com/kaspanet/kaspad/releases/latest/download/kaspad-linux-amd64.tar.gz

# 2. Extrahieren
tar -xzf kaspad-linux-amd64.tar.gz
cd kaspad

# 3. Starten
./kaspad --utxoindex

# Node läuft auf: localhost:16110
```

### **Option 2: Kaspa REST Server (Leichtgewichtig)**

```bash
# 1. Install Go (falls nicht installiert)
wget https://go.dev/dl/go1.21.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.21.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin

# 2. Clone Kaspa REST API
git clone https://github.com/kaspanet/kaspa-rest-server
cd kaspa-rest-server

# 3. Build
go build

# 4. Starten
./kaspa-rest-server --kaspad-address localhost:16110

# REST API läuft auf: localhost:8080
```

### **Option 3: Docker (EINFACHSTE METHODE)**

```bash
# Kaspa Node mit REST API
docker run -d \
  --name kaspa-node \
  -p 16110:16110 \
  -p 8080:8080 \
  kaspanet/kaspad:latest \
  --utxoindex \
  --rest-server
```

---

## ⚙️ BACKEND KONFIGURATION

### **1. .env anpassen:**

```bash
# Backend-Verzeichnis
cd /path/to/klassik/backend
nano .env
```

**Für lokalen Node:**
```env
KASPA_REST_SERVER=http://localhost:8080
```

**Für Server mit externem Node:**
```env
KASPA_REST_SERVER=http://YOUR_NODE_IP:8080
```

### **2. Backend neustarten:**

```bash
# Mit pm2:
pm2 restart klassik-backend

# Oder direkt:
npm start
```

---

## 🧪 TESTEN

### **1. Node Health Check:**

```bash
# Prüfe ob Node läuft
curl http://localhost:8080/info
```

Erwartete Antwort:
```json
{
  "blockCount": 12345678,
  "networkName": "kaspa-mainnet",
  "isUtxoIndexed": true,
  "isSynced": true
}
```

### **2. Transaction Check:**

```bash
# Teste Transaction Lookup
curl "http://localhost:8080/addresses/kaspa:qzhszuncy0qsh0d3upnd8uxjtwmdqdzslh6vzl20clwcf4gw8mfgyektl04p4/transactions?limit=10"
```

### **3. Backend Sacrifice Check:**

```bash
cd backend
node scripts/check-sacrifice.js
```

---

## 📊 API FALLBACK STRATEGIE

Das Backend versucht APIs in dieser Reihenfolge:

1. ✅ **Lokaler REST Server** (localhost:8080) - FASTEST
2. ✅ **KaspaLive API** (api.kaspa.live) - Usually not blocked
3. ✅ **Kaspa Explorer API** (explorer.kaspa.org) - Official
4. ✅ **KaspaScan API** (api.kaspascan.io) - Alternative

Wenn ALLE fehlschlagen → Error Message

---

## 🔧 TROUBLESHOOTING

### **Problem: "Connection refused"**

```bash
# Prüfe ob Node läuft
ps aux | grep kaspad

# Prüfe Ports
netstat -tuln | grep -E '8080|16110'

# Restart Node
sudo systemctl restart kaspad  # falls als Service
# oder
./kaspad --utxoindex  # direkt starten
```

### **Problem: "Node not synced"**

```bash
# Warte bis Node synchronized ist (kann 1-2 Stunden dauern)
curl http://localhost:8080/info | grep isSynced

# Sollte zeigen: "isSynced": true
```

### **Problem: "UTXO index not found"**

```bash
# Node muss mit --utxoindex gestartet werden
./kaspad --utxoindex

# Oder in systemd service file hinzufügen
```

---

## 🚀 PRODUCTION SETUP

### **Systemd Service erstellen:**

```bash
sudo nano /etc/systemd/system/kaspa-rest.service
```

```ini
[Unit]
Description=Kaspa REST Server
After=network.target kaspad.service

[Service]
Type=simple
User=kaspa
WorkingDirectory=/opt/kaspa-rest-server
ExecStart=/opt/kaspa-rest-server/kaspa-rest-server --kaspad-address localhost:16110
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# Service aktivieren
sudo systemctl enable kaspa-rest.service
sudo systemctl start kaspa-rest.service

# Status prüfen
sudo systemctl status kaspa-rest.service
```

---

## 📈 MONITORING

### **PM2 Dashboard:**

```bash
# Backend Logs live sehen
pm2 logs klassik-backend --lines 100

# Suche nach Kaspa API Calls:
pm2 logs | grep "Kaspa"
pm2 logs | grep "sacrifice"
```

### **Node Status prüfen:**

```bash
# Node Info
curl http://localhost:8080/info | jq

# Address Balance
curl "http://localhost:8080/addresses/kaspa:YOUR_ADDRESS/balance"

# Latest Blocks
curl "http://localhost:8080/blocks/latest?limit=5"
```

---

## ⚡ PERFORMANCE

**Lokaler Node:**
- Response Time: ~50-100ms
- Rate Limit: Unbegrenzt
- Uptime: 99.9%+ (unter deiner Kontrolle)

**Public APIs:**
- Response Time: ~500-2000ms
- Rate Limit: Variiert (100-1000 req/day)
- Uptime: Abhängig von Service

**Empfehlung:** Lokaler Node für Production!

---

## 🎯 OHNE LOKALEN NODE

Falls du KEINEN lokalen Node setup willst:

Das Backend nutzt automatisch **multiple Fallback APIs**:
- KaspaLive (meist verfügbar)
- Explorer.kaspa.org
- KaspaScan.io

**Aber:** Kann langsamer sein + Rate Limits

---

## ✅ QUICK START (Minimale Config)

1. **Backend startet** → Nutzt automatisch Public APIs
2. **Später** → Setup lokaler Node für bessere Performance
3. **Backend erkennt automatisch** wenn lokaler Node verfügbar

Keine Config-Änderung nötig! Backend ist smart configured.

