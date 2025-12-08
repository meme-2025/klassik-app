# 🚀 Klassik App - Komplette Setup & Deployment Anleitung

## 📋 Projekt-Übersicht

Diese App besteht aus:
- **Backend**: Node.js/Express API (Port 3000)
- **Frontend**: Static HTML/CSS/JS 
- **Datenbank**: PostgreSQL
- **Blockchain**: Ethereum/Kaspa Wallet Integration

---

## 🔧 Lokale Entwicklung (Windows)

### 1. Voraussetzungen installieren

```powershell
# Node.js 18+ und PostgreSQL müssen installiert sein
node --version  # sollte v18.x oder höher sein
psql --version  # sollte PostgreSQL 12+ sein
```

### 2. Datenbank erstellen

```powershell
# PostgreSQL starten und DB erstellen
psql -U postgres

# In psql:
CREATE DATABASE klassik;
CREATE USER klassik WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE klassik TO klassik;
\q
```

### 3. Backend Setup

```powershell
cd backend

# Dependencies installieren
npm install

# .env prüfen (sollte bereits existieren)
# Falls nicht, aus .env.example kopieren und anpassen

# Datenbank-Migrationen ausführen
npm run migrate:up

# Optional: Test-Daten laden
npm run seed

# Server starten
npm run dev
```

Backend läuft auf: **http://localhost:3000**

### 4. Frontend testen

Das Frontend wird automatisch vom Backend unter `/` ausgeliefert.

Öffne im Browser: **http://localhost:3000**

---

## 🐧 Ubuntu Server Deployment

### Option 1: Automatisches Setup (empfohlen)

```bash
# Auf Ubuntu Server per SSH einloggen
ssh dein-user@deine-server-ip

# Setup-Script herunterladen und ausführen
curl -fsSL https://raw.githubusercontent.com/meme-2025/klassik-app/main/backend/deploy/setup-ubuntu.sh -o setup.sh
chmod +x setup.sh
./setup.sh
```

Das Script macht automatisch:
✅ Node.js 18 installieren
✅ PostgreSQL einrichten
✅ Projekt klonen
✅ .env Datei erstellen
✅ Migrationen ausführen
✅ systemd Service einrichten
✅ nginx konfigurieren
✅ Firewall aktivieren

**Nach 3-5 Minuten ist alles ready!**

### Option 2: Manuelle Installation

```bash
# 1. System aktualisieren
sudo apt update && sudo apt upgrade -y

# 2. Dependencies installieren
sudo apt install -y curl git nginx postgresql postgresql-contrib build-essential

# 3. Node.js 18 installieren
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 4. PostgreSQL einrichten
sudo -u postgres psql -c "CREATE USER klassik WITH PASSWORD 'DEIN_STARKES_PASSWORT';"
sudo -u postgres psql -c "CREATE DATABASE klassik OWNER klassik;"

# 5. Projekt klonen
sudo mkdir -p /opt/klassik
sudo chown $USER:$USER /opt/klassik
cd /opt/klassik
git clone https://github.com/meme-2025/klassik-app.git .

# 6. Backend konfigurieren
cd backend
npm ci --production

# 7. .env Datei erstellen
sudo mkdir -p /etc/klassik
sudo nano /etc/klassik/klassik.env
```

**Inhalt der /etc/klassik/klassik.env:**

```env
DATABASE_URL=postgresql://klassik:DEIN_PASSWORT@localhost:5432/klassik
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRY=7d
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://deine-domain.com
ENABLE_WATCHER=false
```

```bash
# Berechtigungen setzen
sudo chown root:root /etc/klassik/klassik.env
sudo chmod 600 /etc/klassik/klassik.env

# 8. Migrationen ausführen
export $(cat /etc/klassik/klassik.env | xargs)
npm run migrate:up

# 9. systemd Service einrichten
sudo cp deploy/klassik.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable klassik
sudo systemctl start klassik

# Status prüfen
sudo systemctl status klassik
sudo journalctl -u klassik -f

# 10. nginx einrichten
sudo cp deploy/nginx.conf /etc/nginx/sites-available/klassik
sudo ln -s /etc/nginx/sites-available/klassik /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# 11. Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

---

## ✅ Funktionen testen

### 1. Health Check

```bash
# Lokal
curl http://localhost:3000/health

# Production
curl https://deine-domain.com/health
```

Erwartete Antwort:
```json
{
  "status": "ok",
  "timestamp": "2025-12-08T...",
  "environment": "production"
}
```

### 2. Register testen

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

Erwartete Antwort:
```json
{
  "user": {
    "id": 1,
    "email": "test@example.com",
    "created_at": "..."
  },
  "token": "eyJhbGc...",
  "expiresIn": "7d"
}
```

### 3. Login testen

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

### 4. Wallet Connect testen (im Browser)

1. Browser öffnen: `http://localhost:3000`
2. MetaMask installieren (falls nicht vorhanden)
3. "Connect Wallet" Button klicken
4. MetaMask Popup bestätigen
5. Email eingeben (wenn Wallet noch nicht registriert)
6. Nachricht signieren

