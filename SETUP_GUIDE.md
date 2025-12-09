# 🚀 Klassik Backend Setup & Deployment Guide

## ✅ Aktuelle Situation
- Backend läuft auf Ubuntu
- Nginx ist konfiguriert
- Frontend wird erreicht
- .env ist eingerichtet
- **Problem**: Register/Login funktioniert nicht → Datenbank-Tabellen fehlen

---

## 📋 Schritt-für-Schritt Setup

### 1. Datenbank initialisieren (auf Ubuntu Server)

```bash
# Wechsel ins Backend-Verzeichnis
cd ~/klassik/backend  # oder dein Pfad

# Datenbank initialisieren
node init-db.js
```

**Erwartete Ausgabe:**
```
🚀 Initializing database...
✅ Database initialized successfully!
📊 Created tables:
   - users (with email & wallet support)
   - nonces (for wallet authentication)
   - events
   - bookings
   - products
   - orders
   - payments
   - swap_transactions
```

### 2. Backend neustarten

```bash
# PM2 neustart (falls PM2 verwendet wird)
pm2 restart klassik-backend

# ODER mit npm
npm start

# ODER als Service
sudo systemctl restart klassik.service
```

### 3. Auth-Funktionalität testen (von Windows aus)

```powershell
# Test-Script ausführen
cd C:\Users\TUF-s\Desktop\git\Klassik
.\test-auth.ps1
```

**Erwartete Ausgabe:**
```
✅ Health check: OK
✅ Auth routes: OK
✅ Registration: OK
✅ Login: OK
```

---

## 🔧 Troubleshooting

### Problem: "Database connection failed"

**Lösung:**
```bash
# PostgreSQL Status prüfen
sudo systemctl status postgresql

# PostgreSQL starten
sudo systemctl start postgresql

# .env prüfen
cat .env | grep DATABASE_URL
```

### Problem: "Table does not exist"

**Lösung:**
```bash
# Datenbank-Initialisierung erneut ausführen
node init-db.js
```

### Problem: "Port 3000 already in use"

**Lösung:**
```bash
# Prozess finden und beenden
lsof -i :3000
kill -9 <PID>

# Oder Port in .env ändern
echo "PORT=3001" >> .env
```

### Problem: Frontend kann Backend nicht erreichen

**Nginx Config prüfen:**
```bash
# Nginx Config testen
sudo nginx -t

# Nginx neuladen
sudo nginx -s reload

# Logs prüfen
sudo tail -f /var/log/nginx/error.log
```

---

## 🎯 Alle wichtigen Endpunkte

### Public Endpoints
- `GET /health` - Health check
- `GET /api/auth/test` - Auth info
- `POST /api/auth/register` - Register mit Email/Password
- `POST /api/auth/login` - Login mit Email/Password

### Wallet Auth Endpoints
- `GET /api/auth/nonce?address=0x...` - Nonce für Wallet-Auth
- `POST /api/auth/signin-with-wallet` - Login mit Wallet
- `GET /api/auth/user?address=0x...` - User via Wallet finden
- `POST /api/auth/user` - Wallet registrieren

### Protected Endpoints (benötigen JWT Token)
- `GET /api/users/me` - Eigenes Profil
- `GET /api/orders` - Alle Orders
- `POST /api/orders` - Neue Order erstellen
- `GET /api/products` - Alle Produkte

---

## 📊 Datenbank Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  address VARCHAR(42),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Nonces Table (für Wallet Auth)
```sql
CREATE TABLE nonces (
  address VARCHAR(42) PRIMARY KEY,
  nonce VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔐 Sicherheit

### Environment Variables (.env)
```bash
# Wichtig: Niemals in Git committen!
JWT_SECRET=<starkes-secret-generieren>
DATABASE_URL=postgresql://user:password@localhost:5432/klassik
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
```

### JWT Secret generieren
```bash
# Auf Ubuntu Server
openssl rand -base64 32
```

---

## 🚦 Status Check Kommandos

```bash
# Backend Status (PM2)
pm2 status klassik-backend
pm2 logs klassik-backend

# Nginx Status
sudo systemctl status nginx

# PostgreSQL Status
sudo systemctl status postgresql

# Ports prüfen
netstat -tlnp | grep -E '3000|80|443|5432'

# Logs live anschauen
tail -f ~/klassik/backend/logs/app.log
pm2 logs klassik-backend --lines 50
```

---

## 🎨 Frontend Integration

Das Frontend ist bereits korrekt konfiguriert und verwendet:
- `/api/auth/register` für Registrierung
- `/api/auth/login` für Login
- JWT Token wird in localStorage gespeichert
- Authorization Header: `Bearer <token>`

---

## ✅ Finale Checkliste

- [ ] PostgreSQL läuft (`systemctl status postgresql`)
- [ ] Datenbank initialisiert (`node init-db.js`)
- [ ] Backend läuft (`pm2 status` oder `systemctl status klassik`)
- [ ] Nginx läuft (`systemctl status nginx`)
- [ ] .env korrekt konfiguriert
- [ ] Health check erfolgreich (`curl http://localhost:3000/health`)
- [ ] Auth test erfolgreich (test-auth.ps1)
- [ ] Frontend kann Backend erreichen
- [ ] Register funktioniert
- [ ] Login funktioniert

---

## 🆘 Noch Probleme?

### Backend Logs prüfen:
```bash
# PM2 Logs
pm2 logs klassik-backend --lines 100

# Service Logs
sudo journalctl -u klassik.service -f

# Node direkt starten (für Debugging)
cd ~/klassik/backend
npm start
```

### Datenbank direkt prüfen:
```bash
# PostgreSQL Shell
psql -U klassik -d klassik

# In psql:
\dt                    # Tabellen anzeigen
SELECT * FROM users;   # Users anzeigen
\q                     # Beenden
```

---

## 📝 Nächste Schritte nach erfolgreicher Installation

1. ✅ Test-User erstellen und Login testen
2. 🛍️ Produkte hinzufügen (`npm run seed-products`)
3. 🎫 Events erstellen
4. 🔐 SSL/HTTPS einrichten (Let's Encrypt)
5. 🔥 Firewall konfigurieren
6. 📊 Monitoring einrichten (PM2, Nginx logs)

---

**Viel Erfolg! 🚀**
