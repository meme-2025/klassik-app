#!/bin/bash

# ==================================================
# KLASSIK KASPA OFFICIAL DEPLOYMENT SCRIPT
# Deploy real Kaspa Stack with official components
# Domain: klassik.99pace.space
# ==================================================

set -e

DOMAIN="klassik.99pace.space"
LETSENCRYPT_EMAIL="admin@99pace.space"
COMPOSE_FILE="docker-compose.official.yml"
LOG_FILE="/opt/klassik/deployment-official.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[ERROR $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a $LOG_FILE
}

warning() {
    echo -e "${YELLOW}[WARNING $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a $LOG_FILE
}

info() {
    echo -e "${BLUE}[INFO $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a $LOG_FILE
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    error "This script should not be run as root"
    exit 1
fi

cd /opt/klassik

log "🚀 Starting Official Kaspa Stack Deployment"

# 1. Update system and install dependencies
log "📦 Installing system dependencies..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y docker.io docker-compose-plugin certbot python3-certbot-nginx htop curl wget git

# 2. Configure Docker
log "🐳 Configuring Docker..."
sudo usermod -aG docker $USER
sudo systemctl enable docker
sudo systemctl start docker

# 3. Create environment file
log "⚙️  Creating environment configuration..."
if [ ! -f .env ]; then
    cat > .env << EOF
# Kaspa Network Configuration
KASPA_NETWORK=mainnet
KASPAD_HOST=127.0.0.1:16110
KASPAD_WRPC_URL=ws://127.0.0.1:16110
NETWORK_TYPE=mainnet

# Database Configuration
POSTGRES_DB=kaspa
POSTGRES_USER=kaspa
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# Monitoring
GRAFANA_PASSWORD=$(openssl rand -base64 16)

# Domain
DOMAIN=$DOMAIN

# Generated on: $(date)
EOF
    log "✅ Environment file created"
else
    log "✅ Environment file already exists"
fi

# 4. Create necessary directories
log "📁 Creating directory structure..."
mkdir -p ssl monitoring/grafana/dashboards monitoring/prometheus nginx logs

# 5. Pull official images
log "📥 Pulling official Kaspa images..."
docker pull kaspaorg/kaspa-rest-server:latest
docker pull supertypo/simply-kaspa-indexer:latest
docker pull postgres:15
docker pull grafana/grafana:latest
docker pull prom/prometheus:latest
docker pull nginx:alpine

# 6. Setup SSL certificates
log "🔒 Setting up SSL certificates..."
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log "Obtaining SSL certificate for $DOMAIN..."
    sudo certbot certonly --nginx -d $DOMAIN --email $LETSENCRYPT_EMAIL --agree-tos --non-interactive
    
    if [ $? -eq 0 ]; then
        log "✅ SSL certificate obtained successfully"
    else
        error "❌ Failed to obtain SSL certificate"
        exit 1
    fi
else
    log "✅ SSL certificate already exists"
fi

# 7. Setup auto-renewal for SSL
log "🔄 Setting up SSL auto-renewal..."
sudo crontab -l | grep -q certbot || {
    (sudo crontab -l; echo "0 12 * * * /usr/bin/certbot renew --quiet") | sudo crontab -
}

# 8. Configure Nginx
log "🔧 Configuring Nginx..."
sudo cp nginx/klassik-official.conf /etc/nginx/sites-available/klassik.99pace.space
sudo ln -sf /etc/nginx/sites-available/klassik.99pace.space /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 9. Create htpasswd for Grafana access
log "🔐 Setting up Grafana authentication..."
if [ ! -f nginx/.htpasswd ]; then
    echo -n "Enter username for Grafana access: "
    read username
    sudo htpasswd -c nginx/.htpasswd $username
fi

# 10. Start the official stack
log "🚀 Starting Official Kaspa Stack..."
docker compose -f $COMPOSE_FILE down --remove-orphans
docker compose -f $COMPOSE_FILE pull
docker compose -f $COMPOSE_FILE up -d

# 11. Wait for services to be healthy
log "⏳ Waiting for services to start..."
sleep 30

# Check service health
check_service() {
    local service_name=$1
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker compose -f $COMPOSE_FILE ps $service_name | grep -q "healthy"; then
            log "✅ $service_name is healthy"
            return 0
        fi
        
        info "Waiting for $service_name... (attempt $attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    error "❌ $service_name failed to become healthy"
    return 1
}

# Check all services
log "🩺 Checking service health..."
check_service postgres
check_service kaspa_rest_server
check_service kaspa_explorer

# 12. Setup monitoring
log "📊 Configuring monitoring..."
docker exec kaspa_grafana grafana-cli admin reset-admin-password "$(grep GRAFANA_PASSWORD .env | cut -d'=' -f2)"

# 13. Final verification
log "🔍 Final verification..."
if curl -k https://$DOMAIN/health > /dev/null 2>&1; then
    log "✅ Website is accessible at https://$DOMAIN"
else
    warning "⚠️  Website may not be immediately accessible - DNS propagation required"
fi

# 14. Display status
log "📋 Deployment Status:"
docker compose -f $COMPOSE_FILE ps

log "🎉 Official Kaspa Stack deployment completed!"
log ""
log "🌐 Access URLs:"
log "   • Main Explorer: https://$DOMAIN"
log "   • API Endpoint: https://$DOMAIN/api"
log "   • WebSocket: wss://$DOMAIN/ws"
log "   • Monitoring: https://$DOMAIN/monitoring"
log "   • Metrics: https://$DOMAIN/metrics (admin only)"
log ""
log "📊 Services:"
log "   • Kaspa Explorer (Official Next.js): Running on port 3000"
log "   • Kaspa REST Server (Official Rust): Running on port 8080"  
log "   • PostgreSQL Database: Running on port 5432"
log "   • Grafana Monitoring: Running on port 3001"
log "   • Prometheus: Running on port 9090"
log ""
log "🔑 Security:"
log "   • SSL/TLS enabled with Let's Encrypt"
log "   • Auto-renewal configured"
log "   • Rate limiting enabled"
log "   • Security headers configured"
log ""
log "📝 Next Steps:"
log "   1. Wait for DNS propagation if domain is new"
log "   2. Monitor logs: docker compose -f $COMPOSE_FILE logs -f"
log "   3. Check Grafana dashboards for system metrics"
log "   4. Test API endpoints at https://$DOMAIN/api"
log ""
log "✅ OFFICIAL KASPA STACK SUCCESSFULLY DEPLOYED! 🚀"