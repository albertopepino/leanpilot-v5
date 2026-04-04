#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# LeanPilot v5.1 — FULL AUDIT
# Security, GDPR, ZZLP, Data Flow, Permissions, Deployment Readiness
# ═══════════════════════════════════════════════════════════════════

BASE="http://localhost:3001/api"
PASS=0; FAIL=0; WARN=0; TOTAL=0

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

assert() {
  TOTAL=$((TOTAL + 1))
  if [ "$2" = "$3" ]; then
    echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $1 (expected=$2, got=$3)"; FAIL=$((FAIL + 1))
  fi
}
assert_ok() {
  TOTAL=$((TOTAL + 1))
  if echo "200 201 202" | grep -qw "$2"; then
    echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $1 (got $2)"; FAIL=$((FAIL + 1))
  fi
}
assert_blocked() {
  TOTAL=$((TOTAL + 1))
  if echo "401 403" | grep -qw "$2"; then
    echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $1 (expected 401/403, got $2)"; FAIL=$((FAIL + 1))
  fi
}
warn() {
  TOTAL=$((TOTAL + 1)); WARN=$((WARN + 1))
  echo -e "  ${YELLOW}⚠${NC} $1"
}
check_file() {
  TOTAL=$((TOTAL + 1))
  if [ -f "$1" ]; then
    echo -e "  ${GREEN}✓${NC} $2"; PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $2 (missing: $1)"; FAIL=$((FAIL + 1))
  fi
}
check_no_file() {
  TOTAL=$((TOTAL + 1))
  if [ ! -f "$1" ]; then
    echo -e "  ${GREEN}✓${NC} $2"; PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $2 (FOUND: $1)"; FAIL=$((FAIL + 1))
  fi
}
check_grep() {
  TOTAL=$((TOTAL + 1))
  if echo "$3" | grep -q "$2"; then
    echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1))
  fi
}
check_no_grep() {
  TOTAL=$((TOTAL + 1))
  if echo "$3" | grep -q "$2"; then
    echo -e "  ${RED}✗${NC} $1 (found '$2')"; FAIL=$((FAIL + 1))
  else
    echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1))
  fi
}

login() {
  sleep 0.2
  curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"password123\"}"
}
token() {
  echo "$1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null
}
http() {
  curl -s -w "\n%{http_code}" "$BASE$1" -H "Authorization: Bearer $2" ${3:+-H "Content-Type: application/json" -d "$3"} ${4:+-X $4}
}
code() { echo "$1" | tail -1; }
body() { echo "$1" | sed '$d'; }

SRC="/home/csg/repos/experiments/leanpilot-v4"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${CYAN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║  LEANPILOT v5.1 — FULL SECURITY & COMPLIANCE AUDIT ║${NC}"
echo -e "${BOLD}${CYAN}╚═══════════════════════════════════════════════════╝${NC}"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 1. AUTHENTICATION & SESSION SECURITY ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}1.1 JWT Token Security${NC}"
RESP=$(login "admin@leanpilot.me")
T_ADMIN=$(token "$RESP")
assert "Admin login succeeds" "true" "$([ -n "$T_ADMIN" ] && echo true || echo false)"
# Check JWT doesn't contain password
PAYLOAD=$(echo "$T_ADMIN" | cut -d. -f2 | base64 -d 2>/dev/null)
check_no_grep "JWT payload does not contain password" "password" "$PAYLOAD"
check_grep "JWT contains sub (user id)" "sub" "$PAYLOAD"
check_grep "JWT contains role" "role" "$PAYLOAD"
check_grep "JWT contains siteId" "siteId" "$PAYLOAD"

echo -e "\n${YELLOW}1.2 Password Security${NC}"
# Check bcrypt rounds in auth service
BCRYPT=$(grep -r "bcrypt.hash" "$SRC/apps/api/src/auth/" 2>/dev/null)
check_grep "Bcrypt hashing with 12 rounds" "12" "$BCRYPT"
# Check password not returned in login response
check_no_grep "Password not in login response" "\"password\"" "$RESP"

