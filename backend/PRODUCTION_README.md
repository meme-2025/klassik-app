# Klassik Production README
# Complete deployment and monitoring guide

## 🚀 Production Deployment Guide

### Overview
This guide covers the complete production deployment of the Klassik platform on Ubuntu with comprehensive monitoring and health checks.

### Prerequisites
- Ubuntu 20.04+ server
- sudo access
- Domain name (optional but recommended)
- 4GB+ RAM, 50GB+ disk space

### Quick Deployment
```bash
# 1. Clone repository
git clone https://github.com/YOUR_USERNAME/Klassik.git
cd Klassik/backend

# 2. Make deployment script executable
chmod +x deploy/production-setup.sh

# 3. Run deployment (as non-root user with sudo)
./deploy/production-setup.sh

# 4. Follow prompts for domain/SSL setup
```

### Architecture Overview
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     nginx       │    │   Klassik App   │    │   PostgreSQL    │
│   (Port 80/443) │────│   (Port 3000)   │────│   (Port 5432)   │
│   Load Balancer │    │   Node.js       │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │              ┌─────────────────┐
         │                       │              │     Redis       │
         │                       └──────────────│   (Port 6379)   │
         │                                      │   Cache/Session │
         │                                      └─────────────────┘
         │
┌─────────────────┐
│   Static Files  │
│   Frontend      │
│   (nginx serve) │
└─────────────────┘
```

## 🔧 System Services

### Klassik Service
```bash
# Service status
sudo systemctl status klassik

# View logs
sudo journalctl -u klassik -f

# Restart service
sudo systemctl restart klassik

# Enable/disable
sudo systemctl enable klassik
sudo systemctl disable klassik
```

### Service Configuration
Location: `/etc/systemd/system/klassik.service`

Key features:
- Auto-restart on failure
- Security sandboxing
- Resource limits
- Proper logging

### Database Service
```bash
# PostgreSQL status
sudo systemctl status postgresql

# Connect to database
sudo -u postgres psql klassik

# Backup database
sudo -u klassik pg_dump klassik > /opt/klassik/backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
sudo -u klassik psql klassik < backup_file.sql
```

## 📊 Monitoring and Health Checks

### Health Check Endpoints

#### Basic Health Check
```bash
curl http://localhost/health
```
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": {
    "milliseconds": 3600000,
    "human": "1h 0m"
  },
  "version": "1.0.0",
  "environment": "production"
}
```

#### Detailed Health Check
```bash
curl http://localhost/api/health
```
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": { "human": "1h 0m", "seconds": 3600 },
  "memory": {
    "rss": "150 MB",
    "heapTotal": "120 MB",
    "heapUsed": "80 MB"
  },
  "process": {
    "pid": 1234,
    "nodeVersion": "v18.17.0",
    "platform": "linux"
  },
  "services": {
    "database": { "status": "healthy" },
    "redis": { "status": "healthy" },
    "kaspa": { "status": "healthy" },
    "websocket": { "status": "healthy", "connections": 5 }
  }
}
```

#### Readiness Check (Kubernetes/Docker)
```bash
curl http://localhost/api/health/ready
```

#### Liveness Check (Kubernetes/Docker)
```bash
curl http://localhost/api/health/live
```

#### Metrics Endpoint
```bash
curl http://localhost/api/health/metrics
```
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime_seconds": 3600,
  "memory_usage_bytes": 157286400,
  "heap_total_bytes": 125829120,
  "heap_used_bytes": 83886080,
  "cpu_usage": 2.5,
  "websocket_connections": 5
}
```

### Automated Monitoring

The system includes an automated monitoring script:
- Location: `/usr/local/bin/klassik-monitor`
- Runs every 5 minutes via cron
- Auto-restarts failed services
- Checks disk space, memory usage
- Optional webhook notifications

#### Monitoring Logs
```bash
tail -f /var/log/klassik-monitor.log
```

#### Configure Webhook Alerts
```bash
# Edit cron to include webhook URL
sudo crontab -e

# Add webhook URL
*/5 * * * * WEBHOOK_URL="https://hooks.slack.com/your-webhook" /usr/local/bin/klassik-monitor
```

## 🔄 Deployment Updates

### Zero-Downtime Updates
```bash
# Navigate to app directory
cd /opt/klassik/current/backend

# Run update script
./deploy/deploy-update.sh
```

Update process:
1. Creates backup of current release
2. Downloads new code
3. Installs dependencies
4. Runs database migrations
5. Updates symlink
6. Restarts service
7. Performs health check
8. Rolls back on failure

### Manual Deployment
```bash
# Create new release
RELEASE=$(date +%Y%m%d_%H%M%S)
sudo -u klassik git clone https://github.com/YOUR_USERNAME/Klassik.git /opt/klassik/releases/$RELEASE

# Install dependencies
cd /opt/klassik/releases/$RELEASE/backend
sudo -u klassik npm ci --production

# Run migrations
sudo -u klassik env $(cat /etc/klassik/klassik.env | xargs) npm run migrate:up

# Update symlink
sudo -u klassik ln -sfn /opt/klassik/releases/$RELEASE /opt/klassik/current

# Restart service
sudo systemctl restart klassik
```

