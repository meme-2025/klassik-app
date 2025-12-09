# 🔐 Wallet Authentication Guide

## 📋 Übersicht der Änderungen

### ✅ Was wurde geändert:

1. **Backend Auth Routes** (`backend/src/routes/auth.js`)
   - ✨ Neue Endpoints für Wallet-Auth hinzugefügt
   - 🔧 Angepasst für existierende `users` Tabelle (id, email, password, created_at)
   - 🔐 Vollständige Wallet-Signatur-Verifikation implementiert

2. **Datenbank Support** (`backend/add-wallet-support.sql`)
   - 📊 Migration zum Hinzufügen von `address` Spalte
   - 🗄️ `nonces` Tabelle für Wallet-Auth erstellt
   - ✅ Kompatibel mit existierender Struktur

3. **Frontend Wallet Module** (`frontend/assets/js/wallet-auth.js`)
   - 👛 MetaMask Integration
   - ✍️ Message Signing Flow
   - 🔄 Auto-Registration bei nicht-registrierten Wallets

4. **Test Scripts**
   - `test-wallet-auth.ps1` - Testet alle Auth-Flows
   - `check-schema.js` - Prüft Datenbankstruktur

---

## 🎯 Wie funktioniert Wallet Authentication?

### Flow Diagramm:

```
┌─────────────────────────────────────────────────────────────┐
│                    WALLET AUTHENTICATION                     │
└─────────────────────────────────────────────────────────────┘

┌──────────┐         ┌──────────┐         ┌──────────┐
│ Frontend │         │ Backend  │         │ Database │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                     │
     │ 1. GET /nonce      │                     │
     ├───────────────────>│                     │
     │    ?address=0x...  │                     │
     │                    │ 2. Generate Nonce   │
     │                    ├────────────────────>│
     │                    │    Store in DB      │
     │ 3. Nonce + Message │                     │
     │<───────────────────┤                     │
     │                    │                     │
     │ 4. User signs      │                     │
     │    message in      │                     │
     │    MetaMask        │                     │
     │                    │                     │
     │ 5. POST /register  │                     │
     │    or /login       │                     │
     ├───────────────────>│                     │
     │ { address,         │                     │
     │   signature }      │ 6. Verify Signature │
     │                    ├────────────────────>│
     │                    │    Check Nonce      │
     │                    │                     │
     │                    │ 7. Create/Find User │
     │                    ├────────────────────>│
     │                    │                     │
     │ 8. JWT Token       │                     │
     │<───────────────────┤                     │
     │                    │                     │
```

### Detaillierter Ablauf:

#### **REGISTER mit Wallet:**

1. **Frontend:** User klickt "Sign in with Wallet"
2. **Frontend → Backend:** `GET /api/auth/nonce?address=0x742d35Cc...`
3. **Backend:** Generiert zufälligen Nonce und speichert in DB
   ```javascript
   nonce = crypto.randomBytes(32).toString('hex');
   message = `Sign this message to authenticate with Klassik:\n\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
   ```
4. **Backend → Frontend:** Sendet Nonce und Message zurück
5. **Frontend:** Öffnet MetaMask mit der Message
6. **User:** Signiert die Message in MetaMask
7. **Frontend → Backend:** `POST /api/auth/register-wallet`
   ```json
   {
     "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
     "signature": "0x...",
     "email": "user@example.com" // optional
   }
   ```
8. **Backend:** 
   - Verifiziert Signatur mit `ethers.utils.verifyMessage()`
   - Prüft ob Wallet bereits registriert
   - Erstellt neuen User in DB
   - Generiert JWT Token
9. **Backend → Frontend:** Sendet Token und User-Daten
10. **Frontend:** Speichert Token in localStorage

#### **LOGIN mit Wallet:**

Gleicher Ablauf wie Register, aber:
- Verwendet `POST /api/auth/login-wallet`
- Prüft ob User existiert (anstatt zu erstellen)
- Gibt Fehler wenn Wallet nicht registriert

---

## 🔧 API Endpunkte

### 1. **GET /api/auth/nonce**
Generiert einen Nonce für Wallet-Signatur

**Query Parameters:**
- `address` (required): Ethereum Wallet-Adresse

**Response:**
```json
{
  "nonce": "a1b2c3d4e5f6...",
  "message": "Sign this message to authenticate with Klassik:\n\nNonce: a1b2c3d4...\nTimestamp: 2025-12-09T10:30:00.000Z",
  "expiresAt": "2025-12-09T10:40:00.000Z"
}
```

**Beispiel:**
```bash
curl "http://localhost:3000/api/auth/nonce?address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
```

---

### 2. **POST /api/auth/register-wallet**
Registriert neuen User mit Wallet-Signatur

**Body:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "signature": "0x1234567890abcdef...",
  "email": "user@example.com"  // optional
}
```

