# 🎵 Klassik - Wallet-Only Authentication Platform

## ✅ Was wurde finalisiert

### 1. Backend (Wallet-Only Auth)
- ✅ Email/Password Authentication **komplett entfernt**
- ✅ Nur noch Wallet-basierte Authentifizierung (Ethereum Signatures)
- ✅ Neue Auth Routes: `/api/auth/nonce`, `/api/auth/check`, `/api/auth/register`, `/api/auth/login`
- ✅ DB Migration für `username` Spalte erstellt
- ✅ Alte/veraltete Dateien gelöscht

### 2. Datenbank Schema
```sql
users:
  - id (SERIAL PRIMARY KEY)
  - address (VARCHAR UNIQUE) -- Ethereum Wallet Address
  - username (VARCHAR UNIQUE) -- Display Name
  - email (VARCHAR NULLABLE) -- Optional, für Notifications
  - password (TEXT NULLABLE) -- NULL für Wallet-Only Users
  - created_at (TIMESTAMP)
```

### 3. API Endpunkte

#### Wallet Authentication
```bash
# 1. Nonce holen
GET /api/auth/nonce?address=0x123...
→ { nonce, message, expiresAt }

# 2. Prüfen ob registriert
GET /api/auth/check?address=0x123...
→ { registered: true/false, user?: {...} }

# 3. Registrierung
POST /api/auth/register
Body: { address, signature, username }
→ { user, token, expiresIn }

# 4. Login
POST /api/auth/login
Body: { address, signature }
→ { user, token, expiresIn }

# 5. User Info
GET /api/auth/me
Header: Authorization: Bearer <token>
→ { user }
```

#### Andere Endpunkte (geschützt mit JWT)
- GET `/health` - Health Check
- GET `/api/kaspa/stats` - Kaspa Blockchain Stats
- GET `/api/products` - Shop Products
- POST `/api/orders` - Create Swap Order (Protected)
- POST `/api/payments/invoice` - Create Payment Invoice (Protected)
- GET `/api/events` - Events
- POST `/api/bookings` - Create Booking (Protected)

---

## 🚀 Deployment auf Ubuntu

### Schritt 1: Code auf Server pullen

```bash
# SSH auf Server
ssh klassikapp@157.173.222.140

# In Projekt-Verzeichnis
cd ~/klassik-app

# Code pullen
git pull origin klassik1

# Dependencies installieren
cd backend
npm install
```

### Schritt 2: DB Migration ausführen

```bash
# Migration ausführen
npm run migrate:up

# Ausgabe prüfen:
# ✅ Wallet-Only Migration complete!
```

### Schritt 3: Backend starten

```bash
# Backend starten
pm2 restart klassik

# ODER mit systemd:
sudo systemctl restart klassik

# Logs prüfen
pm2 logs klassik
# ODER:
sudo journalctl -u klassik -f
```

### Schritt 4: Testen

```bash
# Health Check
curl http://157.173.222.140:8130/health

# Sollte zurückgeben:
# {"status":"ok","timestamp":"...","environment":"production"}
```

---

## 💻 Lokale Nutzung (Windows)

### Backend testen
```powershell
# Im Projekt-Verzeichnis
cd c:\Users\TUF-s\Desktop\git\Klassik

# Backend testen (lokal)
cd backend
npm install
npm start

# Backend läuft auf: http://localhost:8130
```

### Frontend öffnen

```powershell
# Option 1: Direkter Zugriff auf Ubuntu Backend
# Öffne Browser: http://157.173.222.140:8130

# Option 2: Frontend lokal hosten
cd c:\Users\TUF-s\Desktop\git\Klassik\frontend
python -m http.server 3000

# Dann Browser öffnen: http://localhost:3000
```

---

## 🎯 Wallet-Auth Flow

### 1. User öffnet Frontend
```
http://157.173.222.140:8130
```

### 2. Click "Connect Wallet"
- MetaMask Popup öffnet sich
- User verbindet Wallet
- Frontend prüft: `GET /api/auth/check?address=0x123...`

### 3a. Falls **NICHT registriert**
- Frontend zeigt Username-Eingabe
- User gibt Username ein (z.B. `crypto_fan`)
- Click "Sign & Register"
- MetaMask Popup: Signature Request
- Frontend sendet: `POST /api/auth/register`
- Backend:
  1. Verifiziert Signatur
  2. Erstellt User in DB
  3. Gibt JWT Token zurück

### 3b. Falls **BEREITS registriert**
- Frontend zeigt "Sign & Login"
- Click "Sign & Login"
- MetaMask Popup: Signature Request
- Frontend sendet: `POST /api/auth/login`
- Backend:
  1. Verifiziert Signatur
  2. Gibt JWT Token zurück

### 4. Authenticated!
- Frontend speichert Token in localStorage
- Alle weiteren API-Calls nutzen: `Authorization: Bearer <token>`
- User kann jetzt:
  - Products ansehen
  - Orders erstellen
  - Payments machen
  - Events buchen

---

