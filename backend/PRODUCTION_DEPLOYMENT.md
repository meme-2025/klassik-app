# 🏆 KLASSIK PRODUCTION DEPLOYMENT GUIDE

**Status:** ✅ Production-Ready  
**Version:** 1.0.0  
**Date:** December 2024

---

## 📋 OVERVIEW

This guide transforms the Klassik prototype into a **production-ready system** with:

- ✅ **Autonomous Blockchain Monitoring** (24/7 SAC wallet scanner)
- ✅ **Persistent State Management** (Database-backed game sessions)
- ✅ **Always-On Game Engine** (Server-side logic with reconnection)
- ✅ **Real-Time Admin Dashboard** (WebSocket-based monitoring)
- ✅ **Zero-Downtime Deployment** (PM2 process management)

---

## 🏗️ ARCHITECTURE

```
┌─────────────────────────────────────────────────────────┐
│                    PRODUCTION STACK                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────┐ │
│  │   Nginx      │──▶│  Express.js  │──▶│ PostgreSQL  │ │
│  │  (Port 80)   │   │  (Port 3000) │   │  (State DB) │ │
│  └──────────────┘   └──────────────┘   └─────────────┘ │
│                            │                             │
│                     ┌──────┴──────┐                      │
│                     ▼              ▼                      │
│           ┌────────────────┐  ┌─────────────┐           │
│           │  Socket.io     │  │   PM2       │           │
│           │  (WebSockets)  │  │ (Process    │           │
│           └────────────────┘  │  Manager)   │           │
│                               └─────────────┘           │
│                                                           │
│  ┌───────────────── AUTONOMOUS WORKERS ─────────────┐   │
│  │                                                    │   │
│  │  • Sacrifice Watcher (15s interval)              │   │
│  │  • Blockchain Monitor (Kaspa API)                │   │
│  │  • Game Engine (State persistence)               │   │
│  │  • Session Cleanup (Abandoned games)             │   │
│  │                                                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 QUICK START (Automated)

### One-Command Deployment

```bash
cd backend
sudo bash deploy-production.sh
```

This script will:
1. Install all dependencies (Node.js, PostgreSQL, PM2)
2. Create system user `klassik`
3. Configure database with triggers & views
4. Set up environment variables
5. Start services with PM2
6. Configure firewall
7. Optionally set up Nginx reverse proxy

---

## 🛠️ MANUAL DEPLOYMENT

### 1. System Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL 14+
sudo apt-get install -y postgresql postgresql-contrib

# Install PM2
sudo npm install -g pm2

# Install Nginx (optional)
sudo apt-get install -y nginx
```

### 2. Create System User

```bash
sudo useradd -m -s /bin/bash klassik
sudo mkdir -p /etc/klassik
sudo mkdir -p /var/log/klassik
sudo chown klassik:klassik /var/log/klassik
```

### 3. Database Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE USER klassik3_writer WITH PASSWORD 'YOUR_STRONG_PASSWORD';
CREATE DATABASE klassik3_production OWNER klassik3_writer;
\q

# Run migrations
cd backend
psql -U klassik3_writer -d klassik3_production -f ../db/production-state-management.sql
```

### 4. Application Setup

```bash
# Copy files to production directory
sudo cp -r backend /home/klassik/
sudo chown -R klassik:klassik /home/klassik/backend

# Install dependencies
cd /home/klassik/backend
sudo -u klassik npm install --production
```

### 5. Environment Configuration

```bash
# Copy environment template
sudo cp /home/klassik/backend/.env.production.example /etc/klassik/klassik1.env

# Edit environment file
sudo nano /etc/klassik/klassik1.env
```

**Critical Settings:**

```env
# Database
DATABASE_URL=postgresql://klassik3_writer:YOUR_PASSWORD@localhost:5432/klassik3_production

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=YOUR_RANDOM_SECRET_HERE

# Sacrifice Address
SACRIFICE_ADDRESS=kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc

# Admin Wallets (comma-separated)
ADMIN_WALLETS=0x1234...,0x5678...

# CORS (your domain)
CORS_ORIGIN=https://klassik.99pace.space

# WebSocket Monitor Token
MONITOR_ACCESS_TOKEN=YOUR_SECURE_TOKEN
```

### 6. Start with PM2

```bash
cd /home/klassik/backend

# Start application
sudo -u klassik pm2 start ecosystem.config.json

# Save process list
sudo -u klassik pm2 save

