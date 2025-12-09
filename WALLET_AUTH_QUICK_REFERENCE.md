# 🚀 Wallet-Only Auth - Quick Reference

## 🎯 Schnellstart

### 1. Backend starten
```bash
cd backend
npm install
npm run migrate  # Führt Migration 002_wallet_only_auth.js aus
npm start
```

### 2. Frontend öffnen
```
http://localhost:3000/index.html
```

### 3. MetaMask installieren
- Chrome Extension: https://metamask.io/download/

---

## 📋 User Flow

### Registrierung
1. Klicke **"Register"**
2. Klicke **"Connect Wallet"**
3. MetaMask genehmigen
4. Username eingeben (3-30 Zeichen, nur a-z, 0-9, _)
5. Klicke **"Sign & Register"**
6. MetaMask Signatur genehmigen
7. ✅ Fertig!

### Login
1. Klicke **"Connect Wallet"**
2. MetaMask genehmigen
3. Username eingeben
4. Klicke **"Sign & Login"**
5. MetaMask Signatur genehmigen
6. ✅ Eingeloggt!

---

## 🔑 API Endpoints

| Endpoint | Beschreibung |
|----------|--------------|
| `GET /api/auth/nonce?address=0x...` | Nonce generieren |
| `POST /api/auth/check-wallet` | Wallet-Status prüfen |
| `POST /api/auth/register` | Registrierung |
| `POST /api/auth/login` | Login |
| `GET /api/auth/test` | API-Status |

---

## 🗄️ Datenbank

### Users Table
```sql
id         | SERIAL PRIMARY KEY
address    | VARCHAR(255) NOT NULL UNIQUE  -- Wallet-Adresse
username   | VARCHAR(100) NOT NULL UNIQUE  -- Benutzername
created_at | TIMESTAMP DEFAULT NOW()
```

### Nonces Table
```sql
address    | VARCHAR(255) PRIMARY KEY
nonce      | VARCHAR(255) NOT NULL
expires_at | TIMESTAMP NOT NULL
created_at | TIMESTAMP DEFAULT NOW()
```

---

## 🛠️ Testing

### PowerShell Test
```powershell
.\test-wallet-only-auth.ps1
```

### Manual Test
1. Backend läuft auf Port 3000
2. Browser mit MetaMask öffnen
3. MetaMask auf Testnet oder Mainnet
4. Registrieren → Login testen

---

## 🔒 Sicherheit

- ✅ Keine Passwörter gespeichert
- ✅ Signatur-Verifizierung
- ✅ Nonce läuft nach 10 Min ab
- ✅ JWT Token 7 Tage gültig
- ✅ Username-Validierung

---

## 📂 Geänderte Dateien

### Backend
- `backend/migrations/002_wallet_only_auth.js` (NEU)
- `backend/src/routes/auth.js` (ERSETZT)
- `backend/src/routes/auth_old_backup.js` (BACKUP)

### Frontend
- `frontend/index.html` (GEÄNDERT)
- `frontend/assets/js/auth.js` (ERSETZT)
- `frontend/assets/js/auth_old_backup.js` (BACKUP)
- `frontend/assets/css/wallet-auth.css` (NEU)

### Dokumentation
- `WALLET_AUTH_IMPLEMENTATION.md` (NEU)
- `test-wallet-only-auth.ps1` (NEU)

---

## ⚠️ Wichtige Hinweise

1. **Migration ausführen!**
   ```bash
   cd backend
   npm run migrate
   ```

2. **MetaMask erforderlich**
   - Nur mit MetaMask funktioniert die App
   - Andere Wallets müssen separat implementiert werden

3. **Alte Daten**
   - Email/Password-User werden durch Migration gelöscht
   - Backup vor Migration empfohlen!

4. **Environment Variables**
   ```
   JWT_SECRET=your-secret-key
   JWT_EXPIRY=7d
   DATABASE_URL=postgresql://...
   ```

---

## 🆘 Troubleshooting

### "MetaMask not installed"
→ Installiere MetaMask Browser Extension

### "Failed to connect wallet"
→ MetaMask entsperren und Account auswählen

### "Nonce expired"
→ Prozess erneut starten (neuer Nonce wird generiert)

### "Username already taken"
→ Anderen Username wählen

### "Wallet already registered"
→ Zum Login wechseln

### "Invalid signature"
→ MetaMask Signatur erneut durchführen

---

## 📞 Support

Bei Problemen:
1. Console-Log im Browser prüfen (F12)
2. Backend-Logs prüfen
3. Test-Skript ausführen
4. Dokumentation lesen

---

✅ **Ready to go!** 🚀
