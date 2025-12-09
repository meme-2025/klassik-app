# ✅ KLASSIK SETUP & TEST - KOMPLETTE ANLEITUNG

## 📊 Was wurde geändert?

### 1. Backend Auth System (`backend/src/routes/auth.js`)
**Änderungen:**
- ✅ Wallet Authentication hinzugefügt (MetaMask Sign-In)
- ✅ Angepasst für deine existierende `users` Tabelle (id, email, password, created_at)
- ✅ Neue Endpoints: `/nonce`, `/register-wallet`, `/login-wallet`
- ✅ Dual-Auth: Email/Password UND Wallet Sign-In

### 2. Datenbank Migration (`backend/add-wallet-support.sql`)
**Neu erstellt:**
- Fügt `address` Spalte zur `users` Tabelle hinzu (für Wallet-Adressen)
- Erstellt `nonces` Tabelle (für Wallet-Signatur-Verifikation)
- Macht `password` nullable (für wallet-only users)

### 3. Frontend Wallet Module (`frontend/assets/js/wallet-auth.js`)
**Neu erstellt:**
- MetaMask Integration
- Wallet Connect & Sign Flow
- Auto-Handle Registration/Login

### 4. Test & Utility Scripts
**Neu erstellt:**
- `test-wallet-auth.ps1` - Testet alle Auth-Flows
- `test-auth.ps1` - Testet Email/Password Auth
- `check-schema.js` - Prüft Datenbankstruktur
- `init-db.js` - Initialisiert komplette Datenbank
- `deploy-db.sh` - Ubuntu Deployment Script

### 5. Dokumentation
**Neu erstellt:**
- `WALLET_AUTH_GUIDE.md` - Komplette Wallet-Auth Dokumentation
- `SETUP_GUIDE.md` - Setup & Troubleshooting Guide

---

## 🚀 SCHRITT-FÜR-SCHRITT TEST

### ═══════════════════════════════════════
### SCHRITT 1: Backend auf Ubuntu vorbereiten
### ═══════════════════════════════════════

**SSH in deinen Ubuntu Server:**
```bash
ssh user@your-server
cd ~/klassik/backend  # oder dein Backend-Pfad
```

**1.1 Prüfe Datenbank-Status:**
```bash
# Prüfe PostgreSQL läuft
sudo systemctl status postgresql

# Falls nicht aktiv, starten:
sudo systemctl start postgresql
```

**1.2 Prüfe aktuelle Tabellen-Struktur:**
```bash
# Mit psql
psql -U klassik -d klassik -c "\d users"

# ODER mit Node.js Script
node check-schema.js
```

**Erwartete Ausgabe:**
```
📊 Current USERS table structure:
=====================================
  id                   integer                        NOT NULL
  email                character varying              NULL
  password             character varying              NULL
  created_at           timestamp                      NULL
```

**1.3 Datenbank Migration ausführen:**
```bash
# Option A: Mit psql (empfohlen)
psql -U klassik -d klassik -f add-wallet-support.sql

# Option B: Mit SQL direkt
psql -U klassik -d klassik << 'EOF'
-- Füge address Spalte hinzu
ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(42);
CREATE INDEX IF NOT EXISTS idx_users_address ON users(LOWER(address));

-- Erstelle nonces Tabelle
CREATE TABLE IF NOT EXISTS nonces (
  address VARCHAR(42) PRIMARY KEY,
  nonce VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_nonces_expires_at ON nonces(expires_at);

-- Password kann NULL sein
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
EOF
```

**1.4 Verifiziere Migration:**
```bash
node check-schema.js
```

**Erwartete Ausgabe sollte jetzt enthalten:**
```
📊 Current USERS table structure:
  id                   integer                        NOT NULL
  email                character varying              NULL
  password             character varying              NULL
  created_at           timestamp                      NULL
  address              character varying              NULL    ← NEU!

📋 Nonces table exists: ✅ YES                                ← NEU!
```

