# Manual Deployment Guide (production) — Backend

## 1) System prerequisites (on Linux host)
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx ufw

Install Node 18 LTS:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs build-essential

Install PostgreSQL (if not using managed DB):
sudo apt install -y postgresql postgresql-contrib

## 2) Create app user & directories
sudo adduser --system --group --no-create-home klassik
sudo mkdir -p /opt/klassik/backend
sudo chown YOURUSER:YOURUSER /opt/klassik/backend   # if you deploy as non-root user

## 3) Clone repo (as deploy user)
cd /opt/klassik
git clone <your-repo-url> backend
cd backend

## 4) Database: create DB user and DB (example)
# switch to postgres user
sudo -u postgres psql
# In psql:
CREATE USER klassik WITH PASSWORD 'strong_db_password';
CREATE DATABASE klassik OWNER klassik;
\q

# apply schema (from repo)
psql postgresql://klassik:strong_db_password@localhost:5432/klassik -f db/init.sql

## 5) Prepare secrets (on server, AS ROOT)
sudo mkdir -p /etc/klassik
sudo nano /etc/klassik/klassik.env
# Paste (example)
# DATABASE_URL=postgresql://klassik:strong_db_password@localhost:5432/klassik
# JWT_SECRET=<use openssl rand -base64 32>
# JWT_EXPIRY=24h
# ETH_RPC_URL=...
# HOT_WALLET_PRIVATE_KEY=<REDACTED or from vault>

# Secure file:
sudo chown root:klassik /etc/klassik/klassik.env
sudo chmod 640 /etc/klassik/klassik.env

## 6) Install dependencies & run migrations (as deploy user)
cd /opt/klassik/backend
npm ci --production
# ensure env loaded for migrations
set -a; source /etc/klassik/klassik.env; set +a
npm run migrate:up

## 7) systemd service
Create /etc/systemd/system/klassik.service with:
(Use the sample below and adapt WorkingDirectory & ExecStart)
[Unit]
Description=Klassik Backend
After=network.target

[Service]
EnvironmentFile=/etc/klassik/klassik.env
WorkingDirectory=/opt/klassik/backend
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5
User=klassik
Group=klassik
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target

# Enable & start
sudo systemctl daemon-reload
sudo systemctl enable --now klassik
sudo journalctl -u klassik -f

## 8) nginx reverse proxy & TLS
Create site: /etc/nginx/sites-available/klassik
server {
    listen 80;
    server_name your.domain.tld;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

sudo ln -s /etc/nginx/sites-available/klassik /etc/nginx/sites-enabled/klassik
sudo nginx -t && sudo systemctl reload nginx

# Obtain TLS with certbot:
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain.tld

## 9) Firewall (basic)
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

## 10) Tests
# Health
curl -i https://your.domain.tld/health

# Auth register/login (replace JSON as needed)
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","password":"secret"}' \
  https://your.domain.tld/api/auth/register

# Login -> use token for protected endpoints
# Example protected request:
curl -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Concert","description":"desc","date":"2025-01-01T20:00:00Z","capacity":100}' \
  https://your.domain.tld/api/events

## 11) Operational recommendations
- Rotate JWT_SECRET and DB passwords regularly.
- Consider a secrets manager (Hashicorp Vault, AWS Secrets Manager) for production.
- Enable logrotation for application logs and DB backups (pg_dump cron).
- Monitor service with systemd + Prometheus node exporter or simple uptime checks.

## Push repository to GitHub (local machine)
1. Create a repository on github.com.
2. Locally, in your repo root:
   git init
   git add .
   git commit -m "initial"
   git remote add origin git@github.com:YOUR_USER/YOUR_REPO.git
   git push -u origin main

## Manual deploy on Ubuntu (pull from GitHub)
Assumes you have SSH access to the Ubuntu host and git installed.

1) Create deploy user & directories (on server)
sudo adduser --system --group --no-create-home klassik
sudo mkdir -p /opt/klassik
sudo chown YOURUSER:YOURUSER /opt/klassik

2) Clone the repo (as your deploy user or your normal user)
cd /opt/klassik
git clone git@github.com:YOUR_USER/YOUR_REPO.git backend
cd backend

