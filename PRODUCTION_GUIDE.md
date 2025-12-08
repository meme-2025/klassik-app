# 🚀 Production Setup - Klassik Backend auf Ubuntu

**Existierende Datenbank:** `klassikdb`  
**Tabellen:** users, bookings, events

---

## ⚡ Schnellstart (Automatisch)

```bash
# Im Projekt-Verzeichnis
cd /pfad/zu/klassik

# Setup-Script ausführbar machen
chmod +x production-setup.sh

# Setup starten (wird nach DB-Passwort fragen)
sudo bash production-setup.sh
```

Das Script macht automatisch:
- ✅ Prüft Node.js & PostgreSQL
- ✅ Testet Verbindung zu `klassikdb`
- ✅ Installiert Dependencies
- ✅ Erstellt `.env` mit sicheren Secrets
- ✅ Führt Migrationen aus (falls nötig)
- ✅ Erstellt systemd Service
- ✅ Startet Backend (Port 3000)
- ✅ Führt Health Check aus

**Dauer:** ca. 2-3 Minuten

---

## 📋 Manuelle Installation

### 1. Datenbank-Verbindung prüfen

```bash
# Verbindung testen
psql -U klassik -d klassikdb -h localhost

# Passwort eingeben, dann in psql:
\dt                              # Tabellen anzeigen
SELECT * FROM users LIMIT 5;     # Users prüfen
SELECT * FROM events;            # Events prüfen
SELECT * FROM bookings;          # Bookings prüfen
\q                               # Verlassen
```

### 2. Backend-Verzeichnis vorbereiten

```bash
cd /pfad/zu/klassik/backend

# Dependencies installieren
npm install --production
```

### 3. Production .env erstellen

```bash
# .env im backend/ Verzeichnis erstellen
nano .env
```

**Inhalt (.env):**

```env
# ============================================
# Database Configuration
# ============================================
DATABASE_URL=postgresql://klassik:DEIN_DB_PASSWORT@localhost:5432/klassikdb

# ============================================
# Server Configuration
# ============================================
NODE_ENV=production
PORT=3000
BASE_URL=http://deine-server-ip:3000
FRONTEND_URL=http://deine-server-ip:3000

# CORS (für Production: Domain angeben)
CORS_ORIGIN=*

# ============================================
# JWT Authentication
# ============================================
# Generieren mit: openssl rand -base64 32
JWT_SECRET=HIER_SICHEREN_KEY_EINGEBEN
JWT_EXPIRY=7d

# ============================================
# Blockchain
# ============================================
ENABLE_WATCHER=false

# ============================================
# Logging
# ============================================
LOG_LEVEL=info
```

**Berechtigungen setzen:**

```bash
chmod 600 .env
```

### 4. Datenbank-Schema prüfen/aktualisieren

```bash
# Migrationen ausführen (erstellt fehlende Spalten)
npm run migrate:up

# Wenn Fehler: Bereits existierende Tabellen werden übersprungen
```

**Wichtig:** Die Migrationen fügen nur fehlende Spalten hinzu:
- `users`: `address`, `nonce`, `nonce_expiry` (für Wallet-Auth)
- `orders`, `deposits`, `swaps` (werden neu erstellt falls nicht vorhanden)

### 5. Backend testen (Development Mode)

```bash
# Test-Start
npm run dev

# In anderem Terminal testen:
curl http://localhost:3000/health

# Sollte zeigen:
# {"status":"ok","timestamp":"...","environment":"development"}
```

Wenn funktioniert: `CTRL+C` zum Stoppen

### 6. systemd Service erstellen

```bash
# Service-Datei erstellen
sudo nano /etc/systemd/system/klassik.service
```

**Inhalt (klassik.service):**

```ini
[Unit]
Description=Klassik Backend Server
After=network.target postgresql.service

[Service]
Type=simple
User=DEIN_UBUNTU_USER
WorkingDirectory=/pfad/zu/klassik/backend
EnvironmentFile=/pfad/zu/klassik/backend/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=klassik

[Install]
WantedBy=multi-user.target
```

**Wichtig:** `User=` und `WorkingDirectory=` anpassen!

### 7. Service aktivieren & starten

