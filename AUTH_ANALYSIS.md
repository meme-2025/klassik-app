# 🔐 KLASSIK AUTH-SYSTEM ANALYSE

## **ZUSAMMENFASSUNG**

Das Klassik-System nutzt ein **WALLET-ONLY AUTHENTICATION** System mit folgenden Features:

### ✅ **Authentifizierungs-Flow**
1. **Wallet Connection**: MetaMask/Kaspium
2. **Nonce Generation**: Server generiert Signing-Nonce
3. **Wallet Signature**: User signiert Nachricht mit Private Key
4. **JWT Token**: Backend verifiziert Signatur → erstellt JWT (7 Tage gültig)
5. **Protected Routes**: Middleware prüft `Authorization: Bearer <token>`

---

## **1. BACKEND AUTHENTIFIZIERUNG**

### **Dateien:**
- `backend/src/routes/auth.js` (415 Zeilen) - Registration/Login
- `backend/src/middleware/auth.js` (45 Zeilen) - JWT Verification
- `backend/src/middleware/enhanced-rate-limit.js` - Rate Limiting

### **Auth Flow Details:**

#### **1.1 Registration (Sacrifice-Based)**
```javascript
POST /api/auth/register
Body: { address, signature, username, sacrificeProof }

// Prüft:
- Wallet-Signatur verifiziert
- Sacrifice-Transaktion >= $100 in Kaspa (KRC20)
- Username 3-30 Zeichen, alphanumerisch
- Wallet noch nicht registriert

// Response:
{
  token: "eyJhbGciOiJIUzI1NiIsInR...",
  user: { id, username, address },
  expiresIn: "7d"
}
```

#### **1.2 Login**
```javascript
POST /api/auth/login
Body: { address, signature }

// Verifiziert Wallet-Signatur
// Response: JWT Token
```

#### **1.3 Protected Routes**
```javascript
// middleware/auth.js
module.exports = (req, res, next) => {
  const auth = req.headers.authorization;
  
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }
  
  const token = auth.split(' ')[1];
  const payload = jwt.verify(token, JWT_SECRET);
  
  req.user = {
    userId: payload.userId,
    address: payload.address
  };
  
  next();
};
```

---

## **2. RATE LIMITING**

### **Problem: HTTP 429 Errors während Testing**

**Ursache:** Enhanced Rate Limiting in `enhanced-rate-limit.js`

### **Aktuelle Limits:**

| Route Type | Window | Max Requests | Grund |
|-----------|--------|--------------|-------|
| **Blockchain API** | 1 Minute | 60 | Kaspa Explorer Queries |
| **Authentication** | 15 Minuten | 10 | Brute-Force Schutz |
| **Registration** | 1 Stunde | 3 | Spam Prevention |
| **Payment** | 5 Minuten | 5 | Payment Spam |
| **Admin** | 1 Minute | 30 | Admin Operations |
| **General** | 15 Minuten | 100 | Base Protection |

### **Blockchain Limiter Code:**
```javascript
const blockchainLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 Minute
  max: 60, // Max 60 Requests = 1/Sekunde
  message: {
    error: 'Blockchain API rate limit exceeded',
    retryAfter: 'Please reduce request frequency'
  },
  handler: (req, res) => {
    console.warn(`⚠️ Blockchain API limit exceeded: ${req.ip}`);
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many blockchain queries. Maximum 60 requests per minute.',
      retryAfter: Math.ceil(req.rateLimit.resetTime.getTime() / 1000)
    });
  }
});
```

### **Angewandt auf:**
```javascript
app.use('/api/kaspa', blockchainLimiter, kaspaRoutes);
app.use('/api/kaspa-enhanced', blockchainLimiter, kaspaEnhancedRoutes);
```

### **Problem bei Testing:**
- Live-Mode: 100ms Polling = 600 Requests/Minute ❌
- Normale Updates: 10s Polling = 6 Requests/Minute ✅
- Stats: 30s Polling = 2 Requests/Minute ✅