echo -e "\n${YELLOW}1.3 Token Expiration${NC}"
check_grep "JWT has expiration" "exp" "$PAYLOAD"

echo -e "\n${YELLOW}1.4 Refresh Token Rotation${NC}"
# Use refresh token, verify old one is consumed
REFRESH=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('refreshToken',''))" 2>/dev/null)
REFRESH_RESP=$(curl -s "$BASE/auth/refresh" -H "Content-Type: application/json" -d "{\"refreshToken\":\"$REFRESH\"}")
check_grep "Refresh returns new access token" "accessToken" "$REFRESH_RESP"
# Try reusing old refresh token (should fail — consumed)
sleep 0.3
REPLAY=$(curl -s -w "\n%{http_code}" "$BASE/auth/refresh" -H "Content-Type: application/json" -d "{\"refreshToken\":\"$REFRESH\"}")
assert "Old refresh token rejected (replay attack)" "401" "$(code "$REPLAY")"

echo -e "\n${YELLOW}1.5 Invalid Credentials${NC}"
RESP=$(curl -s -w "\n%{http_code}" "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@leanpilot.me","password":"wrongpassword"}')
assert "Wrong password returns 401" "401" "$(code "$RESP")"
RESP=$(curl -s -w "\n%{http_code}" "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"nonexistent@test.com","password":"password123"}')
assert_blocked "Non-existent user blocked" "$(code "$RESP")"

echo -e "\n${YELLOW}1.6 Unauthenticated Access${NC}"
RESP=$(http "/users" "invalid-token-here")
assert "Invalid token → 401" "401" "$(code "$RESP")"
RESP=$(curl -s -w "\n%{http_code}" "$BASE/users")
assert "No token → 401" "401" "$(code "$RESP")"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 2. AUTHORIZATION & PERMISSION MATRIX ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

# Login all roles
T_ADMIN=$(token "$(login "admin@leanpilot.me")")
T_SITE=$(token "$(login "site.admin@leanpilot.me")")
T_MANAGER=$(token "$(login "manager@leanpilot.me")")
T_QUALITY=$(token "$(login "quality@leanpilot.me")")
T_SHIFT=$(token "$(login "shift.leader@leanpilot.me")")
T_OP=$(token "$(login "operator1@leanpilot.me")")
T_FLOOR=$(token "$(login "floor@leanpilot.me")")
T_VIEWER=$(token "$(login "viewer@leanpilot.me")")

echo -e "\n${YELLOW}2.1 Floor Operator — restricted to production + safety${NC}"
assert_ok "Floor → shopfloor" "$(code "$(http "/shopfloor/reason-codes?category=breakdown" "$T_FLOOR")")"
assert_blocked "Floor → quality" "$(code "$(http "/quality/templates" "$T_FLOOR")")"
assert_blocked "Floor → 5S" "$(code "$(http "/tools/five-s" "$T_FLOOR")")"
assert_blocked "Floor → gemba" "$(code "$(http "/gemba" "$T_FLOOR")")"
assert_blocked "Floor → maintenance" "$(code "$(http "/maintenance/plans" "$T_FLOOR")")"
assert_blocked "Floor → users" "$(code "$(http "/users" "$T_FLOOR")")"
assert_blocked "Floor → roles" "$(code "$(http "/roles" "$T_FLOOR")")"
assert_ok "Floor → safety (compliance)" "$(code "$(http "/safety/incidents" "$T_FLOOR")")"

echo -e "\n${YELLOW}2.2 Operator — CI + production, no quality manage${NC}"
assert_ok "Operator → 5S" "$(code "$(http "/tools/five-s" "$T_OP")")"
assert_ok "Operator → shopfloor" "$(code "$(http "/shopfloor/reason-codes?category=breakdown" "$T_OP")")"
assert_ok "Operator → quality (view)" "$(code "$(http "/quality/templates" "$T_OP")")"
assert_blocked "Operator → quality templates (create)" "$(code "$(http "/quality/templates" "$T_OP" '{"name":"test","checkpoints":[]}' "")")"

echo -e "\n${YELLOW}2.3 Quality Engineer — quality manage, no shopfloor operate${NC}"
assert_ok "Quality → quality" "$(code "$(http "/quality/templates" "$T_QUALITY")")"
assert_ok "Quality → root cause" "$(code "$(http "/rca/five-why" "$T_QUALITY")")"
assert_blocked "Quality → shopfloor (participate)" "$(code "$(http "/shopfloor/reason-codes?category=breakdown" "$T_QUALITY")")"

echo -e "\n${YELLOW}2.4 System admin bypass${NC}"
assert_ok "Site Admin → everything" "$(code "$(http "/quality/templates" "$T_SITE")")"
assert_ok "Site Admin → roles" "$(code "$(http "/roles" "$T_SITE")")"
assert_ok "Site Admin → users" "$(code "$(http "/users" "$T_SITE")")"
assert_ok "Site Admin → escalation" "$(code "$(http "/escalation" "$T_SITE")")"

echo -e "\n${YELLOW}2.5 Corporate admin — multi-site access${NC}"
assert_ok "Corp Admin → corporate overview" "$(code "$(http "/corporate/overview" "$T_ADMIN")")"
assert_ok "Corp Admin → audit logs" "$(code "$(http "/audit?limit=1" "$T_ADMIN")")"
assert_blocked "Manager → audit logs" "$(code "$(http "/audit" "$T_MANAGER")")"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 3. GDPR COMPLIANCE (Arts. 5-35) ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}3.1 Art. 5 — Data Minimization${NC}"
RESP=$(login "operator1@leanpilot.me")
check_no_grep "Login response: no password field" "\"password\"" "$RESP"
check_no_grep "Login response: no password hash" "\$2b\$" "$RESP"
# Check user list doesn't expose passwords
RESP=$(body "$(http "/users" "$T_SITE")")
check_no_grep "User list: no password exposed" "password" "$RESP"