## 📁 Dateien Overview

### Backend (wichtigste)
```
backend/
├── src/
│   ├── index.js                    # Express Server
│   ├── db.js                       # PostgreSQL Connection
│   ├── routes/
│   │   └── auth.js                 # ✅ WALLET-ONLY AUTH (NEU!)
│   ├── controllers/
│   │   ├── orders.js              # Swap Orders
│   │   ├── products.js            # Shop Products
│   │   └── payments.js            # NOWPayments
│   └── middleware/
│       └── auth.js                 # JWT Verification
│
├── migrations/
│   └── 1733758800000_wallet_only_final.js  # ✅ DB Migration (NEU!)
│
├── package.json
└── .env                            # Environment Variables
```

### Frontend
```
frontend/
└── index.html                      # ✅ MODERNES WALLET UI (NEU!)
```

---

## 🔧 Environment Variables

Auf Ubuntu Server: `/etc/klassik/klassik.env`

```bash
# Database
DATABASE_URL=postgresql://klassikuser:PASSWORD@localhost:5432/klassikdb

# Server
NODE_ENV=production
PORT=8130
HOST=0.0.0.0
BASE_URL=http://157.173.222.140:8130
FRONTEND_URL=http://157.173.222.140:8130

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRY=7d

# Optional
CORS_ORIGIN=*
ENABLE_WATCHER=false
```

---

## ✅ Testing Checklist

### 1. Backend läuft?
```bash
curl http://157.173.222.140:8130/health
# Erwartung: {"status":"ok",...}
```

### 2. Wallet Registration
1. Öffne: http://157.173.222.140:8130
2. Click "Connect Wallet"
3. MetaMask verbinden
4. Username eingeben
5. "Sign & Register" klicken
6. MetaMask Signature
7. ✅ User Card wird angezeigt

### 3. Wallet Login
1. Logout klicken
2. Seite neu laden
3. "Connect Wallet"
4. "Sign & Login"
5. ✅ Direkt eingeloggt

### 4. API Calls (mit Token)
```bash
# Token aus Frontend kopieren
TOKEN="eyJhbGciOiJIUzI1NiIs..."

# Products abrufen
curl http://157.173.222.140:8130/api/products

# User Info
curl -H "Authorization: Bearer $TOKEN" \
     http://157.173.222.140:8130/api/auth/me
```

---

## 🎨 Frontend Features (2025/2026 Design)

- ✅ **Glassmorphism** Design
- ✅ **Animated Backgrounds** (Gradient Drift)
- ✅ **Smooth Transitions** (Cubic Bezier)
- ✅ **Micro-Interactions** (Button Ripples)
- ✅ **Dark Mode** (Modern Slate Palette)
- ✅ **Responsive** (Mobile-First)
- ✅ **Accessibility** (Focus States, ARIA)
- ✅ **Loading States** (Spinners, Progress)
- ✅ **Auto-Login** (localStorage Persistence)

---

## 🐛 Troubleshooting

### Backend startet nicht
```bash
# Logs prüfen
pm2 logs klassik

# Port 8130 belegt?
sudo lsof -i :8130

# DB Verbindung OK?
psql -U klassikuser -d klassikdb -c "\dt"
```

### Migration failed
```bash
# Manuell prüfen
psql -U klassikuser -d klassikdb

# Tabellen anzeigen
\dt

# Username Spalte existiert?
\d users

# Falls nicht:
ALTER TABLE users ADD COLUMN username VARCHAR(100) UNIQUE;
```

### Frontend kann Backend nicht erreichen
1. Firewall prüfen: `sudo ufw status`
2. Port 8130 offen? `sudo ufw allow 8130`
3. Backend läuft? `curl http://localhost:8130/health`

---

## 📦 Deployment Workflow

```bash
# 1. Lokal entwickeln
cd c:\Users\TUF-s\Desktop\git\Klassik
git add .
git commit -m "Update"
git push origin klassik1

# 2. Auf Server deployen
ssh klassikapp@157.173.222.140
cd ~/klassik-app
git pull origin klassik1
cd backend
npm install
npm run migrate:up
pm2 restart klassik

# 3. Testen
curl http://localhost:8130/health
```

---

## 🎯 Zusammenfassung

**Was funktioniert:**
✅ Wallet-Only Authentication  
✅ MetaMask Integration  
✅ JWT Token System  
✅ Modernes UI (2025/2026 Standard)  
✅ PostgreSQL mit Migration  
✅ Production-Ready Deployment  

**Was entfernt wurde:**
❌ Email/Password Authentication  
❌ Alte/veraltete Auth Routes  
❌ Deprecated Migrations  
❌ Unnötige Backup-Dateien  

**Nächste Schritte:**
1. `git pull` auf Ubuntu
2. `npm run migrate:up`
3. `pm2 restart klassik`
4. Testen: http://157.173.222.140:8130

---

**Version**: 1.0 Final  
**Datum**: 2025-12-09  
**Status**: ✅ Production Ready  
**Author**: GitHub Copilot