**Response (Success 201):**
```json
{
  "message": "Wallet registered successfully",
  "user": {
    "id": 1,
    "address": "0x742d35cc6634c0532925a3b844bc9e7595f0beb",
    "email": "user@example.com",
    "created_at": "2025-12-09T10:30:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "7d"
}
```

**Response (Error 409):**
```json
{
  "error": "Wallet already registered",
  "user": { ... }
}
```

---

### 3. **POST /api/auth/login-wallet**
Login mit Wallet-Signatur

**Body:**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "signature": "0x1234567890abcdef..."
}
```

**Response (Success 200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "address": "0x742d35cc6634c0532925a3b844bc9e7595f0beb",
    "email": "user@example.com",
    "created_at": "2025-12-09T10:30:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "7d"
}
```

**Response (Error 404):**
```json
{
  "error": "Wallet not registered. Please register first.",
  "needsRegistration": true
}
```

---

### 4. **POST /api/auth/register** (Email/Password)
Klassische Registrierung mit Email und Passwort

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

---

### 5. **POST /api/auth/login** (Email/Password)
Klassischer Login mit Email und Passwort

**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

---

## 🗄️ Datenbank Schema

### Users Tabelle (aktuell):
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255),
  password VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Migration für Wallet Support:
```sql
-- 1. Spalte für Wallet-Adresse hinzufügen
ALTER TABLE users ADD COLUMN address VARCHAR(42);
CREATE INDEX idx_users_address ON users(LOWER(address));

-- 2. password kann NULL sein (für Wallet-only Users)
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- 3. Constraint: Entweder Email+Password ODER Wallet
ALTER TABLE users ADD CONSTRAINT users_auth_method_check 
  CHECK (
    (email IS NOT NULL AND password IS NOT NULL) OR 
    (address IS NOT NULL)
  );
```

### Nonces Tabelle (neu):
```sql
CREATE TABLE nonces (
  address VARCHAR(42) PRIMARY KEY,
  nonce VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nonces_expires_at ON nonces(expires_at);
```

---

## 🚀 Setup Schritte

### 1. Datenbank Migration ausführen

**Auf Ubuntu Server:**
```bash
cd ~/klassik/backend

# Prüfe aktuelle Struktur
node check-schema.js

# Füge Wallet-Support hinzu
psql -U klassik -d klassik -f add-wallet-support.sql

# Oder via Node
node -e "
const db = require('./src/db');
const fs = require('fs');
const sql = fs.readFileSync('add-wallet-support.sql', 'utf8');
db.query(sql).then(() => {
  console.log('✅ Migration complete');
  process.exit(0);
}).catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
"
```

### 2. Backend neu starten

```bash
pm2 restart klassik-backend
# oder
npm start
```

### 3. Frontend aktualisieren

Füge in `index.html` **vor** `</body>` hinzu:
```html
<!-- Ethers.js für Wallet-Signatur -->
<script src="https://cdn.ethers.io/lib/ethers-5.7.umd.min.js"></script>

<!-- Wallet Auth Module -->
<script src="/assets/js/wallet-auth.js"></script>
```

### 4. Wallet-Buttons hinzufügen

In Login/Register Modals:
```html
<!-- In Login Modal -->
<button id="walletLoginBtn" onclick="handleWalletLogin()">
  🦊 Sign in with Wallet
</button>

<!-- In Register Modal -->
<button id="walletRegisterBtn" onclick="handleWalletRegister()">
  🦊 Register with Wallet
</button>
```