### **Lösung:**
- **Authentifizierte User:** Höhere Limits (120-180/min)
- **Unauthentifizierte User:** Niedrigere Limits (30-60/min)
- **Admin/Premium:** Unlimited oder 300/min

---

## **3. FRONTEND AUTHENTIFIZIERUNG**

### **Dateien:**
- `frontend/assets/js/auth.js` (368 Zeilen) - Wallet Auth Flow
- `frontend/assets/js/wallet-auth.js` (200 Zeilen) - Simplified Auth

### **3.1 Wallet Connection Flow:**

```javascript
// 1. Connect MetaMask
const accounts = await window.ethereum.request({ 
  method: 'eth_requestAccounts' 
});
connectedWallet = accounts[0];

// 2. Check Registration
const checkRes = await fetch(`/api/auth/check?address=${address}`);

// 3a. If registered → Login
if (checkRes.ok) {
  await performWalletSignIn(address);
}

// 3b. If not registered → Show Registration
else {
  showWalletRegistration(address);
}
```

### **3.2 Signature & JWT Flow:**

```javascript
// Step 1: Get Nonce
const nonceRes = await fetch(`/api/auth/nonce?address=${address}`);
const { nonce, message } = await nonceRes.json();

// Step 2: Sign Message
const signature = await window.ethereum.request({
  method: 'personal_sign',
  params: [message, address]
});

// Step 3: Login/Register
const authRes = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address, signature })
});

const { token, user } = await authRes.json();

// Step 4: Store Token
localStorage.setItem('klassik_token', token);
localStorage.setItem('klassik_user', JSON.stringify(user));
```

### **3.3 Token Storage:**
```javascript
// LocalStorage:
localStorage.setItem('klassik_token', token);        // JWT
localStorage.setItem('klassik_user', JSON.stringify(user)); // User Info

// User Object:
{
  id: 123,
  username: "satoshi",
  address: "0x2a04b64d4641cda7271289d2da6bbf27de02d823",
  created_at: "2026-01-05T..."
}
```

---

## **4. AKTUELL: KASPA EXPLORER API UNGESCHÜTZT**

### **Problem:**
```javascript
// backend/src/index.js
app.use('/api/kaspa-enhanced', blockchainLimiter, kaspaEnhancedRoutes);
//                            ❌ KEIN authMiddleware!
```

**Alle können zugreifen:**
- `/api/kaspa-enhanced/stats` → Network Stats
- `/api/kaspa-enhanced/blocks/latest` → Latest Blocks
- `/api/kaspa-enhanced/transactions/latest` → Latest TXs
- `/api/kaspa-enhanced/address/:address` → Address Lookup
- `/api/kaspa-enhanced/block/:hash` → Block Lookup
- `/api/kaspa-enhanced/transaction/:hash` → Transaction Lookup

### **User Requirement:**
> "es dürfen nur registrierte nutzer über meine webseite die auch engemeldet sind die backend, bzw den explorer bzw die api benutzen"

**Bedeutet:**
- ✅ Nur eingeloggte User
- ✅ JWT Token required
- ❌ Kein Public Access

---

## **5. LÖSUNG: AUTH-MIDDLEWARE HINZUFÜGEN**

### **5.1 Backend: kaspa-enhanced.js schützen**

```javascript
// backend/src/index.js

// VORHER:
app.use('/api/kaspa-enhanced', blockchainLimiter, kaspaEnhancedRoutes);

// NACHHER:
const authMiddleware = require('./middleware/auth');
app.use('/api/kaspa-enhanced', authMiddleware, blockchainLimiter, kaspaEnhancedRoutes);
```

### **5.2 Frontend: JWT Token in alle Requests**

