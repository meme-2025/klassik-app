# ============================================
# KLASSIK DATABASE BACKUP SCRIPT (Windows)
# PowerShell Version
# ============================================

param(
    [Parameter(Position=0)]
    [ValidateSet("backup", "restore", "list", "cleanup")]
    [string]$Action = "backup",
    
    [Parameter(Position=1)]
    [string]$RestoreFile = "",
    
    [string]$DbName = $env:DB_NAME ?? "klassikdb",
    [string]$DbUser = $env:DB_USER ?? "postgres",
    [string]$DbHost = $env:DB_HOST ?? "localhost",
    [int]$DbPort = [int]($env:DB_PORT ?? 5432),
    [string]$BackupDir = $env:BACKUP_DIR ?? "C:\klassik-backups",
    [int]$RetentionDays = [int]($env:BACKUP_RETENTION_DAYS ?? 30)
)

# Farben
$ESC = [char]27
$GREEN = "$ESC[32m"
$RED = "$ESC[31m"
$YELLOW = "$ESC[33m"
$NC = "$ESC[0m"

function Write-Log {
    param([string]$Message, [string]$Color = $GREEN)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "${Color}[$timestamp]${NC} $Message"
}

function Write-Error-Log {
    param([string]$Message)
    Write-Log "ERROR: $Message" $RED
}

function Create-Backup {
    Write-Log "===================================================================" $GREEN
    Write-Log "Starting database backup: $DbName" $GREEN
    Write-Log "===================================================================" $GREEN
    
    # Backup-Verzeichnis erstellen
    if (-not (Test-Path $BackupDir)) {
        Write-Log "Creating backup directory: $BackupDir"
        New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
    }
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFile = Join-Path $BackupDir "${DbName}_${timestamp}.sql"
    $backupFileGz = "${backupFile}.gz"
    
    # PostgreSQL Dump
    Write-Log "Creating PostgreSQL dump..."
    
    $env:PGPASSWORD = $env:DB_PASSWORD
    
    try {
        & pg_dump -h $DbHost -p $DbPort -U $DbUser -F p -b -v -f $backupFile $DbName 2>&1 | Out-File -Append "C:\klassik-backup.log"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Log "✅ Database dump created: $backupFile" $GREEN
        } else {
            throw "pg_dump failed with exit code $LASTEXITCODE"
        }
        
        # Komprimieren mit 7-Zip (wenn verfügbar) oder .NET
        Write-Log "Compressing backup..."
        
        if (Get-Command 7z -ErrorAction SilentlyContinue) {
            & 7z a -tgzip $backupFileGz $backupFile
            Remove-Item $backupFile
        } else {
            # Native PowerShell Komprimierung
            Compress-Archive -Path $backupFile -DestinationPath "${backupFile}.zip" -CompressionLevel Optimal
            Remove-Item $backupFile
            $backupFileGz = "${backupFile}.zip"
        }
        
        $size = (Get-Item $backupFileGz).Length / 1MB
        Write-Log "✅ Backup compressed: $backupFileGz (${size:N2} MB)" $GREEN
        
        # Checksumme
        $hash = Get-FileHash -Path $backupFileGz -Algorithm SHA256
        $hash.Hash | Out-File "${backupFileGz}.sha256"
        Write-Log "✅ Checksum created" $GREEN
        
        # Alte Backups löschen
        Cleanup-OldBackups
        
        Write-Log "✅ Backup completed successfully" $GREEN
        Write-Log "===================================================================" $GREEN
        
    } catch {
        Write-Error-Log "Failed to create backup: $_"
        return 1
    } finally {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
    
    return 0
}

function Cleanup-OldBackups {
    Write-Log "Cleaning up backups older than $RetentionDays days..."
    
    $cutoffDate = (Get-Date).AddDays(-$RetentionDays)
    $oldBackups = Get-ChildItem -Path $BackupDir -Filter "${DbName}_*.sql*" | 
                  Where-Object { $_.LastWriteTime -lt $cutoffDate }
    
    if ($oldBackups.Count -gt 0) {
        $oldBackups | Remove-Item -Force
        Write-Log "✅ Deleted $($oldBackups.Count) old backup(s)" $GREEN
    } else {
        Write-Log "   No old backups to delete"
    }
}

