# 🐧 Ubuntu Setup - Wallet Connect & Datenbank

## 📋 Voraussetzungen
- ✅ PostgreSQL läuft auf Ubuntu
- ✅ Repo auf Ubuntu geladen
- 🎯 Ziel: Wallet Connect im Frontend funktionsfähig machen

---

## 1️⃣ PostgreSQL Datenbank einrichten

### Datenbank erstellen

```bash
# Als postgres User einloggen
sudo -u postgres psql

# In psql:
CREATE DATABASE klassik;
CREATE USER klassik WITH PASSWORD 'dein-starkes-passwort';
GRANT ALL PRIVILEGES ON DATABASE klassik TO klassik;

# Verbindung zur klassik DB
\c klassik

# Prüfen ob leer
\dt

# Verlassen
\q
```

### Alternative: Direkt per Command

```bash
sudo -u postgres psql -c "CREATE DATABASE klassik;"
sudo -u postgres psql -c "CREATE USER klassik WITH PASSWORD 'SuperSicher123!';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE klassik TO klassik;"
```

---

## 2️⃣ Backend konfigurieren

### .env Datei erstellen

```bash
# Im Projekt-Verzeichnis
cd /pfad/zu/klassik/backend

# .env erstellen (aus Example kopieren)
cp .env.example .env

# Bearbeiten
nano .env
```

**Inhalt der .env:**

```env
# Database
DATABASE_URL=postgresql://klassik:SuperSicher123!@localhost:5432/klassik

# Server
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# CORS (für lokales Testen: *)
CORS_ORIGIN=*

# JWT (für Production: sicheren Key generieren!)
JWT_SECRET=dev-secret-key-change-in-production
JWT_EXPIRY=7d

# Blockchain (optional)
ENABLE_WATCHER=false
```

### Dependencies installieren

```bash
cd /pfad/zu/klassik/backend

# Node.js installieren (falls nicht vorhanden)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Version prüfen
node --version  # sollte v18.x+ sein
npm --version

# Packages installieren
npm install
```

### Datenbank-Schema erstellen (Migrationen)

```bash
# Migrationen ausführen
npm run migrate:up

# Erfolgreich? Du solltest sehen:
# > klassik-backend@1.0.0 migrate:up
# > node-pg-migrate up
# 
# 000_initial.js
# 001_add_products.js
```

### Backend starten

```bash
# Development-Modus
npm run dev

# Sollte zeigen:
# 🎵 Klassik Backend Server
# Environment: development
# Port: 3000
# URL: http://localhost:3000
```

---

## 3️⃣ Datenbank-Tabellen prüfen & testen

### users Tabelle ansehen

```bash
# psql öffnen
sudo -u postgres psql -d klassik

# Tabellen-Struktur anzeigen
\d users

# Sollte zeigen:
# Column        | Type                     | Nullable
# --------------------------------------
# id            | integer                  | not null
# email         | character varying(255)   | 
# password      | text                     | 
# address       | character varying(255)   |     <- Wallet-Adresse
# nonce         | character varying(255)   |     <- Für Wallet-Auth
# nonce_expiry  | timestamp                |
# created_at    | timestamp                | not null
```

### Test-User erstellen (Email/Password)

```bash
# In psql:
INSERT INTO users (email, password, created_at) 
VALUES ('test@example.com', '$2a$10$dummyhash', CURRENT_TIMESTAMP);

# Prüfen
SELECT id, email, address, created_at FROM users;
```

### Alle Users anzeigen

```bash
# In psql:
SELECT * FROM users;

# Nur bestimmte Spalten:
SELECT id, email, address, created_at FROM users ORDER BY created_at DESC;

# Anzahl Users:
SELECT COUNT(*) FROM users;

# Nur Wallet-Users (ohne Email):
SELECT * FROM users WHERE email IS NULL;

# Nur Email-Users (ohne Wallet):
SELECT * FROM users WHERE address IS NULL;
```

---

## 4️⃣ Wallet Connect testen

