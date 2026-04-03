#!/bin/bash
# LeanPilot Database Backup
# Run via cron: 0 2 * * * /opt/leanpilot/scripts/backup.sh

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/leanpilot/backups}"
DB_URL="${DATABASE_URL}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/leanpilot_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# Dump and compress
pg_dump "$DB_URL" | gzip > "$BACKUP_FILE"

# Verify backup is not empty
if [ ! -s "$BACKUP_FILE" ]; then
  echo "[$(date)] ERROR: Backup file is empty!"
  rm -f "$BACKUP_FILE"
  exit 1
fi

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup complete: $BACKUP_FILE ($SIZE)"

# Clean old backups
find "$BACKUP_DIR" -name "leanpilot_*.sql.gz" -mtime +$RETENTION_DAYS -delete
REMAINING=$(ls -1 "$BACKUP_DIR"/leanpilot_*.sql.gz 2>/dev/null | wc -l)
echo "[$(date)] Retained $REMAINING backups (${RETENTION_DAYS}-day retention)"
