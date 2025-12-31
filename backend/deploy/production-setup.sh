#!/bin/bash
# Production Deployment Script for Ubuntu
# File: backend/deploy/production-setup.sh

set -e

echo "🚀 Starting Klassik Production Deployment..."

# Configuration
APP_NAME="klassik"
APP_USER="klassik"
APP_DIR="/opt/klassik"
BACKUP_DIR="/opt/klassik/backups"
CONFIG_DIR="/etc/klassik"
LOG_DIR="/var/log/klassik"
REPO_URL=${REPO_URL:-"https://github.com/YOUR_USERNAME/Klassik.git"}
BRANCH=${BRANCH:-"main"}
NODE_VERSION="18"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    error "This script should not be run as root. Use a user with sudo privileges."
fi

# Update system
log "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install essential packages
log "Installing essential packages..."
sudo apt install -y curl wget git nginx ufw postgresql postgresql-contrib redis-server \
    build-essential python3-pip supervisor htop iotop rsync fail2ban certbot \
    python3-certbot-nginx logrotate

# Install Node.js
log "Installing Node.js $NODE_VERSION..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Verify installations
node_version=$(node --version)
npm_version=$(npm --version)
success "Node.js $node_version and npm $npm_version installed"

# Create application user
log "Creating application user: $APP_USER"
if ! id "$APP_USER" &>/dev/null; then
    sudo adduser --system --group --home $APP_DIR --shell /bin/bash $APP_USER
    success "User $APP_USER created"
else
    warning "User $APP_USER already exists"
fi

# Create directory structure
log "Creating directory structure..."
sudo mkdir -p $APP_DIR/{releases,shared/{logs,config,uploads}} $BACKUP_DIR $LOG_DIR
sudo chown -R $APP_USER:$APP_USER $APP_DIR $BACKUP_DIR $LOG_DIR
sudo mkdir -p $CONFIG_DIR
sudo chmod 750 $CONFIG_DIR

# Setup database
log "Setting up PostgreSQL database..."
if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw $APP_NAME; then
    # Generate random password
    DB_PASSWORD=$(openssl rand -base64 32)
    
    sudo -u postgres createuser $APP_NAME
    sudo -u postgres psql -c "ALTER USER $APP_NAME PASSWORD '$DB_PASSWORD';"
    sudo -u postgres createdb -O $APP_NAME $APP_NAME
    
    # Save database credentials
    echo "DATABASE_URL=postgresql://$APP_NAME:$DB_PASSWORD@localhost:5432/$APP_NAME" | sudo tee $CONFIG_DIR/database.env > /dev/null
    sudo chmod 600 $CONFIG_DIR/database.env
    sudo chown $APP_USER:$APP_USER $CONFIG_DIR/database.env
    
    success "Database created with user: $APP_NAME"
else
    warning "Database $APP_NAME already exists"
fi

# Setup Redis
log "Configuring Redis..."
sudo systemctl enable redis-server
sudo systemctl start redis-server
success "Redis configured and started"

# Generate application secrets
log "Generating application secrets..."
JWT_SECRET=$(openssl rand -base64 64)
SESSION_SECRET=$(openssl rand -base64 64)
ADMIN_TOKEN=$(openssl rand -hex 32)

# Create environment configuration
log "Creating environment configuration..."
sudo tee $CONFIG_DIR/klassik.env > /dev/null << EOF
# Klassik Production Configuration
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# Database
$(cat $CONFIG_DIR/database.env)

# Security
JWT_SECRET=$JWT_SECRET
JWT_EXPIRY=7d
SESSION_SECRET=$SESSION_SECRET
ADMIN_TOKEN=$ADMIN_TOKEN

# CORS
CORS_ORIGIN=https://yourdomain.com

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Kaspa Configuration
KASPA_REST_SERVER=http://localhost:8080
KASPA_SACRIFICE_ADDRESS=kaspa:qr25pe5pfa4mhs8slw3dvxud4x55zx73tkz4xnpfyudnf7j8czzlsvf3vksdc
POINTS_PER_KAS=100
MIN_POINTS_REQUIRED=1