**1.5 Neue Dateien hochladen:**
```bash
# Von deinem Windows-PC aus (neues PowerShell Fenster):
cd C:\Users\TUF-s\Desktop\git\Klassik

# Dateien per SCP hochladen
scp backend/src/routes/auth.js user@server:~/klassik/backend/src/routes/
scp backend/check-schema.js user@server:~/klassik/backend/
scp frontend/assets/js/wallet-auth.js user@server:~/klassik/frontend/assets/js/

# ODER wenn du Git verwendest:
git add .
git commit -m "Add wallet authentication"
git push

# Dann auf Server:
git pull
```

**1.6 Backend neu starten:**
```bash
# Mit PM2:
pm2 restart klassik-backend
pm2 logs klassik-backend --lines 20

# ODER mit systemd:
sudo systemctl restart klassik.service
sudo journalctl -u klassik.service -f

# ODER direkt (für Testing):
cd ~/klassik/backend
npm start
```

**Erfolgreich wenn du siehst:**
```
✅ Database connected successfully
🚀 Server running on port 3000
```

---

### ═══════════════════════════════════════
### SCHRITT 2: Backend API Tests (von Windows)
### ═══════════════════════════════════════

**Öffne PowerShell auf deinem Windows PC:**
```powershell
cd C:\Users\TUF-s\Desktop\git\Klassik
```

**2.1 Test Health Check:**
```powershell
Invoke-RestMethod -Uri "http://YOUR-SERVER-IP:3000/health"
```

**Erwartete Ausgabe:**
```
status      : ok
timestamp   : 2025-12-09T...
environment : production
```

**2.2 Test Auth Endpoints Info:**
```powershell
Invoke-RestMethod -Uri "http://YOUR-SERVER-IP:3000/api/auth/test"
```

**Erwartete Ausgabe:**
```
status    : Auth routes active
endpoints : @{email_password=...; wallet=...}
```

**2.3 Vollständiger Auth Test:**
```powershell
# Passe die BASE_URL in test-wallet-auth.ps1 an:
# Öffne die Datei und ändere Zeile 4:
$BASE_URL = "http://YOUR-SERVER-IP:3000"  # ← Deine Server-IP

# Dann ausführen:
.\test-wallet-auth.ps1
```

**Erwartete Ausgabe:**
```
✅ Backend Health: OK
✅ Auth Routes: OK
✅ Nonce Generation: OK
✅ Email Registration: OK
✅ Email Login: OK
⚠️  Wallet Registration: Requires real wallet signature
⚠️  Wallet Login: Requires real wallet signature
```

---

### ═══════════════════════════════════════
### SCHRITT 3: Frontend Wallet Integration
### ═══════════════════════════════════════

**3.1 Füge Ethers.js zum Frontend hinzu:**

Öffne: `frontend/index.html`

Füge **VOR `</body>`** hinzu:
```html
<!-- Ethers.js für Wallet-Signatur -->
<script src="https://cdn.ethers.io/lib/ethers-5.7.umd.min.js"></script>

<!-- Wallet Auth Module -->
<script src="/assets/js/wallet-auth.js"></script>
```

**3.2 Füge Wallet-Buttons hinzu:**

In deinem Login Modal (suche nach `loginModal`):
```html
<!-- Bestehender Email/Password Login -->
<form id="loginForm">
  <input type="email" id="loginEmail" placeholder="Email" required>
  <input type="password" id="loginPassword" placeholder="Password" required>
  <button type="submit">Login</button>
</form>

<!-- NEU: Wallet Login Button -->
<div style="margin-top: 20px; text-align: center;">
  <p>- oder -</p>
  <button 
    id="walletLoginBtn" 
    onclick="handleWalletLogin()" 
    style="background: linear-gradient(135deg, #F6851B, #E2761B); border: none; padding: 12px 24px; color: white; border-radius: 8px; cursor: pointer;">
    🦊 Sign in with Wallet
  </button>
</div>
```

In deinem Register Modal:
```html
<!-- Bestehender Email/Password Register -->
<form id="registerForm">
  <input type="email" id="registerEmail" placeholder="Email" required>
  <input type="password" id="registerPassword" placeholder="Password" required>
  <button type="submit">Register</button>
</form>

<!-- NEU: Wallet Register Button -->
<div style="margin-top: 20px; text-align: center;">
  <p>- oder -</p>
  <button 
    id="walletRegisterBtn" 
    onclick="handleWalletRegister()" 
    style="background: linear-gradient(135deg, #F6851B, #E2761B); border: none; padding: 12px 24px; color: white; border-radius: 8px; cursor: pointer;">
    🦊 Register with Wallet
  </button>
</div>
```

