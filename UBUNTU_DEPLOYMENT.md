# 🚀 Ubuntu Deployment Guide - Klassik Backend

## 📋 Voraussetzungen

- Ubuntu Server (20.04 oder neuer)
- PostgreSQL läuft auf `localhost:5432`
- Database `klassik` existiert
- SSH-Zugriff zum Server

---

## 🎯 Deployment-Schritte

### 1. Projekt auf Ubuntu Server kopieren

**Von Windows PowerShell:**

```powershell
# Mit SCP (ersetze USER und SERVER_IP)
scp -r C:\Users\TUF-s\Desktop\git\Klassik user@SERVER_IP:/home/user/

# Oder mit Git (empfohlen!)
# Auf Ubuntu:
cd /home/user
git clone https://github.com/meme-2025/klassik-app.git klassik
cd klassik
git checkout klassik1
```

---

### 2. Auf Ubuntu Server einloggen

```bash
ssh user@SERVER_IP
cd /home/user/klassik
```

---

### 3. Deployment-Script ausführen

```bash
# Script ausführbar machen
chmod +x deploy-ubuntu.sh

# Deployment starten
./deploy-ubuntu.sh
```

**Was macht das Script:**
- ✅ System-Updates
- ✅ Node.js & npm Installation
- ✅ PM2 Installation
- ✅ PostgreSQL Check
- ✅ Database Check/Erstellung
- ✅ npm install
- ✅ Firewall konfigurieren (Port 8130)
- ✅ PM2 starten
- ✅ Auto-Start bei Server-Reboot

---

### 4. Manueller Start (Alternative)

Falls Script nicht funktioniert:

```bash
cd /home/user/klassik/backend

# Dependencies installieren
npm install

# PM2 global installieren
sudo npm install -g pm2

# Backend starten
pm2 start src/index.js --name klassik-backend

# Auto-Start einrichten
pm2 startup
pm2 save

# Firewall
sudo ufw allow 8130/tcp
```

---

## 🔧 Konfiguration

### Backend .env

Bereits konfiguriert in `backend/.env`:

```env
NODE_ENV=production
PORT=8130
DATABASE_URL=postgresql://klassik:password@localhost:5432/klassik
CORS_ORIGIN=*
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

**⚠️ Wichtig:** 
- `DATABASE_URL` Passwort anpassen!
- `JWT_SECRET` durch sicheren Wert ersetzen:
  ```bash
  openssl rand -base64 32
  ```

---

## 🌐 Von außen erreichbare Endpoints

### Server IP herausfinden:

```bash
curl ifconfig.me
```

Beispiel Output: `203.0.113.45`

### API Endpoints:

**Base URL:** `http://203.0.113.45:8130`

| Methode | Endpoint | Beschreibung |
|---------|----------|--------------|
| GET | `/health` | Health Check |
| POST | `/api/auth/register` | User registrieren (Email/Passwort) |
| POST | `/api/auth/login` | User einloggen |
| GET | `/api/auth/user?address=0x...` | Wallet prüfen |
| POST | `/api/auth/user` | Wallet registrieren |
| GET | `/api/auth/nonce?address=0x...` | Nonce für Signatur |
| POST | `/api/auth/signin-with-wallet` | Wallet Login |
| GET | `/api/kaspa/stats` | Kaspa Blockchain Stats |
| GET | `/api/products` | Produkte auflisten |
| POST | `/api/products` | Produkt erstellen (Auth) |
| POST | `/api/payments/invoice` | Payment Invoice |
| POST | `/api/orders` | Order erstellen (Auth) |
| GET | `/api/orders` | Orders auflisten (Auth) |

---

## 🧪 Testing

### 1. Health Check

```bash
# Lokal auf Server
curl http://localhost:8130/health

# Von außen
curl http://203.0.113.45:8130/health

# Erwartete Antwort:
# {"status":"ok","timestamp":"2025-12-09T...","environment":"production"}
```

### 2. Wallet Registration Flow

```bash
# 1. Check if wallet exists
curl "http://203.0.113.45:8130/api/auth/user?address=0x2a04b64d4641cda7271289d2da6bbf27de02d823"

# 2. Register wallet
curl -X POST http://203.0.113.45:8130/api/auth/user \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x2a04b64d4641cda7271289d2da6bbf27de02d823",
    "username": "testuser"
  }'

# 3. Get nonce
curl "http://203.0.113.45:8130/api/auth/nonce?address=0x2a04b64d4641cda7271289d2da6bbf27de02d823"
```

### 3. Browser Test

```
http://203.0.113.45:8130/gateway.html
http://203.0.113.45:8130/test-api-flow.html
```

---

## 📊 PM2 Management

