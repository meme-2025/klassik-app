# Klassik Backend - Production Ready

Vollständiges Backend für die Klassik Cross-Chain Swap & Shop Plattform.

## 🚀 Features

### ✅ Authentifizierung
- **Email/Passwort Auth** mit bcrypt Hashing
- **Wallet-basierte Auth** mit Ethereum Signatur-Verifizierung
- **JWT Tokens** mit konfigurierbarer Expiry
- Einheitliche Token-Struktur
- Input-Validierung (Email-Format, Passwort-Stärke)

### ✅ Cross-Chain Swaps
- **ETH ↔ KASPA** Order-Erstellung
- Escrow-basiertes Deposit-System
- **Blockchain Watcher** für automatische Deposit-Erkennung
- Confirmation-Tracking
- Automatische Swap-Ausführung nach Confirmations

### ✅ E-Commerce Shop
- **Produkt-Management** (CRUD)
- Kategorien & Filter (Gaming, Mobile, Giftcards, Bundles)
- Multi-Provider-Support (internal, DingConnect, Reloadly)
- Lagerbestandsverwaltung
- **NOWPayments Integration** für Crypto-Zahlungen
- Webhook-Handler für Payment-Status-Updates

### ✅ Datenbank
- PostgreSQL mit Migrations
- Tabellen: users, events, bookings, orders, deposits, swaps, products, order_items, payments
- Automatische Timestamps
- Foreign Keys & Constraints

### ✅ Sicherheit
- JWT Secret Validation (kein unsicherer Fallback)
- Rate Limiting (Auth: 20/min, Payments: 5/min)
- Input-Validierung & Sanitization
- CORS-Konfiguration
- Keine Stack Traces in Production

## 📦 Installation

```bash
cd backend
npm install
```

## ⚙️ Konfiguration

1. Kopiere `.env.example` zu `.env`:
```bash
cp .env.example .env
```

2. Bearbeite `.env` und setze folgende **kritische** Variablen:
```bash
# Datenbank
DATABASE_URL=postgresql://klassik:password@localhost:5432/klassik

# JWT Secret (generiere mit: openssl rand -base64 32)
JWT_SECRET=dein-super-sicherer-jwt-key

# Ethereum
ETH_RPC_URL=http://127.0.0.1:8545
ESCROW_CONTRACT_ADDRESS=0x...

# NOWPayments
NOWPAYMENTS_API_KEY=dein-nowpayments-api-key
NOWPAYMENTS_IPN_SECRET=dein-ipn-secret
```

## 🗄️ Datenbank Setup

```bash
# Migrationen ausführen
npm run migrate:up

# Sample-Produkte laden
npm run seed

# Oder beides zusammen
npm run db:setup
```

## 🏃 Server starten

**Entwicklung** (mit Auto-Reload):
```bash
npm run dev
```

**Produktion**:
```bash
npm start
```

Server läuft auf `http://localhost:3000`

## 📡 API Endpoints

### Authentifizierung
```
POST   /api/auth/register          - Email/Passwort Registrierung
POST   /api/auth/login             - Email/Passwort Login
POST   /api/auth/user              - Wallet-Registrierung
GET    /api/auth/user?address=0x.. - User per Wallet-Adresse abrufen
```

### Produkte
```
GET    /api/products                - Alle Produkte (mit Filtern)
GET    /api/products/:id            - Einzelnes Produkt
GET    /api/products/categories     - Kategorien
GET    /api/products/countries      - Länder
POST   /api/products                - Neues Produkt (Auth)
PUT    /api/products/:id            - Produkt aktualisieren (Auth)
DELETE /api/products/:id            - Produkt deaktivieren (Auth)
```

### Orders (Cross-Chain Swaps)
```
POST   /api/orders                  - Neue Order erstellen (Auth)
GET    /api/orders                  - Eigene Orders auflisten (Auth)
GET    /api/orders/:id              - Order-Details (Auth)
```

