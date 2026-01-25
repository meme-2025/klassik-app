#!/bin/bash

################################################################################
# Deployment Script for Ubuntu Server
# Deploys the Kaspa stack to the remote server via SSH
################################################################################

set -euo pipefail

# Configuration
REMOTE_USER="admxn"
REMOTE_HOST="192.168.2.148"
SSH_KEY="C:\Users\TUF-s\.ssh\id_ed25519_new"
REMOTE_DIR="/home/admxn/kaspa-main-stack"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Deploying Kaspa Stack to Ubuntu Server                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Test SSH connection
echo -e "${GREEN}[1/6]${NC} Testing SSH connection..."
if ssh -i "$SSH_KEY" ${REMOTE_USER}@${REMOTE_HOST} "echo 'Connection successful'" &>/dev/null; then
    echo "✓ SSH connection successful"
else
    echo "✗ SSH connection failed"
    exit 1
fi

# Step 2: Create remote directory
echo -e "${GREEN}[2/6]${NC} Creating remote directory..."
ssh -i "$SSH_KEY" ${REMOTE_USER}@${REMOTE_HOST} "mkdir -p $REMOTE_DIR"
echo "✓ Remote directory ready: $REMOTE_DIR"

# Step 3: Transfer files
echo -e "${GREEN}[3/6]${NC} Transferring files to server..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

scp -i "$SSH_KEY" -r "$PROJECT_ROOT"/* ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/
echo "✓ Files transferred successfully"

# Step 4: Make scripts executable
echo -e "${GREEN}[4/6]${NC} Setting up permissions..."
ssh -i "$SSH_KEY" ${REMOTE_USER}@${REMOTE_HOST} << 'EOF'
cd ~/kaspa-main-stack
chmod +x scripts/*.sh
chmod -R 755 backend middleware frontend nginx monitoring
echo "✓ Permissions configured"
EOF

# Step 5: Install dependencies (if needed)
echo -e "${GREEN}[5/6]${NC} Checking Docker installation..."
ssh -i "$SSH_KEY" ${REMOTE_USER}@${REMOTE_HOST} << 'EOF'
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✓ Docker installed"
else
    echo "✓ Docker already installed"
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
    echo "✓ Docker Compose installed"
else
    echo "✓ Docker Compose already installed"
fi
EOF

# Step 6: Run installation
echo -e "${GREEN}[6/6]${NC} Running installation script..."
echo -e "${YELLOW}This will take 10-15 minutes...${NC}"
echo ""

ssh -i "$SSH_KEY" ${REMOTE_USER}@${REMOTE_HOST} << 'EOF'
cd ~/kaspa-main-stack
./scripts/install_and_test.sh
EOF

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║             DEPLOYMENT COMPLETED SUCCESSFULLY                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Access your Kaspa Stack at:"
echo "  - Frontend: http://192.168.2.148:3000"
echo "  - API: http://192.168.2.148:8080/api"
echo "  - Grafana: http://192.168.2.148:3001"
echo ""
echo "Next steps:"
echo "  1. Configure Nginx for klassik.99pace.space"
echo "  2. Set up SSL certificates"
echo "  3. Monitor logs: ssh -i \"$SSH_KEY\" ${REMOTE_USER}@${REMOTE_HOST} 'cd kaspa-main-stack && docker-compose logs -f'"
echo ""