# Enable startup script
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u klassik --hp /home/klassik
```

### 7. Configure Nginx (Optional but Recommended)

```bash
sudo nano /etc/nginx/sites-available/klassik
```

**Nginx Configuration:**

```nginx
server {
    listen 80;
    server_name klassik.99pace.space;
    
    # API and static files
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout for long-polling/WebSocket
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
    
    # WebSocket specific
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # WebSocket timeouts
        proxy_read_timeout 86400;
    }
    
    # Favicon
    location /favicon.ico {
        log_not_found off;
        access_log off;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/klassik /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Install SSL (Let's Encrypt)
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d klassik.99pace.space
```

### 8. Firewall Configuration

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (if not already allowed)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

---

## 📊 VERIFICATION & TESTING

### Health Check

```bash
curl http://localhost:3000/api/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-12-...",
  "uptime": 123.45,
  "services": {
    "database": "connected",
    "sacrificeWatcher": "active",
    "gameEngine": "active"
  }
}
```

### WebSocket Test

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:3000/socket.io/?EIO=4&transport=websocket
```

### Database Test

```bash
psql -U klassik3_writer -d klassik3_production -c "
SELECT * FROM v_system_health;
"
```

---

## 🎮 AUTONOMOUS SERVICES

### 1. Sacrifice Watcher

**File:** `src/services/sacrifice-watcher.js`

**Functionality:**
- Polls Kaspa API every 15 seconds
- Detects transactions to SAC wallet
- Automatically updates user status in database
- Sends WebSocket notifications to admins

**Monitoring:**
```bash
# View sacrifice watcher logs
sudo -u klassik pm2 logs klassik-production --lines 100 | grep "SACRIFICE"
```

**Manual Trigger (for testing):**
```bash
curl -X POST http://localhost:3000/api/admin/check-sacrifices \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 2. Game Engine

**File:** `src/services/game-engine.js`

**Functionality:**
- Server-side game logic (prevents cheating)
- Persistent state in database
- Session recovery on reconnect
- Automatic cleanup of abandoned games (30 min timeout)

**Test Game Session:**
```bash
# Start game
curl -X POST http://localhost:3000/api/game/start \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"betAmount": 100}'

# Place bet
curl -X POST http://localhost:3000/api/game/bet \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "...", "amount": 50}'

# Cash out
curl -X POST http://localhost:3000/api/game/cashout \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "..."}'
```

### 3. Database State Management

**File:** `db/production-state-management.sql`

**Functionality:**
- Auto-update triggers for user status
- Payment queue management
- Game session tracking
- System health views

**Check System State:**
```sql
-- Active users
SELECT * FROM v_active_users;

-- Pending payments
SELECT * FROM v_pending_payments;

-- Active games
SELECT * FROM v_active_games;

-- System health
SELECT * FROM v_system_health;
```

---

## 📡 MONITORING & ADMINISTRATION

### Real-Time Monitor Dashboard

**URL:** `http://your-server:3000/monitor.html`

**Features:**
- Live request stream
- WebSocket event tracking
- User registration/login events
- Game activity
- Sacrifice transaction notifications
- System metrics (CPU, Memory, Uptime)

**Authentication:**
Set monitor token in environment:
```env
MONITOR_ACCESS_TOKEN=your-secure-token-here
```

Login with token at monitor dashboard.

### Admin Dashboard

**URL:** `http://your-server:3000/admin-dashboard-v2.html`

**Features:**
- User management
- Transaction history
- System statistics
- Manual sacrifice checks
- Payment status overview

**Access Control:**
Only wallet addresses listed in `ADMIN_WALLETS` environment variable can access admin functions.

### PM2 Management

```bash
# View all processes
sudo -u klassik pm2 list

# View logs (all)
sudo -u klassik pm2 logs

# View logs (specific service)
sudo -u klassik pm2 logs klassik-production

# Monitor resources
sudo -u klassik pm2 monit

# Restart application
sudo -u klassik pm2 restart klassik-production

# Reload (zero-downtime)
sudo -u klassik pm2 reload klassik-production

# Stop application
sudo -u klassik pm2 stop klassik-production

# Delete process
sudo -u klassik pm2 delete klassik-production
```

### Log Files

```bash
# PM2 logs
/home/klassik/.pm2/logs/

# Application logs
tail -f /home/klassik/.pm2/logs/klassik-production-out.log
tail -f /home/klassik/.pm2/logs/klassik-production-error.log

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 🔧 MAINTENANCE

### Database Backup

```bash
# Create backup
pg_dump -U klassik3_writer klassik3_production > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql -U klassik3_writer -d klassik3_production < backup_20241215_120000.sql
```

### Application Updates

```bash
# Pull latest code
cd /home/klassik/backend
sudo -u klassik git pull

# Install dependencies
sudo -u klassik npm install --production

# Reload application (zero-downtime)
sudo -u klassik pm2 reload klassik-production
```

### Database Migrations

```bash
# Run new migration
psql -U klassik3_writer -d klassik3_production -f migrations/new_migration.sql

# Verify schema
psql -U klassik3_writer -d klassik3_production -c "\dt"
```

### Cleanup Old Sessions

Automatic cleanup runs every 10 minutes via game engine.

**Manual cleanup:**
```sql
DELETE FROM game_sessions 
WHERE status = 'abandoned' 
  AND updated_at < NOW() - INTERVAL '24 hours';
```

---

## 🐛 TROUBLESHOOTING

### Server Won't Start

**Check logs:**
```bash
sudo -u klassik pm2 logs klassik-production --err
```

**Common issues:**
- ❌ Database connection failed → Check `DATABASE_URL` in environment
- ❌ Port 3000 already in use → `sudo lsof -i :3000`
- ❌ Permission denied → Check file ownership: `ls -la /home/klassik/backend`

### WebSocket Connection Failed

**Check CORS settings:**
```bash
grep CORS_ORIGIN /etc/klassik/klassik1.env
```

**Test WebSocket locally:**
```bash
wscat -c ws://localhost:3000/socket.io/?EIO=4&transport=websocket
```

**Nginx WebSocket config:**
Ensure `/socket.io/` location has `Upgrade` headers.

### Sacrifice Watcher Not Detecting Transactions

**Check Kaspa API connectivity:**
```bash
curl https://api.kaspa.org/addresses/kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc/full-transactions
```

**Verify watcher is running:**
```bash
sudo -u klassik pm2 logs | grep "Sacrifice watcher started"
```

**Manual check:**
```bash
curl -X POST http://localhost:3000/api/admin/check-sacrifices \
  -H "Authorization: Bearer YOUR_ADMIN_JWT"
```

### Database Connection Pool Exhausted

**Check active connections:**
```sql
SELECT count(*) FROM pg_stat_activity 
WHERE datname = 'klassik3_production';
```

**Increase pool size:**
```env
# In /etc/klassik/klassik1.env
DATABASE_MAX_CONNECTIONS=20
```

**Restart application:**
```bash
sudo -u klassik pm2 restart klassik-production
```

### Memory Leak

**Check memory usage:**
```bash
sudo -u klassik pm2 monit
```

**Restart application:**
```bash
sudo -u klassik pm2 restart klassik-production
```

**Auto-restart on memory limit:**
Already configured in `ecosystem.config.json`:
```json
"max_memory_restart": "500M"
```

---

## 🔒 SECURITY CHECKLIST

- [x] JWT secret is random and secure (32+ characters)
- [x] Database password is strong (16+ characters)
- [x] Admin wallets are explicitly whitelisted
- [x] CORS is restricted to production domain
- [x] Environment file has restricted permissions (600)
- [x] Firewall allows only necessary ports
- [x] SSL certificate is installed (Nginx + Let's Encrypt)
- [x] WebSocket monitor token is secure
- [x] Database user has minimal privileges
- [x] PM2 runs as non-root user

---

## 📈 PERFORMANCE OPTIMIZATION

### Database Indexes

Already created in `production-state-management.sql`:
```sql
CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_sacrifice_tx_user ON sacrifice_transactions(user_id);
CREATE INDEX idx_game_sessions_user ON game_sessions(user_id);
CREATE INDEX idx_payment_queue_status ON payment_queue(status);
```

### PM2 Cluster Mode (Multi-Core)

For high-traffic production:
```bash
# Edit ecosystem.config.json
"instances": 4,  # Number of CPU cores
"exec_mode": "cluster"

# Restart
sudo -u klassik pm2 reload ecosystem.config.json
```

### Nginx Caching

Add to Nginx config:
```nginx
# Cache static assets
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

### PostgreSQL Tuning

```bash
sudo nano /etc/postgresql/14/main/postgresql.conf
```

**Recommended settings:**
```conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 16MB
min_wal_size = 1GB
max_wal_size = 4GB
```

---

## 📞 SUPPORT & MAINTENANCE

### Critical Files

| File | Purpose | Backup Frequency |
|------|---------|------------------|
| `/etc/klassik/klassik1.env` | Environment config | Before every change |
| Database | All user data | Daily (automated) |
| `ecosystem.config.json` | PM2 configuration | Before every change |
| `/etc/nginx/sites-available/klassik` | Nginx config | Before every change |

### Daily Checks

```bash
# Check service health
curl http://localhost:3000/api/health

# Check disk space
df -h

# Check database size
psql -U klassik3_writer -d klassik3_production -c "
SELECT pg_size_pretty(pg_database_size('klassik3_production'));"

# Check PM2 status
sudo -u klassik pm2 status
```

### Weekly Tasks

- Review error logs
- Check database backup integrity
- Monitor disk usage
- Review active users and transactions
- Update system packages (`sudo apt update && sudo apt upgrade`)

---

## ✅ DEPLOYMENT COMPLETE

Your Klassik system is now:

- ✅ **Production-ready** with PM2 process management
- ✅ **Autonomous** with 24/7 blockchain monitoring
- ✅ **Persistent** with database-backed state
- ✅ **Monitored** with real-time dashboard
- ✅ **Secure** with JWT auth and CORS protection
- ✅ **Scalable** with cluster mode support

**Next Steps:**
1. Configure environment variables in `/etc/klassik/klassik1.env`
2. Restart services: `sudo -u klassik pm2 restart klassik-production`
3. Access monitor dashboard at `/monitor.html`
4. Test sacrifice detection with a small transaction
5. Monitor logs for first 24 hours

**Support:**
- Logs: `sudo -u klassik pm2 logs klassik-production`
- Health: `http://your-server:3000/api/health`
- Monitor: `http://your-server:3000/monitor.html`

---

**🏆 Deployment Version:** 1.0.0  
**Last Updated:** December 2024
