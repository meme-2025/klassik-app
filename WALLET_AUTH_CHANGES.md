# 📊 Wallet-Only Auth - Änderungsübersicht

## 🔄 Umstellung von Email/Password → Wallet-Only

```
┌─────────────────────────────────────────────────────────────────┐
│                     VORHER (Email/Password)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Frontend:                                                       │
│  ├─ Login Button                                                │
│  ├─ Register Button                                             │
│  └─ Modals:                                                     │
│     ├─ Email-Eingabe                                            │
│     ├─ Password-Eingabe                                         │
│     └─ Password-Confirm                                         │
│                                                                  │
│  Backend:                                                        │
│  ├─ POST /api/auth/register (email, password)                  │
│  ├─ POST /api/auth/login (email, password)                     │
│  └─ bcrypt Hash/Verify                                          │
│                                                                  │
│  Database:                                                       │
│  ├─ users.email                                                 │
│  ├─ users.password (hashed)                                     │
│  └─ users.address (optional)                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

                              ⬇️  MIGRATION  ⬇️

┌─────────────────────────────────────────────────────────────────┐
│                    NACHHER (Wallet-Only)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Frontend:                                                       │
│  ├─ Register Button (öffnet Wallet-Modal)                      │
│  ├─ Connect Wallet Button (für Login)                          │
│  └─ Modals:                                                     │
│     ├─ Wallet Connect                                           │
│     ├─ Username-Eingabe                                         │
│     └─ MetaMask Sign                                            │
│                                                                  │
│  Backend:                                                        │
│  ├─ GET /api/auth/nonce (address)                              │
│  ├─ POST /api/auth/check-wallet (address)                      │
│  ├─ POST /api/auth/register (address, username, signature)     │
│  ├─ POST /api/auth/login (address, username, signature)        │
│  └─ ethers.js verifyMessage                                     │
│                                                                  │
│  Database:                                                       │
│  ├─ users.address (NOT NULL, UNIQUE)                           │
│  ├─ users.username (NOT NULL, UNIQUE)                          │
│  └─ ❌ email & password entfernt                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Datei-Änderungen

### ✅ Neu erstellt

```
backend/migrations/002_wallet_only_auth.js
frontend/assets/css/wallet-auth.css
test-wallet-only-auth.ps1
WALLET_AUTH_IMPLEMENTATION.md
WALLET_AUTH_QUICK_REFERENCE.md
WALLET_AUTH_CHANGES.md (diese Datei)
```

### 🔄 Ersetzt (Backup erstellt)

```
backend/src/routes/auth.js
  → Backup: backend/src/routes/auth_old_backup.js

frontend/assets/js/auth.js
  → Backup: frontend/assets/js/auth_old_backup.js
```

### ✏️ Modifiziert

```
frontend/index.html
  ├─ Navigation: Login → Register Button
  ├─ User-Menu hinzugefügt
  ├─ Login Modal → Wallet Connect Modal
  ├─ Register Modal → Wallet-Only Register
  └─ wallet-auth.css eingebunden
```

---

## 🔀 Flow-Vergleich

### Registration Flow

#### Vorher (Email/Password):
```
1. User gibt Email ein
2. User gibt Password ein
3. Password wird gehashed (bcrypt)
4. User wird in DB gespeichert
5. JWT Token generiert
6. Login erfolgreich
```

#### Nachher (Wallet-Only):
```
1. User verbindet Wallet (MetaMask)
2. System prüft: Wallet registriert?
3. User gibt Username ein
4. System generiert Nonce
5. User signiert Message mit Wallet
6. System verifiziert Signatur
7. User wird in DB gespeichert (address + username)
8. JWT Token generiert
9. Login erfolgreich
```

---

### Login Flow

#### Vorher (Email/Password):
```
1. User gibt Email ein
2. User gibt Password ein
3. Password wird mit Hash verglichen
4. JWT Token generiert
5. Login erfolgreich
```

#### Nachher (Wallet-Only):
```
1. User verbindet Wallet (MetaMask)
2. System prüft: Wallet registriert?
3. User gibt Username ein
4. System generiert Nonce
5. User signiert Message mit Wallet
6. System verifiziert Signatur + Username
7. JWT Token generiert
8. Login erfolgreich
```

---

## 🛡️ Sicherheits-Verbesserungen

| Feature | Vorher | Nachher |
|---------|--------|---------|
| **Password Storage** | ❌ Gehashed in DB | ✅ Keine Passwords |
| **Phishing** | ⚠️ Möglich (Fake-Login) | ✅ Schwieriger (Wallet-Signatur) |
| **Brute Force** | ⚠️ Möglich auf Passwords | ✅ Unmöglich (Wallet-Kontrolle) |
| **Password Reset** | ⚠️ Email-basiert | ✅ Nicht nötig |
| **2FA** | ❌ Separat implementieren | ✅ Wallet = 2FA |
| **Identity** | ⚠️ Email (änderbar) | ✅ Wallet-Address (unveränderbar) |

---

## 📊 Database Schema Changes

### Migration 002_wallet_only_auth.js

```sql
-- REMOVED
ALTER TABLE users DROP COLUMN email;
ALTER TABLE users DROP COLUMN password;