### Backend API-Endpunkte (alle verfügbar)

#### 1. **Wallet-Adresse prüfen** (ist bereits registriert?)

```bash
# GET /api/auth/user?address=0x...
curl "http://localhost:3000/api/auth/user?address=0x1234567890abcdef1234567890abcdef12345678"

# Response wenn NICHT registriert:
# {"error":"User not found"}  <- Status 404

# Response wenn registriert:
# {"user":{"id":1,"email":"user@example.com","address":"0x1234...","created_at":"..."}}
```

#### 2. **Wallet-User registrieren**

```bash
# POST /api/auth/user
curl -X POST http://localhost:3000/api/auth/user \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "email": "wallet@example.com"
  }'

# Response:
# {
#   "user": {
#     "id": 2,
#     "email": "wallet@example.com",
#     "address": "0x1234567890abcdef1234567890abcdef12345678",
#     "created_at": "2025-12-08T..."
#   },
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "expiresIn": "7d"
# }
```

**In der Datenbank prüfen:**

```sql
-- In psql:
SELECT * FROM users WHERE address = '0x1234567890abcdef1234567890abcdef12345678';
```

#### 3. **Nonce für Wallet-Signatur anfordern**

```bash
# GET /api/auth/nonce?address=0x...
curl "http://localhost:3000/api/auth/nonce?address=0x1234567890abcdef1234567890abcdef12345678"

# Response:
# {
#   "nonce": "a1b2c3d4e5f6...",
#   "message": "Sign this message to authenticate with Klassik:\n\nNonce: a1b2c3d4e5f6...\nTimestamp: 2025-12-08T..."
# }
```

**In der Datenbank prüfen:**

```sql
-- In psql:
SELECT id, email, address, nonce, nonce_expiry FROM users 
WHERE address = '0x1234567890abcdef1234567890abcdef12345678';

-- Sollte jetzt nonce und nonce_expiry haben!
```

#### 4. **Mit Wallet anmelden** (nach Signatur)

```bash
# POST /api/auth/signin-with-wallet
curl -X POST http://localhost:3000/api/auth/signin-with-wallet \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x1234567890abcdef1234567890abcdef12345678",
    "signature": "0xabcdef123456789..." 
  }'

# Response:
# {
#   "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "address": "0x1234567890abcdef1234567890abcdef12345678",
#   "expiresIn": "7d",
#   "user": {...}
# }
```

**Wichtig:** Die Signatur muss mit MetaMask/Wallet erstellt werden!

---

## 5️⃣ Frontend Wallet Connect Flow

### So funktioniert es im Browser:

1. **User klickt "Connect Wallet"**
   ```javascript
   // frontend/assets/js/wallet.js
   async function connectWallet() {
     // MetaMask-Verbindung anfordern
     const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
     const address = accounts[0]; // z.B. "0x1234..."
     
     // Schritt 1: Prüfen ob Wallet registriert
     const res = await fetch(`${API_URL}/api/auth/user?address=${address}`);
     
     if (res.ok) {
       // Wallet existiert -> Sign-In Flow
       await walletSignIn(address);
     } else {
       // Wallet nicht registriert -> Registrierung
       const email = prompt('Enter your email to register:');
       await registerWallet(address, email);
     }
   }
   ```

2. **Wallet registrieren** (wenn nötig)
   ```javascript
   async function registerWallet(address, email) {
     const res = await fetch(`${API_URL}/api/auth/user`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ address, email })
     });
     
     const data = await res.json();
     // Token speichern
     localStorage.setItem('klassik_token', data.token);
   }
   ```

3. **Wallet Sign-In** (Nachricht signieren)
   ```javascript
   async function walletSignIn(address) {
     // Nonce holen
     const nonceRes = await fetch(`${API_URL}/api/auth/nonce?address=${address}`);
     const { message } = await nonceRes.json();
     
     // MetaMask: Nachricht signieren
     const signature = await window.ethereum.request({
       method: 'personal_sign',
       params: [message, address]
     });
     
     // Auth mit Signatur
     const authRes = await fetch(`${API_URL}/api/auth/signin-with-wallet`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ address, signature })
     });
     
     const data = await authRes.json();
     localStorage.setItem('klassik_token', data.token);
   }
   ```

