#!/bin/bash
# Update deployment script for running deployments
# File: backend/deploy/deploy-update.sh

set -e

APP_NAME="klassik"
APP_USER="klassik"
APP_DIR="/opt/klassik"
CONFIG_DIR="/etc/klassik"
REPO_URL=${REPO_URL:-"https://github.com/YOUR_USERNAME/Klassik.git"}
BRANCH=${BRANCH:-"main"}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

# Create backup
CURRENT_RELEASE=$(readlink $APP_DIR/current)
BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"

log "Creating backup: $BACKUP_NAME"
sudo -u $APP_USER cp -r $CURRENT_RELEASE $APP_DIR/releases/$BACKUP_NAME

# Create new release
NEW_RELEASE=$(date +%Y%m%d_%H%M%S)
RELEASE_DIR="$APP_DIR/releases/$NEW_RELEASE"

log "Creating new release: $NEW_RELEASE"
sudo -u $APP_USER git clone $REPO_URL $RELEASE_DIR
cd $RELEASE_DIR
sudo -u $APP_USER git checkout $BRANCH

# Install dependencies
log "Installing dependencies..."
cd $RELEASE_DIR/backend
sudo -u $APP_USER npm ci --production --no-audit

# Run migrations
log "Running database migrations..."
sudo -u $APP_USER env $(cat $CONFIG_DIR/klassik.env | xargs) npm run migrate:up

# Update symlink
log "Updating symlink..."
sudo -u $APP_USER ln -sfn $RELEASE_DIR $APP_DIR/current
sudo -u $APP_USER ln -sfn /var/log/klassik $APP_DIR/current/backend/logs

# Restart service
log "Restarting service..."
sudo systemctl restart $APP_NAME

# Wait for service
sleep 10

# Health check
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    success "Deployment successful! Service is healthy."
    
    # Clean old releases (keep last 5)
    find $APP_DIR/releases -maxdepth 1 -type d | sort | head -n -5 | xargs rm -rf
    success "Cleaned old releases"
else
    warning "Health check failed. Rolling back..."
    sudo -u $APP_USER ln -sfn $APP_DIR/releases/$BACKUP_NAME $APP_DIR/current
    sudo systemctl restart $APP_NAME
    exit 1
fi

success "Update deployment completed!"