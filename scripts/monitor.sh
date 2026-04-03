#!/bin/bash
# LeanPilot Health Monitor
# Run via cron: */5 * * * * /opt/leanpilot/scripts/monitor.sh

HEALTH_URL="${HEALTH_URL:-http://localhost:3001/api/health}"
ALERT_EMAIL="${ALERT_EMAIL:-admin@leanpilot.me}"
STATE_FILE="/tmp/leanpilot-health-state"

RESPONSE=$(curl -s -w "\n%{http_code}" --max-time 10 "$HEALTH_URL" 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

PREV_STATE=$(cat "$STATE_FILE" 2>/dev/null || echo "unknown")

if [ "$HTTP_CODE" = "200" ]; then
  CURRENT_STATE="ok"
  if [ "$PREV_STATE" != "ok" ]; then
    echo "[$(date)] LeanPilot RECOVERED — $BODY"
    # Optionally send recovery email
  fi
else
  CURRENT_STATE="down"
  if [ "$PREV_STATE" != "down" ]; then
    echo "[$(date)] LeanPilot DOWN — HTTP $HTTP_CODE"
    # Send alert email via mail command if configured
    echo "LeanPilot is DOWN. HTTP $HTTP_CODE at $(date). Response: $BODY" | mail -s "ALERT: LeanPilot DOWN" "$ALERT_EMAIL" 2>/dev/null || true
  fi
fi

echo "$CURRENT_STATE" > "$STATE_FILE"