function List-Backups {
    Write-Log "Available backups in ${BackupDir}:" $GREEN
    Write-Log "===================================================================" $GREEN
    
    if (-not (Test-Path $BackupDir)) {
        Write-Log "Backup directory does not exist: $BackupDir" $YELLOW
        return
    }
    
    $backups = Get-ChildItem -Path $BackupDir -Filter "${DbName}_*.sql*" | 
               Where-Object { $_.Extension -in ".gz", ".zip" } |
               Sort-Object LastWriteTime -Descending
    
    if ($backups.Count -eq 0) {
        Write-Log "No backups found"
        return
    }
    
    Write-Host ""
    Write-Host ("{0,-40} {1,-12} {2,-20}" -f "FILENAME", "SIZE", "DATE")
    Write-Host ("=" * 75)
    
    foreach ($backup in $backups) {
        $size = "{0:N2} MB" -f ($backup.Length / 1MB)
        $date = $backup.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
        
        Write-Host ("{0,-40} {1,-12} {2,-20}" -f $backup.Name, $size, $date)
    }
    
    Write-Host ""
    Write-Log "Total backups: $($backups.Count)"
}

function Restore-Backup {
    param([string]$BackupFilePath)
    
    if (-not (Test-Path $BackupFilePath)) {
        Write-Error-Log "Backup file not found: $BackupFilePath"
        return 1
    }
    
    Write-Log "===================================================================" $YELLOW
    Write-Log "RESTORE DATABASE FROM BACKUP" $YELLOW
    Write-Log "===================================================================" $YELLOW
    Write-Log "⚠️  This will OVERWRITE the current database: $DbName" $YELLOW
    
    $confirmation = Read-Host "Are you sure you want to restore? (yes/no)"
    if ($confirmation -ne "yes") {
        Write-Log "Restore cancelled by user"
        return 0
    }
    
    # Checksumme verifizieren
    if (Test-Path "${BackupFilePath}.sha256") {
        Write-Log "Verifying checksum..."
        $storedHash = Get-Content "${BackupFilePath}.sha256"
        $currentHash = (Get-FileHash -Path $BackupFilePath -Algorithm SHA256).Hash
        
        if ($storedHash -eq $currentHash) {
            Write-Log "✅ Checksum verified" $GREEN
        } else {
            Write-Error-Log "Checksum verification failed!"
            return 1
        }
    }
    
    Write-Log "Decompressing backup..."
    
    $tempSql = [System.IO.Path]::GetTempFileName() + ".sql"
    
    if ($BackupFilePath -like "*.gz") {
        # Dekomprimieren mit 7-Zip
        & 7z x -so $BackupFilePath > $tempSql
    } elseif ($BackupFilePath -like "*.zip") {
        Expand-Archive -Path $BackupFilePath -DestinationPath ([System.IO.Path]::GetTempPath())
        $tempSql = Join-Path ([System.IO.Path]::GetTempPath()) (Split-Path $BackupFilePath -LeafBase)
    }
    
    Write-Log "Restoring database..."
    
    $env:PGPASSWORD = $env:DB_PASSWORD
    
    try {
        # Verbindungen trennen
        & psql -h $DbHost -p $DbPort -U $DbUser -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DbName' AND pid <> pg_backend_pid();"
        
        # Datenbank neu erstellen
        & dropdb -h $DbHost -p $DbPort -U $DbUser $DbName 2>&1 | Out-Null
        & createdb -h $DbHost -p $DbPort -U $DbUser $DbName
        
        # SQL importieren
        & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -f $tempSql
        
        Write-Log "✅ Database restored successfully" $GREEN
        
    } catch {
        Write-Error-Log "Failed to restore database: $_"
        return 1
    } finally {
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
        Remove-Item $tempSql -ErrorAction SilentlyContinue
    }
    
    return 0
}

# Main
switch ($Action) {
    "backup"  { exit (Create-Backup) }
    "restore" { exit (Restore-Backup $RestoreFile) }
    "list"    { List-Backups; exit 0 }
    "cleanup" { Cleanup-OldBackups; exit 0 }
}