### Frontend starten

```bash
# Option 1: Backend serviert Frontend automatisch
# Einfach Backend starten (siehe oben), dann Browser öffnen:
firefox http://localhost:3000

# Option 2: Separater HTTP-Server (nur für Tests)
cd /pfad/zu/klassik/frontend
python3 -m http.server 8080
# Browser: http://localhost:8080
```

---

## 6️⃣ Datenbank-Operationen (SQL Befehle)

### Users Tabelle - Wichtigste Befehle

```sql
-- In psql: sudo -u postgres psql -d klassik

-- 1. ALLE USERS ANZEIGEN
SELECT * FROM users;

-- 2. NUR WICHTIGE SPALTEN
SELECT id, email, address, created_at FROM users ORDER BY id;

-- 3. USER NACH EMAIL SUCHEN
SELECT * FROM users WHERE email = 'test@example.com';

-- 4. USER NACH WALLET-ADRESSE SUCHEN
SELECT * FROM users WHERE address = '0x1234567890abcdef1234567890abcdef12345678';

-- 5. NUR WALLET-USERS (ohne Email/Password)
SELECT id, address, created_at FROM users WHERE email IS NULL;

-- 6. NUR EMAIL-USERS (ohne Wallet)
SELECT id, email, created_at FROM users WHERE address IS NULL;

-- 7. USER LÖSCHEN
DELETE FROM users WHERE id = 1;

-- 8. USER AKTUALISIEREN (Email hinzufügen)
UPDATE users SET email = 'newemail@example.com' WHERE id = 1;

-- 9. WALLET-ADRESSE HINZUFÜGEN
UPDATE users SET address = '0xabc...' WHERE id = 1;

-- 10. NONCE LÖSCHEN (nach Login)
UPDATE users SET nonce = NULL, nonce_expiry = NULL WHERE id = 1;

-- 11. ANZAHL USERS
SELECT COUNT(*) FROM users;

-- 12. LETZTE 10 REGISTRIERUNGEN
SELECT id, email, address, created_at FROM users 
ORDER BY created_at DESC LIMIT 10;

-- 13. USERS MIT AKTIVEN NONCES
SELECT id, email, address, nonce_expiry FROM users 
WHERE nonce IS NOT NULL AND nonce_expiry > CURRENT_TIMESTAMP;

-- 14. ABGELAUFENE NONCES LÖSCHEN
UPDATE users SET nonce = NULL, nonce_expiry = NULL 
WHERE nonce_expiry < CURRENT_TIMESTAMP;

-- 15. TABELLE LEEREN (VORSICHT!)
TRUNCATE TABLE users RESTART IDENTITY CASCADE;
```

### Andere Tabellen

```sql
-- ALLE TABELLEN ANZEIGEN
\dt

-- TABELLEN-STRUKTUR
\d users
\d events
\d bookings
\d orders

-- EVENTS
SELECT * FROM events;

-- BOOKINGS
SELECT b.id, u.email, e.title, b.quantity 
FROM bookings b
JOIN users u ON b.user_id = u.id
JOIN events e ON b.event_id = e.id;

-- ORDERS
SELECT o.id, u.email, o.from_chain, o.to_chain, o.status 
FROM orders o
JOIN users u ON o.user_id = u.id;
```

---

## 7️⃣ Häufige Probleme & Lösungen

### Problem: Backend startet nicht

```bash
# Logs prüfen
cd /pfad/zu/klassik/backend
npm run dev

# Häufige Fehler:
# 1. "Cannot connect to database"
#    -> DATABASE_URL in .env prüfen
#    -> PostgreSQL läuft? sudo systemctl status postgresql

# 2. "Port 3000 already in use"
#    -> Anderen Port verwenden: PORT=3001 npm run dev
#    -> Oder Prozess killen: sudo lsof -ti:3000 | xargs kill -9

# 3. "JWT_SECRET is not set"
#    -> .env Datei prüfen und JWT_SECRET hinzufügen
```

