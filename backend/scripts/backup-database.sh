#!/bin/bash

###############################################################################
# KLASSIK DATABASE BACKUP SCRIPT
# 
# Automatisches PostgreSQL Backup mit:
# - Kompression (gzip)
# - Rotation (30 Tage alte Backups löschen)
# - Fehlerbehandlung
# - Logging
# - S3/Cloud-Upload (optional)
###############################################################################

# Konfiguration
DB_NAME="${DB_NAME:-klassikdb}"
DB_USER="${DB_USER:-klassik}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"

BACKUP_DIR="${BACKUP_DIR:-/opt/klassik/backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
LOG_FILE="${LOG_FILE:-/var/log/klassik-backup.log}"

# S3 Upload (optional)
S3_ENABLED="${S3_ENABLED:-false}"
S3_BUCKET="${S3_BUCKET:-}"
S3_PREFIX="${S3_PREFIX:-klassik-backups}"

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging-Funktion
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

###############################################################################
# MAIN BACKUP FUNCTION
###############################################################################

create_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${BACKUP_DIR}/${DB_NAME}_${timestamp}.sql"
    local backup_file_gz="${backup_file}.gz"
    
    log "==================================================================="
    log "Starting database backup: ${DB_NAME}"
    log "==================================================================="
    
    # 1. Backup-Verzeichnis erstellen
    if [ ! -d "$BACKUP_DIR" ]; then
        log "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
    
    # 2. PostgreSQL Dump erstellen
    log "Creating PostgreSQL dump..."
    
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -F p -b -v -f "$backup_file" "$DB_NAME" 2>> "$LOG_FILE"; then
        log "✅ Database dump created: $backup_file"
    else
        error "❌ Failed to create database dump"
        return 1
    fi
    
    # 3. Komprimieren
    log "Compressing backup..."
    
    if gzip "$backup_file"; then
        log "✅ Backup compressed: $backup_file_gz"
        
        # Größe anzeigen
        local size=$(du -h "$backup_file_gz" | cut -f1)
        log "   Backup size: $size"
    else
        error "❌ Failed to compress backup"
        return 1
    fi
    
    # 4. Checksumme erstellen
    log "Creating checksum..."
    sha256sum "$backup_file_gz" > "${backup_file_gz}.sha256"
    log "✅ Checksum created"
    
    # 5. S3 Upload (optional)
    if [ "$S3_ENABLED" = "true" ] && [ -n "$S3_BUCKET" ]; then
        upload_to_s3 "$backup_file_gz"
    fi
    
    # 6. Alte Backups löschen
    cleanup_old_backups
    
    log "✅ Backup completed successfully: $backup_file_gz"
    log "==================================================================="
    
    return 0
}

###############################################################################
# S3 UPLOAD (Optional)
###############################################################################

upload_to_s3() {
    local file=$1
    local s3_path="s3://${S3_BUCKET}/${S3_PREFIX}/$(basename $file)"
    
    log "Uploading to S3: $s3_path"
    
    if command -v aws &> /dev/null; then
        if aws s3 cp "$file" "$s3_path" 2>> "$LOG_FILE"; then
            log "✅ Uploaded to S3: $s3_path"
            
            # Checksumme auch hochladen
            aws s3 cp "${file}.sha256" "${s3_path}.sha256" 2>> "$LOG_FILE"
        else
            error "❌ Failed to upload to S3"
        fi
    else
        warn "AWS CLI not installed, skipping S3 upload"
    fi
}

###############################################################################
# CLEANUP OLD BACKUPS
###############################################################################

cleanup_old_backups() {
    log "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."
    
    local deleted_count=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime +${BACKUP_RETENTION_DAYS} -delete -print | wc -l)
    
    if [ "$deleted_count" -gt 0 ]; then
        log "✅ Deleted $deleted_count old backup(s)"
    else
        log "   No old backups to delete"
    fi
    
    # Checksummen auch löschen
    find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz.sha256" -type f -mtime +${BACKUP_RETENTION_DAYS} -delete 2>/dev/null
}

###############################################################################
# RESTORE FUNCTION
###############################################################################

