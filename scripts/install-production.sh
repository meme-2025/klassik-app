#!/bin/bash

################################################################################
# Kaspa Stack - Production Installation (Port-Konflikte behoben)
################################################################################

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="/opt/klassik"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║      Kaspa Stack - Production Installation (Fixed)            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_ROOT"

# Alte Container stoppen
echo -e "${GREEN}[1/8]${NC} Stopping existing containers..."
sudo docker-compose down 2>/dev/null || true
echo "✓ Cleaned up"

# Environment setup
echo -e "${GREEN}[2/8]${NC} Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    POSTGRES_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    API_KEY=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    GRAFANA_PASS=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-12)
    
    sed -i "s/POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=${POSTGRES_PASS}/" .env
    sed -i "s/API_KEY=.*/API_KEY=${API_KEY}/" .env
    sed -i "s/GRAFANA_PASSWORD=.*/GRAFANA_PASSWORD=${GRAFANA_PASS}/" .env
    
    echo "✓ Generated secure passwords"
else
    echo "✓ Using existing .env"
fi

# Verwende production docker-compose
echo -e "${GREEN}[3/8]${NC} Copying production config..."
cp docker-compose.production.yml docker-compose.yml
echo "✓ Production config ready (Ports: 5433, 6380, 8080, 8081, 3000)"

# Log directories
echo -e "${GREEN}[4/8]${NC} Creating log directories..."
mkdir -p backend/rest-server/logs middleware/logs
chmod -R 755 backend/rest-server/logs middleware/logs
echo "✓ Log directories ready"

# Pull images
echo -e "${GREEN}[5/8]${NC} Pulling Docker images..."
sudo docker-compose pull postgres redis prometheus grafana node-exporter 2>&1 | grep -v "Pulling" || true
echo "✓ Images pulled"

# Start database services
echo -e "${GREEN}[6/8]${NC} Starting PostgreSQL and Redis..."
sudo docker-compose up -d postgres redis
sleep 10

# Wait for PostgreSQL
echo -e "${YELLOW}Waiting for PostgreSQL...${NC}"
for i in {1..30}; do
    if sudo docker-compose exec -T postgres pg_isready -U kaspa_admin &>/dev/null; then
        echo "✓ PostgreSQL ready"
        break
    fi
    sleep 2
done

# Build and start backend
echo -e "${GREEN}[7/8]${NC} Building and starting backend services..."
echo -e "${YELLOW}This may take 10-15 minutes for first build...${NC}"
sudo docker-compose build kaspa-rest-server middleware
sudo docker-compose up -d kaspa-rest-server
sleep 15
sudo docker-compose up -d middleware
sleep 10

# Start frontend and monitoring
echo -e "${GREEN}[8/8]${NC} Starting frontend and monitoring..."
sudo docker-compose build frontend
sudo docker-compose up -d frontend prometheus grafana node-exporter

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 INSTALLATION COMPLETED                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Show status
echo "Services Status:"
echo "────────────────────────────────────────────────────────────────"
sudo docker-compose ps

echo ""
echo "Access Points:"
echo "────────────────────────────────────────────────────────────────"
echo -e "  Frontend:    ${BLUE}http://192.168.2.148:3000${NC}"
echo -e "  API:         ${BLUE}http://192.168.2.148:8080/api${NC}"
echo -e "  Grafana:     ${BLUE}http://192.168.2.148:3001${NC}"
echo -e "  Prometheus:  ${BLUE}http://192.168.2.148:9090${NC}"
echo ""
echo "Credentials in: /opt/klassik/.env"
echo ""

# Test API
echo "Testing API..."
sleep 5
API_KEY=$(grep API_KEY .env | cut -d'=' -f2)
if curl -s -H "x-api-key: $API_KEY" http://localhost:8080/api/health | grep -q "healthy"; then
    echo -e "${GREEN}✓ API is responding!${NC}"
else
    echo -e "${YELLOW}⚠ API not ready yet (may need more time)${NC}"
fi

echo ""
echo "View logs: sudo docker-compose logs -f [service-name]"
echo "Restart: sudo docker-compose restart [service-name]"
echo ""