### Problem: Migrations schlagen fehl

```bash
# Migration zurücksetzen
npm run migrate:down

# Neu ausführen
npm run migrate:up

# Oder manuell:
sudo -u postgres psql -d klassik < backend/migrations/000_initial.js
```

### Problem: Wallet Connect funktioniert nicht

```bash
# 1. Backend erreichbar?
curl http://localhost:3000/health

# 2. API-Endpunkte funktionieren?
curl "http://localhost:3000/api/auth/user?address=0xtest"

# 3. Browser-Console öffnen (F12)
# Fehler: "API_URL is not defined"
# -> In frontend/assets/js/auth.js: const API_URL = 'http://localhost:3000'

# Fehler: "CORS policy"
# -> In backend/.env: CORS_ORIGIN=*
```

---

## 8️⃣ Test-Workflow (komplett)

### Schritt-für-Schritt Test

```bash
# 1. Backend starten
cd /pfad/zu/klassik/backend
npm run dev

# In NEUEM Terminal:

# 2. Health Check
curl http://localhost:3000/health

# 3. Test-User mit Email registrieren
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@klassik.com","password":"Test123!"}'

# 4. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@klassik.com","password":"Test123!"}'

# 5. Wallet registrieren
curl -X POST http://localhost:3000/api/auth/user \
  -H "Content-Type: application/json" \
  -d '{"address":"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb","email":"wallet@klassik.com"}'

# 6. Nonce anfordern
curl "http://localhost:3000/api/auth/nonce?address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"

# 7. DB prüfen
sudo -u postgres psql -d klassik -c "SELECT id, email, address, nonce FROM users;"

# 8. Browser-Test
firefox http://localhost:3000
# -> MetaMask installiert?
# -> "Connect Wallet" klicken
# -> Nachricht signieren
```

---

## 9️⃣ Production-Deployment (später)

```bash
# Für Production auf Ubuntu Server:
# 1. Setup-Script ausführen
curl -fsSL https://raw.githubusercontent.com/meme-2025/klassik-app/main/backend/deploy/setup-ubuntu.sh -o setup.sh
chmod +x setup.sh
./setup.sh

# 2. Service läuft automatisch
sudo systemctl status klassik

# 3. Logs ansehen
sudo journalctl -u klassik -f

# 4. nginx für HTTPS
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d deine-domain.com
```

---

## 🎯 Zusammenfassung

### Wichtigste Befehle:

```bash
# PostgreSQL
sudo -u postgres psql -d klassik
SELECT * FROM users;

# Backend
cd backend
npm run dev

# Migrationen
npm run migrate:up

# API testen
curl http://localhost:3000/health
curl "http://localhost:3000/api/auth/user?address=0x..."

# Browser
firefox http://localhost:3000
```

### Wallet Connect Flow:

1. **Frontend**: User klickt "Connect Wallet"
2. **MetaMask**: User verbindet Account
3. **Frontend** → **Backend**: `GET /api/auth/user?address=0x...`
4. **Backend** → **DB**: `SELECT * FROM users WHERE address = '0x...'`
5. Wenn nicht registriert: `POST /api/auth/user` → **DB**: `INSERT INTO users`
6. **Frontend** → **Backend**: `GET /api/auth/nonce?address=0x...`
7. **Backend** → **DB**: `UPDATE users SET nonce = ...`
8. **MetaMask**: User signiert Nachricht
9. **Frontend** → **Backend**: `POST /api/auth/signin-with-wallet`
10. **Backend**: Verifiziert Signatur → **DB**: `UPDATE users SET nonce = NULL`
11. **Backend** → **Frontend**: JWT Token
12. **Frontend**: Speichert Token, User ist eingeloggt!

---

**Viel Erfolg! 🚀**
