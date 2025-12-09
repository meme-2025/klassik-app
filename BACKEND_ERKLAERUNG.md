# 🎵 Klassik Backend - Vollständige Erklärung

## 📋 Inhaltsverzeichnis
1. [Überblick](#überblick)
2. [Architektur](#architektur)
3. [Datenbank Schema](#datenbank-schema)
4. [API Endpunkte](#api-endpunkte)
5. [Authentifizierung](#authentifizierung)
6. [Aktueller Zustand](#aktueller-zustand)
7. [Problem & Lösung](#problem--lösung)

---

## 🎯 Überblick

**Klassik Backend** ist eine Node.js/Express API die auf Ubuntu läuft und über IP:Port (192.168.2.148:8130) erreichbar ist.

### Technologie-Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Datenbank**: PostgreSQL (`klassikdb`)
- **Auth**: JWT (JSON Web Tokens) + Wallet-Signatur (ethers.js)
- **Blockchain**: Ethereum/Kaspa Integration
- **Payment**: NOWPayments API Integration

### Hauptfunktionen
1. ✅ Wallet-basierte Registrierung & Login
2. ✅ Event & Booking Management
3. ✅ Produkt-Shop mit Bezahlung
4. ✅ Cross-Chain Swaps (ETH ↔ KASPA)
5. ✅ Kaspa Blockchain Stats

---

## 🏗️ Architektur

```
backend/
├── src/
│   ├── index.js              # 🚀 Hauptserver (Express App)
│   ├── db.js                 # 🗄️  PostgreSQL Verbindung
│   ├── watcher.js            # ⛓️  Blockchain Event Listener
│   │
│   ├── routes/               # 📍 API Route Definitionen
│   │   ├── auth.js           # Authentifizierung (Register/Login/Wallet)
│   │   ├── events.js         # Event Management
│   │   ├── bookings.js       # Buchungen
│   │   ├── kaspa.js          # Kaspa Stats API
│   │   ├── users.js          # User Profile
│   │   └── debug.js          # Debug Tools (Admin)
│   │
│   ├── controllers/          # 🎮 Business Logic
│   │   ├── auth.js           # Auth Controller
│   │   ├── orders.js         # Swap Orders
│   │   ├── products.js       # Shop Products
│   │   └── payments.js       # NOWPayments Integration
│   │
│   └── middleware/           # 🛡️ Middleware
│       ├── auth.js           # JWT Token Verification
│       ├── rateLimit.js      # Rate Limiting
│       └── validation.js     # Input Validation
│
├── migrations/               # 📊 DB Migrations
│   ├── 000_initial.js
│   ├── 001_add_nonces.js
│   └── 002_wallet_only_auth.js
│
└── .env                      # 🔐 Konfiguration
```

---

## 🗄️ Datenbank Schema

### Database: `klassikdb`

#### 📊 Tabellen-Übersicht

```sql
-- 1️⃣ USERS Tabelle
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,        -- ⚠️ Wird für Wallet-Adresse missbraucht!
  password TEXT,                    -- ⚠️ Wird für Username missbraucht!
  address VARCHAR(255) UNIQUE,      -- Ethereum/Wallet Adresse
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2️⃣ EVENTS Tabelle
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  date TIMESTAMP,
  capacity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3️⃣ BOOKINGS Tabelle
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  event_id INTEGER REFERENCES events(id),
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4️⃣ NONCES Tabelle (für Wallet-Auth)
CREATE TABLE nonces (
  address VARCHAR(255) PRIMARY KEY,
  nonce VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5️⃣ PRODUCTS Tabelle
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  subcategory VARCHAR(100),
  provider VARCHAR(100) DEFAULT 'internal',
  country VARCHAR(100),
  price DECIMAL(20,8) NOT NULL,
  currency VARCHAR(10) DEFAULT 'ETH',
  stock INTEGER DEFAULT 0,
  image_url TEXT,
  external_id VARCHAR(255),
  metadata JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6️⃣ ORDERS Tabelle
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  order_type VARCHAR(50) DEFAULT 'swap', -- 'swap' oder 'shop'
  from_chain VARCHAR(20),
  to_chain VARCHAR(20),
  from_amount DECIMAL(20,8),
  to_amount DECIMAL(20,8),
  from_address VARCHAR(255),
  to_address VARCHAR(255),
  deposit_address VARCHAR(255),
  deposit_reference VARCHAR(255),
  total_amount DECIMAL(20,8),
  status VARCHAR(50) DEFAULT 'created',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7️⃣ PAYMENTS Tabelle (NOWPayments)
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  payment_id VARCHAR(255),
  invoice_id VARCHAR(255),
  invoice_url TEXT,
  pay_address VARCHAR(255),
  pay_amount DECIMAL(20,8),
  pay_currency VARCHAR(10),
  price_amount DECIMAL(20,8),
  price_currency VARCHAR(10),
  payment_status VARCHAR(50) DEFAULT 'waiting',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### ⚠️ KRITISCHES PROBLEM

**Aktuelle Wallet-Auth nutzt falsche Spalten:**
```javascript
// ❌ AKTUELL (FALSCH):
// - email Spalte = Wallet-Adresse speichern
// - password Spalte = Username speichern

// POST /api/auth/user
INSERT INTO users (email, password, created_at) 
VALUES ('0x123...abc', 'max_mustermann', CURRENT_TIMESTAMP)
```

**Das führt zu:**
- ❌ Login mit Email/Password funktioniert nicht mehr
- ❌ Wallet-Adressen in email Spalte → Chaos
- ❌ Usernames in password Spalte → Unsicher
- ❌ Keine echte Wallet-Authentifizierung

---

## 📍 API Endpunkte

### ✅ LIVE Endpunkte (auf Ubuntu)

#### 1️⃣ Health Check
```bash
GET http://157.173.222.140:8130/health
```
**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-09T10:30:00.000Z",
  "environment": "production"
}
```

---

#### 2️⃣ Registrierung (Email/Password) - VERALTET
```bash
POST http://157.173.222.140:8130/api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepass123"
}
```
**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "created_at": "2025-12-09T10:30:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "7d"
}
```

---

#### 3️⃣ Login (Email/Password) - VERALTET
```bash
POST http://157.173.222.140:8130/api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepass123"
}
```

---

#### 4️⃣ Kaspa Stats
```bash
GET http://157.173.222.140:8130/api/kaspa/stats
```
**Response:**
```json
{
  "price": {
    "usd": 0.15,
    "btc": 0.0000035,
    "change_24h": 5.2,
    "market_cap": 3500000000,
    "volume_24h": 85000000
  },
  "blockchain": {
    "blockCount": 12500000,
    "difficulty": "1.23e+18",
    "hashrate": "850 PH/s",
    "networkName": "kaspa-mainnet"
  },
  "timestamp": "2025-12-09T10:30:00.000Z",
  "cached": false
}
```

---

#### 5️⃣ Products (Shop)
```bash
GET http://157.173.222.140:8130/api/products
GET http://157.173.222.140:8130/api/products?category=music&limit=10
GET http://157.173.222.140:8130/api/products/1
```
**Response:**
```json
{
  "products": [
    {
      "id": 1,
      "title": "Premium Concert Ticket",
      "description": "VIP access to classical concert",
      "category": "tickets",
      "price": "0.05",
      "currency": "ETH",
      "stock": 50,
      "active": true
    }
  ],
  "count": 1
}
```

---

#### 6️⃣ Invoice (Payment) - 🔐 Geschützt
```bash
POST http://157.173.222.140:8130/api/payments/invoice
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "items": [
    { "id": 1, "qty": 2 }
  ],
  "buyerAddress": "0x123..."
}
```
**Response:**
```json
{
  "orderId": 42,
  "payment_id": "np_12345",
  "invoice_url": "https://nowpayments.io/payment/...",
  "pay_address": "0xABC...",
  "pay_amount": "0.1",
  "pay_currency": "eth"
}
```

---

#### 7️⃣ Orders - 🔐 Geschützt
```bash
POST http://157.173.222.140:8130/api/orders
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "fromChain": "ETH",
  "toChain": "KASPA",
  "fromAmount": "1.0",
  "toAmount": "5000",
  "fromAddress": "0x123...",
  "toAddress": "kaspa:qz..."
}
```

```bash
GET http://157.173.222.140:8130/api/orders
GET http://157.173.222.140:8130/api/orders/42
```

---

### 🔐 Wallet-Auth Endpunkte (AKTUELL FEHLERHAFT)

#### 8️⃣ Check User by Wallet
```bash
GET http://157.173.222.140:8130/api/auth/user?address=0x123...
```

#### 9️⃣ Register Wallet (PROBLEM)
```bash
POST http://157.173.222.140:8130/api/auth/user
Content-Type: application/json

{
  "address": "0x123...",
  "username": "max_mustermann"
}
```
⚠️ **Problem**: Speichert Wallet in `email` und Username in `password` Spalte!

#### 🔟 Get Nonce
```bash
GET http://157.173.222.140:8130/api/auth/nonce?address=0x123...
```
**Response:**
```json
{
  "nonce": "a1b2c3...",
  "message": "Sign this message to authenticate with Klassik:\n\nNonce: a1b2c3...\nTimestamp: 2025-12-09T10:30:00.000Z",
  "expiresAt": "2025-12-09T10:40:00.000Z"
}
```

#### 1️⃣1️⃣ Login with Wallet
```bash
POST http://157.173.222.140:8130/api/auth/login-wallet
Content-Type: application/json

{
  "address": "0x123...",
  "signature": "0xabc..."
}
```

---

## 🔐 Authentifizierung

### JWT Token System

**1. Token erstellen (bei Login/Register):**
```javascript
const token = jwt.sign(
  { 
    userId: user.id,
    email: user.email,
    address: user.address
  },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);
```

**2. Token nutzen (in Frontend):**
```javascript
fetch('http://157.173.222.140:8130/api/orders', {
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  }
})
```

**3. Geschützte Routes (Backend):**
```javascript
app.post('/api/orders', authMiddleware, ordersController.createOrder);
//                       ^^^^^^^^^^^^^^ prüft JWT Token
```

### Wallet-Signatur Flow

```
1. User → GET /api/auth/nonce?address=0x123
   Backend → Generiert Nonce, speichert in DB
   
2. User → Signiert Message mit MetaMask:
   Message: "Sign this message...\nNonce: abc123..."
   Signature: "0x456def..."
   
3. User → POST /api/auth/login-wallet
   Body: { address, signature }
   Backend → Verifiziert Signature mit ethers.verifyMessage()
   Backend → Gibt JWT Token zurück
   
4. User → Nutzt JWT für alle weiteren Requests
```

---

## 📊 Aktueller Zustand

### ✅ Was funktioniert
- Health Check
- Kaspa Stats API
- Products API (GET)
- Events & Bookings (mit Auth)
- Orders System (Swap)
- Payments (NOWPayments Integration)

### ⚠️ Was problematisch ist
- **Wallet-Auth speichert in falschen Spalten**
- Email/Password Login kollidiert mit Wallet-Auth
- Keine klare Trennung zwischen Auth-Methoden
- Username wird in `password` Spalte gespeichert (unsicher!)

### ❌ Was fehlt
- Frontend für Wallet-Registrierung
- Frontend für Wallet-Login
- Dashboard zur Verwaltung
- Benutzerfreundliche UI

---

## 🚨 Problem & Lösung

### PROBLEM
```javascript
// ❌ AKTUELL: Wallet-Adresse in email Spalte
POST /api/auth/user
{
  "address": "0x123abc",
  "username": "max"
}

→ INSERT INTO users (email, password) VALUES ('0x123abc', 'max')
```

**Folgen:**
1. Login mit Email funktioniert nicht: `WHERE email = '0x123abc'` ❌
2. Wallet-Adresse wird als "Email" behandelt
3. Username steht in `password` Spalte → Sicherheitsrisiko!

### ✅ LÖSUNG

**Option A: Eigene Spalten (EMPFOHLEN)**
```sql
ALTER TABLE users 
  ADD COLUMN wallet_address VARCHAR(255) UNIQUE,
  ADD COLUMN username VARCHAR(100) UNIQUE;

-- Daten migrieren
UPDATE users 
SET wallet_address = email, 
    username = password 
WHERE email LIKE '0x%';
```

**Option B: Zwei getrennte User-Typen**
```sql
ALTER TABLE users ADD COLUMN auth_type VARCHAR(20) DEFAULT 'email';
-- auth_type: 'email' oder 'wallet'
```

---

## 🎯 Nächste Schritte

Siehe: `FRONTEND_INTEGRATION_PLAN.md`

1. DB Schema fixen
2. Auth Routes aufräumen
3. Frontend Wallet-Connect bauen
4. Dashboard erstellen
5. Testing

---

**Erstellt**: 2025-12-09  
**Version**: 1.0  
**Server**: Ubuntu @ 157.173.222.140:8130
