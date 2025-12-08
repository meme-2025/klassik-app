# ✅ Ubuntu Deployment Checkliste

**Projekt:** Klassik App  
**Server:** Ubuntu 20.04+  
**Datum:** _______________

---

## 📋 Pre-Deployment

- [ ] Ubuntu Server mit sudo-Rechten vorhanden
- [ ] SSH-Zugang funktioniert
- [ ] Domain-Name registriert (optional, aber empfohlen)
- [ ] DNS auf Server-IP zeigt

---

## 🔧 Server-Vorbereitung

### System Update
```bash
sudo apt update && sudo apt upgrade -y
```

- [ ] System aktualisiert
- [ ] Neustart durchgeführt (falls Kernel-Update)

### Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
```

- [ ] UFW aktiviert
- [ ] SSH Port offen (22)
- [ ] HTTP/HTTPS offen (80, 443)

---

## 🚀 Deployment

### Option A: Automatisches Setup-Script

```bash
curl -fsSL https://raw.githubusercontent.com/meme-2025/klassik-app/main/backend/deploy/setup-ubuntu.sh -o setup.sh
chmod +x setup.sh
./setup.sh
```

- [ ] Script heruntergeladen
- [ ] Script ausgeführt (ca. 3-5 Min)
- [ ] Keine Fehler im Output

### Option B: Manuelle Installation

#### 1. Node.js installieren
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # sollte v18.x sein
```

- [ ] Node.js 18+ installiert

#### 2. PostgreSQL einrichten
```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER klassik WITH PASSWORD 'STARKES_PASSWORT';"
sudo -u postgres psql -c "CREATE DATABASE klassik OWNER klassik;"
```

- [ ] PostgreSQL installiert
- [ ] Database `klassik` erstellt
- [ ] User `klassik` erstellt
- [ ] **Passwort notiert:** _______________

#### 3. Projekt klonen
```bash
sudo mkdir -p /opt/klassik
sudo chown $USER:$USER /opt/klassik
cd /opt/klassik
git clone https://github.com/meme-2025/klassik-app.git .
```

- [ ] Projekt geklont nach `/opt/klassik`

#### 4. Backend konfigurieren
```bash
cd backend
npm ci --production
```

- [ ] Dependencies installiert

#### 5. .env Datei erstellen
```bash
sudo mkdir -p /etc/klassik
sudo nano /etc/klassik/klassik.env
```

Inhalt:
```env
DATABASE_URL=postgresql://klassik:PASSWORT@localhost:5432/klassik
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRY=7d
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://deine-domain.com
ENABLE_WATCHER=false
```

```bash
sudo chown root:root /etc/klassik/klassik.env
sudo chmod 600 /etc/klassik/klassik.env
```

- [ ] .env erstellt in `/etc/klassik/klassik.env`
- [ ] DATABASE_URL korrekt
- [ ] JWT_SECRET generiert
- [ ] CORS_ORIGIN gesetzt
- [ ] Berechtigungen gesetzt (600)

#### 6. Datenbank-Migrationen
```bash
export $(sudo cat /etc/klassik/klassik.env | xargs)
npm run migrate:up
```

- [ ] Migrationen erfolgreich ausgeführt
- [ ] Keine Fehler im Output

#### 7. systemd Service
```bash
sudo cp deploy/klassik.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable klassik
sudo systemctl start klassik
sudo systemctl status klassik
```

- [ ] Service-Datei kopiert
- [ ] Service aktiviert (auto-start)
- [ ] Service gestartet
- [ ] Status = `active (running)`