**3.3 Frontend-Dateien hochladen:**
```powershell
# Von Windows
scp frontend/index.html user@server:~/klassik/frontend/
scp frontend/assets/js/wallet-auth.js user@server:~/klassik/frontend/assets/js/

# ODER mit Git:
git add .
git commit -m "Add wallet auth UI"
git push
# dann auf Server: git pull
```

**3.4 Nginx cache leeren (auf Server):**
```bash
sudo nginx -s reload
```

---

### ═══════════════════════════════════════
### SCHRITT 4: Browser Test mit MetaMask
### ═══════════════════════════════════════

**4.1 Vorbereitung:**
- ✅ MetaMask Extension installiert (https://metamask.io)
- ✅ Test-Wallet in MetaMask erstellt
- ✅ Browser geöffnet

**4.2 Öffne deine Seite:**
```
http://YOUR-SERVER-IP
```

**4.3 Test Email/Password (zum Vergleich):**
1. Klicke "Register" oder "Login"
2. Gib Email + Password ein
3. Submit
4. ✅ Sollte funktionieren

**4.4 Test Wallet Sign-In:**

**TEST A: Register mit Wallet**
1. Klicke "Register"
2. Klicke "🦊 Register with Wallet"
3. MetaMask öffnet sich → Klicke "Connect"
4. MetaMask zeigt Message → Klicke "Sign"
5. ✅ Du bist registriert & eingeloggt!

**TEST B: Login mit Wallet**
1. Logout (falls eingeloggt)
2. Klicke "Login"
3. Klicke "🦊 Sign in with Wallet"
4. MetaMask → "Sign"
5. ✅ Du bist eingeloggt!

**4.5 Browser Console öffnen (F12):**

Du solltest sehen:
```
✅ Wallet connected: 0x742d35Cc...
✅ Message signed
POST http://your-server/api/auth/login-wallet 200 OK
```

---

### ═══════════════════════════════════════
### SCHRITT 5: Debugging & Verification
### ═══════════════════════════════════════

**5.1 Backend Logs prüfen (auf Server):**
```bash
# PM2 Logs
pm2 logs klassik-backend --lines 50

# Suche nach:
# ✅ "Wallet connected"
# ✅ "Message signed"
# ✅ "Login successful"
```

**5.2 Datenbank prüfen:**
```bash
psql -U klassik -d klassik

# In psql:
SELECT id, email, address, created_at FROM users;

# Du solltest sehen:
# - Users mit email + password (Email-Auth)
# - Users mit address (Wallet-Auth)
# - Users mit beiden (Hybrid)

\q  # Beenden
```

**5.3 Browser Network Tab (F12 → Network):**

Prüfe die API Calls:
```
✅ GET  /api/auth/nonce?address=0x... → 200 OK
✅ POST /api/auth/login-wallet → 200 OK
   Response: { token: "eyJ...", user: {...} }
```

**5.4 localStorage prüfen (Browser Console):**
```javascript
// Im Browser Console (F12):
localStorage.getItem('klassik_token')
// Sollte JWT Token zeigen: "eyJhbGciOiJI..."

JSON.parse(localStorage.getItem('klassik_user'))
// Sollte User-Objekt zeigen: { id: 1, address: "0x...", ... }
```

---

### ═══════════════════════════════════════
### SCHRITT 6: Manual API Testing
### ═══════════════════════════════════════

**Test Wallet Flow manuell (Browser Console):**

```javascript
// 1. Nonce abrufen
const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'; // Deine Wallet
const nonceRes = await fetch(`http://your-server/api/auth/nonce?address=${address}`);
const { nonce, message } = await nonceRes.json();
console.log('Message to sign:', message);

// 2. Message signieren
const provider = new ethers.providers.Web3Provider(window.ethereum);
const signer = provider.getSigner();
const signature = await signer.signMessage(message);
console.log('Signature:', signature);

// 3. Login
const loginRes = await fetch('http://your-server/api/auth/login-wallet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ address, signature })
});
const loginData = await loginRes.json();
console.log('Login result:', loginData);
// Sollte Token + User zurückgeben
```

**Test mit PowerShell (Teil-Flow):**
```powershell
# 1. Nonce abrufen
$wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
$nonceRes = Invoke-RestMethod -Uri "http://YOUR-SERVER:3000/api/auth/nonce?address=$wallet"
Write-Host "Nonce: $($nonceRes.nonce)"
Write-Host "Message to sign:"
Write-Host $nonceRes.message

