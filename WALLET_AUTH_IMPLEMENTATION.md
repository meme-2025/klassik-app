# 🔐 Wallet-Only Authentication - Implementierungsguide

## ✅ Fertiggestellt am 9. Dezember 2025

---

## 📋 Übersicht

Die Klassik-App wurde komplett auf **Wallet-Only Authentication** umgestellt. Es gibt keine Email/Password-Authentifizierung mehr. Alle Benutzer registrieren und authentifizieren sich ausschließlich über ihre Ethereum-Wallet (MetaMask).

---

## 🎯 Änderungen im Detail

### **1. Database Schema (Migration)**

#### Neue Users-Tabelle Struktur:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,              -- Fortlaufende ID
  address VARCHAR(255) NOT NULL UNIQUE, -- Wallet-Adresse (0x...)
  username VARCHAR(100) NOT NULL UNIQUE, -- Benutzername (selbst gewählt)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Migration ausführen:
```bash
cd backend
npm run migrate
```

**Datei:** `backend/migrations/002_wallet_only_auth.js`

---

### **2. Backend API Endpoints**

#### Alte Endpoints (ENTFERNT):
- ❌ `POST /api/auth/register` (Email/Password)
- ❌ `POST /api/auth/login` (Email/Password)

#### Neue Endpoints:

| Endpoint | Methode | Beschreibung |
|----------|---------|--------------|
| `GET /api/auth/nonce?address=0x...` | GET | Nonce für Wallet-Signatur generieren |
| `POST /api/auth/check-wallet` | POST | Prüfen ob Wallet registriert ist |
| `POST /api/auth/register` | POST | Registrierung mit Wallet + Username |
| `POST /api/auth/login` | POST | Login mit Wallet + Username |

**Datei:** `backend/src/routes/auth.js`

---

### **3. Frontend Änderungen**

#### HTML (index.html):
- ✅ **Login-Button** wurde durch **Register-Button** ersetzt
- ✅ **Connect Wallet** Button bleibt (für Login)
- ✅ Neue Modals:
  - `registerModal` - Wallet-basierte Registrierung
  - `walletConnectModal` - Wallet-basierter Login

#### JavaScript (auth.js):
- ✅ Komplett neu geschrieben
- ✅ Email/Password-Flows entfernt
- ✅ Wallet-Connect-Integration
- ✅ Username-Validierung vor Wallet-Sign

#### CSS (wallet-auth.css):
- ✅ Neue Styles für Wallet-Display
- ✅ User-Menu in Navigation
- ✅ Responsive Design

**Dateien:**
- `frontend/index.html`
- `frontend/assets/js/auth.js`
- `frontend/assets/css/wallet-auth.css`

---

## 🔄 Authentifizierungs-Flow

### **Registration (Neue Benutzer)**

```
1. Benutzer klickt "Register"
   ↓
2. Modal öffnet sich
   ↓
3. Benutzer klickt "Connect Wallet"
   ↓
4. MetaMask öffnet sich → Wallet verbinden
   ↓
5. Frontend prüft: Ist Wallet bereits registriert?
   ├─ JA → Weiterleitung zu Login
   └─ NEIN → Weiter zu Schritt 6
   ↓
6. Benutzer gibt Username ein (3-30 Zeichen, a-zA-Z0-9_)
   ↓
7. Benutzer klickt "Sign & Register"
   ↓
8. Backend generiert Nonce
   ↓
9. MetaMask öffnet sich → Nachricht signieren
   ↓
10. Backend verifiziert Signatur
    ↓
11. User wird in DB gespeichert
    ↓
12. JWT Token wird generiert
    ↓
13. Token + User-Daten → localStorage
    ↓
14. UI wird aktualisiert → Eingeloggt!
```

### **Login (Bestehende Benutzer)**

```
1. Benutzer klickt "Connect Wallet"
   ↓
2. Modal öffnet sich
   ↓
3. Benutzer klickt "Connect MetaMask"
   ↓
4. MetaMask öffnet sich → Wallet verbinden
   ↓
5. Frontend prüft: Ist Wallet registriert?
   ├─ NEIN → Weiterleitung zu Register
   └─ JA → Weiter zu Schritt 6
   ↓
6. Benutzer gibt Username ein
   ↓
7. Benutzer klickt "Sign & Login"
   ↓
8. Backend generiert Nonce
   ↓
9. MetaMask öffnet sich → Nachricht signieren
   ↓
10. Backend verifiziert:
    ├─ Signatur korrekt?
    ├─ Username stimmt mit Wallet überein?
    └─ Nonce nicht abgelaufen?
    ↓
11. JWT Token wird generiert
    ↓
12. Token + User-Daten → localStorage
    ↓
13. UI wird aktualisiert → Eingeloggt!
```