```javascript
// kaspa-explorer.js - Alle fetchNetworkInfo/fetchBlocks/etc. Calls

async function fetchNetworkInfo() {
  const token = localStorage.getItem('klassik_token');
  
  const response = await fetch(`${API_CONFIG.BACKEND_URL}/stats`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (response.status === 401) {
    // Token abgelaufen oder ungültig
    showLoginPrompt();
    return null;
  }
  
  return await response.json();
}
```

### **5.3 Error Handling für Unauthorized**

```javascript
// Wenn 401 Unauthorized:
if (!token || response.status === 401) {
  // Zeige Login-Prompt
  document.getElementById('explorerContent').style.display = 'none';
  document.getElementById('loginPrompt').style.display = 'block';
  document.getElementById('loginPrompt').innerHTML = `
    <h2>🔐 Login Required</h2>
    <p>Please connect your wallet to access the Kaspa Explorer</p>
    <button onclick="window.location.href='index.html'">
      Go to Login
    </button>
  `;
}
```

---

## **6. RATE LIMITING FÜR AUTHENTICATED USERS**

### **Problem:**
- Live-Mode: 600 Requests/Min → 429 Error
- Blockchain Limiter: 60 Requests/Min

### **Lösung: Dynamic Rate Limiting basierend auf Auth**

```javascript
// middleware/enhanced-rate-limit.js

// Authenticated Users: Höhere Limits
const authenticatedBlockchainLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 180, // 3x höher für eingeloggte User
  skip: (req) => !req.user, // Nur für authenticated
  message: { error: 'Authenticated rate limit exceeded' }
});

// Unauthenticated Users: Niedrigere Limits
const publicBlockchainLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30, // Niedriger für public
  skip: (req) => !!req.user, // Nur für unauthenticated
  message: { error: 'Public API limit exceeded. Please login for higher limits.' }
});

// Apply both
router.use(authenticatedBlockchainLimiter);
router.use(publicBlockchainLimiter);
```

---

## **7. SACRIFICE-BASIERTE REGISTRIERUNG**

### **Was ist ein "Sacrifice"?**

User müssen eine **Kaspa-Transaktion (KRC20)** von mindestens **1 KAS** an die Klassik-Adresse senden, um sich zu registrieren.

### **Flow:**
```javascript
POST /api/auth/check-sacrifice
Body: { kaspaAddress, ethAddress }

// Backend prüft:
1. Kaspa Blockchain nach Transaktionen
2. Mindestbetrag: 1 KAS (100 Points)
3. An Klassik Sacrifice Wallet gesendet
4. Bestätigt (confirmations >= 10)

// Response:
{
  eligible: true,
  totalSacrificed: 1.5, // KAS
  currentPoints: 150,
  requiredPoints: 100,
  transactions: [
    { txHash, amount, timestamp }
  ]
}
```

### **Registration mit Sacrifice:**
```javascript
POST /api/auth/register
Body: {
  address: "0x...",              // Ethereum Wallet
  signature: "0x...",            // Wallet Signature
  username: "satoshi",
  kaspaAddress: "kaspa:qz...",   // Kaspa Wallet Address
  nonce: "abc123..."             // Nonce from /api/auth/nonce
}

// Backend:
1. Verifiziert Wallet-Signatur (Ethereum)
2. Prüft Sacrifice-Transaktion (Kaspa Blockchain)
   - Mindestens 1 KAS an Sacrifice Address
   - Mindestens 100 Points
3. Erstellt User
4. Gibt JWT zurück
```

### **Controller:**
`backend/src/controllers/sacrifice-auth.js`

---

## **8. DEPLOYMENT PLAN**

### **Files to Update:**

#### **Backend (auf Server):**
```bash
/opt/klassik/backend/src/index.js
# Füge authMiddleware zu kaspa-enhanced hinzu

/opt/klassik/backend/src/routes/kaspa-enhanced.js
# Bereits aktualisiert (CoinGecko fallback)
```