```bash
# systemd neu laden
sudo systemctl daemon-reload

# Service aktivieren (Auto-Start beim Booten)
sudo systemctl enable klassik

# Service starten
sudo systemctl start klassik

# Status prüfen
sudo systemctl status klassik

# Sollte zeigen: active (running)
```

### 8. Logs prüfen

```bash
# Live-Logs anzeigen
sudo journalctl -u klassik -f

# Sollte zeigen:
# 🎵 Klassik Backend Server
# Environment: production
# Port: 3000
# ✅ Database connected successfully
```

### 9. Tests

```bash
# Health Check
curl http://localhost:3000/health

# API testen
curl http://localhost:3000/api/products

# User registrieren
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@klassik.com","password":"Test123!"}'

# In DB prüfen
psql -U klassik -d klassikdb -h localhost -c "SELECT * FROM users;"
```

---

## 🔥 Backend läuft jetzt!

### Service-Management

```bash
# Status
sudo systemctl status klassik

# Neu starten (nach Code-Änderungen)
sudo systemctl restart klassik

# Stoppen
sudo systemctl stop klassik

# Starten
sudo systemctl start klassik

# Logs
sudo journalctl -u klassik -f           # Live
sudo journalctl -u klassik -n 100       # Letzte 100 Zeilen
sudo journalctl -u klassik --since today # Heute
```

### Code aktualisieren

```bash
cd /pfad/zu/klassik

# Neueste Version holen
git pull origin main

# Dependencies aktualisieren
cd backend
npm install --production

# Migrationen (falls neue vorhanden)
npm run migrate:up

# Service neu starten
sudo systemctl restart klassik

# Logs prüfen
sudo journalctl -u klassik -f
```

---

## 🌐 nginx Reverse Proxy (Optional, empfohlen)

### Installation

```bash
sudo apt install nginx -y
```

### Konfiguration

```bash
sudo nano /etc/nginx/sites-available/klassik
```

**Inhalt:**

```nginx
server {
    listen 80;
    server_name deine-domain.com www.deine-domain.com;

    # Frontend (Static Files)
    location / {
        root /pfad/zu/klassik/frontend;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health Check
    location /health {
        proxy_pass http://localhost:3000;
    }
}
```

### Aktivieren

```bash
# Symlink erstellen
sudo ln -s /etc/nginx/sites-available/klassik /etc/nginx/sites-enabled/

# Default-Site deaktivieren
sudo rm /etc/nginx/sites-enabled/default

# Config testen
sudo nginx -t

# nginx neu laden
sudo systemctl reload nginx
```

### Testen

```bash
# Von außen (Browser oder curl)
curl http://deine-server-ip/health
curl http://deine-server-ip/api/products
```

---

## 🔒 SSL/TLS mit Let's Encrypt

```bash
# Certbot installieren
sudo apt install certbot python3-certbot-nginx -y

# Zertifikat erstellen (Domain muss auf Server zeigen!)
sudo certbot --nginx -d deine-domain.com -d www.deine-domain.com

# Auto-Renewal testen
sudo certbot renew --dry-run
```

Jetzt läuft die App über **HTTPS**! 🎉

---

## 🛡️ Firewall

```bash
# UFW installieren (falls nicht vorhanden)
sudo apt install ufw -y

# SSH erlauben (WICHTIG!)
sudo ufw allow OpenSSH

# HTTP & HTTPS
sudo ufw allow 'Nginx Full'

# Oder nur spezifische Ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Firewall aktivieren
sudo ufw enable

# Status
sudo ufw status
```

---

## 📊 Monitoring

### CPU & RAM Überwachung

```bash
# htop installieren
sudo apt install htop -y

# Starten
htop

# Klassik-Prozess suchen (F4 zum Filtern, "node" eingeben)
```

### Disk Space

```bash
df -h
```

### Datenbank-Statistiken

```bash
psql -U klassik -d klassikdb -h localhost << EOF
-- Datenbank-Größe
SELECT pg_size_pretty(pg_database_size('klassikdb'));

-- Tabellen-Größen
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Anzahl Einträge
SELECT 
  'users' as table_name, COUNT(*) FROM users
UNION ALL
SELECT 'events', COUNT(*) FROM events
UNION ALL
SELECT 'bookings', COUNT(*) FROM bookings;
EOF
```

