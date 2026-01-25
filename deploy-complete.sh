#!/bin/bash
# Kaspa Full-Stack Complete Deployment
# Ausführung auf dem Server: ./deploy-complete.sh

set -euo pipefail

DEPLOY_ROOT="/opt/kaspa-main-stack"
REPO_URL="https://github.com/meme-2025/klassik-app"
BRANCH="klassik.litehost0.2"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=== KASPA FULL-STACK COMPLETE DEPLOYMENT ==="
echo ""

# Check if running as correct user
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}Do not run as root!${NC}"
    exit 1
fi

# Navigate to deployment directory
cd "$DEPLOY_ROOT" || exit 1

# Pull latest changes
echo -e "${YELLOW}Updating from Git...${NC}"
git fetch origin
git reset --hard origin/$BRANCH

# Load environment
if [ ! -f .env ]; then
    echo -e "${RED}Creating .env file...${NC}"
    
    # Generate secrets
    POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    API_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    cat > .env << EOFENV
NODE_ENV=production
KASPAD_HOST=127.0.0.1
KASPAD_RPC_PORT=16110
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=kaspa
POSTGRES_USER=kaspa
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}
API_SECRET_KEY=${API_SECRET}
BACKEND_PORT=8081
MIDDLEWARE_PORT=8080
NEXT_PUBLIC_API_URL=https://klassik.99pace.space/api
FRONTEND_PORT=3000
DOMAIN=klassik.99pace.space
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
GRAFANA_ADMIN_PASSWORD=${POSTGRES_PASSWORD}
EOFENV
    
    chmod 600 .env
    echo -e "${GREEN}✓ .env created${NC}"
fi

source .env

# Stop old containers
echo -e "${YELLOW}Stopping old containers...${NC}"
docker-compose -f docker-compose.production.yml down -v 2>/dev/null || true

# Build new images
echo -e "${YELLOW}Building Docker images...${NC}"
docker-compose -f docker-compose.production.yml build --no-cache

# Start services
echo -e "${YELLOW}Starting services...${NC}"
docker-compose -f docker-compose.production.yml up -d

# Wait for health
echo -e "${YELLOW}Waiting for services (60s)...${NC}"
sleep 60

# Run tests
echo -e "${YELLOW}Running health checks...${NC}"
./install_and_test.sh

echo ""
echo -e "${GREEN}=== DEPLOYMENT COMPLETE ===${NC}"
echo ""
echo "Services:"
echo "  REST: http://localhost:${BACKEND_PORT}"
echo "  API:  http://localhost:${MIDDLEWARE_PORT}"
echo "  Grafana: http://localhost:${GRAFANA_PORT}"
echo ""
echo "Next: Configure Nginx for ${DOMAIN}"