---

## 🧪 Testing

### PowerShell Test (Backend):
```powershell
cd C:\Users\TUF-s\Desktop\git\Klassik
.\test-wallet-auth.ps1
```

### Browser Test (Frontend):
1. Öffne Frontend: `http://localhost:3000`
2. Stelle sicher MetaMask ist installiert
3. Klicke "Sign in with Wallet"
4. Bestätige in MetaMask
5. Du bist eingeloggt!

### Manual API Test:
```bash
# 1. Nonce abrufen
curl "http://localhost:3000/api/auth/nonce?address=0xYourAddress"

# 2. Message in MetaMask signieren (Browser Console):
const signer = new ethers.providers.Web3Provider(window.ethereum).getSigner();
const message = "Sign this message..."; // von Schritt 1
const signature = await signer.signMessage(message);
console.log(signature);

# 3. Register oder Login
curl -X POST http://localhost:3000/api/auth/register-wallet \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0xYourAddress",
    "signature": "0x..."
  }'
```

---

## 🔒 Sicherheit

### Nonce Expiry
- Nonces sind 10 Minuten gültig
- Nach Verwendung werden sie gelöscht
- Alte Nonces werden nicht akzeptiert

### Signatur-Verifikation
```javascript
// Backend verifiziert mit ethers.js:
const recoveredAddress = ethers.utils.verifyMessage(message, signature);
if (recoveredAddress.toLowerCase() !== userAddress.toLowerCase()) {
  throw new Error('Invalid signature');
}
```

### JWT Token
- 7 Tage Gültigkeit (konfigurierbar)
- Enthält: userId, email, address
- Signiert mit JWT_SECRET

---

## 📊 User Flow Beispiele

### Beispiel 1: Neuer User mit Wallet
```
1. User kommt auf die Seite
2. Klickt "Sign in with Wallet"
3. MetaMask öffnet sich → Connect
4. Backend: Nonce generieren
5. MetaMask: Message signieren
6. Backend: Wallet nicht gefunden → Auto-Register
7. User ist eingeloggt ✅
```

### Beispiel 2: Bestehender Wallet-User
```
1. Klickt "Sign in with Wallet"
2. MetaMask: Message signieren
3. Backend: Wallet gefunden → Login
4. User ist eingeloggt ✅
```

### Beispiel 3: Email-User will Wallet hinzufügen
```
1. Bereits mit Email eingeloggt
2. Klickt "Link Wallet" (in Profil)
3. MetaMask: Signieren
4. Backend: UPDATE users SET address = ... WHERE id = currentUserId
5. User kann nun mit beiden Methoden einloggen ✅
```

---

## 🐛 Troubleshooting

### Problem: "Nonce not found"
**Lösung:** Nonce vorher mit GET /nonce abrufen

### Problem: "Invalid signature"
**Lösung:** 
- Exakte Message verwenden
- MetaMask muss auf richtiger Chain sein
- Keine extra Zeichen in der Message

### Problem: "Wallet already registered"
**Lösung:** Verwende `/login-wallet` statt `/register-wallet`

### Problem: MetaMask nicht erkannt
**Lösung:**
```javascript
if (!window.ethereum) {
  alert('Please install MetaMask!');
  window.open('https://metamask.io/download/');
}
```

---

## 📝 Zusammenfassung

### ✅ Was du jetzt hast:

1. **Dual Auth System**: Email/Password UND Wallet
2. **Secure Wallet Auth**: Mit Signatur-Verifikation
3. **Flexible User Model**: Unterstützt beide Auth-Methoden
4. **Production Ready**: Mit Rate Limiting, Error Handling, etc.

### 🎯 Alle Endpoints:

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/api/auth/nonce` | Nonce für Wallet-Sign abrufen |
| POST | `/api/auth/register-wallet` | Mit Wallet registrieren |
| POST | `/api/auth/login-wallet` | Mit Wallet einloggen |
| POST | `/api/auth/register` | Mit Email/Password registrieren |
| POST | `/api/auth/login` | Mit Email/Password einloggen |
| GET | `/api/auth/test` | Auth-System Status |

---

**Ready to go! 🚀**
