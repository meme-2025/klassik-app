# 🔐 WALLET AUTH SYSTEM - KOMPLETTE DOKUMENTATION

## 📋 INHALTSVERZEICHNIS
1. [Wie funktioniert der Login?](#login-flow)
2. [JWT Token Erstellung](#jwt-creation)
3. [JWT Token Nutzung](#jwt-usage)
4. [Dashboard Funktionsweise](#dashboard)
5. [API Calls mit Authentication](#api-calls)
6. [Code-Beispiele](#examples)

---

## 🔑 1. WIE FUNKTIONIERT DER LOGIN? <a name="login-flow"></a>

### Schritt-für-Schritt Ablauf:

```
┌──────────────────┐
│  User klickt     │
│  "Login" Button  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  MetaMask öffnet │
│  sich → User     │
│  verbindet Wallet│
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  App erhält      │
│  Wallet-Adresse  │
│  (0x123...)      │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────┐
│  Backend Check:              │
│  "Ist Wallet registriert?"   │
│  GET /api/auth/check?address │
└────────┬─────────────────────┘
         │
    ┌────┴────┐
    │ WENN    │
    └────┬────┘
         │
    ┌────┴────────────────────┐
    │ REGISTRIERT             │
    │ → Zeige Login Flow      │
    └────┬────────────────────┘
         │
         ▼
    ┌────────────────────────┐
    │ 1. Nonce holen         │
    │ GET /api/auth/nonce    │
    └────┬───────────────────┘
         │
         ▼
    ┌────────────────────────┐
    │ 2. Message signieren   │
    │ MetaMask → Signature   │
    └────┬───────────────────┘
         │
         ▼
    ┌────────────────────────┐
    │ 3. Login Request       │
    │ POST /api/auth/login   │
    │ + signature            │
    └────┬───────────────────┘
         │
         ▼
    ┌────────────────────────┐
    │ 4. JWT Token erhalten  │
    │ + User Daten           │
    └────┬───────────────────┘
         │
         ▼
    ┌────────────────────────┐
    │ 5. In localStorage     │
    │ speichern              │
    └────┬───────────────────┘
         │
         ▼
    ┌────────────────────────┐
    │ 6. UI Update           │
    │ → "Angemeldet"         │
    └────────────────────────┘
```

---

## 🎟️ 2. JWT TOKEN ERSTELLUNG <a name="jwt-creation"></a>

### Backend Code (auth.js):

```javascript
// In backend/src/controllers/auth.js

const jwt = require('jsonwebtoken');

// JWT erstellen
const token = jwt.sign(
  {
    userId: 42,                    // User ID aus DB
    address: "0x1234...abcd"       // Wallet Adresse
  },
  process.env.JWT_SECRET,          // Geheimer Schlüssel (NUR Server kennt!)
  { expiresIn: '24h' }             // Gültigkeit: 24 Stunden
);

// Resultat: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQ..."
```

### Was passiert intern?

```
1. HEADER erstellen:
   {
     "alg": "HS256",        // Algorithmus: HMAC-SHA256
     "typ": "JWT"           // Type: JWT
   }
   → Base64 encode → "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"

2. PAYLOAD erstellen:
   {
     "userId": 42,
     "address": "0x1234...",
     "iat": 1702812345,     // Issued At (Zeitstempel)
     "exp": 1702898745      // Expires (24h später)
   }
   → Base64 encode → "eyJ1c2VySWQiOjQyLCJhZGRyZXNzIjoi..."

3. SIGNATURE erstellen:
   HMAC-SHA256(
     base64(HEADER) + "." + base64(PAYLOAD),
     JWT_SECRET
   )
   → "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"

4. ZUSAMMENSETZEN:
   HEADER.PAYLOAD.SIGNATURE
   → "eyJhbGci...  .  eyJ1c2Vy...  .  SflKxwRJ..."
```

### Warum ist JWT sicher?

```
✅ Signatur mit SECRET:
   - Nur Server kennt den SECRET
   - Niemand kann Token fälschen
   - Änderung wird erkannt

✅ Enthält User-Info:
   - Kein DB-Zugriff nötig
   - Schnelle Verifikation
   
✅ Expiry Time:
   - Automatisches Ablaufen
   - Verhindert alten Token-Missbrauch
```

---

## 🔒 3. JWT TOKEN NUTZUNG <a name="jwt-usage"></a>

### Frontend: Token bei API-Calls senden

```javascript
// Token aus localStorage holen
const token = localStorage.getItem('klassik_token');

// API Call mit Authorization Header
const response = await fetch('/api/users/me', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// ✅ Server kann User identifizieren
const userData = await response.json();
```

### Backend: Token verifizieren

```javascript
// In backend/src/middleware/auth.js

module.exports = (req, res, next) => {
  // 1. Authorization Header lesen
  const auth = req.headers.authorization;
  
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token fehlt' });
  }
  
  // 2. Token extrahieren
  const token = auth.split(' ')[1];
  
  // 3. Token verifizieren
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    
    // 4. User-Info an Request anhängen
    req.user = {
      userId: payload.userId,
      address: payload.address
    };
    
    // 5. Weiter zur Route
    next();
    
  } catch (err) {
    // Token ungültig oder abgelaufen
    return res.status(401).json({ error: 'Ungültiger Token' });
  }
};
```

### Welche APIs brauchen Token?

```javascript
// ❌ OHNE Token (Öffentlich):
GET /api/kaspa/stats          // Blockchain Stats
GET /api/kaspa/blocks         // Blocks
GET /api/products             // Produkte auflisten

// ✅ MIT Token (Geschützt):
GET /api/users/me             // User Profile
GET /api/bookings/my          // Meine Buchungen
POST /api/orders              // Bestellung erstellen
DELETE /api/bookings/:id      // Buchung löschen
```

---

## 📊 4. DASHBOARD FUNKTIONSWEISE <a name="dashboard"></a>

### dashboard.html - Komplett erklärt:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Dashboard</title>
</head>
<body>
  <div id="userInfo">
    <span id="username">-</span>
    <span id="address">-</span>
  </div>
  
  <script>
    // === BEIM LADEN ===
    window.addEventListener('load', () => {
      
      // 1. Token aus localStorage holen
      const token = localStorage.getItem('klassik_token');
      const userStr = localStorage.getItem('klassik_user');
      
      // 2. Check: Ist User eingeloggt?
      if (!token || !userStr) {
        // NICHT eingeloggt → Redirect zu Login
        alert('Bitte erst einloggen!');
        window.location.href = 'login-main.html';
        return;
      }
      
      // 3. User Daten parsen
      const user = JSON.parse(userStr);
      
      // 4. Token-Gültigkeit prüfen
      if (!isTokenValid(token)) {
        alert('Session abgelaufen - Bitte neu einloggen');
        localStorage.clear();
        window.location.href = 'login-main.html';
        return;
      }
      
      // 5. User Daten anzeigen
      document.getElementById('username').textContent = user.username;
      document.getElementById('address').textContent = user.address;
      
      // 6. API Daten laden (mit Token!)
      loadDashboardData(token);
    });
    
    // Token Validierung
    function isTokenValid(token) {
      try {
        // Payload dekodieren (Base64)
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        // Expiry prüfen
        const expiry = payload.exp * 1000;  // Sekunden → Millisekunden
        const now = Date.now();
        
        return now < expiry;  // Noch gültig?
      } catch {
        return false;  // Fehler beim Dekodieren
      }
    }
    
    // Dashboard Daten laden
    async function loadDashboardData(token) {
      try {
        // API Call mit Token
        const response = await fetch('/api/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.status === 401) {
          // Token ungültig/abgelaufen
          alert('Session abgelaufen');
          localStorage.clear();
          window.location.href = 'login-main.html';
          return;
        }
        
        const data = await response.json();
        console.log('User Daten:', data);
        
        // Weitere Daten laden...
        
      } catch (error) {
        console.error('Fehler beim Laden:', error);
      }
    }
  </script>
</body>
</html>
```

### Dashboard MIT Login:
```
✅ Token vorhanden
✅ Token gültig
→ Zeige User Info
→ Lade persönliche Daten
→ Erlaube API Calls
→ Zeige Bookings, Orders, etc.
```

### Dashboard OHNE Login:
```
❌ Kein Token
ODER
❌ Token abgelaufen
→ Redirect zu login-main.html
→ Keine Daten geladen
```

---

## 🌐 5. API CALLS MIT AUTHENTICATION <a name="api-calls"></a>

### Beispiel 1: User Profile abrufen

```javascript
// wallet-auth-integration.js bietet diese Funktion:

const response = await window.WalletAuth.authenticatedFetch('/api/users/me');
const userProfile = await response.json();

console.log('User:', userProfile);
// { id: 42, username: "crypto_king", address: "0x123...", ... }
```

### Beispiel 2: Bestellung erstellen

```javascript
const orderData = {
  productId: 5,
  quantity: 2,
  totalPrice: 200
};

const response = await window.WalletAuth.authenticatedFetch('/api/orders', {
  method: 'POST',
  body: JSON.stringify(orderData)
});

const order = await response.json();
console.log('Order created:', order);
```

### Beispiel 3: Meine Bookings laden

```javascript
const response = await window.WalletAuth.authenticatedFetch('/api/bookings/my');
const bookings = await response.json();

bookings.forEach(booking => {
  console.log(`Event: ${booking.eventTitle}, Date: ${booking.eventDate}`);
});
```

---

## 💻 6. CODE-BEISPIELE <a name="examples"></a>

### Beispiel 1: Login Button in HTML

```html
<!-- Desktop Login -->
<button class="btn-ghost" id="loginBtn">
  <i class="fas fa-user"></i>
  <span>Login</span>
</button>

<!-- Wallet Login Button (im Modal) -->
<button id="walletLoginBtn" class="btn-outline-kaspa">
  <i class="fas fa-wallet"></i>
  <span>Login with Wallet</span>
</button>

<script>
  // wird automatisch gebunden durch wallet-auth-integration.js
</script>
```

### Beispiel 2: Login-Status prüfen

```javascript
// Irgendwo in deinem Code:

if (window.WalletAuth.isAuthenticated()) {
  console.log('✅ User ist eingeloggt');
  
  const user = window.WalletAuth.getCurrentUser();
  console.log('Username:', user.username);
  
} else {
  console.log('❌ User ist NICHT eingeloggt');
  // Optional: Zu Login weiterleiten
}
```

### Beispiel 3: Nach Login aktion ausführen

```javascript
// Custom Event Listener:

document.addEventListener('walletAuthSuccess', (event) => {
  const user = event.detail.user;
  const token = event.detail.token;
  
  console.log('🎉 Login erfolgreich!');
  console.log('User:', user.username);
  console.log('Token:', token);
  
  // Eigene Aktionen...
  loadUserDashboard();
  showWelcomeMessage();
});
```

### Beispiel 4: Logout

```javascript
// Logout Button
document.getElementById('logoutBtn').addEventListener('click', () => {
  window.WalletAuth.logout();
  // → localStorage wird geleert
  // → UI wird zurückgesetzt
  // → User sieht wieder Login-Buttons
});
```

### Beispiel 5: Geschützte Route

```javascript
// Nur für eingeloggte User zugänglich

async function loadProtectedContent() {
  if (!window.WalletAuth.isAuthenticated()) {
    alert('Bitte erst einloggen!');
    return;
  }
  
  try {
    const response = await window.WalletAuth.authenticatedFetch(
      '/api/admin/sensitive-data'
    );
    
    if (!response.ok) {
      throw new Error('Zugriff verweigert');
    }
    
    const data = await response.json();
    displayData(data);
    
  } catch (error) {
    console.error('Fehler:', error);
    alert('Fehler beim Laden der Daten');
  }
}
```

---

## 🎯 ZUSAMMENFASSUNG

### Flow im Überblick:

```
1. User → "Connect Wallet" → MetaMask
2. App erhält Wallet-Adresse
3. Check: Registriert?
   - JA: Login Flow
   - NEIN: Registration Flow

4. Nonce holen vom Server
5. Message in MetaMask signieren
6. Signature + Address an Server senden
7. Server verifiziert Signature mathematisch
8. Server erstellt JWT Token mit User-Daten
9. Token wird in localStorage gespeichert
10. Bei jedem API Call: Token im Header senden
11. Server prüft Token → erlaubt Zugriff
```

### Wichtige Funktionen:

```javascript
// Login starten
window.WalletAuth.handleWalletLogin()

// Eingeloggt prüfen
window.WalletAuth.isAuthenticated()

// Current User
window.WalletAuth.getCurrentUser()

// Token holen
window.WalletAuth.getToken()

// API Call mit Auth
window.WalletAuth.authenticatedFetch(url, options)

// Logout
window.WalletAuth.logout()
```

---

## 🚀 VERWENDUNG IN INDEX-V0.1.HTML

Die Datei `wallet-auth-integration.js` ist bereits eingebunden!

```html
<script defer src="assets/js/wallet-auth-integration.js?v=3.1"></script>
```

### Was funktioniert automatisch:

✅ Login Button öffnet Modal
✅ "Login with Wallet" startet Wallet-Connect
✅ Auto-Login bei erneutem Besuch
✅ Mobile Profile Button zeigt User-Daten
✅ Logout löscht alle Daten
✅ JWT Token wird automatisch verwaltet

### Was Sie noch tun können:

```javascript
// Custom Actions nach Login:
// → Dashboard öffnen
// → User-spezifische Inhalte laden
// → API Calls starten
```

---

## ❓ HÄUFIGE FRAGEN

**Q: Wie lange ist der Token gültig?**
A: 24 Stunden (einstellbar via JWT_EXPIRY env variable)

**Q: Was passiert wenn Token abläuft?**
A: User wird automatisch ausgeloggt und muss sich neu einloggen

**Q: Ist das sicher?**
A: Ja! Wallet-Signatur beweist Besitz, JWT ist kryptographisch signiert

**Q: Kann Token gefälscht werden?**
A: Nein - nur Server kennt JWT_SECRET

**Q: Wo wird Token gespeichert?**
A: localStorage (persistent) - bleibt nach Browser-Schließen

**Q: Funktioniert das ohne MetaMask?**
A: Nein - MetaMask oder andere Web3 Wallet nötig

---

**Viel Erfolg! 🚀**