#### **Frontend (auf Server):**
```bash
/opt/klassik/frontend/assets/js/kaspa-explorer.js
# Füge JWT-Token zu allen API-Calls hinzu

/opt/klassik/frontend/assets/js/realtime-updates.js
# NEW FILE - Live Mode mit JWT

/opt/klassik/frontend/kaspa-explorerv5.21.html
# Live-Mode Button + Login-Prompt
```

### **SCP Upload Commands:**
```powershell
$KEY = "C:\Users\TUF-s\.ssh\id_ed25519_new"
$SERVER = "admxn@192.168.2.148"

# Backend
scp -i $KEY C:\Users\TUF-s\Desktop\git\Klassik\backend\src\index.js $SERVER:/opt/klassik/backend/src/

# Frontend
scp -i $KEY C:\Users\TUF-s\Desktop\git\Klassik\frontend\assets\js\kaspa-explorer.js $SERVER:/opt/klassik/frontend/assets/js/
scp -i $KEY C:\Users\TUF-s\Desktop\git\Klassik\frontend\assets\js\realtime-updates.js $SERVER:/opt/klassik/frontend/assets/js/
scp -i $KEY C:\Users\TUF-s\Desktop\git\Klassik\frontend\kaspa-explorerv5.21.html $SERVER:/opt/klassik/frontend/
```

---

## **9. TESTING CHECKLIST**

### **Pre-Deployment:**
- [ ] Backend: authMiddleware zu kaspa-enhanced hinzugefügt
- [ ] Frontend: JWT-Token in alle API-Calls
- [ ] Frontend: 401 Error Handling (Login-Prompt)
- [ ] Rate Limiting angepasst (höhere Limits für authenticated)

### **Post-Deployment:**
- [ ] Login Flow: MetaMask → Signature → JWT
- [ ] Kaspa Explorer: Stats laden mit Token
- [ ] Kaspa Explorer: Blocks laden mit Token
- [ ] Kaspa Explorer: Transactions laden mit Token
- [ ] Search: Address/Block/TX mit Token
- [ ] Live-Mode: 100ms Polling funktioniert (kein 429)
- [ ] Logout: Token cleared, 401 Error erscheint
- [ ] CSP: Keine Violations mehr

---

## **10. WICHTIGE ENV VARIABLES**

```bash
# /etc/klassik/klassik1.env

JWT_SECRET=<geheimer-key>           # Für Token-Signierung
JWT_EXPIRY=7d                       # Token-Gültigkeit

KASPA_REST_SERVER=http://localhost:8080  # Lokale Node
ADMIN_WALLETS=0x2a04b64d4641cda7271289d2da6bbf27de02d823

RATE_LIMIT_WHITELIST=127.0.0.1,192.168.2.1  # IPs ohne Limit
```

---

## **ZUSAMMENFASSUNG FÜR USER**

### **Warum 429 Errors?**
- Blockchain API Rate Limit: 60 Requests/Minute
- Live-Mode macht 600 Requests/Minute (100ms polling)
- **Lösung:** Höhere Limits für eingeloggte User

### **Warum Auth für Explorer?**
- User-Anforderung: "nur registrierte nutzer"
- Schutz vor API-Missbrauch
- **Sacrifice-System:** $100 USD in Kaspa für Registration
1 KAS für Registration

### **Welche Technologien?**
- ✅ **Wallet Auth**: MetaMask, Kaspium (Ethereum-kompatibel)
- ✅ **JWT Tokens**: 7 Tage Gültigkeit
- ✅ **Kaspa Sacrifice**: 1 KAS = 100 Points (Minimum: 100 Points)
- ✅ **Redis Cache**: Für Performance (optional)

### **Nächste Schritte:**
1. Auth-Middleware zu kaspa-enhanced.js hinzufügen
2. Frontend: JWT-Token in API-Calls einfügen
3. Rate Limits für authenticated users erhöhen
4. Alle Dateien auf Server deployen
5. End-to-End testen

---

**Status:** ✅ Analyse komplett | ⚠️ Implementation pending