### Payments
```
POST   /api/payments/invoice        - NOWPayments Invoice erstellen (Auth)
POST   /api/payments/webhook        - NOWPayments IPN Webhook (Public)
GET    /api/payments/:orderId       - Payment-Status (Auth)
```

### Events & Bookings
```
GET    /api/events                  - Alle Events
POST   /api/events                  - Event erstellen (Auth)
POST   /api/bookings                - Buchung erstellen (Auth)
GET    /api/bookings/user/:userId   - User-Buchungen (Auth)
```

## 🔐 Authentifizierung

**Email/Passwort Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123"}'
```

**Geschützte Endpoints nutzen:**
```bash
curl http://localhost:3000/api/orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🛠️ Verfügbare Scripts

```bash
npm start         # Server starten (Production)
npm run dev       # Server mit Nodemon (Development)
npm run migrate:up     # DB-Migrationen ausführen
npm run migrate:down   # Letzte Migration zurückrollen
npm run migrate:create # Neue Migration erstellen
npm run seed      # Sample-Produkte laden
npm run db:setup  # Migrationen + Seed zusammen
```

## 🧪 Testen

**Health Check:**
```bash
curl http://localhost:3000/health
```

**Produkte abrufen:**
```bash
curl http://localhost:3000/api/products
```

## 📂 Projekt-Struktur

```
backend/
├── src/
│   ├── index.js              # Main server
│   ├── db.js                 # PostgreSQL connection
│   ├── watcher.js            # Blockchain event listener
│   ├── controllers/
│   │   ├── auth.js           # Wallet auth (nonce, signin)
│   │   ├── orders.js         # Cross-chain orders
│   │   ├── products.js       # Product CRUD
│   │   └── payments.js       # NOWPayments integration
│   ├── routes/
│   │   ├── auth.js           # Email/password auth
│   │   ├── events.js         # Event routes
│   │   └── bookings.js       # Booking routes
│   └── middleware/
│       ├── auth.js           # JWT verification
│       ├── rateLimit.js      # Rate limiting
│       └── validation.js     # Input validation
├── migrations/
│   ├── 000_initial.js        # Initial schema
│   └── 001_add_products.js   # Products, payments tables
├── scripts/
│   └── seed-products.js      # Sample data
├── .env.example              # Environment template
└── package.json
```

## 🚢 Deployment

Siehe [DEPLOYMENT.md](DEPLOYMENT.md) für detaillierte Deployment-Anleitung (Ubuntu, nginx, systemd, TLS).

**Quick Deployment:**
```bash
# Auf Server
git clone <repo>
cd backend
npm ci --production
cp .env.example /etc/klassik/klassik.env
# .env bearbeiten mit sicheren Werten
npm run migrate:up
npm start
```

## 🔧 Umgebungsvariablen

Siehe [.env.example](.env.example) für alle verfügbaren Variablen.

**Kritisch für Produktion:**
- `JWT_SECRET` - Generiere mit `openssl rand -base64 32`
- `DATABASE_URL` - PostgreSQL Connection String
- `NOWPAYMENTS_API_KEY` - Von nowpayments.io
- `ESCROW_CONTRACT_ADDRESS` - Deployed Contract Address
- `HOT_WALLET_PRIVATE_KEY` - Für Swap-Execution (NIEMALS committen!)

## 📝 Changelog

### Version 1.0.0 (Production Ready)
- ✅ Vollständige Authentifizierung (Email + Wallet)
- ✅ Produkt-Management mit Filtern
- ✅ NOWPayments Integration
- ✅ Blockchain Watcher für Deposits
- ✅ Rate Limiting & Input-Validierung
- ✅ Migrations & Seed-Scripts
- ✅ Production-ready Error-Handling

## 🤝 Support

Bei Fragen oder Problemen, siehe [DEPLOYMENT.md](DEPLOYMENT.md) oder erstelle ein Issue.

---

**🎵 Klassik Backend - Ready for Production!**
