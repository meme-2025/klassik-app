#!/bin/bash
# Master deployment script - Run from Windows/Linux to deploy to Ubuntu server
# Usage: bash deploy-to-server.sh

set -e

SSH_KEY="C:\Users\TUF-s\.ssh\id_ed25519_new"
SSH_USER="admxn"
SSH_HOST="192.168.2.148"
DEPLOY_ROOT="/opt/kaspa-main-stack"
REPO_URL="https://github.com/meme-2025/klassik-app"
BRANCH="klassik.litehost0.2"

echo "=== KASPA FULL-STACK AUTONOMOUS DEPLOYMENT ==="
echo "Target: ${SSH_USER}@${SSH_HOST}:${DEPLOY_ROOT}"
echo "Branch: ${BRANCH}"
echo ""

# Transfer all files to server
echo "Phase 1: Transferring deployment package..."

ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} << 'ENDSSH'

# System check
echo "Checking system requirements..."
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y docker.io docker-compose-plugin curl git
    sudo usermod -aG docker $USER
    echo "⚠️  Please log out and back in for Docker permissions, then re-run this script"
    exit 1
fi

# Create deployment structure
sudo mkdir -p /opt/kaspa-main-stack/{backend/rest-server,middleware/src,frontend,db/migrations,nginx,monitoring,e2e,backups,logs,errors}
sudo chown -R admxn:admxn /opt/kaspa-main-stack
cd /opt/kaspa-main-stack

# Clone/update repo
if [ -d ".git" ]; then
    echo "Backing up existing deployment..."
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p ../backups
    tar -czf "../backups/${BACKUP_NAME}.tar.gz" . 2>/dev/null || true
    
    git fetch origin
    git reset --hard origin/klassik.litehost0.2
else
    git clone --branch klassik.litehost0.2 https://github.com/meme-2025/klassik-app .
fi

ENDSSH

echo "✅ Phase 1 Complete"
echo ""

# Deploy configuration files
echo "Phase 2: Deploying configuration files..."

ssh -i "${SSH_KEY}" ${SSH_USER}@${SSH_HOST} << 'ENDSSH'
cd /opt/kaspa-main-stack

# Generate secure secrets
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
API_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# Create .env file
cat > .env << EOFENV
# Kaspa Full-Stack Environment - Generated $(date)
NODE_ENV=production

# Kaspad Connection
KASPAD_HOST=127.0.0.1
KASPAD_RPC_PORT=16110

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=kaspa
POSTGRES_USER=kaspa
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# API Configuration
API_SECRET_KEY=${API_SECRET}
BACKEND_PORT=8081
MIDDLEWARE_PORT=8080

# Frontend
NEXT_PUBLIC_API_URL=https://klassik.99pace.space/api
FRONTEND_PORT=3000

# Domain
DOMAIN=klassik.99pace.space

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
GRAFANA_ADMIN_PASSWORD=${POSTGRES_PASSWORD}
EOFENV

chmod 600 .env

echo "✅ Secrets generated and saved to .env"

ENDSSH

echo "✅ Phase 2 Complete"
echo ""
echo "Deployment package ready. Run install_and_test.sh on server to complete deployment."