3) Prepare secrets securely (on server)
sudo mkdir -p /etc/klassik
sudo nano /etc/klassik/klassik.env
# Paste values:
# DATABASE_URL=postgresql://klassik:strong_db_pass@db.host:5432/klassik
# JWT_SECRET=<openssl rand -base64 32>
# JWT_EXPIRY=24h
# ETH_RPC_URL=...
sudo chown root:klassik /etc/klassik/klassik.env
sudo chmod 640 /etc/klassik/klassik.env

4) Install Node and build deps (if not installed)
# Install Node 18 LTS (one-time)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential

# In app dir
cd /opt/klassik/backend
npm ci --production

5) Run migrations (ensure DATABASE_URL visible)
set -a; source /etc/klassik/klassik.env; set +a
npm run migrate:up

6) Create and start systemd service
Create `/etc/systemd/system/klassik.service` with:
[Unit]
Description=Klassik Backend
After=network.target

[Service]
EnvironmentFile=/etc/klassik/klassik.env
WorkingDirectory=/opt/klassik/backend
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=5
User=klassik
Group=klassik
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target

Enable & start:
sudo systemctl daemon-reload
sudo systemctl enable --now klassik
sudo journalctl -u klassik -f

7) nginx reverse proxy & TLS
Create `/etc/nginx/sites-available/klassik`:
server {
    listen 80;
    server_name your.domain.tld;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

Enable and reload:
sudo ln -s /etc/nginx/sites-available/klassik /etc/nginx/sites-enabled/klassik
sudo nginx -t && sudo systemctl reload nginx

Install certbot and obtain TLS:
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain.tld

8) Tests
# Health
curl -i https://your.domain.tld/health

# Register
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"a@b.com","password":"secret"}' \
  https://your.domain.tld/api/auth/register

# Login -> use token for protected calls

## Optional: GitHub Actions (reference only)
If later you want automatic deploy on push, add a workflow that SSHes and pulls; example (store SSH key as secret in GitHub and deploy user on server allows key):
.github/workflows/deploy.yml (example snippet):
```yaml
name: Deploy to Ubuntu
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v0.1.7
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/klassik/backend
            git pull origin main
            npm ci --production
            set -a; source /etc/klassik/klassik.env; set +a
            npm run migrate:up
            sudo systemctl restart klassik
```
(Only use this after you trust automation; keep SSH keys and secrets in GitHub Secrets.)

## Notes & Security reminders
- Never commit /etc/klassik/klassik.env to git.
- Use strong JWT_SECRET: openssl rand -base64 32
- DB user should have minimal privileges and DB should not be publicly accessible.
- Use firewall (ufw) to restrict DB ports, allow only SSH and HTTP/HTTPS.
- Consider backups (pg_dump) and monitoring.

## Quickstart: Ich habe .env erstellt — einfache Schritte für /var/www/klassik

Wenn du bereits eine .env (oder /etc/klassik/klassik.env) vorbereitet hast, führe auf dem Ubuntu-Server diese Schritte aus (ersetze YOURUSER, YOUR_REPO, your.domain.tld):

1) Optional: App-Systemuser erstellen
```bash
sudo adduser --system --group --no-create-home klassik
```

2) Projektverzeichnis anlegen und Rechte setzen
```bash
sudo mkdir -p /var/www/klassik
sudo chown YOURUSER:YOURUSER /var/www/klassik
```

3) Code auf den Server bringen
- Von GitHub:
```bash
cd /var/www
git clone git@github.com:YOUR_USER/YOUR_REPO.git klassik
cd /var/www/klassik
```
- Oder per SCP vom lokalen Rechner:
```bash
# lokal
scp -r ./backend YOURUSER@your.server:/var/www/klassik
```

4) Secrets sicher ablegen (als root) — falls du die .env lokal erstellt hast, kopiere den Inhalt nach /etc/klassik/klassik.env:
```bash
sudo mkdir -p /etc/klassik
sudo nano /etc/klassik/klassik.env   # füge DATABASE_URL, JWT_SECRET, etc. ein
sudo chown root:klassik /etc/klassik/klassik.env
sudo chmod 640 /etc/klassik/klassik.env
```

5) Eigentümer des Projekts auf den App-User setzen
```bash
sudo chown -R klassik:klassik /var/www/klassik
```