---

## 💾 Backup

### Automatisches DB-Backup einrichten

```bash
# Backup-Script erstellen
sudo nano /opt/klassik-backup.sh
```

**Inhalt:**

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/klassik"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="klassikdb"
DB_USER="klassik"

# Verzeichnis erstellen
mkdir -p $BACKUP_DIR

# Backup
PGPASSWORD='DEIN_DB_PASSWORT' pg_dump -U $DB_USER -h localhost $DB_NAME > $BACKUP_DIR/klassikdb_$DATE.sql

# Alte Backups löschen (älter als 7 Tage)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete

echo "Backup erstellt: $BACKUP_DIR/klassikdb_$DATE.sql"
```

**Ausführbar machen:**

```bash
sudo chmod +x /opt/klassik-backup.sh
```

### Cronjob einrichten (täglich um 2 Uhr)

```bash
sudo crontab -e

# Hinzufügen:
0 2 * * * /opt/klassik-backup.sh >> /var/log/klassik-backup.log 2>&1
```

### Backup wiederherstellen

```bash
# DB löschen (VORSICHT!)
psql -U postgres -c "DROP DATABASE klassikdb;"
psql -U postgres -c "CREATE DATABASE klassikdb OWNER klassik;"

# Backup einspielen
psql -U klassik -d klassikdb -h localhost < /var/backups/klassik/klassikdb_DATUM.sql
```

---

## 🐛 Troubleshooting

### Problem: Service startet nicht

```bash
# Logs detailliert anzeigen
sudo journalctl -u klassik -n 50 --no-pager

# Häufige Fehler:
# 1. "Cannot connect to database"
#    -> DATABASE_URL in .env prüfen
#    -> PostgreSQL läuft? sudo systemctl status postgresql

# 2. "Port 3000 already in use"
#    -> Anderer Prozess auf Port 3000?
#    -> sudo lsof -i :3000
#    -> sudo kill -9 PID

# 3. "JWT_SECRET is not set"
#    -> .env Datei prüfen
#    -> EnvironmentFile in Service-Datei korrekt?
```

### Problem: DB-Verbindung fehlschlägt

```bash
# PostgreSQL Status
sudo systemctl status postgresql

# Verbindung manuell testen
psql -U klassik -d klassikdb -h localhost

# pg_hba.conf prüfen (Passwort-Auth aktiviert?)
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Zeile sollte sein: local all all md5

# PostgreSQL neu starten
sudo systemctl restart postgresql
```

### Problem: Frontend lädt nicht

```bash
# Backend läuft?
curl http://localhost:3000/health

# nginx Status (falls verwendet)
sudo systemctl status nginx

# nginx Logs
sudo tail -f /var/log/nginx/error.log
```

---

## ✅ Checkliste: Production-Ready

- [ ] Backend läuft: `sudo systemctl status klassik`
- [ ] DB verbunden: `curl http://localhost:3000/health`
- [ ] Logs sauber: `sudo journalctl -u klassik -n 50`
- [ ] Auto-Start aktiviert: `sudo systemctl is-enabled klassik`
- [ ] .env Datei sicher (600): `ls -la backend/.env`
- [ ] JWT_SECRET stark (32+ Zeichen)
- [ ] nginx konfiguriert (optional)
- [ ] SSL/TLS aktiv (Let's Encrypt)
- [ ] Firewall aktiviert: `sudo ufw status`
- [ ] Backups eingerichtet
- [ ] Von außen erreichbar: Browser-Test

---

## 🎯 Zusammenfassung

```bash
# Setup (einmalig)
sudo bash production-setup.sh

# Service-Management (täglich)
sudo systemctl status klassik        # Status
sudo systemctl restart klassik       # Neu starten
sudo journalctl -u klassik -f        # Logs

# Datenbank
psql -U klassik -d klassikdb -h localhost
SELECT * FROM users;

# Updates deployen
git pull && cd backend && npm install --production && sudo systemctl restart klassik

# Monitoring
htop                                  # CPU/RAM
df -h                                 # Disk
curl http://localhost:3000/health    # Health Check
```

---

**Backend ist jetzt live und nutzt deine existierende `klassikdb` Datenbank! 🚀**
