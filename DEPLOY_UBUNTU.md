# Ubuntu Server Deployment

Dein Backend ist jetzt auf GitHub: **https://github.com/meme-2025/klassik-app**

## Schnellstart auf Ubuntu Server

### Option 1: Automatisches Setup-Script (empfohlen)

1. **Verbinde per SSH zu deinem Ubuntu-Server:**
```bash
ssh dein-user@deine-server-ip
```

2. **Lade das Setup-Script herunter und führe es aus:**
```bash
curl -fsSL https://raw.githubusercontent.com/meme-2025/klassik-app/main/backend/deploy/setup-ubuntu.sh -o setup.sh
chmod +x setup.sh
./setup.sh
```

Das Script installiert automatisch:
- ✅ Node.js 18 LTS
- ✅ PostgreSQL mit Datenbank & User
- ✅ Klont dein Repository
- ✅ Erstellt sichere .env-Datei
- ✅ Führt Migrationen aus
- ✅ Startet systemd Service
- ✅ Konfiguriert nginx
- ✅ Richtet Firewall ein

**Nach ca. 3-5 Minuten ist alles fertig!**

---

### Option 2: Manuelle Installation

Falls du jeden Schritt manuell ausführen möchtest:

```bash
# 1. System aktualisieren
sudo apt-get update && sudo apt-get upgrade -y

# 2. Pakete installieren
sudo apt-get install -y curl git nginx postgresql postgresql-contrib build-essential

# 3. Node.js 18 installieren
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. App-User erstellen
sudo adduser --system --group --no-create-home klassik

# 5. PostgreSQL einrichten
sudo -u postgres psql -c "CREATE USER klassik WITH PASSWORD 'IHR_STARKES_PASSWORT';"
sudo -u postgres psql -c "CREATE DATABASE klassik OWNER klassik;"

# 6. Repository klonen
sudo mkdir -p /opt/klassik
sudo chown $USER:$USER /opt/klassik
cd /opt/klassik
git clone https://github.com/meme-2025/klassik-app.git backend
cd backend

# 7. Environment-Datei erstellen
sudo mkdir -p /etc/klassik
sudo nano /etc/klassik/klassik.env
# Füge ein:
# DATABASE_URL=postgresql://klassik:IHR_PASSWORT@localhost:5432/klassik
# JWT_SECRET=$(openssl rand -base64 32)
# JWT_EXPIRY=24h
# NODE_ENV=production
# PORT=3000

sudo chown root:klassik /etc/klassik/klassik.env
sudo chmod 640 /etc/klassik/klassik.env

# 8. Dependencies & Migrationen
npm ci --production
sudo -u klassik bash -c "set -a; source /etc/klassik/klassik.env; set +a; npm run migrate:up"

# 9. systemd Service
sudo cp deploy/klassik.service /etc/systemd/system/klassik.service
sudo systemctl daemon-reload
sudo systemctl enable --now klassik
sudo journalctl -u klassik -f

# 10. nginx konfigurieren
sudo cp deploy/nginx.conf /etc/nginx/sites-available/klassik
sudo ln -s /etc/nginx/sites-available/klassik /etc/nginx/sites-enabled/klassik
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 11. Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Nach der Installation testen

```bash
# Health-Check
curl http://localhost:3000/health

# User registrieren
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234"}' \
  http://localhost:3000/api/auth/register

# Login
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234"}' \
  http://localhost:3000/api/auth/login
```

Öffne im Browser: `http://DEINE-SERVER-IP`

---

## Updates deployen (zukünftig)

Nach jeder Änderung auf GitHub (nach `git push`):

```bash
ssh dein-user@server-ip
cd /opt/klassik/backend
git pull origin main
npm ci --production
sudo -u klassik bash -c "set -a; source /etc/klassik/klassik.env; set +a; npm run migrate:up"
sudo systemctl restart klassik
```

---

## Optional: SSL-Zertifikat (HTTPS)

Falls du eine Domain hast (z.B. `klassik.example.com`):

```bash
# Domain in nginx-Config eintragen
sudo nano /etc/nginx/sites-available/klassik
# Ersetze die server_name Zeile mit: server_name klassik.example.com;

# Certbot installieren
sudo apt install -y certbot python3-certbot-nginx

# SSL-Zertifikat holen
sudo certbot --nginx -d klassik.example.com

# Automatische Erneuerung testen
sudo certbot renew --dry-run
```

Danach läuft deine App unter: **https://klassik.example.com**

---

## Troubleshooting

**Service läuft nicht:**
```bash
sudo journalctl -u klassik -n 100 --no-pager
sudo systemctl status klassik
```

**Datenbank-Verbindung fehlgeschlagen:**
```bash
psql postgresql://klassik:PASSWORT@localhost:5432/klassik -c "\dt"
```

**nginx Fehler:**
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

**Port bereits belegt:**
```bash
sudo ss -ltnp | grep 3000
```

---

## Wichtige Pfade

- **App-Code**: `/opt/klassik/backend`
- **Environment**: `/etc/klassik/klassik.env`
- **Service**: `/etc/systemd/system/klassik.service`
- **nginx Config**: `/etc/nginx/sites-available/klassik`
- **Logs**: `sudo journalctl -u klassik -f`

---

## Sicherheit

✅ JWT_SECRET wird automatisch generiert (32 Zeichen)  
✅ DB-Passwort wird automatisch generiert (20 Zeichen)  
✅ Environment-Datei ist nur für root + klassik-User lesbar (640)  
✅ Firewall blockiert alle Ports außer SSH + HTTP/HTTPS  
✅ Service läuft als eingeschränkter System-User (nicht root)  

**Wichtig**: `/etc/klassik/klassik.env` niemals ins Git committen!