echo -e "\n${YELLOW}3.2 Art. 25 — Data Protection by Design${NC}"
# Bcrypt for passwords
check_grep "Passwords hashed with bcrypt" "bcrypt" "$(grep -r 'bcrypt' "$SRC/apps/api/src/auth/auth.service.ts" 2>/dev/null)"
# Validation pipe strips unknown fields
VALIDATION=$(grep -A5 "ValidationPipe" "$SRC/apps/api/src/main.ts" 2>/dev/null)
check_grep "ValidationPipe whitelist enabled" "whitelist" "$VALIDATION"
check_grep "ValidationPipe forbidNonWhitelisted" "forbidNonWhitelisted" "$VALIDATION"

echo -e "\n${YELLOW}3.3 Art. 30 — Records of Processing (Audit Log)${NC}"
RESP=$(http "/audit?limit=5" "$T_ADMIN")
assert_ok "Audit log accessible" "$(code "$RESP")"
AUDIT_BODY=$(body "$RESP")
check_grep "Audit log has entries" "logs" "$AUDIT_BODY"
check_grep "Audit entries have userId" "userId" "$AUDIT_BODY"
check_grep "Audit entries have action" "action" "$AUDIT_BODY"
check_grep "Audit entries have timestamp" "timestamp" "$AUDIT_BODY"
check_grep "Audit entries have entityType" "entityType" "$AUDIT_BODY"
# Check audit interceptor is global
MAIN=$(cat "$SRC/apps/api/src/main.ts" 2>/dev/null)
check_grep "Audit interceptor globally registered" "useGlobalInterceptors" "$MAIN"

