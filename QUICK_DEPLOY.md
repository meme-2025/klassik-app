# 🚀 Git Push & Ubuntu Deployment - Schnellanleitung

## ⚡ Schritt 1: Projekt auf GitHub pushen

```powershell
# In PowerShell (Windows)
cd C:\Users\TUF-s\Desktop\git\Klassik

# Git Status prüfen
git status

# Alle Änderungen hinzufügen
git add .

# Commit
git commit -m "Backend configured for Ubuntu - Port 8130, wallet auth, all endpoints ready"

# Push zu GitHub
git push origin klassik1
```

---

## ⚡ Schritt 2: Auf Ubuntu Server deployen

```bash
# SSH auf Ubuntu Server
ssh user@YOUR_SERVER_IP

# Projekt klonen/pullen
cd ~
git clone https://github.com/meme-2025/klassik-app.git klassik
# Oder falls schon existiert:
cd klassik
git pull origin klassik1

# Deployment-Script ausführen
chmod +x deploy-ubuntu.sh
./deploy-ubuntu.sh
```

---

## ⚡ Schritt 3: Testen

```bash
# Auf Ubuntu Server:
curl http://localhost:8130/health

# Server IP herausfinden
curl ifconfig.me
# z.B. Output: 203.0.113.45

# Von Windows Browser:
# http://203.0.113.45:8130/gateway.html
# http://203.0.113.45:8130/test-api-flow.html
```

---

## 📋 API Endpoints (von außen erreichbar)

**Base URL:** `http://YOUR_SERVER_IP:8130`

### Authentication:
- `POST /api/auth/register` - Email/Passwort Registration
- `POST /api/auth/login` - Email/Passwort Login
- `GET /api/auth/user?address=0x...` - Wallet prüfen
- `POST /api/auth/user` - Wallet registrieren (address + username)
- `GET /api/auth/nonce?address=0x...` - Nonce für Wallet-Signatur
- `POST /api/auth/signin-with-wallet` - Wallet Login mit Signatur

### Kaspa:
- `GET /api/kaspa/stats` - Blockchain Stats

### Products:
- `GET /api/products` - Alle Produkte
- `POST /api/products` - Produkt erstellen (Auth required)

### Payments:
- `POST /api/payments/invoice` - Payment Invoice erstellen

### Orders:
- `POST /api/orders` - Order erstellen (Auth required)
- `GET /api/orders` - Orders auflisten (Auth required)

---

## 🔧 Nach dem Deployment

### PM2 Befehle:

```bash
pm2 status                    # Status anzeigen
pm2 logs klassik-backend      # Logs live anzeigen
pm2 restart klassik-backend   # Neustart
pm2 stop klassik-backend      # Stoppen
pm2 monit                     # Monitoring Dashboard
```

### Bei Code-Änderungen:

```bash
cd ~/klassik
git pull origin klassik1
cd backend
npm install  # Falls neue Dependencies
pm2 restart klassik-backend
```

---

## ✅ Das ist jetzt konfiguriert:

- ✅ Backend Port: **8130**
- ✅ PostgreSQL: **localhost:5432**
- ✅ CORS: **\* (alle Origins erlaubt)**
- ✅ Environment: **production**
- ✅ Wallet Authentication: **Funktioniert**
- ✅ API Endpoints: **Alle von außen erreichbar**
- ✅ Frontend: **gateway.html, test-api-flow.html**

---

## 🎯 Test-URLs (nach Deployment):

Ersetze `YOUR_SERVER_IP` mit deiner echten Server-IP:

```
http://YOUR_SERVER_IP:8130/health
http://YOUR_SERVER_IP:8130/gateway.html
http://YOUR_SERVER_IP:8130/test-api-flow.html
```

**Wallet Registration:**
1. Browser öffnen: `http://YOUR_SERVER_IP:8130/gateway.html`
2. "Wallet Verbinden" klicken
3. MetaMask verbinden
4. Username eingeben
5. Signieren
6. ✅ User wird in Ubuntu PostgreSQL gespeichert!

---

## 🚨 Wichtig vor Produktion:

1. **JWT Secret ändern:**
   ```bash
   openssl rand -base64 32
   # In .env eintragen bei JWT_SECRET=
   ```

2. **DB Passwort ändern:**
   ```bash
   sudo -u postgres psql
   ALTER USER klassik WITH PASSWORD 'SicheresPasswort123!';
   # In .env DATABASE_URL anpassen
   ```

3. **CORS einschränken:**
   ```env
   # In .env:
   CORS_ORIGIN=https://deine-domain.com
   ```

4. **Firewall prüfen:**
   ```bash
   sudo ufw status
   sudo ufw allow 8130/tcp
   ```
