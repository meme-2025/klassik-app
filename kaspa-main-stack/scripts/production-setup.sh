#!/bin/bash

################################################################################
# Complete Kaspa Stack Setup for Production
# Location: /opt/klassik
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      Kaspa Stack - Production Installation                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}This script needs sudo access for Docker and Nginx setup.${NC}"
    echo -e "${YELLOW}Please run with: sudo ./production-setup.sh${NC}"
    exit 1
fi

INSTALL_DIR="/opt/klassik"
cd "$INSTALL_DIR" || exit 1

echo -e "${GREEN}[1/7]${NC} Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
fi

if ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose plugin..."
    apt-get update
    apt-get install -y docker-compose-plugin
fi

echo "✓ Docker installed"

echo -e "${GREEN}[2/7]${NC} Adding user to docker group..."
usermod -aG docker admxn
echo "✓ User added to docker group (logout/login to apply)"

echo -e "${GREEN}[3/7]${NC} Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    
    # Generate secure passwords
    POSTGRES_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    API_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    GRAFANA_PASS=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-12)
    
    sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${POSTGRES_PASS}/" .env
    sed -i "s/API_KEY=.*/API_KEY=${API_KEY}/" .env
    sed -i "s/GRAFANA_PASSWORD=.*/GRAFANA_PASSWORD=${GRAFANA_PASS}/" .env
    
    echo "✓ Generated secure passwords"
    echo ""
    echo -e "${YELLOW}API Key: ${API_KEY}${NC}"
    echo -e "${YELLOW}Grafana Password: ${GRAFANA_PASS}${NC}"
    echo ""
fi

# Set correct KASPAD_HOST for local connection
sed -i "s/KASPAD_HOST=.*/KASPAD_HOST=host.docker.internal/" .env

echo "✓ Environment configured"

echo -e "${GREEN}[4/7]${NC} Creating log directories..."
mkdir -p backend/rest-server/logs
mkdir -p middleware/logs
chmod -R 755 backend/rest-server/logs middleware/logs
echo "✓ Log directories ready"

echo -e "${GREEN}[5/7]${NC} Stopping any existing containers..."
docker compose down 2>/dev/null || true
echo "✓ Cleaned up"

echo -e "${GREEN}[6/7]${NC} Starting services..."
echo "This will take 10-15 minutes for the first build..."

# Start database first
echo "  Starting PostgreSQL and Redis..."
docker compose up -d postgres redis

# Wait for database
echo "  Waiting for PostgreSQL..."
sleep 10
until docker compose exec -T postgres pg_isready -U kaspa_admin &>/dev/null; do
    sleep 2
done
echo "  ✓ Database ready"

# Build and start backend services
echo "  Building kaspa-rest-server..."
docker compose build kaspa-rest-server
docker compose up -d kaspa-rest-server
sleep 10

echo "  Building middleware..."
docker compose build middleware
docker compose up -d middleware
sleep 10

echo "  Building frontend..."
docker compose build frontend
docker compose up -d frontend
sleep 5

echo "  Starting monitoring..."
docker compose up -d prometheus grafana node-exporter

echo "✓ All services started"

echo -e "${GREEN}[7/7]${NC} Configuring Nginx..."

# Backup existing config
if [ -f /etc/nginx/sites-enabled/99pace.space ]; then
    cp /etc/nginx/sites-enabled/99pace.space /etc/nginx/sites-enabled/99pace.space.backup
fi

# Copy new config
cp nginx/klassik.conf /etc/nginx/sites-available/99pace.space

# Enable site
ln -sf /etc/nginx/sites-available/99pace.space /etc/nginx/sites-enabled/99pace.space

# Remove default if exists
rm -f /etc/nginx/sites-enabled/default

# Test nginx config
if nginx -t; then
    systemctl reload nginx
    echo "✓ Nginx configured and reloaded"
else
    echo -e "${RED}✗ Nginx configuration has errors${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              INSTALLATION COMPLETED!                           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Run tests
echo "Running health checks..."
sleep 5

# Check services
echo ""
echo "Service Status:"
echo "───────────────────────────────────────────────────────────"
docker compose ps

echo ""
echo "Health Checks:"
echo "───────────────────────────────────────────────────────────"

# Test middleware
if curl -s -f http://localhost:8080/api/health > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Middleware API: Running"
else
    echo -e "  ${RED}✗${NC} Middleware API: Not responding"
fi

# Test frontend
if curl -s -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Frontend: Running"
else
    echo -e "  ${RED}✗${NC} Frontend: Not responding"
fi

# Test Grafana
if curl -s -f http://localhost:3001/api/health > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Grafana: Running"
else
    echo -e "  ${RED}✗${NC} Grafana: Not responding"
fi

# Test Nginx
if curl -s -f http://localhost > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Nginx: Running"
else
    echo -e "  ${RED}✗${NC} Nginx: Check configuration"
fi

echo ""
echo "Access Points:"
echo "───────────────────────────────────────────────────────────"
echo "  Domain:      http://99pace.space"
echo "  Frontend:    http://localhost:3000"
echo "  API:         http://localhost:8080/api"
echo "  Grafana:     http://localhost:3001"
echo "  Prometheus:  http://localhost:9090"
echo ""
echo "Credentials:"
echo "───────────────────────────────────────────────────────────"
source .env
echo "  API Key:            $API_KEY"
echo "  Grafana User:       admin"
echo "  Grafana Password:   $GRAFANA_PASSWORD"
echo ""
echo "Next Steps:"
echo "───────────────────────────────────────────────────────────"
echo "  1. Logout and login again to apply docker group"
echo "  2. Test domain: curl http://99pace.space"
echo "  3. Setup SSL: certbot --nginx -d 99pace.space"
echo "  4. Monitor logs: docker compose logs -f"
echo ""
