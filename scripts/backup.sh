#!/bin/bash

################################################################################
# Backup Script for Kaspa Stack
# Backs up database, configuration, and logs
################################################################################

set -euo pipefail

BACKUP_DIR="/var/backups/kaspa"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="kaspa_backup_${TIMESTAMP}"

echo "Creating backup: $BACKUP_NAME"

# Create backup directory
mkdir -p "$BACKUP_DIR/$BACKUP_NAME"

# Backup database
echo "Backing up PostgreSQL database..."
docker-compose exec -T postgres pg_dump -U kaspa_admin kaspa_mainnet | gzip > "$BACKUP_DIR/$BACKUP_NAME/database.sql.gz"

# Backup Redis data
echo "Backing up Redis..."
docker-compose exec -T redis redis-cli SAVE
docker cp kaspa-redis:/data/dump.rdb "$BACKUP_DIR/$BACKUP_NAME/redis-dump.rdb"

# Backup configuration
echo "Backing up configuration files..."
cp .env "$BACKUP_DIR/$BACKUP_NAME/"
cp -r nginx "$BACKUP_DIR/$BACKUP_NAME/"
cp -r monitoring/grafana/provisioning "$BACKUP_DIR/$BACKUP_NAME/grafana-config"

# Create archive
echo "Creating archive..."
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"

echo "✓ Backup completed: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"

# Keep only last 7 backups
ls -t kaspa_backup_*.tar.gz | tail -n +8 | xargs rm -f 2>/dev/null || true
echo "✓ Old backups cleaned up"