-- MODIFIED
ALTER TABLE users ALTER COLUMN address 
  SET NOT NULL,
  ADD CONSTRAINT unique_address UNIQUE (address);

-- ADDED
ALTER TABLE users ADD COLUMN username VARCHAR(100) 
  NOT NULL UNIQUE;
```

### Resultat:

```sql
-- Vorher:
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,           -- ❌ Entfernt
  password TEXT,                        -- ❌ Entfernt
  address VARCHAR(255) UNIQUE,          -- ✅ Jetzt NOT NULL
  nonce VARCHAR(255),
  nonce_expiry TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Nachher:
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  address VARCHAR(255) NOT NULL UNIQUE, -- ✅ Required
  username VARCHAR(100) NOT NULL UNIQUE, -- ✅ Neu
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🎨 UI/UX Änderungen

### Navigation Bar

#### Vorher:
```
[ Login ]  [ Register ]
```

#### Nachher:
```
[ Register ]  [ Connect Wallet ]

(wenn eingeloggt):
[ 👤 username ]  [ Logout ]
```

### Modals

#### Vorher - Login Modal:
```
┌─────────────────────────┐
│   Welcome Back          │
├─────────────────────────┤
│ Email: [____________]   │
│ Password: [_________]   │
│ [ Login ]               │
│ ─── or ───              │
│ [ Login with Wallet ]   │
└─────────────────────────┘
```

#### Nachher - Wallet Connect Modal:
```
┌─────────────────────────┐
│   🔐 Login with Wallet  │
├─────────────────────────┤
│ [ Connect MetaMask ]    │
│                         │
│ (nach Wallet-Connect:)  │
│ Connected: 0x742d...bEb │
│ Username: [_________]   │
│ [ Sign & Login ]        │
└─────────────────────────┘
```

#### Vorher - Register Modal:
```
┌─────────────────────────┐
│   Create Account        │
├─────────────────────────┤
│ Email: [____________]   │
│ Password: [_________]   │
│ Confirm: [__________]   │
│ [ Register ]            │
└─────────────────────────┘
```

#### Nachher - Register Modal:
```
┌─────────────────────────┐
│   ➕ Create Account     │
├─────────────────────────┤
│ [ Connect Wallet ]      │
│                         │
│ (nach Wallet-Connect:)  │
│ Connected: 0x742d...bEb │
│ Username: [_________]   │
│ (3-30 chars, a-z0-9_)   │
│ [ Sign & Register ]     │
└─────────────────────────┘
```

---

## 🧪 Testing

### Alte Test-Skripte:
```
test-auth.ps1          → Email/Password Tests
test-wallet-auth.ps1   → Hybrid Tests
```

### Neue Test-Skripte:
```
test-wallet-only-auth.ps1  → Wallet-Only Tests
```

### Test-Coverage:

| Test | Status |
|------|--------|
| ✅ Nonce generieren | Funktioniert |
| ✅ Wallet-Status prüfen | Funktioniert |
| ✅ Registration (ohne Signature) | Fehlt wie erwartet |
| ✅ Login (ohne Signature) | Fehlt wie erwartet |
| ⚠️ Vollständige Registration | Manuell mit MetaMask |
| ⚠️ Vollständiger Login | Manuell mit MetaMask |

---

## 📦 Dependencies

### Unverändert:
```json
"ethers": "^5.7.2",
"jsonwebtoken": "^9.0.2",
"pg": "^8.11.3"
```

### Entfernt:
```json
"bcryptjs": "^2.4.3"  ❌ Nicht mehr benötigt
```

---

## 🚀 Deployment Checklist

- [ ] Backend Migration ausführen: `npm run migrate`
- [ ] Backend neu starten
- [ ] Environment Variables prüfen
- [ ] Frontend Dateien hochladen
- [ ] MetaMask Installation dokumentieren
- [ ] User-Migration kommunizieren
- [ ] Alte Email/Password-User informieren

---

## 📞 Rollback Plan

Falls Probleme auftreten:

```bash
# Backend
cd backend/src/routes
rm auth.js
mv auth_old_backup.js auth.js

# Frontend
cd frontend/assets/js
rm auth.js
mv auth_old_backup.js auth.js

# Database
# Migration rückgängig machen:
npm run migrate down
```

---

✅ **Migration abgeschlossen!** 🎉