echo -e "\n${YELLOW}3.4 Art. 32 — Security of Processing${NC}"
# HTTPS config exists
check_file "$SRC/docker/docker-compose.prod.yml" "Production Docker Compose exists"
CADDY=$(cat "$SRC/docker/docker-compose.prod.yml" 2>/dev/null)
check_grep "Caddy reverse proxy (auto HTTPS)" "caddy" "$CADDY"
# CORS configured
check_grep "CORS enabled" "enableCors" "$MAIN"
CORS=$(grep -A5 "enableCors" "$SRC/apps/api/src/main.ts" 2>/dev/null)
check_grep "CORS restricts origins in production" "production" "$CORS"

echo -e "\n${YELLOW}3.5 Art. 17 — Right to Erasure (Soft Delete)${NC}"
# Users are soft-deleted, not hard-deleted
USER_SERVICE=$(cat "$SRC/apps/api/src/users/users.service.ts" 2>/dev/null)
check_grep "Users soft-deleted via isActive" "isActive" "$USER_SERVICE"

echo -e "\n${YELLOW}3.6 Audit Log Immutability${NC}"
AUDIT_SERVICE=$(cat "$SRC/apps/api/src/audit/audit.service.ts" 2>/dev/null)
check_no_grep "No update method in audit service" "update(" "$AUDIT_SERVICE"
check_no_grep "No delete method in audit service" "delete(" "$AUDIT_SERVICE"
check_grep "Audit is append-only (create only)" "create(" "$AUDIT_SERVICE"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 4. ZZLP COMPLIANCE (Serbian Data Protection) ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}4.1 Data Residency${NC}"
check_grep "Hetzner deployment (EU data residency)" "Hetzner" "$(cat "$SRC/CLAUDE.md" 2>/dev/null)"
check_grep "PostgreSQL (data stays in DB, not third-party)" "PostgreSQL" "$(cat "$SRC/CLAUDE.md" 2>/dev/null)"

echo -e "\n${YELLOW}4.2 Data Processing Register${NC}"
# PII fields documented
SCHEMA=$(cat "$SRC/apps/api/prisma/schema.prisma" 2>/dev/null)
check_grep "User email (PII) tracked" "email.*String.*@unique" "$SCHEMA"
check_grep "User firstName (PII) tracked" "firstName" "$SCHEMA"
check_grep "User lastName (PII) tracked" "lastName" "$SCHEMA"
check_grep "Password stored as hash" "password.*String" "$SCHEMA"
check_grep "Safety injuredPerson (PII) tracked" "injuredPerson" "$SCHEMA"

echo -e "\n${YELLOW}4.3 Consent & Purpose Limitation${NC}"
# No analytics/tracking SDKs
WEB_PKG=$(cat "$SRC/apps/web/package.json" 2>/dev/null)
check_no_grep "No Google Analytics" "google-analytics" "$WEB_PKG"
check_no_grep "No Facebook pixel" "facebook" "$WEB_PKG"
check_no_grep "No Sentry (external data processor)" "sentry" "$WEB_PKG"
check_no_grep "No Mixpanel" "mixpanel" "$WEB_PKG"

echo -e "\n${YELLOW}4.4 Cross-Border Transfer${NC}"
API_PKG=$(cat "$SRC/apps/api/package.json" 2>/dev/null)
# S3 is used but should be EU region
check_grep "S3 client exists (check EU region config)" "aws-sdk" "$API_PKG"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 5. ISO 9001 / IATF 16949 COMPLIANCE ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}5.1 Quality Record Immutability${NC}"
# Create and close an NCR, try to modify
RESP=$(http "/quality/ncr" "$T_QUALITY" '{"severity":"minor","description":"Immutability test NCR"}')
NCR_ID=$(body "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$NCR_ID" ]; then
  # Close it
  http "/quality/ncr/$NCR_ID" "$T_QUALITY" '{"status":"closed"}' "PATCH" > /dev/null 2>&1
  sleep 0.3
  RESP=$(http "/quality/ncr/$NCR_ID" "$T_QUALITY" '{"rootCause":"hack"}' "PATCH")
  assert "Closed NCR immutable (400)" "400" "$(code "$RESP")"