# Blockchain Monitoring
ENABLE_BLOCKCHAIN_MONITOR=true
KASPA_POLL_INTERVAL=10000

# Services
ENABLE_WATCHER=true
ENABLE_KLASSIK=true

# Logging
LOG_LEVEL=info
LOG_DIR=$LOG_DIR

# Paths
APP_DIR=$APP_DIR
BACKUP_DIR=$BACKUP_DIR
EOF

sudo chmod 640 $CONFIG_DIR/klassik.env
sudo chown root:$APP_USER $CONFIG_DIR/klassik.env
success "Environment configuration created"

# Clone or update repository
CURRENT_RELEASE=$(date +%Y%m%d_%H%M%S)
RELEASE_DIR="$APP_DIR/releases/$CURRENT_RELEASE"

log "Deploying release: $CURRENT_RELEASE"
sudo -u $APP_USER git clone $REPO_URL $RELEASE_DIR
cd $RELEASE_DIR
sudo -u $APP_USER git checkout $BRANCH

# Install dependencies
log "Installing application dependencies..."
cd $RELEASE_DIR/backend
sudo -u $APP_USER npm ci --production --no-audit

# Run database migrations
log "Running database migrations..."
sudo -u $APP_USER env $(cat $CONFIG_DIR/klassik.env | xargs) npm run migrate:up

# Create symlinks
log "Creating symlinks..."
sudo -u $APP_USER ln -sfn $RELEASE_DIR $APP_DIR/current
sudo -u $APP_USER ln -sfn $LOG_DIR $APP_DIR/current/backend/logs

# Setup systemd service
log "Creating systemd service..."
sudo tee /etc/systemd/system/$APP_NAME.service > /dev/null << EOF
[Unit]
Description=Klassik Backend Server
Documentation=https://github.com/YOUR_USERNAME/Klassik
After=network.target postgresql.service redis.service
Wants=postgresql.service redis.service

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/current/backend
Environment=NODE_ENV=production
EnvironmentFile=$CONFIG_DIR/klassik.env
ExecStart=/usr/bin/node src/index.js
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=5
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR $LOG_DIR /tmp

# Resource limits
LimitNOFILE=65536
LimitNPROC=32768

# Monitoring
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$APP_NAME

[Install]
WantedBy=multi-user.target
EOF

# Setup nginx configuration
log "Creating nginx configuration..."
sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null << 'EOF'
# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;

# Upstream backend
upstream klassik_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self' wss: https:;" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1000;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml+rss;

    # Static files
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        root /opt/klassik/current/frontend;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # API routes with rate limiting
    location /api/auth/ {
        limit_req zone=auth burst=20 nodelay;
        proxy_pass http://klassik_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }

    location /api/ {
        limit_req zone=api burst=50 nodelay;
        proxy_pass http://klassik_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://klassik_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    # Frontend (SPA)
    location / {
        root /opt/klassik/current/frontend;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Health check
    location /health {
        proxy_pass http://klassik_backend/health;
        access_log off;
    }

    # Deny access to sensitive files
    location ~ /\. {
        deny all;
        access_log off;
    }

    location ~ \.(env|config|log)$ {
        deny all;
        access_log off;
    }
}
EOF

# Enable nginx site
sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Setup logrotate
log "Setting up log rotation..."
sudo tee /etc/logrotate.d/$APP_NAME > /dev/null << EOF
$LOG_DIR/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
    postrotate
        systemctl reload $APP_NAME > /dev/null 2>&1 || true
    endscript
}
EOF

# Setup monitoring script
log "Creating monitoring script..."
sudo tee /usr/local/bin/klassik-monitor > /dev/null << 'EOF'
#!/bin/bash

APP_NAME="klassik"
LOG_FILE="/var/log/klassik-monitor.log"
WEBHOOK_URL="${WEBHOOK_URL:-""}" # Set this to your webhook URL

log_message() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

check_service() {
    if ! systemctl is-active --quiet $APP_NAME; then
        log_message "ERROR: $APP_NAME service is not running"
        systemctl start $APP_NAME
        sleep 10
        
        if systemctl is-active --quiet $APP_NAME; then
            log_message "SUCCESS: $APP_NAME service restarted"
        else
            log_message "CRITICAL: Failed to restart $APP_NAME service"
            if [[ -n "$WEBHOOK_URL" ]]; then
                curl -X POST "$WEBHOOK_URL" -H 'Content-type: application/json' \
                     --data '{"text":"🚨 Klassik service failed to restart on server"}'
            fi
        fi
    fi
}

check_health() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")
    
    if [[ "$response" != "200" ]]; then
        log_message "WARNING: Health check failed (HTTP $response)"
        return 1
    fi
    
    return 0
}