6) Node installieren (falls nötig) und Abhängigkeiten installieren
```bash
# falls Node fehlt (einmalig)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential

# im Projektverzeichnis
cd /var/www/klassik
sudo -u klassik npm ci --production
```

7) Migrationen ausführen (env aus /etc/klassik laden)
```bash
sudo -u klassik bash -c "set -a; source /etc/klassik/klassik.env; set +a; npm run migrate:up"
```

8) systemd-Service (falls du das deploy/klassik.service geliefert hast)
```bash
sudo cp /var/www/klassik/deploy/klassik.service /etc/systemd/system/klassik.service
sudo systemctl daemon-reload
sudo systemctl enable --now klassik
sudo journalctl -u klassik -f
```

9) nginx konfigurieren und TLS einrichten
```bash
sudo cp /var/www/klassik/deploy/nginx.conf /etc/nginx/sites-available/klassik
sudo ln -sf /etc/nginx/sites-available/klassik /etc/nginx/sites-enabled/klassik
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain.tld
```

10) Schnelltests
```bash
# lokal auf dem Server
curl -I http://127.0.0.1:3000/health

# extern (Domain)
curl -I https://your.domain.tld/health
```

Sicherheits-Reminder: /etc/klassik/klassik.env nie committen, Berechtigungen 640, JWT_SECRET mit `openssl rand -base64 32` erzeugen, DB-Zugriffe per Firewall einschränken.

## From Windows to Ubuntu — quick commands

Pick one option below and replace USER, HOST and remote path (/var/www/klassik).

Option A — PowerShell with scp (OpenSSH client installed)
1. In Windows PowerShell, go to project root (contains backend/):
```powershell
cd "C:\Users\YOU\Desktop\Neuer Ordner\Klassik"
# Copy whole project (excludes nothing) to remote /tmp and then move on server
scp -r . USER@HOST:/tmp/klassik_upload
```
2. On Ubuntu (ssh USER@HOST):
```bash
sudo mkdir -p /var/www/klassik
sudo rm -rf /var/www/klassik/*     # optional
sudo mv /tmp/klassik_upload/* /var/www/klassik/
sudo chown -R klassik:klassik /var/www/klassik
```

Option B — Create archive on Windows, copy, extract on server (recommended if scp stalls)
1. In PowerShell (use 7zip or tar via WSL/Git-Bash). With tar in Git-Bash/WSL:
```bash
# in Git-Bash or WSL in project folder
tar -czf klassik.tgz .
scp klassik.tgz USER@HOST:/tmp/
```
2. On Ubuntu:
```bash
ssh USER@HOST
sudo mkdir -p /var/www/klassik
sudo tar -xzf /tmp/klassik.tgz -C /var/www/klassik
sudo chown -R klassik:klassik /var/www/klassik
```

Option C — rsync from Windows via WSL/Git-Bash (best for repeated deploys)
1. In WSL/Git-Bash on Windows:
```bash
cd /mnt/c/Users/YOU/Desktop/"Neuer Ordner"/Klassik
rsync -avz --delete --exclude='.env' --exclude='node_modules' ./ USER@HOST:/var/www/klassik/
```
2. On Ubuntu:
```bash
ssh USER@HOST
sudo chown -R klassik:klassik /var/www/klassik
```

Option D — WinSCP GUI (if you prefer GUI)
- Open WinSCP, connect via SFTP to USER@HOST, upload the local folder to /var/www/klassik, then SSH to set permissions:
```bash
sudo chown -R klassik:klassik /var/www/klassik
```

After transfer — minimal server steps (run on Ubuntu)
```bash
# ensure /etc/klassik/klassik.env exists and has correct values
sudo chown root:klassik /etc/klassik/klassik.env
sudo chmod 640 /etc/klassik/klassik.env

# install deps and run migrations (as app user)
cd /var/www/klassik
sudo -u klassik npm ci --production
sudo -u klassik bash -c "set -a; source /etc/klassik/klassik.env; set +a; npm run migrate:up"

# start service if configured
sudo systemctl daemon-reload
sudo systemctl enable --now klassik
sudo journalctl -u klassik -f
```

Security reminders
- Never copy .env or private keys in plain to the repo or USB. Create /etc/klassik/klassik.env on server and set perms root:klassik 640.
- Use rsync for repeated deploys; use Git for proper versioning.
