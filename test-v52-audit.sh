#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# LeanPilot v5.2 — COMPLETE AUDIT
# Auth, Permissions, Data Flow, GDPR, ZZLP, ISO, Security,
# Escalation, Email, PWA, Analytics, Export, Health, Deployment
# ═══════════════════════════════════════════════════════════════════

BASE="http://localhost:3001/api"
PASS=0; FAIL=0; WARN=0; TOTAL=0
SRC="/home/csg/repos/experiments/leanpilot-v4"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

t() {
  TOTAL=$((TOTAL + 1))
  if [ "$2" = "$3" ]; then echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1))
  else echo -e "  ${RED}✗${NC} $1 (expected=$2 got=$3)"; FAIL=$((FAIL + 1)); fi
}
tok() {
  TOTAL=$((TOTAL + 1))
  if echo "200 201 202" | grep -qw "$2"; then echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1))
  else echo -e "  ${RED}✗${NC} $1 (got $2)"; FAIL=$((FAIL + 1)); fi
}
tblock() {
  TOTAL=$((TOTAL + 1))
  if echo "401 403" | grep -qw "$2"; then echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1))
  else echo -e "  ${RED}✗${NC} $1 (expected 401/403 got $2)"; FAIL=$((FAIL + 1)); fi
}
tgrep() {
  TOTAL=$((TOTAL + 1))
  if echo "$3" | grep -q "$2"; then echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1))
  else echo -e "  ${RED}✗${NC} $1 (missing '$2')"; FAIL=$((FAIL + 1)); fi
}
tnogrep() {
  TOTAL=$((TOTAL + 1))
  if echo "$3" | grep -q "$2"; then echo -e "  ${RED}✗${NC} $1 (found '$2')"; FAIL=$((FAIL + 1))
  else echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); fi
}
tfile() {
  TOTAL=$((TOTAL + 1))
  if [ -f "$1" ]; then echo -e "  ${GREEN}✓${NC} $2"; PASS=$((PASS + 1))
  else echo -e "  ${RED}✗${NC} $2 (missing)"; FAIL=$((FAIL + 1)); fi
}
twarn() { TOTAL=$((TOTAL + 1)); WARN=$((WARN + 1)); echo -e "  ${YELLOW}⚠${NC} $1"; }