#### 8. nginx konfigurieren
```bash
sudo apt install -y nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/klassik
sudo ln -s /etc/nginx/sites-available/klassik /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

- [ ] nginx installiert
- [ ] Config kopiert
- [ ] Symlink erstellt
- [ ] Config-Test erfolgreich
- [ ] nginx neu geladen

---

## 🧪 Tests

### Health Check
```bash
curl http://localhost:3000/health
```

- [ ] Backend antwortet
- [ ] Response: `{"status":"ok",...}`

### API Test
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

- [ ] Registrierung erfolgreich
- [ ] Token erhalten

### nginx Test
```bash
curl http://localhost/
```

- [ ] Frontend-HTML erhalten
- [ ] Keine nginx-Fehlerseite

### Von außen (Browser)
```
http://DEINE-SERVER-IP
```

- [ ] Seite lädt
- [ ] CSS/JS funktioniert
- [ ] Keine Console-Errors

---

## 🔒 SSL/TLS (optional, aber empfohlen)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d deine-domain.com -d www.deine-domain.com
sudo certbot renew --dry-run
```

- [ ] Certbot installiert
- [ ] Zertifikat erstellt
- [ ] Auto-Renewal funktioniert
- [ ] HTTPS-Redirect aktiv

---

## 📊 Monitoring

### Logs prüfen
```bash
# Backend Logs
sudo journalctl -u klassik -f

# nginx Logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

- [ ] Logs laufen durch
- [ ] Keine kritischen Errors

### Ressourcen prüfen
```bash
# CPU & RAM
htop

# Disk Space
df -h

# Service Status
sudo systemctl status klassik
sudo systemctl status nginx
sudo systemctl status postgresql
```

- [ ] Genug Disk Space (min. 2GB frei)
- [ ] RAM-Verbrauch normal (<500MB)
- [ ] Alle Services `active`

---

## 🔄 Post-Deployment

### Backup einrichten
```bash
# DB Backup Script
sudo nano /opt/klassik/backup-db.sh
```

Inhalt:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U klassik klassik > /opt/klassik/backups/klassik_$DATE.sql
find /opt/klassik/backups -name "*.sql" -mtime +7 -delete
```

```bash
chmod +x /opt/klassik/backup-db.sh
sudo crontab -e
# Hinzufügen: 0 2 * * * /opt/klassik/backup-db.sh
```

- [ ] Backup-Script erstellt
- [ ] Cronjob konfiguriert (täglich 2 Uhr)

### Updates planen
```bash
# Auto-Updates (optional)
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

- [ ] Auto-Updates aktiviert (Security only)

---

## 📝 Dokumentation

- [ ] .env Passwörter in Passwort-Manager gespeichert
- [ ] Server-IP notiert: _______________
- [ ] Domain notiert: _______________
- [ ] SSH-Key-Pfad notiert: _______________

---

## ✅ Final Checks

- [ ] Backend läuft: `curl http://localhost:3000/health`
- [ ] nginx läuft: `curl http://localhost/`
- [ ] PostgreSQL läuft: `sudo systemctl status postgresql`
- [ ] SSL funktioniert (falls konfiguriert)
- [ ] Firewall aktiv: `sudo ufw status`
- [ ] Auto-Start aktiviert: `sudo systemctl is-enabled klassik`
- [ ] Logs sauber: `sudo journalctl -u klassik -n 50`
- [ ] Von extern erreichbar: Browser-Test
- [ ] Register/Login funktioniert
- [ ] Wallet Connect funktioniert

---

## 🎉 Deployment abgeschlossen!

**Datum:** _______________  
**Deployed von:** _______________  
**Server-IP:** _______________  
**Domain:** _______________  

### Wichtige Commands

```bash
# Service neu starten
sudo systemctl restart klassik

# Logs ansehen
sudo journalctl -u klassik -f

# Code aktualisieren
cd /opt/klassik && git pull && cd backend && npm ci --production && sudo systemctl restart klassik

# DB Backup
sudo -u postgres pg_dump klassik > backup_$(date +%Y%m%d).sql
```

---

**Probleme?** Siehe [`SETUP_ANLEITUNG.md#troubleshooting`](./SETUP_ANLEITUNG.md#-troubleshooting)