### 5. Protected Endpoint testen

```bash
TOKEN="dein-jwt-token-hier"

curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 Monitoring & Logs

### Logs ansehen (Ubuntu)

```bash
# Backend Logs
sudo journalctl -u klassik -f

# nginx Logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# PostgreSQL Logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### Service Management

```bash
# Service neu starten
sudo systemctl restart klassik

# Service stoppen
sudo systemctl stop klassik

# Service Status
sudo systemctl status klassik

# Nach Code-Update
cd /opt/klassik
git pull origin main
cd backend
npm ci --production
npm run migrate:up
sudo systemctl restart klassik
```

### Datenbank prüfen

```bash
# In PostgreSQL einloggen
sudo -u postgres psql -d klassik

# Wichtige Queries
SELECT * FROM users LIMIT 5;
SELECT COUNT(*) FROM users;
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;

# Verbindungen prüfen
SELECT count(*) FROM pg_stat_activity WHERE datname = 'klassik';
```

---

## 🔒 Sicherheits-Checkliste

### Produktions-Umgebung

- [ ] `.env` Datei mit starken Passwörtern (nicht in Git!)
- [ ] JWT_SECRET mit `openssl rand -base64 32` generieren
- [ ] PostgreSQL User hat sichere Passwörter
- [ ] CORS_ORIGIN auf deine Domain begrenzen
- [ ] Firewall (ufw) aktiviert
- [ ] SSL/TLS Zertifikat (Let's Encrypt) installieren
- [ ] nginx Rate Limiting aktivieren
- [ ] Backup-Strategie für Datenbank

### SSL mit Let's Encrypt (empfohlen)

```bash
# Certbot installieren
sudo apt install certbot python3-certbot-nginx

# Zertifikat erstellen
sudo certbot --nginx -d deine-domain.com -d www.deine-domain.com

# Auto-Renewal testen
sudo certbot renew --dry-run
```

---

## 🐛 Troubleshooting

### Backend startet nicht

```bash
# Logs prüfen
sudo journalctl -u klassik -n 50

# Häufige Probleme:
# 1. DB-Verbindung fehlerhaft -> DATABASE_URL in .env prüfen
# 2. Port bereits belegt -> sudo lsof -i :3000
# 3. Node Version -> node --version (muss >= 18 sein)
```

### Datenbank-Verbindungsfehler

```bash
# PostgreSQL läuft?
sudo systemctl status postgresql

# Verbindung testen
psql -U klassik -d klassik -h localhost

# Falls Passwort-Auth fehlschlägt:
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Zeile ändern zu: local all all md5
sudo systemctl restart postgresql
```

### Frontend lädt nicht

```bash
# nginx Status
sudo systemctl status nginx

# Config testen
sudo nginx -t

# Frontend-Dateien vorhanden?
ls -la /opt/klassik/frontend/
```

### Wallet Connect funktioniert nicht

1. Browser-Konsole öffnen (F12)
2. Fehler prüfen
3. Häufige Probleme:
   - MetaMask nicht installiert
   - Falsches Netzwerk (muss Ethereum Mainnet sein)
   - API_URL stimmt nicht (sollte automatisch `window.location.origin` sein)

---

## 📝 API Endpoints Übersicht

### Public Endpoints

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/health` | Health check |
| POST | `/api/auth/register` | Email/Password Registrierung |
| POST | `/api/auth/login` | Email/Password Login |
| GET | `/api/auth/nonce?address=0x...` | Nonce für Wallet-Auth |
| POST | `/api/auth/signin-with-wallet` | Wallet-Authentifizierung |
| GET | `/api/auth/user?address=0x...` | User by Wallet-Adresse |
| POST | `/api/auth/user` | Wallet-User registrieren |
| GET | `/api/products` | Produkte auflisten |
| GET | `/api/kaspa/stats` | Kaspa Blockchain Stats |

### Protected Endpoints (benötigen JWT Token)

| Method | Endpoint | Beschreibung |
|--------|----------|--------------|
| GET | `/api/users/me` | Eigenes Profil |
| PUT | `/api/users/me` | Profil aktualisieren |
| GET | `/api/orders` | Eigene Orders |
| POST | `/api/orders` | Order erstellen |
| GET | `/api/bookings` | Eigene Bookings |
| POST | `/api/bookings` | Booking erstellen |

---

## 🎯 Nächste Schritte

1. ✅ **Grundsetup funktioniert**
2. 🔄 Admin-Panel für Produkt-Verwaltung
3. 🔄 Kaspa Payment Integration
4. 🔄 Email-Verifizierung
5. 🔄 Passwort-Reset-Funktion
6. 🔄 Rate Limiting verfeinern
7. 🔄 Automated Tests

---

## 💬 Support

Bei Problemen:
1. Logs prüfen (`journalctl -u klassik -f`)
2. Browser-Konsole öffnen (F12)
3. GitHub Issues: https://github.com/meme-2025/klassik-app/issues