## 🗄️ Database Management

### Migrations
```bash
# Run pending migrations
cd /opt/klassik/current/backend
sudo -u klassik env $(cat /etc/klassik/klassik.env | xargs) npm run migrate:up

# Rollback migrations
sudo -u klassik env $(cat /etc/klassik/klassik.env | xargs) npm run migrate:down

# Check migration status
sudo -u klassik env $(cat /etc/klassik/klassik.env | xargs) npm run migrate:status
```

### Database Backups
```bash
# Manual backup
sudo -u klassik pg_dump klassik > /opt/klassik/backups/manual_$(date +%Y%m%d_%H%M%S).sql

# Automated backups (add to cron)
0 2 * * * sudo -u klassik pg_dump klassik | gzip > /opt/klassik/backups/auto_$(date +\%Y\%m\%d_\%H\%M\%S).sql.gz

# Clean old backups (keep 30 days)
find /opt/klassik/backups -name "*.sql*" -mtime +30 -delete
```

## 🔒 Security

### SSL/TLS Configuration
Automatically configured if domain is provided during setup using Let's Encrypt.

### Firewall Rules
```bash
# View current rules
sudo ufw status

# Allow specific IP
sudo ufw allow from 192.168.1.100

# Block IP
sudo ufw deny from 192.168.1.200
```

### Fail2Ban Protection
Configuration: `/etc/fail2ban/jail.local`

View banned IPs:
```bash
sudo fail2ban-client status nginx-http-auth
sudo fail2ban-client status nginx-req-limit
```

## 📁 Directory Structure

```
/opt/klassik/
├── current/                 # Symlink to current release
├── releases/               # All releases
│   ├── 20240115_103000/   # Release directories
│   └── 20240115_120000/
├── shared/                 # Shared resources
│   ├── logs/              # Application logs
│   ├── uploads/           # File uploads
│   └── config/            # Shared configuration
├── backups/               # Database backups
└── deployment-info.txt    # Deployment information

/etc/klassik/
├── klassik.env           # Environment variables
└── database.env          # Database credentials

/var/log/klassik/
├── app.log              # Application logs
├── error.log            # Error logs
└── access.log           # Access logs
```

## 🔍 Troubleshooting

### Service Won't Start
```bash
# Check service status
sudo systemctl status klassik

# Check logs
sudo journalctl -u klassik -n 50

# Check configuration
sudo -u klassik node -c "console.log('Config OK')"

# Check environment
sudo -u klassik env $(cat /etc/klassik/klassik.env | xargs) node -e "console.log(process.env.DATABASE_URL ? 'DB OK' : 'DB Missing')"
```

### Database Connection Issues
```bash
# Test database connection
sudo -u postgres psql -c "SELECT version();"
sudo -u klassik psql klassik -c "SELECT 1;"

# Check database credentials
cat /etc/klassik/database.env
```

### High Memory Usage
```bash
# Check memory usage
free -h
sudo systemctl status klassik

# Restart service
sudo systemctl restart klassik

# Check for memory leaks
curl http://localhost/api/health/metrics
```

### WebSocket Issues
```bash
# Check WebSocket connections
curl http://localhost/api/health | jq '.services.websocket'

# Test WebSocket manually
wscat -c ws://localhost:3000/socket.io/?EIO=4&transport=websocket
```

## 📈 Performance Optimization

### Nginx Configuration
- Gzip compression enabled
- Static file caching (1 year)
- Rate limiting configured
- SSL optimization

### Node.js Optimization
- Production mode
- Memory limits configured
- PM2 clustering available

### Database Optimization
- Connection pooling
- Proper indexing
- Query optimization

## 🎯 Production Checklist

### Pre-Launch
- [ ] All services running
- [ ] Health checks passing
- [ ] SSL certificate installed
- [ ] Firewall configured
- [ ] Monitoring active
- [ ] Backups scheduled
- [ ] DNS configured

### Post-Launch Monitoring
- [ ] Monitor error rates
- [ ] Check response times
- [ ] Verify websocket connections
- [ ] Monitor resource usage
- [ ] Review security logs

## 🆘 Emergency Procedures

### Service Recovery
```bash
# Quick restart
sudo systemctl restart klassik nginx postgresql redis

# Emergency rollback
sudo -u klassik ln -sfn /opt/klassik/releases/PREVIOUS_RELEASE /opt/klassik/current
sudo systemctl restart klassik
```

### Database Recovery
```bash
# Restore from backup
sudo systemctl stop klassik
sudo -u postgres dropdb klassik
sudo -u postgres createdb klassik
sudo -u klassik psql klassik < /opt/klassik/backups/BACKUP_FILE.sql
sudo systemctl start klassik
```

---

## 📞 Support

For issues or questions:
- Check logs: `/var/log/klassik/`
- Review health checks: `http://localhost/api/health`
- Check service status: `sudo systemctl status klassik`

The monitoring system will automatically attempt recovery for common issues.