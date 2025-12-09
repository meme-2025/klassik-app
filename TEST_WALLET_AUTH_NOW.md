# 🚀 Wallet-Only Auth - Test Tutorial

## ✅ Backend läuft bereits auf Port 3000!

---

## 📱 So testest du jetzt:

### **1. MetaMask installieren** (falls noch nicht vorhanden)
- Chrome: https://metamask.io/download/
- Firefox: https://addons.mozilla.org/de/firefox/addon/ether-metamask/

### **2. Browser öffnen**
```
http://localhost:3000/index.html
```

### **3. Registrierung testen**

#### Option A: Über "Login" Button
1. Klicke auf **"Login"** Button (oben rechts)
2. Im Modal: Klicke **"Login with Wallet"**
3. MetaMask öffnet sich → **Wallet verbinden**
4. Wallet wird geprüft → **"Nicht registriert"** → Registrierungs-Modal öffnet sich
5. Gib deinen **Username** ein (z.B. `crypto_king`)
6. Klicke **"🚀 Sign & Create Account"**
7. MetaMask öffnet sich → **Signatur bestätigen**
8. ✅ **Account erstellt!** Du bist eingeloggt!

#### Option B: Über "Register" Button (gleicher Flow)
1. Klicke auf **"Register"** Button
2. Gib Email/Password ein → **"Please use Wallet registration"** Hinweis
3. Schließe Modal
4. Folge Option A

---

## 🔍 Was passiert im Backend?

### Bei Registrierung:
```sql
INSERT INTO users (email, password, created_at) 
VALUES (
  '0x742d35cc6634c0532925a3b844bc9e7595f0beb',  -- Deine Wallet-Adresse (in email)
  'crypto_king',                                   -- Dein Username (in password)
  CURRENT_TIMESTAMP
);
```

### Datenbank-Check:
```powershell
# PostgreSQL öffnen
psql -U postgres -d klassik

# User anzeigen
SELECT id, email as wallet_address, password as username, created_at FROM users;
```

Ausgabe:
```
 id |                   wallet_address                    |   username   |       created_at        
----+-----------------------------------------------------+--------------+-------------------------
  1 | 0x742d35cc6634c0532925a3b844bc9e7595f0beb           | crypto_king  | 2025-12-09 20:30:15.123
```

---

## 🎯 Login-Flow testen

1. **Logout** (falls eingeloggt)
   - Klicke oben rechts auf deinen Username
   - Klicke **"Logout"**

2. **Login**
   - Klicke **"Login"**
   - Klicke **"Login with Wallet"**
   - MetaMask verbinden
   - Username wird automatisch erkannt
   - Signatur bestätigen
   - ✅ **Eingeloggt!**

---

## 🔥 Krasse Features

### Automatische Wallet-Erkennung
- Wallet registriert → **Sofort Login**
- Wallet nicht registriert → **Registrierung anbieten**

### Sicherer Flow
- **Nonce-System**: Jede Signatur einmalig
- **JWT Token**: 7 Tage gültig
- **Keine Passwörter**: Nur Wallet-Kontrolle

### UI Updates
- **Eingeloggt**: Zeigt Username oben rechts
- **Ausgeloggt**: Zeigt Login/Register Buttons

---

## 🐛 Console-Logs (für Debugging)

Öffne Browser Console (F12):

```javascript
// Bei Wallet-Connect:
✅ Wallet connected: 0x742d...bEb
🔍 Checking if wallet is registered...

// Bei Registration:
📝 Registering wallet with username...
✅ Wallet registered!
🎲 Getting nonce...
✍️ Requesting signature...
✅ Message signed!
🔐 Verifying signature...
✅ Login successful!

// Bei Login:
✅ Wallet found! Username: crypto_king
🎲 Getting nonce...
✍️ Requesting signature...
✅ Message signed!
🔐 Verifying signature...
✅ Login successful!
```

---

## 📊 API-Endpoints (Backend)

| Endpoint | Beschreibung | Body |
|----------|--------------|------|
| `GET /api/auth/user?address=0x...` | Wallet prüfen | - |
| `POST /api/auth/user` | Registrierung | `{address, username}` |
| `GET /api/auth/nonce?address=0x...` | Nonce holen | - |
| `POST /api/auth/signin-with-wallet` | Login | `{address, signature}` |

---

## 🎨 UI-Flow

```
┌─────────────────────────────────────────┐
│  Startseite                             │
│  [ Login ]  [ Register ]                │
└─────────────────────────────────────────┘
                 ↓ Klick
┌─────────────────────────────────────────┐
│  Login Modal                            │
│  Email: [___________]                   │
│  Password: [________]                   │
│  [ Login ]                              │
│  ─── or ───                             │
│  [ 🔐 Login with Wallet ]  ← HIER      │
└─────────────────────────────────────────┘
                 ↓ Klick
┌─────────────────────────────────────────┐
│  MetaMask PopUp                         │
│  Connect to localhost:3000?             │
│  [ Cancel ]  [ Connect ]                │
└─────────────────────────────────────────┘
                 ↓ Connect
┌─────────────────────────────────────────┐
│  Wallet Check...                        │
│  ✅ Connected: 0x742d...bEb            │
└─────────────────────────────────────────┘
                 ↓
       ┌────────┴────────┐
       │                 │
    Wallet            Wallet
  registriert?     nicht registriert
       │                 │
       ↓                 ↓
┌─────────────┐   ┌─────────────────────┐
│  Login      │   │  Registration Modal │
│  (Nonce +   │   │  Username: [______] │
│  Signatur)  │   │  [ Sign & Create ]  │
└─────────────┘   └─────────────────────┘
       │                 ↓
       │           ┌─────────────────────┐
       │           │  MetaMask Sign      │
       │           │  Message: "Sign..." │
       │           │  [ Sign ]           │
       │           └─────────────────────┘
       │                 ↓
       └─────────┬───────┘
                 ↓
        ✅ Eingeloggt!
┌─────────────────────────────────────────┐
│  [ 👤 crypto_king ▼ ]  [ Logout ]      │
└─────────────────────────────────────────┘
```

---

## 🎯 Dein erster Test - Schritt für Schritt

### **Schritt 1: Browser öffnen**
```
http://localhost:3000/index.html
```

### **Schritt 2: Login klicken**
Oben rechts: **"Login"**

### **Schritt 3: Wallet Login**
Im Modal: **"Login with Wallet"**

### **Schritt 4: MetaMask verbinden**
MetaMask PopUp → **"Connect"**

### **Schritt 5: Username eingeben**
Falls nicht registriert → Username: **`dein_name`**

### **Schritt 6: Signieren**
**"🚀 Sign & Create Account"** → MetaMask **"Sign"**

### **Schritt 7: Fertig!** ✅
Du bist eingeloggt! Dein Username erscheint oben rechts.

---

## 🔥 Krasse Wallet-Auth ist live!

**Viel Spaß beim Testen!** 🚀
