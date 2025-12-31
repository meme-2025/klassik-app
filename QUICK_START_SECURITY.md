# 🚀 QUICK START: Security & Performance Implementation

## All critical fixes have been implemented!

---

## ✅ WHAT'S NEW

### Security Enhancements
1. **Sacrifice-Validierung** - Real blockchain transaction verification
2. **WebSocket-Authentifizierung** - JWT-based authentication for WebSocket connections
3. **CORS-Policy** - Whitelist-only origin access
4. **Admin-IP-Whitelist** - IP-based access control with CIDR support
5. **Enhanced Rate-Limiting** - 7 differentiated rate limiters

### Performance Optimizations
6. **Redis-Caching** - Smart cache with stale-while-revalidate
7. **Database-Backups** - Automated backups (Linux + Windows)
8. **Kaspa-Node Integration** - localhost-first API with fallback

---

## 🔧 INSTALLATION

### 1. Install Redis (optional but recommended)

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

**Windows:**
Download from: https://redis.io/download
Or use WSL: `wsl --install` then install Redis in WSL

**macOS:**
```bash
brew install redis
brew services start redis
```

### 2. Update Environment Variables

Edit `/etc/klassik/klassik1.env` (Linux) or `.env` (Windows):

```bash
# Security
ADMIN_WALLET_ADDRESS=kaspa:qq...your-admin-wallet...
ADMIN_IP_WHITELIST=192.168.1.0/24,10.0.0.1,203.0.113.*
JWT_SECRET=your-strong-secret-here-min-32-chars

# CORS
CORS_ORIGIN=https://klassik.99pace.space

# Kaspa Node (optional)
KASPA_REST_SERVER=http://localhost:8080

# Redis (optional)
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password
REDIS_TTL=60

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_AUTH_MAX=10
RATE_LIMIT_AUTH_WINDOW_MS=900000

# Backups
BACKUP_DIR=/opt/klassik/backups
BACKUP_RETENTION_DAYS=30
S3_BUCKET=klassik-backups
S3_ACCESS_KEY=your-s3-key
S3_SECRET_KEY=your-s3-secret
```

### 3. Install Dependencies

```bash
cd backend
npm install

# New dependencies (already in package.json):
# - redis (^4.6.0)
# - express-rate-limit (^7.1.0)
```

### 4. Restart Backend

```bash
# Development
cd backend
npm start

# Production (systemd)
sudo systemctl restart klassik-backend

# Check logs
sudo journalctl -u klassik-backend -f
```

---

## 🧪 TESTING

### Run Automated Tests

**Linux/macOS:**
```bash
cd backend/scripts
chmod +x test-security.sh
./test-security.sh
```

**Windows PowerShell:**
```powershell
cd backend\scripts
.\test-security.ps1
```

### Manual Testing

1. **Test Sacrifice Validation:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "kaspaAddress": "kaspa:qq...",
    "sacrificeData": {"transactions": []}
  }'

# Expected: 400 "No transaction found"
```

2. **Test Rate Limiting:**
```bash
# Spam login endpoint (should block after 10 requests)
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"address": "kaspa:qq...", "signature": "test"}'
  echo "Request $i"
done

# Expected: First 10 succeed, then 429 "Too many login attempts"
```

3. **Test Redis Cache:**
```bash
# First request (uncached)
time curl http://localhost:3000/api/kaspa-enhanced/stats

# Second request (cached - should be faster)
time curl http://localhost:3000/api/kaspa-enhanced/stats
```

4. **Test Admin IP Whitelist:**
```bash
# Should fail if IP not in whitelist
curl -X GET http://localhost:3000/api/admin/stats \
  -H "X-Forwarded-For: 1.2.3.4" \
  -H "X-Admin-Address: kaspa:qq..."

# Expected: 403 "IP not whitelisted" (if whitelist is enabled)
```

---

## 📊 VERIFICATION CHECKLIST

After installation, verify everything works:

- [ ] ✅ Backend starts without errors
- [ ] ✅ Redis connects (check logs for "Redis cache initialized")
- [ ] ✅ GET `/health` returns 200
- [ ] ✅ GET `/api/health` shows database, redis, kaspa status
- [ ] ✅ Sacrifice registration rejects fake transactions
- [ ] ✅ Rate limiting blocks after threshold
- [ ] ✅ CORS blocks non-whitelisted origins
- [ ] ✅ Admin routes check IP whitelist
- [ ] ✅ WebSocket requires JWT token
- [ ] ✅ Cache makes second request faster

---

## 🔄 BACKUP SETUP

### Linux Automated Backups

```bash
# Test manual backup
cd backend/scripts
chmod +x backup-database.sh
./backup-database.sh backup

# Setup cron job (daily at 2 AM)
crontab -e
```

Add line:
```cron
0 2 * * * /opt/klassik/backend/scripts/backup-database.sh backup >> /var/log/klassik-backup.log 2>&1
```

### Windows Automated Backups

```powershell
# Test manual backup
cd backend\scripts
.\backup-database.ps1 -Action Backup

# Setup Task Scheduler (daily at 2 AM)
$trigger = New-ScheduledTaskTrigger -Daily -At 2AM
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\klassik\backend\scripts\backup-database.ps1 -Action Backup"
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName "KlassikDBBackup" -Trigger $trigger -Action $action -Settings $settings -User "SYSTEM" -RunLevel Highest
```

### Verify Backups

```bash
# Linux
./backup-database.sh list
./backup-database.sh restore backup_2024-01-15.sql.gz