### Status prüfen

```bash
pm2 status
pm2 logs klassik-backend
pm2 monit
```

### Neustart

```bash
pm2 restart klassik-backend
```

### Stoppen

```bash
pm2 stop klassik-backend
```

### Logs anzeigen

```bash
# Alle Logs
pm2 logs

# Nur Fehler
pm2 logs klassik-backend --err

# Live-Logs
pm2 logs klassik-backend --lines 100
```

### Bei Code-Änderungen

```bash
cd /home/user/klassik
git pull origin klassik1
cd backend
npm install  # Falls neue Dependencies
pm2 restart klassik-backend
```

---

## 🔒 Sicherheit

### 1. JWT Secret ändern

```bash
cd /home/user/klassik/backend
nano .env

# Generiere sicheren Secret:
openssl rand -base64 32
# Kopiere Output in .env bei JWT_SECRET=

pm2 restart klassik-backend
```

### 2. DB Passwort ändern

```bash
# PostgreSQL Passwort setzen
sudo -u postgres psql
ALTER USER klassik WITH PASSWORD 'DeinSicheresPasswort123!';
\q

# .env anpassen
nano .env
# DATABASE_URL=postgresql://klassik:DeinSicheresPasswort123!@localhost:5432/klassik

pm2 restart klassik-backend
```

### 3. CORS einschränken (Produktion)

```bash
nano .env

# Von:
CORS_ORIGIN=*

# Zu (nur deine Domain):
CORS_ORIGIN=https://deine-domain.com,https://www.deine-domain.com

pm2 restart klassik-backend
```

### 4. Firewall

```bash
# Nur Port 8130 und SSH
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 8130/tcp
sudo ufw enable
sudo ufw status
```

---

## 🌍 Mit NGINX Reverse Proxy (Optional)

### Vorteile:
- ✅ SSL/HTTPS Support
- ✅ Port 80/443 statt 8130
- ✅ Better Performance
- ✅ Load Balancing

### NGINX Installation

```bash
sudo apt install -y nginx

# Config erstellen
sudo nano /etc/nginx/sites-available/klassik
```

**NGINX Config:**

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name deine-domain.com;

    location / {
        proxy_pass http://localhost:8130;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Config aktivieren
sudo ln -s /etc/nginx/sites-available/klassik /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Firewall
sudo ufw allow 'Nginx Full'
```

**Mit SSL (Let's Encrypt):**

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d deine-domain.com
```

---

## 🚨 Troubleshooting

### Backend startet nicht

```bash
# Logs prüfen
pm2 logs klassik-backend --err

# Manuell starten für Debug
cd /home/user/klassik/backend
node src/index.js
```

### PostgreSQL Connection Error

```bash
# PostgreSQL Status
sudo systemctl status postgresql

# PostgreSQL starten
sudo systemctl start postgresql

# Connection testen
psql -h localhost -U klassik -d klassik
```

### Port 8130 nicht erreichbar

```bash
# Firewall prüfen
sudo ufw status

# Port öffnen
sudo ufw allow 8130/tcp

# Prüfe ob Backend läuft
sudo netstat -tuln | grep 8130
```

### "Cannot find module" Error

```bash
cd /home/user/klassik/backend
rm -rf node_modules package-lock.json
npm install
pm2 restart klassik-backend
```

---

## ✅ Checkliste

- [ ] Projekt auf Ubuntu kopiert
- [ ] PostgreSQL läuft (`sudo systemctl status postgresql`)
- [ ] Database `klassik` existiert
- [ ] `.env` konfiguriert (Port 8130, JWT_SECRET)
- [ ] `npm install` ausgeführt
- [ ] PM2 gestartet (`pm2 start src/index.js`)
- [ ] Firewall konfiguriert (`sudo ufw allow 8130/tcp`)
- [ ] Health Check erfolgreich (`curl http://localhost:8130/health`)
- [ ] Von außen erreichbar (`curl http://SERVER_IP:8130/health`)
- [ ] PM2 Auto-Start eingerichtet (`pm2 startup` + `pm2 save`)

---

## 🎯 Quick Commands

```bash
# Status
pm2 status

# Logs
pm2 logs klassik-backend --lines 50

# Neustart
pm2 restart klassik-backend

# Server IP
curl ifconfig.me

# Health Check
curl http://localhost:8130/health

# Database prüfen
sudo -u postgres psql -d klassik -c "SELECT * FROM users;"
```

---

## 📞 Support

Bei Problemen:
1. PM2 Logs prüfen: `pm2 logs klassik-backend`
2. Backend manuell starten: `cd backend && node src/index.js`
3. PostgreSQL testen: `psql -h localhost -U klassik -d klassik`