---

## 🛠️ Backend API Beispiele

### 1. Nonce anfordern

```bash
GET /api/auth/nonce?address=0x1234567890123456789012345678901234567890

Response:
{
  "nonce": "a3f5b2c1...",
  "message": "Sign this message to authenticate with Klassik:\n\nNonce: a3f5b2c1...\nTimestamp: 2025-12-09T...",
  "expiresAt": "2025-12-09T12:10:00.000Z"
}
```

### 2. Wallet prüfen

```bash
POST /api/auth/check-wallet
Content-Type: application/json

{
  "address": "0x1234567890123456789012345678901234567890"
}

Response:
{
  "registered": false,
  "needsUsername": true
}
```

### 3. Registrierung

```bash
POST /api/auth/register
Content-Type: application/json

{
  "address": "0x1234567890123456789012345678901234567890",
  "username": "crypto_king",
  "signature": "0xabc123..."
}

Response:
{
  "message": "Registration successful",
  "user": {
    "id": 1,
    "username": "crypto_king",
    "address": "0x1234567890123456789012345678901234567890",
    "created_at": "2025-12-09T12:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "7d"
}
```

### 4. Login

```bash
POST /api/auth/login
Content-Type: application/json

{
  "address": "0x1234567890123456789012345678901234567890",
  "username": "crypto_king",
  "signature": "0xdef456..."
}

Response:
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "crypto_king",
    "address": "0x1234567890123456789012345678901234567890",
    "created_at": "2025-12-09T12:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "7d"
}
```

---

## 🔒 Sicherheit

### Username-Validierung:
- 3-30 Zeichen
- Nur a-z, A-Z, 0-9, und `_`
- Muss eindeutig sein

### Signatur-Verifikation:
- Nonce ist 10 Minuten gültig
- Einmalige Verwendung (wird nach Erfolg gelöscht)
- Ethereum-Signatur-Verifizierung via `ethers.js`

### JWT Token:
- Gültig für 7 Tage
- Beinhaltet: `userId`, `username`, `address`
- Wird im `localStorage` gespeichert

---

## 📦 Backup-Dateien

Falls ein Rollback nötig ist, wurden Backups erstellt:

```
backend/src/routes/auth_old_backup.js
frontend/assets/js/auth_old_backup.js
```

---

## ✅ Testing Checklist

### Manual Testing:

1. **Registration Flow:**
   - [ ] Register-Button öffnet Modal
   - [ ] Connect Wallet funktioniert
   - [ ] Username-Eingabe wird angezeigt
   - [ ] MetaMask Sign wird aufgerufen
   - [ ] User wird erfolgreich registriert
   - [ ] UI zeigt eingeloggten User an

2. **Login Flow:**
   - [ ] Connect Wallet-Button öffnet Modal
   - [ ] Wallet-Verbindung funktioniert
   - [ ] Username-Eingabe wird angezeigt
   - [ ] Falscher Username → Fehler
   - [ ] Korrekter Username → MetaMask Sign
   - [ ] Login erfolgreich
   - [ ] UI zeigt eingeloggten User an

3. **Error Handling:**
   - [ ] Nicht-registrierte Wallet beim Login → Register-Hinweis
   - [ ] Bereits registrierte Wallet bei Register → Login-Hinweis
   - [ ] Falscher Username beim Login → Fehlermeldung
   - [ ] Username bereits vergeben → Fehlermeldung
   - [ ] Abgelaufene Nonce → Neue Nonce anfordern

4. **Logout:**
   - [ ] Logout-Button funktioniert
   - [ ] Token wird aus localStorage entfernt
   - [ ] UI zeigt ausgeloggten Status

---

## 🚀 Deployment

### Schritte:

1. **Migration ausführen:**
```bash
cd backend
npm run migrate
```

2. **Backend neu starten:**
```bash
npm start
```

3. **Frontend deployen:**
```bash
# Keine Build-Schritte nötig - statisches HTML/CSS/JS
# Einfach auf Server hochladen
```

4. **Environment Variables prüfen:**
```bash
JWT_SECRET=your-secret-key
JWT_EXPIRY=7d
DATABASE_URL=postgresql://...
```

---

## 📚 Weitere Ressourcen

- [MetaMask Docs](https://docs.metamask.io/)
- [Ethers.js Docs](https://docs.ethers.org/)
- [JWT Best Practices](https://jwt.io/introduction)

---

## 🎉 Abgeschlossen!

Die App ist jetzt vollständig auf **Wallet-Only Authentication** umgestellt. Viel Erfolg! 🚀