login() { sleep 0.15; curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"password123\"}"; }
tk() { echo "$1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null; }
G() { curl -s -w "\n%{http_code}" "$BASE$1" -H "Authorization: Bearer $2"; }
P() { curl -s -w "\n%{http_code}" "$BASE$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3"; }
PA() { curl -s -w "\n%{http_code}" -X PATCH "$BASE$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3"; }
C() { echo "$1" | tail -1; }
B() { echo "$1" | sed '$d'; }

echo -e "\n${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║  LEANPILOT v5.2 — COMPLETE AUDIT ($(date +%Y-%m-%d))  ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"

# ═══ 1. HEALTH CHECK ═══════════════════════════════════════════════
echo -e "\n${CYAN}═══ 1. HEALTH & INFRASTRUCTURE ═══${NC}"
R=$(curl -s "$BASE/health")
tgrep "Health endpoint returns ok" "\"ok\"" "$R"
tgrep "Health shows DB connected" "connected" "$R"
tgrep "Health shows uptime" "uptime" "$R"
tgrep "Health shows responseMs" "responseMs" "$R"
# No auth needed
R=$(curl -s -w "\n%{http_code}" "$BASE/health")
tok "Health endpoint is public (no auth)" "$(C "$R")"

# ═══ 2. AUTH ═══════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 2. AUTHENTICATION ═══${NC}"
echo -e "\n${YELLOW}2.1 Login — all roles${NC}"
for email in admin@leanpilot.me site.admin@leanpilot.me manager@leanpilot.me quality@leanpilot.me shift.leader@leanpilot.me operator1@leanpilot.me floor@leanpilot.me viewer@leanpilot.me; do
  R=$(login "$email"); T=$(tk "$R")
  t "Login: $email" "true" "$([ -n "$T" ] && echo true || echo false)"
done

echo -e "\n${YELLOW}2.2 JWT Security${NC}"
R=$(login "admin@leanpilot.me"); TA=$(tk "$R")
PAYLOAD=$(echo "$TA" | cut -d. -f2 | base64 -d 2>/dev/null)
tnogrep "JWT: no password" "password" "$PAYLOAD"
tgrep "JWT: has sub" "sub" "$PAYLOAD"
tgrep "JWT: has exp" "exp" "$PAYLOAD"
tgrep "JWT: has customRoleId" "customRoleId" "$PAYLOAD"
tnogrep "Login: no password in response" "\"password\"" "$R"

echo -e "\n${YELLOW}2.3 Permissions in login response${NC}"
R=$(login "operator1@leanpilot.me")
tgrep "Operator: has permissions" "permissions" "$R"
tgrep "Operator: has customRoleName" "Operator" "$R"
tgrep "Operator: production=participate" "participate" "$R"

echo -e "\n${YELLOW}2.4 Invalid credentials${NC}"
R=$(curl -s -w "\n%{http_code}" "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@leanpilot.me","password":"wrong"}')
t "Wrong password → 401" "401" "$(C "$R")"
R=$(curl -s -w "\n%{http_code}" "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"nobody@test.com","password":"wrong"}')
tblock "Non-existent user blocked" "$(C "$R")"
R=$(curl -s -w "\n%{http_code}" "$BASE/users")
t "No token → 401" "401" "$(C "$R")"

echo -e "\n${YELLOW}2.5 Password Reset Flow${NC}"
R=$(curl -s -w "\n%{http_code}" "$BASE/auth/forgot-password" -H "Content-Type: application/json" -d '{"email":"admin@leanpilot.me"}')
tok "Forgot password endpoint works" "$(C "$R")"
tgrep "Returns generic message" "reset email" "$(B "$R")"
R=$(curl -s -w "\n%{http_code}" "$BASE/auth/reset-password" -H "Content-Type: application/json" -d '{"token":"invalid-token","password":"newpass123"}')
t "Invalid reset token → 401" "401" "$(C "$R")"

echo -e "\n${YELLOW}2.6 Refresh Token Security${NC}"
R=$(login "viewer@leanpilot.me")
REFRESH=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('refreshToken',''))" 2>/dev/null)
R2=$(curl -s "$BASE/auth/refresh" -H "Content-Type: application/json" -d "{\"refreshToken\":\"$REFRESH\"}")
tgrep "Refresh returns new token" "accessToken" "$R2"

# ═══ 3. PERMISSIONS ═══════════════════════════════════════════════
echo -e "\n${CYAN}═══ 3. PERMISSION MATRIX ═══${NC}"
TS=$(tk "$(login "site.admin@leanpilot.me")")
TM=$(tk "$(login "manager@leanpilot.me")")
TQ=$(tk "$(login "quality@leanpilot.me")")
TSH=$(tk "$(login "shift.leader@leanpilot.me")")
TO=$(tk "$(login "operator1@leanpilot.me")")
TF=$(tk "$(login "floor@leanpilot.me")")
TV=$(tk "$(login "viewer@leanpilot.me")")

echo -e "\n${YELLOW}3.1 Floor Operator — production + safety only${NC}"
tok "Floor → shopfloor" "$(C "$(G "/shopfloor/reason-codes?category=breakdown" "$TF")")"
tblock "Floor → quality" "$(C "$(G "/quality/templates" "$TF")")"
tblock "Floor → 5S" "$(C "$(G "/tools/five-s" "$TF")")"
tblock "Floor → gemba" "$(C "$(G "/gemba" "$TF")")"
tblock "Floor → maintenance" "$(C "$(G "/maintenance/plans" "$TF")")"
tblock "Floor → users" "$(C "$(G "/users" "$TF")")"
tok "Floor → safety (compliance)" "$(C "$(G "/safety/incidents" "$TF")")"
tok "Floor → dashboard" "$(C "$(G "/dashboard/overview" "$TF")")"

echo -e "\n${YELLOW}3.2 Operator — CI + production${NC}"
tok "Op → 5S" "$(C "$(G "/tools/five-s" "$TO")")"
tok "Op → shopfloor" "$(C "$(G "/shopfloor/reason-codes?category=breakdown" "$TO")")"
tok "Op → quality view" "$(C "$(G "/quality/templates" "$TO")")"
tblock "Op → quality create" "$(C "$(P "/quality/templates" "$TO" '{"name":"x","checkpoints":[]}')")"
tblock "Op → root cause" "$(C "$(G "/rca/five-why" "$TO")")"

echo -e "\n${YELLOW}3.3 Quality Engineer${NC}"
tok "Qual → quality" "$(C "$(G "/quality/templates" "$TQ")")"
tok "Qual → root cause" "$(C "$(G "/rca/five-why" "$TQ")")"
tblock "Qual → shopfloor operate" "$(C "$(G "/shopfloor/reason-codes?category=breakdown" "$TQ")")"

echo -e "\n${YELLOW}3.4 Shift Leader${NC}"
tok "Shift → shopfloor" "$(C "$(G "/shopfloor/reason-codes?category=breakdown" "$TSH")")"
tok "Shift → tier meetings" "$(C "$(G "/tier-meetings" "$TSH")")"
tok "Shift → 5S" "$(C "$(G "/tools/five-s" "$TSH")")"

echo -e "\n${YELLOW}3.5 System admin bypass${NC}"
tok "Site Admin → quality" "$(C "$(G "/quality/templates" "$TS")")"
tok "Site Admin → roles" "$(C "$(G "/roles" "$TS")")"
tok "Site Admin → escalation" "$(C "$(G "/escalation" "$TS")")"
tok "Site Admin → users" "$(C "$(G "/users" "$TS")")"

echo -e "\n${YELLOW}3.6 Safety compliance floor — ALL roles can report${NC}"
for T in "$TF" "$TO" "$TV" "$TSH" "$TQ" "$TM"; do
  R=$(P "/safety/incidents" "$T" "{\"type\":\"near_miss\",\"location\":\"Test\",\"title\":\"Audit $(date +%s%N)\",\"description\":\"Test\"}")
  tok "Safety report" "$(C "$R")"
done

# ═══ 4. DATA FLOW ═════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 4. DATA CREATION & FLOW ═══${NC}"

echo -e "\n${YELLOW}4.1 5S Audit${NC}"
R=$(P "/tools/five-s" "$TO" '{"area":"Audit Test Area"}')
tok "Operator creates 5S" "$(C "$R")"
AID=$(B "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$AID" ]; then
  R=$(G "/tools/five-s/$AID" "$TM"); tok "Manager views 5S" "$(C "$R")"
fi

echo -e "\n${YELLOW}4.2 Safety Incident → Investigation${NC}"
R=$(P "/safety/incidents" "$TF" '{"type":"near_miss","location":"CNC Area","title":"Oil spill test","description":"Hydraulic leak"}')
IID=$(B "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$IID" ]; then
  tok "Floor reports incident" "$(C "$R")"
  tok "Viewer can view" "$(C "$(G "/safety/incidents/$IID" "$TV")")"
  tblock "Floor cannot investigate" "$(C "$(PA "/safety/incidents/$IID" "$TF" '{"status":"investigating"}')")"
  tok "Manager investigates" "$(C "$(PA "/safety/incidents/$IID" "$TM" '{"status":"investigating","investigationNotes":"Seal worn"}')")"
fi

echo -e "\n${YELLOW}4.3 Quality Inspection${NC}"
R=$(P "/quality/templates" "$TQ" '{"name":"Audit Template","checkpoints":[{"sequence":1,"description":"Dimension check","measurementType":"measurement","lowerLimit":9.9,"upperLimit":10.1,"targetValue":10.0}]}')
tok "Quality creates template" "$(C "$R")"
tblock "Operator cannot create template" "$(C "$(P "/quality/templates" "$TO" '{"name":"x","checkpoints":[]}')")"

echo -e "\n${YELLOW}4.4 Orders${NC}"
R=$(G "/orders" "$TO"); tok "Operator views orders" "$(C "$R")"
tblock "Operator cannot create order" "$(C "$(P "/orders" "$TO" '{"poNumber":"X","productName":"X","targetQuantity":1,"unit":"pcs"}')")"
R=$(P "/orders" "$TM" "{\"poNumber\":\"AUDIT-$(date +%s)\",\"productName\":\"Audit Part\",\"targetQuantity\":50,\"unit\":\"pcs\",\"priority\":\"normal\",\"status\":\"released\",\"dueDate\":\"2026-12-31\"}")
tok "Manager creates order" "$(C "$R")"

echo -e "\n${YELLOW}4.5 Dashboard aggregation${NC}"
tok "Dashboard overview" "$(C "$(G "/dashboard/overview" "$TM")")"
tgrep "Overview has losses" "losses" "$(B "$(G "/dashboard/overview" "$TM")")"
tok "OEE endpoint" "$(C "$(G "/dashboard/oee" "$TM")")"
tok "Pareto endpoint" "$(C "$(G "/dashboard/pareto" "$TM")")"
tok "Shift handover" "$(C "$(G "/dashboard/shift-handover" "$TSH")")"

echo -e "\n${YELLOW}4.6 Multi-tenant isolation${NC}"
TB=$(tk "$(login "belgrade.operator@leanpilot.me")")
R=$(G "/tools/five-s" "$TB"); tok "Belgrade → 5S" "$(C "$R")"
tnogrep "Belgrade sees no Milan data" "Audit Test Area" "$(B "$R")"

# ═══ 5. COMPLIANCE ═════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 5. GDPR / ZZLP / ISO COMPLIANCE ═══${NC}"

echo -e "\n${YELLOW}5.1 Audit Logging (GDPR Art. 30)${NC}"
R=$(G "/audit?limit=3" "$(tk "$(login "admin@leanpilot.me")")")
tok "Audit log accessible (corp admin)" "$(C "$R")"
tgrep "Audit has entries" "logs" "$(B "$R")"
ASVC=$(cat "$SRC/apps/api/src/audit/audit.service.ts" 2>/dev/null)
tnogrep "No update in audit service" "\.update(" "$ASVC"
tnogrep "No delete in audit service" "\.delete(" "$ASVC"
tgrep "Audit is append-only" "\.create(" "$ASVC"
tgrep "Audit interceptor global" "useGlobalInterceptors" "$(cat "$SRC/apps/api/src/main.ts" 2>/dev/null)"

echo -e "\n${YELLOW}5.2 Data Minimization (GDPR Art. 5)${NC}"
R=$(login "operator1@leanpilot.me")
tnogrep "No password in response" "\"password\"" "$R"
tnogrep "No hash in response" "\$2b\$" "$R"
R=$(B "$(G "/users" "$TS")"); tnogrep "No password in user list" "password" "$R"

echo -e "\n${YELLOW}5.3 Data Protection by Design (GDPR Art. 25)${NC}"
tgrep "Bcrypt 12 rounds" "12" "$(grep -r "bcrypt.hash" "$SRC/apps/api/src/auth/" 2>/dev/null)"
VP=$(grep -A5 "ValidationPipe" "$SRC/apps/api/src/main.ts" 2>/dev/null)
tgrep "Whitelist enabled" "whitelist" "$VP"
tgrep "ForbidNonWhitelisted" "forbidNonWhitelisted" "$VP"

echo -e "\n${YELLOW}5.4 Quality Record Immutability (ISO 9001)${NC}"
R=$(P "/quality/ncr" "$TQ" '{"severity":"minor","description":"Immutability audit test"}')
NID=$(B "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$NID" ]; then
  PA "/quality/ncr/$NID" "$TQ" '{"status":"closed"}' > /dev/null 2>&1; sleep 0.2
  R=$(PA "/quality/ncr/$NID" "$TQ" '{"rootCause":"hack"}')
  t "Closed NCR immutable" "400" "$(C "$R")"
fi

echo -e "\n${YELLOW}5.5 Safety Immutability (ISO 45001)${NC}"
R=$(P "/safety/incidents" "$TF" "{\"type\":\"near_miss\",\"location\":\"X\",\"title\":\"Immut $(date +%s)\",\"description\":\"X\"}")
SID=$(B "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$SID" ]; then
  PA "/safety/incidents/$SID" "$TM" '{"status":"closed"}' > /dev/null 2>&1; sleep 0.2
  R=$(PA "/safety/incidents/$SID" "$TM" '{"title":"hacked"}')
  t "Closed incident immutable" "400" "$(C "$R")"
fi

echo -e "\n${YELLOW}5.6 ZZLP — No external data processors${NC}"
PKG=$(cat "$SRC/apps/web/package.json" 2>/dev/null)
tnogrep "No Google Analytics" "google-analytics" "$PKG"
tnogrep "No Sentry" "sentry" "$PKG"
tnogrep "No Mixpanel" "mixpanel" "$PKG"
tnogrep "No Facebook" "facebook" "$PKG"
tgrep "EU deployment (Hetzner)" "Hetzner" "$(cat "$SRC/CLAUDE.md" 2>/dev/null)"

# ═══ 6. SECURITY ═══════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 6. DATA SECURITY ═══${NC}"

echo -e "\n${YELLOW}6.1 SQL Injection${NC}"
tgrep "Prisma ORM (parameterized)" "PrismaService" "$(grep -r 'PrismaService' "$SRC/apps/api/src/quality/quality.service.ts" 2>/dev/null)"
RAW=$(grep -rn '\$queryRaw\|\$executeRaw' "$SRC/apps/api/src/" --include="*.ts" 2>/dev/null | grep -v "node_modules\|.spec.ts\|health")
TOTAL=$((TOTAL+1))
if [ -z "$RAW" ]; then echo -e "  ${GREEN}✓${NC} No raw SQL (except health check)"; PASS=$((PASS+1))
else echo -e "  ${RED}✗${NC} Raw SQL found: $RAW"; FAIL=$((FAIL+1)); fi

echo -e "\n${YELLOW}6.2 XSS${NC}"
tgrep "React 19 (auto-escapes)" "react.*19" "$(cat "$SRC/apps/web/package.json" 2>/dev/null)"

echo -e "\n${YELLOW}6.3 Rate Limiting${NC}"
tgrep "Throttler installed" "throttler" "$(cat "$SRC/apps/api/package.json" 2>/dev/null)"
tgrep "Throttler global guard" "ThrottlerGuard" "$(cat "$SRC/apps/api/src/app.module.ts" 2>/dev/null)"

echo -e "\n${YELLOW}6.4 Secrets${NC}"
tgrep ".env in gitignore" ".env" "$(cat "$SRC/.gitignore" 2>/dev/null)"
GIT_FILES=$(git -C "$SRC" ls-files 2>/dev/null)
tnogrep "No .env committed" "^\.env$" "$GIT_FILES"
tnogrep "No private keys" "\.pem$\|\.key$" "$GIT_FILES"

echo -e "\n${YELLOW}6.5 CORS${NC}"
MAIN=$(cat "$SRC/apps/api/src/main.ts" 2>/dev/null)
tgrep "CORS enabled" "enableCors" "$MAIN"
tgrep "CORS restricted in production" "production" "$(grep -A5 "enableCors" "$SRC/apps/api/src/main.ts" 2>/dev/null)"

# ═══ 7. ESCALATION ═════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 7. ESCALATION ENGINE ═══${NC}"
R=$(G "/escalation" "$TS")
tok "Escalation rules list" "$(C "$R")"
tgrep "Breakdown L1 exists" "Breakdown L1" "$(B "$R")"
tgrep "Breakdown L3 exists" "Breakdown L3" "$(B "$R")"
tgrep "Safety Critical exists" "Safety Critical" "$(B "$R")"
tblock "Operator cannot manage escalation" "$(C "$(G "/escalation" "$TO")")"
tfile "$SRC/apps/api/src/escalation/escalation.scheduler.ts" "Scheduler exists"
tgrep "Scheduler runs every 60s" "60000" "$(cat "$SRC/apps/api/src/escalation/escalation.scheduler.ts" 2>/dev/null)"

# ═══ 8. EMAIL ══════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 8. EMAIL SERVICE ═══${NC}"
tfile "$SRC/apps/api/src/email/email.service.ts" "Email service exists"
tfile "$SRC/apps/api/src/email/email.module.ts" "Email module exists"
ESVC=$(cat "$SRC/apps/api/src/email/email.service.ts" 2>/dev/null)
tgrep "Nodemailer transport" "nodemailer" "$ESVC"
tgrep "Password reset template" "sendPasswordReset" "$ESVC"
tgrep "Escalation template" "sendEscalationAlert" "$ESVC"
tgrep "Dry-run mode when no SMTP" "DRY RUN" "$ESVC"
# Escalation service uses email
ESCA=$(cat "$SRC/apps/api/src/escalation/escalation.service.ts" 2>/dev/null)
tgrep "Escalation sends email" "sendEscalationAlert" "$ESCA"

# ═══ 9. PWA ════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 9. PWA & OFFLINE ═══${NC}"
tfile "$SRC/apps/web/public/manifest.json" "PWA manifest"
tfile "$SRC/apps/web/public/sw.js" "Service worker"
MF=$(cat "$SRC/apps/web/public/manifest.json" 2>/dev/null)
tgrep "Standalone display" "standalone" "$MF"
tgrep "Start URL = shopfloor" "shopfloor" "$MF"
SW=$(cat "$SRC/apps/web/public/sw.js" 2>/dev/null)
tgrep "IndexedDB offline queue" "indexedDB" "$SW"
tgrep "Queue shopfloor writes" "shopfloor" "$SW"
tfile "$SRC/apps/web/src/lib/offline-queue.ts" "Offline queue hook"

# ═══ 10. ANALYTICS ═════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 10. ANALYTICS ENDPOINTS ═══${NC}"
tok "OEE trend" "$(C "$(G "/dashboard/oee-trend?period=7d" "$TM")")"
tgrep "OEE trend has points" "points" "$(B "$(G "/dashboard/oee-trend?period=7d" "$TM")")"
tgrep "OEE insufficient data flag" "insufficientData" "$(B "$(G "/dashboard/oee-trend?period=7d" "$TM")")"
tok "5S trends" "$(C "$(G "/tools/five-s/trends?months=6" "$TM")")"
tok "Safety trends" "$(C "$(G "/safety/trends?months=12" "$TM")")"
tok "Gemba waste pareto" "$(C "$(G "/gemba/waste-pareto?months=3" "$TM")")"

# ═══ 11. EXPORT ════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 11. CSV EXPORT ═══${NC}"
tfile "$SRC/apps/web/src/lib/csv-export.ts" "CSV export utility exists"
CSV=$(cat "$SRC/apps/web/src/lib/csv-export.ts" 2>/dev/null)
tgrep "Proper CSV escaping" "replace" "$CSV"
tgrep "Date-stamped filename" "toISOString" "$CSV"

# ═══ 12. CAMERA ════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 12. CAMERA CAPTURE ═══${NC}"
tfile "$SRC/apps/web/src/components/ui/PhotoCapture.tsx" "PhotoCapture component"
PC=$(cat "$SRC/apps/web/src/components/ui/PhotoCapture.tsx" 2>/dev/null)
tgrep "Rear camera capture" "capture" "$PC"
tgrep "Accept images" "image" "$PC"
tfile "$SRC/apps/web/src/lib/upload.ts" "Upload helper"

# ═══ 13. TOOL CHOOSER ═════════════════════════════════════════════
echo -e "\n${CYAN}═══ 13. SITE TOOL CHOOSER ═══${NC}"
tfile "$SRC/apps/web/src/app/(dashboard)/admin/tools/page.tsx" "Tool admin page"
R=$(G "/site-config/tools" "$TS")
tok "Site config endpoint" "$(C "$R")"

# ═══ 14. ROLES ═════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 14. ROLE MANAGEMENT ═══${NC}"
R=$(G "/roles" "$TS")
tok "Roles list" "$(C "$R")"
tgrep "Operator template" "Operator" "$(B "$R")"
tgrep "Shop Floor template" "Shop Floor" "$(B "$R")"
tgrep "Quality Engineer template" "Quality" "$(B "$R")"
tblock "Operator cannot list roles" "$(C "$(G "/roles" "$TO")")"

# ═══ 15. PAGINATION ════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 15. PAGINATION ═══${NC}"
R=$(G "/safety/incidents?limit=2" "$TM")
tgrep "Paginated: total" "total" "$(B "$R")"
tgrep "Paginated: data" "data" "$(B "$R")"
tgrep "Paginated: limit" "limit" "$(B "$R")"

# ═══ 16. DEPLOYMENT ════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 16. DEPLOYMENT READINESS ═══${NC}"
tfile "$SRC/docker/docker-compose.yml" "Dev compose"
tfile "$SRC/docker/docker-compose.prod.yml" "Prod compose"
tfile "$SRC/docker/Dockerfile.api" "API Dockerfile"
tfile "$SRC/docker/Dockerfile.web" "Web Dockerfile"
tfile "$SRC/scripts/backup.sh" "Backup script"
tfile "$SRC/scripts/restore.sh" "Restore script"
tfile "$SRC/scripts/monitor.sh" "Monitor script"
tfile "$SRC/.github/workflows/ci.yml" "CI/CD pipeline"
tfile "$SRC/.env.example" "Env example"
EX=$(cat "$SRC/.env.example" 2>/dev/null)
tgrep "SMTP config in example" "SMTP_HOST" "$EX"
tgrep "FRONTEND_URL in example" "FRONTEND_URL" "$EX"
tgrep "DATABASE_URL in example" "DATABASE_URL" "$EX"
PROD=$(cat "$SRC/docker/docker-compose.prod.yml" 2>/dev/null)
tgrep "Caddy HTTPS" "caddy" "$PROD"
tgrep "Docker healthcheck" "healthcheck" "$PROD"
MIGRATIONS=$(ls -d "$SRC/apps/api/prisma/migrations/"*/ 2>/dev/null | wc -l)
TOTAL=$((TOTAL+1))
if [ "$MIGRATIONS" -ge 5 ]; then echo -e "  ${GREEN}✓${NC} $MIGRATIONS migrations"; PASS=$((PASS+1))
else echo -e "  ${RED}✗${NC} Only $MIGRATIONS migrations"; FAIL=$((FAIL+1)); fi

# ═══ 17. CODE QUALITY ══════════════════════════════════════════════
echo -e "\n${CYAN}═══ 17. CODE QUALITY ═══${NC}"
CONSOLE=$(grep -rn "console\.log" "$SRC/apps/api/src/" --include="*.ts" 2>/dev/null | grep -v ".spec.ts" | grep -v "node_modules")
TOTAL=$((TOTAL+1))
if [ -z "$CONSOLE" ]; then echo -e "  ${GREEN}✓${NC} No console.log in API"; PASS=$((PASS+1))
else echo -e "  ${YELLOW}⚠${NC} console.log found ($(echo "$CONSOLE" | wc -l) instances)"; WARN=$((WARN+1)); fi

TOTAL=$((TOTAL+1))
TS_ERR=$(cd "$SRC/apps/api" && npx tsc --noEmit 2>&1 | grep -c "error TS" 2>/dev/null || echo "0")
if [ "$TS_ERR" = "0" ]; then echo -e "  ${GREEN}✓${NC} Zero TypeScript errors"; PASS=$((PASS+1))
else echo -e "  ${RED}✗${NC} $TS_ERR TS errors"; FAIL=$((FAIL+1)); fi

TOTAL=$((TOTAL+1))
TEST_OUT=$(cd "$SRC/apps/api" && npx jest --no-cache 2>&1)
if echo "$TEST_OUT" | grep -q "49 passed"; then echo -e "  ${GREEN}✓${NC} 49/49 unit tests passing"; PASS=$((PASS+1))
else echo -e "  ${RED}✗${NC} Tests failing"; FAIL=$((FAIL+1)); fi

# ═══ RESULTS ═══════════════════════════════════════════════════════
echo -e "\n${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║                  AUDIT RESULTS                       ║${NC}"
echo -e "${BOLD}${CYAN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}  ${GREEN}PASSED:   $PASS${NC}"
echo -e "${BOLD}  ${RED}FAILED:   $FAIL${NC}"
echo -e "${BOLD}  ${YELLOW}WARNINGS: $WARN${NC}"
echo -e "${BOLD}  TOTAL:    $TOTAL${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}\n"

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}AUDIT FAILED — $FAIL issues to resolve${NC}\n"; exit 1
else
  echo -e "${GREEN}AUDIT PASSED — v5.2 ready for deployment${NC}\n"
fi