check_disk_space() {
    local usage=$(df /opt/klassik | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [[ $usage -gt 85 ]]; then
        log_message "WARNING: Disk usage is ${usage}%"
        
        # Clean old releases (keep last 5)
        find /opt/klassik/releases -maxdepth 1 -type d | sort | head -n -5 | xargs rm -rf
        log_message "Cleaned old releases"
    fi
}

check_memory() {
    local mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    
    if [[ $mem_usage -gt 90 ]]; then
        log_message "WARNING: Memory usage is ${mem_usage}%"
    fi
}

main() {
    check_service
    check_health
    check_disk_space
    check_memory
    
    # Log success
    log_message "Health check completed successfully"
}

main "$@"
EOF

sudo chmod +x /usr/local/bin/klassik-monitor

# Setup cron for monitoring
log "Setting up monitoring cron..."
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/klassik-monitor") | sudo crontab -u root -

# Setup SSL with Let's Encrypt (optional)
read -p "Do you want to setup SSL with Let's Encrypt? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter your domain name: " domain
    if [[ -n "$domain" ]]; then
        log "Setting up SSL for $domain..."
        sudo certbot --nginx -d $domain --non-interactive --agree-tos --email admin@$domain
        success "SSL certificate installed for $domain"
    fi
fi

# Setup firewall
log "Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
success "Firewall configured"

# Setup fail2ban
log "Configuring fail2ban..."
sudo tee /etc/fail2ban/jail.local > /dev/null << 'EOF'
[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 5
bantime = 3600

[nginx-req-limit]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
bantime = 3600
findtime = 60
EOF

sudo systemctl enable fail2ban
sudo systemctl restart fail2ban
success "Fail2ban configured"

# Start services
log "Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable $APP_NAME
sudo systemctl start $APP_NAME
sudo systemctl enable nginx
sudo systemctl restart nginx

# Wait for service to start
sleep 5

# Final health check
log "Performing final health check..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    success "Application is running and healthy!"
else
    warning "Application may not be fully ready yet. Check logs: sudo journalctl -u $APP_NAME -f"
fi

# Display useful information
echo ""
echo "🎉 Deployment completed successfully!"
echo ""
echo "📊 Service Information:"
echo "  Service status: sudo systemctl status $APP_NAME"
echo "  View logs: sudo journalctl -u $APP_NAME -f"
echo "  Restart: sudo systemctl restart $APP_NAME"
echo ""
echo "📁 Important Paths:"
echo "  Application: $APP_DIR/current"
echo "  Configuration: $CONFIG_DIR"
echo "  Logs: $LOG_DIR"
echo "  Backups: $BACKUP_DIR"
echo ""
echo "🔧 Useful Commands:"
echo "  Monitor health: /usr/local/bin/klassik-monitor"
echo "  Deploy new version: cd $RELEASE_DIR && ./deploy/deploy-update.sh"
echo "  Database backup: sudo -u $APP_USER pg_dump $APP_NAME > $BACKUP_DIR/backup_\$(date +%Y%m%d_%H%M%S).sql"
echo ""
echo "🌍 Your application should be accessible at:"
echo "  HTTP: http://localhost"
echo "  Health check: http://localhost/health"
echo ""

# Create deployment info file
sudo tee $APP_DIR/deployment-info.txt > /dev/null << EOF
Deployment completed: $(date)
Release: $CURRENT_RELEASE
Node.js: $(node --version)
Git commit: $(cd $RELEASE_DIR && git rev-parse HEAD)
Environment: production
EOF

success "Deployment information saved to $APP_DIR/deployment-info.txt"
success "Setup completed! Your Klassik application is ready for production! 🚀"