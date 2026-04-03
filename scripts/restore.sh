#!/bin/bash
# LeanPilot Database Restore
# Usage: ./restore.sh /path/to/backup.sql.gz

set -euo pipefail

if [ $# -eq 0 ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lh /opt/leanpilot/backups/leanpilot_*.sql.gz 2>/dev/null || echo "  No backups found"
  exit 1
fi

BACKUP_FILE="$1"
DB_URL="${DATABASE_URL}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: File not found: $BACKUP_FILE"
  exit 1
fi

echo "WARNING: This will REPLACE the current database with backup:"
echo "  File: $BACKUP_FILE"
echo "  Size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""
read -p "Type 'RESTORE' to confirm: " CONFIRM

if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Aborted."
  exit 0
fi

echo "[$(date)] Restoring from $BACKUP_FILE..."

# Drop and recreate
DB_NAME=$(echo "$DB_URL" | grep -oP '\/([^?]+)' | tail -1 | tr -d '/')
psql "$DB_URL" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true

gunzip -c "$BACKUP_FILE" | psql "$DB_URL"

echo "[$(date)] Restore complete!"