restore_backup() {
    local backup_file=$1
    
    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
        echo "Usage: $0 restore <backup_file.sql.gz>"
        return 1
    fi
    
    log "==================================================================="
    log "RESTORE DATABASE FROM BACKUP"
    log "==================================================================="
    warn "⚠️  This will OVERWRITE the current database: $DB_NAME"
    
    # Sicherheitsabfrage
    read -p "Are you sure you want to restore? (yes/no): " -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        log "Restore cancelled by user"
        return 0
    fi
    
    # Checksumme verifizieren
    if [ -f "${backup_file}.sha256" ]; then
        log "Verifying checksum..."
        if sha256sum -c "${backup_file}.sha256" 2>> "$LOG_FILE"; then
            log "✅ Checksum verified"
        else
            error "❌ Checksum verification failed!"
            return 1
        fi
    fi
    
    # Backup dekomprimieren
    log "Decompressing backup..."
    local sql_file="${backup_file%.gz}"
    
    if gunzip -k "$backup_file"; then
        log "✅ Backup decompressed"
    else
        error "❌ Failed to decompress backup"
        return 1
    fi
    
    # Datenbank wiederherstellen
    log "Restoring database..."
    
    # Vorher alle Verbindungen trennen
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME' AND pid <> pg_backend_pid();" 2>> "$LOG_FILE"
    
    # Datenbank droppen und neu erstellen
    dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>> "$LOG_FILE"
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>> "$LOG_FILE"
    
    # SQL importieren
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$sql_file" 2>> "$LOG_FILE"; then
        log "✅ Database restored successfully"
        
        # Dekomprimierte Datei löschen
        rm -f "$sql_file"
    else
        error "❌ Failed to restore database"
        return 1
    fi
    
    log "==================================================================="
    log "✅ Restore completed"
    log "==================================================================="
    
    return 0
}

###############################################################################
# LIST BACKUPS
###############################################################################

list_backups() {
    log "Available backups in $BACKUP_DIR:"
    log "==================================================================="
    
    if [ ! -d "$BACKUP_DIR" ]; then
        warn "Backup directory does not exist: $BACKUP_DIR"
        return 1
    fi
    
    local backup_files=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f | sort -r)
    
    if [ -z "$backup_files" ]; then
        log "No backups found"
        return 0
    fi
    
    echo ""
    printf "%-30s %-12s %-20s\n" "FILENAME" "SIZE" "DATE"
    echo "-------------------------------------------------------------------"
    
    while IFS= read -r file; do
        local filename=$(basename "$file")
        local size=$(du -h "$file" | cut -f1)
        local date=$(stat -c %y "$file" | cut -d' ' -f1,2 | cut -d'.' -f1)
        
        printf "%-30s %-12s %-20s\n" "$filename" "$size" "$date"
    done <<< "$backup_files"
    
    echo ""
    log "Total backups: $(echo "$backup_files" | wc -l)"
}

###############################################################################
# MAIN SCRIPT
###############################################################################

# Argumente verarbeiten
case "${1:-backup}" in
    backup)
        create_backup
        exit $?
        ;;
    restore)
        restore_backup "$2"
        exit $?
        ;;
    list)
        list_backups
        exit 0
        ;;
    cleanup)
        cleanup_old_backups
        exit 0
        ;;
    *)
        echo "Usage: $0 {backup|restore <file>|list|cleanup}"
        echo ""
        echo "Commands:"
        echo "  backup          Create a new database backup (default)"
        echo "  restore <file>  Restore database from backup file"
        echo "  list            List all available backups"
        echo "  cleanup         Remove backups older than $BACKUP_RETENTION_DAYS days"
        echo ""
        echo "Environment Variables:"
        echo "  DB_NAME                Database name (default: klassikdb)"
        echo "  DB_USER                Database user (default: klassik)"
        echo "  DB_HOST                Database host (default: localhost)"
        echo "  BACKUP_DIR             Backup directory (default: /opt/klassik/backups)"
        echo "  BACKUP_RETENTION_DAYS  Days to keep backups (default: 30)"
        echo "  S3_ENABLED             Upload to S3 (default: false)"
        echo "  S3_BUCKET              S3 bucket name"
        exit 1
        ;;
esac