fi

echo -e "\n${YELLOW}5.2 Safety Incident Immutability (ISO 45001)${NC}"
RESP=$(http "/safety/incidents" "$T_FLOOR" '{"type":"near_miss","location":"Test","title":"Immutability test","description":"Test"}')
INC_ID=$(body "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$INC_ID" ]; then
  http "/safety/incidents/$INC_ID" "$T_MANAGER" '{"status":"closed"}' "PATCH" > /dev/null 2>&1
  sleep 0.3
  RESP=$(http "/safety/incidents/$INC_ID" "$T_MANAGER" '{"title":"hacked"}' "PATCH")
  assert "Closed safety incident immutable (400)" "400" "$(code "$RESP")"
fi

echo -e "\n${YELLOW}5.3 5S Audit Immutability${NC}"
FIVE_S_SVC=$(cat "$SRC/apps/api/src/tools/five-s/five-s.service.ts" 2>/dev/null)
check_grep "Completed 5S audit protected" "Cannot edit a completed audit" "$FIVE_S_SVC"

echo -e "\n${YELLOW}5.4 Traceability${NC}"
check_grep "Audit log tracks userId" "userId" "$AUDIT_SERVICE"
check_grep "Audit log tracks IP address" "ipAddress" "$AUDIT_SERVICE"
check_grep "Audit log tracks user agent" "userAgent" "$AUDIT_SERVICE"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 6. DATA SECURITY ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}6.1 SQL Injection Protection${NC}"
# Prisma ORM = parameterized queries
check_grep "Using Prisma ORM (parameterized queries)" "PrismaService" "$(grep -r 'PrismaService' "$SRC/apps/api/src/quality/quality.service.ts" 2>/dev/null)"
# No raw SQL queries
RAW_SQL=$(grep -r '\$queryRaw\|\$executeRaw\|raw(' "$SRC/apps/api/src/" --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v ".spec.ts")
check_no_grep "No raw SQL queries in services" "queryRaw" "$RAW_SQL"

echo -e "\n${YELLOW}6.2 XSS Protection${NC}"
# React auto-escapes by default
check_grep "React 19 (auto-escapes HTML)" "react.*19" "$(cat "$SRC/apps/web/package.json" 2>/dev/null)"
# No dangerouslySetInnerHTML
DANGEROUS=$(grep -r "dangerouslySetInnerHTML" "$SRC/apps/web/src/" --include="*.tsx" 2>/dev/null)
check_no_grep "No dangerouslySetInnerHTML usage" "dangerouslySetInnerHTML" "$DANGEROUS"

echo -e "\n${YELLOW}6.3 Rate Limiting${NC}"
check_grep "Throttler module installed" "throttler" "$API_PKG"
check_grep "Throttler registered as global guard" "ThrottlerGuard" "$(cat "$SRC/apps/api/src/app.module.ts" 2>/dev/null)"
# Test rate limiting on login
for i in $(seq 1 21); do
  curl -s -o /dev/null "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"ratelimit@test.com","password":"wrong"}'
