# Deployment quickstart (Ubuntu)

This file contains copy-ready commands to deploy the backend on an Ubuntu server where PostgreSQL runs locally.

Preconditions:
- You have SSH access to the Ubuntu server
- Git repo URL is accessible from the server
- You will create a system user `klassik` (recommended)
- Replace `your.domain.tld` and secrets before using

1) Create app user & directories
```bash
sudo adduser --system --group --no-create-home klassik
sudo mkdir -p /opt/klassik
sudo chown $USER:$USER /opt/klassik
```

2) Clone the repo (as your regular user)
```bash
cd /opt/klassik
git clone <YOUR_GIT_REPO_URL> backend
cd backend
```

3) Install Node 18 and build tools
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential
```

4) Install PostgreSQL (if not already) and create DB/user
```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER klassik WITH PASSWORD 'strong_db_password';"
sudo -u postgres psql -c "CREATE DATABASE klassik OWNER klassik;"
```

5) Prepare environment file `/etc/klassik/klassik.env` (as root)
```bash
sudo mkdir -p /etc/klassik
sudo nano /etc/klassik/klassik.env
# Paste values like:
# DATABASE_URL=postgresql://klassik:strong_db_password@localhost:5432/klassik
# JWT_SECRET=$(openssl rand -base64 32)
# JWT_EXPIRY=24h
# NODE_ENV=production
sudo chown root:klassik /etc/klassik/klassik.env
sudo chmod 640 /etc/klassik/klassik.env
```

6) Install dependencies & run migrations (as app user)
```bash
cd /opt/klassik/backend
npm ci --production
# ensure env visible for migrations
sudo -u klassik bash -c "set -a; source /etc/klassik/klassik.env; set +a; npm run migrate:up"
```

7) Configure systemd service (example file in `backend/deploy/klassik.service`)
```bash
sudo cp backend/deploy/klassik.service /etc/systemd/system/klassik.service
sudo systemctl daemon-reload
sudo systemctl enable --now klassik
sudo journalctl -u klassik -f
```

8) Configure nginx (example in `backend/deploy/nginx.conf`)
```bash
sudo cp backend/deploy/nginx.conf /etc/nginx/sites-available/klassik
sudo ln -s /etc/nginx/sites-available/klassik /etc/nginx/sites-enabled/klassik
sudo nginx -t && sudo systemctl reload nginx
```

9) Obtain TLS (certbot)
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain.tld
```

10) Quick tests
```bash
curl -I http://127.0.0.1:3000/health
curl -X POST -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"secretpass"}' http://127.0.0.1:3000/api/auth/register
```

Troubleshooting tips:
- View logs: `sudo journalctl -u klassik -n 200 --no-pager`
- Check port binds: `ss -ltnp | grep 3000`
- Permission issues: ensure `/etc/klassik/klassik.env` is readable by user `klassik` and working dir owned by `klassik` if service runs as that user.