# Windows
.\backup-database.ps1 -Action List
.\backup-database.ps1 -Action Restore -BackupFile "backup_2024-01-15.zip"
```

---

## 🛡️ SECURITY BEST PRACTICES

### 1. Strong JWT Secret

```bash
# Generate strong secret (64 characters)
openssl rand -base64 48
# Or use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. IP Whitelist Configuration

**Examples:**
```bash
# Single IP
ADMIN_IP_WHITELIST=203.0.113.45

# Multiple IPs
ADMIN_IP_WHITELIST=203.0.113.45,198.51.100.23

# CIDR notation (entire subnet)
ADMIN_IP_WHITELIST=192.168.1.0/24

# Wildcard (last octet)
ADMIN_IP_WHITELIST=192.168.1.*

# Mixed
ADMIN_IP_WHITELIST=192.168.1.0/24,203.0.113.45,10.0.0.*
```

### 3. CORS Configuration

```bash
# Production
CORS_ORIGIN=https://klassik.99pace.space

# Multiple domains (comma-separated in code)
# Edit backend/src/index.js:
const ALLOWED_ORIGINS = [
  'https://klassik.99pace.space',
  'https://www.klassik.com',
  'http://localhost:3000'  # Only for development
];
```

### 4. Rate Limit Tuning

Edit `backend/src/middleware/enhanced-rate-limit.js`:

```javascript
// Stricter limits for production
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // 5 attempts (more strict)
  message: 'Too many login attempts'
});

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 1,                     // Only 1 registration per hour
  message: 'Registration limit exceeded'
});
```

---

## 📈 MONITORING

### Health Check Endpoints

```bash
# Basic health
curl http://localhost:3000/health

# Detailed health (database, redis, kaspa)
curl http://localhost:3000/api/health

# Metrics (uptime, memory, cache stats)
curl http://localhost:3000/api/health/metrics

# Redis cache statistics
curl http://localhost:3000/api/health/metrics | jq '.cache'
```

### Logs

```bash
# Backend logs (Linux)
sudo journalctl -u klassik-backend -f

# Redis logs
sudo journalctl -u redis-server -f

# Kaspa node logs
sudo journalctl -u kaspad -f

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Performance Monitoring

```bash
# Request times (with cache)
time curl http://localhost:3000/api/kaspa-enhanced/stats

# Redis info
redis-cli INFO stats
redis-cli DBSIZE

# Database connections
psql -U klassik -d klassik_db -c "SELECT count(*) FROM pg_stat_activity;"
```

---

## 🔧 TROUBLESHOOTING

### Redis not connecting

```bash
# Check if Redis is running
redis-cli ping
# Expected: PONG

# Check Redis port
sudo netstat -tulpn | grep 6379

# Restart Redis
sudo systemctl restart redis-server

# Check logs
sudo journalctl -u redis-server -n 50
```

### Rate limiting not working

```bash
# Check environment variable
echo $RATE_LIMIT_ENABLED

# Check backend logs for "Enhanced rate limiting initialized"
sudo journalctl -u klassik-backend | grep "rate limiting"

# Verify middleware is applied
curl -v http://localhost:3000/api/auth/login
# Look for X-RateLimit-* headers
```

### Admin IP whitelist issues

```bash
# Check current IP
curl ifconfig.me

# Test with explicit IP header
curl -H "X-Forwarded-For: YOUR_IP" http://localhost:3000/api/admin/stats

# Check environment variable
echo $ADMIN_IP_WHITELIST

# Disable whitelist temporarily (empty = disabled)
ADMIN_IP_WHITELIST=
```

### Backup failures

```bash
# Check PostgreSQL access
psql -U klassik -d klassik_db -c "SELECT 1;"

# Check disk space
df -h /opt/klassik/backups

# Check permissions
ls -la /opt/klassik/backups

# Run backup manually with verbose output
./backup-database.sh backup
```

---

## 📞 SUPPORT

### Documentation
- [SECURITY_IMPLEMENTATION_REPORT.md](SECURITY_IMPLEMENTATION_REPORT.md) - Full implementation details
- [KASPA_NODE_SETUP.md](KASPA_NODE_SETUP.md) - Kaspa node installation guide
- [backend/scripts/README.md](backend/scripts/README.md) - Script documentation

### Testing
- [backend/scripts/test-security.sh](backend/scripts/test-security.sh) - Linux test suite
- [backend/scripts/test-security.ps1](backend/scripts/test-security.ps1) - Windows test suite

### Key Files
- [`backend/src/index.js`](backend/src/index.js) - Main server file
- [`backend/src/middleware/enhanced-rate-limit.js`](backend/src/middleware/enhanced-rate-limit.js) - Rate limiting
- [`backend/src/cache/redis-cache.js`](backend/src/cache/redis-cache.js) - Redis caching
- [`backend/src/routes/admin.js`](backend/src/routes/admin.js) - Admin IP whitelist
- [`backend/src/controllers/sacrifice-auth.js`](backend/src/controllers/sacrifice-auth.js) - Sacrifice validation

---

## 🎉 YOU'RE READY!

All security and performance fixes are implemented and ready to use!

**Next Steps:**
1. Run automated tests: `./test-security.sh` (Linux) or `.\test-security.ps1` (Windows)
2. Setup backups: Configure cron job or Task Scheduler
3. Monitor health: `curl http://localhost:3000/api/health/metrics`
4. Install Kaspa node (optional): See [KASPA_NODE_SETUP.md](KASPA_NODE_SETUP.md)
5. **LAUNCH! 🚀**

---

**Version:** 1.0.0  
**Last Updated:** 2024-01-15  
**Status:** ✅ Production Ready