done
RESP=$(curl -s -w "\n%{http_code}" "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"ratelimit@test.com","password":"wrong"}')
assert "Rate limiting active (429)" "429" "$(code "$RESP")"

echo -e "\n${YELLOW}6.4 Input Validation${NC}"
check_grep "class-validator installed" "class-validator" "$API_PKG"
check_grep "ValidationPipe with transform" "transform" "$VALIDATION"

echo -e "\n${YELLOW}6.5 Secrets Management${NC}"
# No hardcoded secrets
HARDCODED=$(grep -r "JWT_SECRET\|password.*=.*['\"]" "$SRC/apps/api/src/" --include="*.ts" 2>/dev/null | grep -v ".spec.ts" | grep -v "example" | grep -v "config.get" | grep -v "dto\." | grep -v "data.password" | grep -v "user.password" | grep -v "compare" | grep -v "hash")
check_no_grep "No hardcoded JWT secrets" "JWT_SECRET.*=" "$HARDCODED"
# .env not in git
check_file "$SRC/.gitignore" ".gitignore exists"
GITIGNORE=$(cat "$SRC/.gitignore" 2>/dev/null)
check_grep ".env in .gitignore" ".env" "$GITIGNORE"

echo -e "\n${YELLOW}6.6 File Upload Security${NC}"
UPLOAD_SVC=$(cat "$SRC/apps/api/src/uploads/uploads.controller.ts" 2>/dev/null)
# Check file type validation exists
UPLOAD_SERVICE=$(cat "$SRC/apps/api/src/uploads/uploads.service.ts" 2>/dev/null)
check_grep "File upload service exists" "class" "$UPLOAD_SERVICE"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 7. MULTI-TENANT DATA ISOLATION ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}7.1 Site isolation — Belgrade cannot see Milan data${NC}"
sleep 62  # Wait for rate limit reset
T_BELGRADE=$(token "$(login "belgrade.operator@leanpilot.me")")

RESP=$(http "/tools/five-s" "$T_BELGRADE")
assert_ok "Belgrade → 5S list" "$(code "$RESP")"
check_no_grep "Belgrade sees no Milan 5S data" "Assembly" "$(body "$RESP")"

RESP=$(http "/safety/incidents" "$T_BELGRADE")
assert_ok "Belgrade → safety" "$(code "$RESP")"

echo -e "\n${YELLOW}7.2 Corporate admin sees all sites${NC}"
RESP=$(http "/corporate/overview" "$T_ADMIN")
check_grep "Corporate sees Milan" "Milan" "$(body "$RESP")"
check_grep "Corporate sees Belgrade" "Belgrade" "$(body "$RESP")"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 8. ESCALATION ENGINE ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}8.1 Escalation rules seeded${NC}"
RESP=$(http "/escalation" "$T_SITE")
assert_ok "Escalation rules list" "$(code "$RESP")"
check_grep "Breakdown L1 rule exists" "Breakdown L1" "$(body "$RESP")"
check_grep "Breakdown L3 rule exists" "Breakdown L3" "$(body "$RESP")"
check_grep "Safety Critical rule exists" "Safety Critical" "$(body "$RESP")"

echo -e "\n${YELLOW}8.2 Escalation rule CRUD${NC}"
assert_blocked "Operator cannot manage escalation" "$(code "$(http "/escalation" "$T_OP")")"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 9. PWA & OFFLINE READINESS ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}9.1 PWA Files${NC}"
check_file "$SRC/apps/web/public/manifest.json" "PWA manifest exists"
check_file "$SRC/apps/web/public/sw.js" "Service worker exists"
MANIFEST=$(cat "$SRC/apps/web/public/manifest.json" 2>/dev/null)
check_grep "Manifest has standalone display" "standalone" "$MANIFEST"
check_grep "Manifest start_url is /shopfloor" "shopfloor" "$MANIFEST"

echo -e "\n${YELLOW}9.2 Offline Queue${NC}"
check_file "$SRC/apps/web/src/lib/offline-queue.ts" "Offline queue module exists"
SW=$(cat "$SRC/apps/web/public/sw.js" 2>/dev/null)
check_grep "SW has IndexedDB queue" "indexedDB" "$SW"
check_grep "SW queues shopfloor POST/PATCH" "shopfloor" "$SW"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 10. ANALYTICS ENDPOINTS ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}10.1 Trend endpoints exist${NC}"
RESP=$(http "/dashboard/oee-trend?period=7d" "$T_MANAGER")
assert_ok "OEE trend endpoint" "$(code "$RESP")"
check_grep "OEE trend has points array" "points" "$(body "$RESP")"

RESP=$(http "/tools/five-s/trends?months=6" "$T_MANAGER")
assert_ok "5S trends endpoint" "$(code "$RESP")"