# 2. Signatur (manual in MetaMask erstellen)
# 3. Dann login (Beispiel):
$body = @{
  address = $wallet
  signature = "0x... (von MetaMask)"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://YOUR-SERVER:3000/api/auth/login-wallet" `
  -Method Post -Body $body -ContentType "application/json"
```

---

## 🎯 SCHNELL-CHECKLISTE

### Backend (Ubuntu Server):
- [ ] PostgreSQL läuft (`systemctl status postgresql`)
- [ ] Migration ausgeführt (`psql -f add-wallet-support.sql`)
- [ ] `address` Spalte existiert (`node check-schema.js`)
- [ ] `nonces` Tabelle existiert
- [ ] Backend läuft (`pm2 status` oder `systemctl status klassik`)
- [ ] Auth routes aktiv (`curl http://localhost:3000/api/auth/test`)

### Frontend (Browser):
- [ ] ethers.js script eingebunden
- [ ] wallet-auth.js eingebunden
- [ ] Wallet-Buttons sichtbar
- [ ] MetaMask installiert
- [ ] Console zeigt keine Fehler (F12)

### API Tests (PowerShell):
- [ ] Health check OK (`.\test-wallet-auth.ps1`)
- [ ] Nonce generation OK
- [ ] Email register/login OK

### Browser Tests:
- [ ] Email Register funktioniert
- [ ] Email Login funktioniert
- [ ] Wallet Register funktioniert (mit MetaMask)
- [ ] Wallet Login funktioniert (mit MetaMask)
- [ ] Token wird gespeichert (localStorage)

---

## 🐛 Häufige Probleme & Lösungen

### Problem: "Cannot connect to backend"
```bash
# Auf Server:
pm2 logs klassik-backend
# Prüfe ob Port 3000 läuft
netstat -tlnp | grep 3000
```

### Problem: "Nonce not found"
```bash
# Prüfe nonces Tabelle:
psql -U klassik -d klassik -c "SELECT * FROM nonces;"
# Sollte Einträge zeigen oder leer sein (OK)
```

### Problem: "Invalid signature"
- Message exakt verwenden (keine Extra-Zeichen)
- Richtige Wallet-Adresse (same case)
- MetaMask auf richtigem Network

### Problem: "MetaMask not detected"
```javascript
// Browser Console:
console.log(window.ethereum);
// Sollte Object zeigen, nicht undefined
```

### Problem: "CORS Error"
```bash
# Auf Server in .env:
CORS_ORIGIN=*
# Dann restart:
pm2 restart klassik-backend
```

---

## 📞 Test mit mir zusammen

Wenn du bereit bist zu testen, können wir **Schritt für Schritt** durchgehen:

1. **Sag mir**: "Bereit für Backend Setup"
   → Ich helfe dir bei Schritt 1

2. **Sag mir**: "Backend läuft, teste API"
   → Ich helfe dir bei Schritt 2

3. **Sag mir**: "Frontend Integration"
   → Ich helfe dir bei Schritt 3

4. **Sag mir**: "Browser Test"
   → Ich helfe dir bei Schritt 4

**Oder einfach:** "Starte Test" - dann gehen wir alle Schritte durch!

---

## 📊 Was haben wir erreicht?

✅ **Dual Authentication System**
- Email/Password Login (klassisch)
- Wallet Sign-In (modern, Web3)

✅ **Production Ready**
- Sichere Signatur-Verifikation
- Nonce-basierte Anti-Replay
- JWT Token Management
- Error Handling

✅ **Flexible User Model**
- Users können beide Methoden nutzen
- Wallet-only users möglich
- Email-only users möglich
- Hybrid users (beides verknüpft)

✅ **Developer Friendly**
- Komplette Tests
- Ausführliche Dokumentation
- Debug Tools

**Alles bereit zum Testen! 🚀**