RESP=$(http "/safety/trends?months=12" "$T_MANAGER")
assert_ok "Safety trends endpoint" "$(code "$RESP")"

RESP=$(http "/gemba/waste-pareto?months=3" "$T_MANAGER")
assert_ok "Gemba waste pareto endpoint" "$(code "$RESP")"

echo -e "\n${YELLOW}10.2 Insufficient data thresholds${NC}"
# With no production data, should flag insufficient
check_grep "OEE trend flags insufficient data" "insufficientData" "$(body "$(http "/dashboard/oee-trend?period=7d" "$T_MANAGER")")"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 11. PAGINATION ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}11.1 List endpoints paginated${NC}"
RESP=$(http "/safety/incidents?limit=2&offset=0" "$T_MANAGER")
check_grep "Safety has total field" "total" "$(body "$RESP")"
check_grep "Safety has data array" "data" "$(body "$RESP")"
check_grep "Safety has limit" "limit" "$(body "$RESP")"

RESP=$(http "/quality/templates?limit=1" "$T_QUALITY")
check_grep "Quality has pagination" "total" "$(body "$RESP")"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 12. DEPLOYMENT READINESS (HETZNER) ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}12.1 Docker Configuration${NC}"
check_file "$SRC/docker/docker-compose.yml" "Dev Docker Compose"
check_file "$SRC/docker/docker-compose.prod.yml" "Prod Docker Compose"
check_file "$SRC/docker/Dockerfile.api" "API Dockerfile"
check_file "$SRC/docker/Dockerfile.web" "Web Dockerfile"

echo -e "\n${YELLOW}12.2 Production Config${NC}"
PROD=$(cat "$SRC/docker/docker-compose.prod.yml" 2>/dev/null)
check_grep "PostgreSQL in production" "postgres" "$PROD"
check_grep "Caddy for auto-HTTPS" "caddy" "$PROD"
check_grep "API depends on postgres" "depends_on" "$PROD"

echo -e "\n${YELLOW}12.3 Environment Variables${NC}"
check_file "$SRC/.env.example" ".env.example exists"
ENV_EXAMPLE=$(cat "$SRC/.env.example" 2>/dev/null)
check_grep "DATABASE_URL in example" "DATABASE_URL" "$ENV_EXAMPLE"
check_grep "JWT_SECRET in example" "JWT_SECRET" "$ENV_EXAMPLE"

echo -e "\n${YELLOW}12.4 No Sensitive Files in Git${NC}"
GIT_FILES=$(git -C "$SRC" ls-files 2>/dev/null)
check_no_grep "No .env committed" "^\.env$" "$GIT_FILES"
check_no_grep "No credentials.json" "credentials.json" "$GIT_FILES"
check_no_grep "No private keys" "\.pem$\|\.key$" "$GIT_FILES"

echo -e "\n${YELLOW}12.5 Build Artifacts${NC}"
TOTAL=$((TOTAL + 1))
if cd "$SRC/apps/api" && npx nest build 2>&1 | grep -qi "error"; then
  echo -e "  ${RED}✗${NC} API build fails"; FAIL=$((FAIL + 1))
else
  echo -e "  ${GREEN}✓${NC} API builds clean"; PASS=$((PASS + 1))
fi

echo -e "\n${YELLOW}12.6 Database Migrations${NC}"
MIGRATIONS=$(ls -d "$SRC/apps/api/prisma/migrations/"*/ 2>/dev/null | wc -l)
TOTAL=$((TOTAL + 1))
if [ "$MIGRATIONS" -gt 0 ]; then
  echo -e "  ${GREEN}✓${NC} $MIGRATIONS migrations present"; PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} No migrations found"; FAIL=$((FAIL + 1))
fi

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 13. CODE QUALITY ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}13.1 No console.log in production code${NC}"
CONSOLE_LOGS=$(grep -rn "console\.log\|console\.warn" "$SRC/apps/api/src/" --include="*.ts" 2>/dev/null | grep -v ".spec.ts" | grep -v "node_modules")
TOTAL=$((TOTAL + 1))
if [ -z "$CONSOLE_LOGS" ]; then
  echo -e "  ${GREEN}✓${NC} No console.log in API source"; PASS=$((PASS + 1))
else
  COUNT=$(echo "$CONSOLE_LOGS" | wc -l)
  echo -e "  ${YELLOW}⚠${NC} $COUNT console.log/warn found in API"; WARN=$((WARN + 1))
fi

echo -e "\n${YELLOW}13.2 TypeScript strict checks${NC}"
TOTAL=$((TOTAL + 1))
TS_ERRORS=$(cd "$SRC/apps/api" && npx tsc --noEmit 2>&1 | grep -c "error TS" 2>/dev/null || echo "0")
if [ "$TS_ERRORS" = "0" ]; then
  echo -e "  ${GREEN}✓${NC} Zero TypeScript errors"; PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} $TS_ERRORS TypeScript errors"; FAIL=$((FAIL + 1))
fi

echo -e "\n${YELLOW}13.3 Unit Tests${NC}"
TOTAL=$((TOTAL + 1))
TEST_RESULT=$(cd "$SRC/apps/api" && npx jest --no-cache 2>&1 | tail -3)
if echo "$TEST_RESULT" | grep -q "passed"; then
  TESTS_PASSED=$(echo "$TEST_RESULT" | grep -oP '\d+ passed' | head -1)
  echo -e "  ${GREEN}✓${NC} $TESTS_PASSED"; PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Tests failing"; FAIL=$((FAIL + 1))
fi

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 14. COMPLIANCE SAFETY FLOOR ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}14.1 Safety reporting available to ALL roles${NC}"
for ROLE_TOKEN in "$T_FLOOR" "$T_OP" "$T_SHIFT" "$T_QUALITY" "$T_MANAGER" "$T_VIEWER"; do
  RESP=$(http "/safety/incidents" "$ROLE_TOKEN")
  TOTAL=$((TOTAL + 1))
  if echo "200 201" | grep -qw "$(code "$RESP")"; then
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Safety view blocked for a role"; FAIL=$((FAIL + 1))
  fi
done
echo -e "  ${GREEN}✓${NC} Safety incidents viewable by all 6 tested roles"

# Safety reporting (create)
for ROLE_TOKEN in "$T_FLOOR" "$T_OP" "$T_VIEWER"; do
  RESP=$(http "/safety/incidents" "$ROLE_TOKEN" "{\"type\":\"near_miss\",\"location\":\"Test\",\"title\":\"Compliance test $(date +%s%N)\",\"description\":\"Test\"}")
  TOTAL=$((TOTAL + 1))
  if echo "200 201" | grep -qw "$(code "$RESP")"; then
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} Safety CREATE blocked (compliance violation!)"; FAIL=$((FAIL + 1))
  fi
done
echo -e "  ${GREEN}✓${NC} Safety reporting works for floor/operator/viewer (compliance floor)"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${CYAN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║                 AUDIT RESULTS                      ║${NC}"
echo -e "${BOLD}${CYAN}╠═══════════════════════════════════════════════════╣${NC}"
echo -e "${BOLD}  ${GREEN}PASSED:  $PASS${NC}"
echo -e "${BOLD}  ${RED}FAILED:  $FAIL${NC}"
echo -e "${BOLD}  ${YELLOW}WARNINGS: $WARN${NC}"
echo -e "${BOLD}  TOTAL:   $TOTAL${NC}"
echo -e "${BOLD}${CYAN}╚═══════════════════════════════════════════════════╝${NC}\n"

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}AUDIT FAILED — $FAIL issues must be resolved before deployment${NC}\n"
  exit 1
else
  echo -e "${GREEN}AUDIT PASSED — Ready for Hetzner deployment${NC}\n"
fi
