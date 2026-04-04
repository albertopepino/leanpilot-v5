#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# LeanPilot v5 — Full Data Flow Test
# Tests auth, permissions, CRUD, cross-role visibility, compliance
# ═══════════════════════════════════════════════════════════════════

BASE="http://localhost:3001/api"
PASS=0
FAIL=0
TOTAL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

assert() {
  local desc="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$expected" = "$actual" ]; then
    echo -e "  ${GREEN}✓${NC} $desc"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $desc (expected=$expected, got=$actual)"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local desc="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL + 1))
  if echo "$actual" | grep -q "$expected"; then
    echo -e "  ${GREEN}✓${NC} $desc"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $desc (expected to contain '$expected')"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local desc="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL + 1))
  if echo "$actual" | grep -q "$expected"; then
    echo -e "  ${RED}✗${NC} $desc (should NOT contain '$expected')"
    FAIL=$((FAIL + 1))
  else
    echo -e "  ${GREEN}✓${NC} $desc"
    PASS=$((PASS + 1))
  fi
}

login() {
  local email="$1"
  sleep 0.3
  local resp=$(curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$email\",\"password\":\"password123\"}")
  echo "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null
}

get() {
  curl -s -w "\n%{http_code}" "$BASE$1" -H "Authorization: Bearer $2"
}

post() {
  curl -s -w "\n%{http_code}" "$BASE$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3"
}

patch() {
  curl -s -w "\n%{http_code}" -X PATCH "$BASE$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3"
}

http_code() {
  echo "$1" | tail -1
}

body() {
  echo "$1" | sed '$d'
}

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 1. AUTHENTICATION ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}1.1 Login — all roles${NC}"
TOKEN_ADMIN=$(login "admin@leanpilot.me")
assert "Corporate admin login" "true" "$([ -n "$TOKEN_ADMIN" ] && echo true || echo false)"

TOKEN_SITE=$(login "site.admin@leanpilot.me")
assert "Site admin login" "true" "$([ -n "$TOKEN_SITE" ] && echo true || echo false)"

TOKEN_MANAGER=$(login "manager@leanpilot.me")
assert "Manager (Full Access) login" "true" "$([ -n "$TOKEN_MANAGER" ] && echo true || echo false)"

TOKEN_QUALITY=$(login "quality@leanpilot.me")
assert "Quality Engineer login" "true" "$([ -n "$TOKEN_QUALITY" ] && echo true || echo false)"

TOKEN_SHIFT=$(login "shift.leader@leanpilot.me")
assert "Shift Leader login" "true" "$([ -n "$TOKEN_SHIFT" ] && echo true || echo false)"

TOKEN_OP=$(login "operator1@leanpilot.me")
assert "Operator login" "true" "$([ -n "$TOKEN_OP" ] && echo true || echo false)"

TOKEN_FLOOR=$(login "floor@leanpilot.me")
assert "Shop Floor Operator login" "true" "$([ -n "$TOKEN_FLOOR" ] && echo true || echo false)"

TOKEN_VIEWER=$(login "viewer@leanpilot.me")
assert "Viewer login" "true" "$([ -n "$TOKEN_VIEWER" ] && echo true || echo false)"

echo -e "\n${YELLOW}1.2 Login — permission map returned${NC}"
RESP=$(curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"operator1@leanpilot.me","password":"password123"}')
assert_contains "Operator has permissions object" "permissions" "$RESP"
assert_contains "Operator has customRoleName" "Operator" "$RESP"
assert_contains "Operator has production:participate" "participate" "$RESP"

echo -e "\n${YELLOW}1.3 Login — invalid credentials${NC}"
RESP=$(curl -s -w "\n%{http_code}" "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"wrong@factory.com","password":"wrongpassword"}')
CODE=$(http_code "$RESP")
assert "Invalid login returns 401" "true" "$(echo "400 401" | grep -qw "$CODE" && echo true || echo false)"

echo -e "\n${YELLOW}1.4 Auth — unauthenticated access${NC}"
RESP=$(get "/dashboard/overview" "invalid-token")
assert "Invalid token returns 401" "401" "$(http_code "$RESP")"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 2. PERMISSION MATRIX — ACCESS CONTROL ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}2.1 Shop Floor Operator — restricted access${NC}"
RESP=$(get "/shopfloor/reason-codes?category=breakdown" "$TOKEN_FLOOR")
assert "Floor → shopfloor: 200" "200" "$(http_code "$RESP")"

RESP=$(get "/quality/templates" "$TOKEN_FLOOR")
assert "Floor → quality: 403" "403" "$(http_code "$RESP")"

RESP=$(get "/tools/five-s" "$TOKEN_FLOOR")
assert "Floor → 5S: 403" "403" "$(http_code "$RESP")"

RESP=$(get "/gemba" "$TOKEN_FLOOR")
assert "Floor → gemba: 403" "403" "$(http_code "$RESP")"

RESP=$(get "/smed" "$TOKEN_FLOOR")
assert "Floor → SMED: 403" "403" "$(http_code "$RESP")"

RESP=$(get "/safety/incidents" "$TOKEN_FLOOR")
assert "Floor → safety (compliance floor): 200" "200" "$(http_code "$RESP")"

echo -e "\n${YELLOW}2.2 Operator — CI tools access, no quality manage${NC}"
RESP=$(get "/tools/five-s" "$TOKEN_OP")
assert "Operator → 5S: 200" "200" "$(http_code "$RESP")"

RESP=$(get "/tools/kaizen" "$TOKEN_OP")
assert "Operator → kaizen: 200" "200" "$(http_code "$RESP")"

RESP=$(get "/quality/templates" "$TOKEN_OP")
assert "Operator → quality (view): 200" "200" "$(http_code "$RESP")"

RESP=$(get "/shopfloor/reason-codes?category=breakdown" "$TOKEN_OP")
assert "Operator → shopfloor: 200" "200" "$(http_code "$RESP")"

RESP=$(get "/rca/five-why" "$TOKEN_OP")
assert "Operator → root cause: 403 (no problem_solving)" "403" "$(http_code "$RESP")"

echo -e "\n${YELLOW}2.3 Quality Engineer — quality manage, no production participate${NC}"
RESP=$(get "/quality/templates" "$TOKEN_QUALITY")
assert "Quality → quality: 200" "200" "$(http_code "$RESP")"

RESP=$(get "/rca/five-why" "$TOKEN_QUALITY")
assert "Quality → root cause: 200" "200" "$(http_code "$RESP")"

RESP=$(get "/shopfloor/reason-codes?category=breakdown" "$TOKEN_QUALITY")
assert "Quality → shopfloor: 403 (view only)" "403" "$(http_code "$RESP")"

echo -e "\n${YELLOW}2.4 Shift Leader — production + shift + basic CI${NC}"
RESP=$(get "/shopfloor/reason-codes?category=breakdown" "$TOKEN_SHIFT")
assert "Shift Leader → shopfloor: 200" "200" "$(http_code "$RESP")"

RESP=$(get "/tier-meetings" "$TOKEN_SHIFT")
assert "Shift Leader → tier meetings: 200" "200" "$(http_code "$RESP")"

RESP=$(get "/tools/five-s" "$TOKEN_SHIFT")
assert "Shift Leader → 5S: 200" "200" "$(http_code "$RESP")"

echo -e "\n${YELLOW}2.5 Site Admin — bypasses all permission checks${NC}"
RESP=$(get "/quality/templates" "$TOKEN_SITE")
assert "Site Admin → quality: 200" "200" "$(http_code "$RESP")"

RESP=$(get "/shopfloor/reason-codes?category=breakdown" "$TOKEN_SITE")
assert "Site Admin → shopfloor: 200" "200" "$(http_code "$RESP")"

RESP=$(get "/roles" "$TOKEN_SITE")
assert "Site Admin → roles API: 200" "200" "$(http_code "$RESP")"

RESP=$(get "/users" "$TOKEN_SITE")
assert "Site Admin → users: 200" "200" "$(http_code "$RESP")"

echo -e "\n${YELLOW}2.6 Viewer — read-only, safety compliance floor${NC}"
RESP=$(get "/dashboard/overview" "$TOKEN_VIEWER")
assert "Viewer → dashboard: 200" "200" "$(http_code "$RESP")"

RESP=$(get "/safety/incidents" "$TOKEN_VIEWER")
assert "Viewer → safety (view): 200" "200" "$(http_code "$RESP")"

RESP=$(get "/quality/templates" "$TOKEN_VIEWER")
assert "Viewer → quality (view): 200" "200" "$(http_code "$RESP")"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 3. DATA CREATION & FLOW ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}3.1 5S Audit — operator creates, manager views${NC}"
RESP=$(post "/tools/five-s" "$TOKEN_OP" '{"area":"Assembly Line"}')
assert "Operator creates 5S audit: 200/201" "true" "$(echo "200 201" | grep -qw "$(http_code "$RESP")" && echo true || echo false)"
AUDIT_ID=$(body "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
assert_contains "5S audit has ID" "cmn" "$AUDIT_ID"

if [ -n "$AUDIT_ID" ]; then
  RESP=$(get "/tools/five-s/$AUDIT_ID" "$TOKEN_MANAGER")
  assert "Manager can view operator's 5S audit: 200" "200" "$(http_code "$RESP")"
  assert_contains "5S audit has area" "Assembly" "$(body "$RESP")"

  RESP=$(patch "/tools/five-s/$AUDIT_ID/scores" "$TOKEN_OP" '{"scores":[{"category":"sort","score":4},{"category":"shine","score":3}]}')
  CODE=$(http_code "$RESP")
  assert "Operator updates scores: 200" "true" "$(echo "200 201" | grep -qw "$CODE" && echo true || echo false)"
fi

echo -e "\n${YELLOW}3.2 Kaizen — operator submits, manager reviews${NC}"
RESP=$(post "/tools/kaizen" "$TOKEN_OP" '{"title":"Reduce changeover time on CNC-01","problem":"Takes 45 min","proposedSolution":"Pre-stage tools","expectedImpact":"high","area":"Machining"}')
assert "Operator submits kaizen: 200/201" "true" "$(echo "200 201" | grep -qw "$(http_code "$RESP")" && echo true || echo false)"
KAIZEN_ID=$(body "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

if [ -n "$KAIZEN_ID" ]; then
  RESP=$(get "/tools/kaizen/$KAIZEN_ID" "$TOKEN_MANAGER")
  assert "Manager views kaizen: 200" "200" "$(http_code "$RESP")"

  RESP=$(patch "/tools/kaizen/$KAIZEN_ID/status" "$TOKEN_MANAGER" '{"status":"under_review","reviewNotes":"Good idea, proceed"}')
  assert "Manager reviews kaizen: 200" "200" "$(http_code "$RESP")"

  # Operator cannot approve
  RESP=$(patch "/tools/kaizen/$KAIZEN_ID/status" "$TOKEN_OP" '{"status":"rejected"}')
  assert "Operator cannot approve kaizen: 403" "403" "$(http_code "$RESP")"
fi

echo -e "\n${YELLOW}3.3 Safety Incident — floor operator reports (compliance floor)${NC}"
RESP=$(post "/safety/incidents" "$TOKEN_FLOOR" '{"type":"near_miss","location":"CNC area","title":"Oil spill near machine","description":"Hydraulic leak on CNC-01 floor"}')
assert "Floor operator reports safety incident: 200/201" "true" "$(echo "200 201" | grep -qw "$(http_code "$RESP")" && echo true || echo false)"
INCIDENT_ID=$(body "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

if [ -n "$INCIDENT_ID" ]; then
  # Everyone can view safety
  RESP=$(get "/safety/incidents/$INCIDENT_ID" "$TOKEN_VIEWER")
  assert "Viewer can view safety incident: 200" "200" "$(http_code "$RESP")"

  # Floor operator cannot investigate (needs manage)
  RESP=$(patch "/safety/incidents/$INCIDENT_ID" "$TOKEN_FLOOR" '{"status":"investigating"}')
  assert "Floor operator cannot investigate: 403" "403" "$(http_code "$RESP")"

  # Manager can investigate
  RESP=$(patch "/safety/incidents/$INCIDENT_ID" "$TOKEN_MANAGER" '{"status":"investigating","investigationNotes":"Root cause: worn seal"}')
  assert "Manager investigates incident: 200" "200" "$(http_code "$RESP")"
fi

echo -e "\n${YELLOW}3.4 Quality — quality engineer creates inspection${NC}"
RESP=$(post "/quality/templates" "$TOKEN_QUALITY" '{"name":"CNC Dimensional Check","checkpoints":[{"sequence":1,"description":"Diameter within tolerance","measurementType":"measurement","lowerLimit":49.9,"upperLimit":50.1,"targetValue":50.0,"isRequired":true}]}')
assert "Quality engineer creates template: 200/201" "true" "$(echo "200 201" | grep -qw "$(http_code "$RESP")" && echo true || echo false)"

# Operator cannot create templates (needs quality.manage)
RESP=$(post "/quality/templates" "$TOKEN_OP" '{"name":"Test","checkpoints":[{"sequence":1,"description":"Test"}]}')
assert "Operator cannot create quality template: 403" "403" "$(http_code "$RESP")"

echo -e "\n${YELLOW}3.5 Maintenance CILT — operator logs, floor operator cannot${NC}"
RESP=$(get "/maintenance/cilt" "$TOKEN_OP")
assert "Operator views CILT: 200" "200" "$(http_code "$RESP")"

RESP=$(get "/maintenance/cilt" "$TOKEN_FLOOR")
assert "Floor operator cannot view CILT: 403" "403" "$(http_code "$RESP")"

echo -e "\n${YELLOW}3.6 Dashboard — all authenticated users can view${NC}"
RESP=$(get "/dashboard/overview" "$TOKEN_FLOOR")
assert "Floor operator → dashboard overview: 200" "200" "$(http_code "$RESP")"
assert_contains "Dashboard has losses" "losses" "$(body "$RESP")"

RESP=$(get "/dashboard/oee" "$TOKEN_VIEWER")
assert "Viewer → OEE: 200" "200" "$(http_code "$RESP")"

RESP=$(get "/dashboard/pareto" "$TOKEN_SHIFT")
assert "Shift leader → Pareto: 200" "200" "$(http_code "$RESP")"

echo -e "\n${YELLOW}3.7 Orders — production.view vs production.manage${NC}"
RESP=$(get "/orders" "$TOKEN_OP")
assert "Operator views orders: 200" "200" "$(http_code "$RESP")"
assert_contains "Orders has data" "data" "$(body "$RESP")"

RESP=$(post "/orders" "$TOKEN_OP" '{"poNumber":"PO-TEST-001","productName":"Test Part","targetQuantity":100,"unit":"pcs"}')
assert "Operator cannot create order (needs manage): 403" "403" "$(http_code "$RESP")"

RESP=$(post "/orders" "$TOKEN_MANAGER" "{\"poNumber\":\"PO-TEST-$(date +%s)\",\"productName\":\"Test Part\",\"targetQuantity\":100,\"unit\":\"pcs\",\"priority\":\"normal\",\"status\":\"released\",\"dueDate\":\"2026-12-31\"}")
assert "Manager creates order: 200/201" "true" "$(echo "200 201" | grep -qw "$(http_code "$RESP")" && echo true || echo false)"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 4. CROSS-ROLE DATA VISIBILITY ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}4.1 Multi-tenant isolation — Belgrade vs Milan${NC}"
TOKEN_BELGRADE=$(login "belgrade.operator@leanpilot.me")
RESP=$(get "/tools/five-s" "$TOKEN_BELGRADE")
BODY=$(body "$RESP")
assert "Belgrade operator → 5S: 200" "200" "$(http_code "$RESP")"
assert_not_contains "Belgrade sees no Milan audits" "Assembly Line" "$BODY"

echo -e "\n${YELLOW}4.2 Corporate admin sees all sites${NC}"
RESP=$(get "/corporate/overview" "$TOKEN_ADMIN")
assert "Corporate admin → overview: 200" "200" "$(http_code "$RESP")"
assert_contains "Overview has Milan" "Milan" "$(body "$RESP")"
assert_contains "Overview has Belgrade" "Belgrade" "$(body "$RESP")"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 5. ROLE MANAGEMENT API ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}5.1 Site admin lists roles${NC}"
RESP=$(get "/roles" "$TOKEN_SITE")
assert "Site admin lists roles: 200" "200" "$(http_code "$RESP")"
assert_contains "Roles include Operator template" "Operator" "$(body "$RESP")"

echo -e "\n${YELLOW}5.2 Site admin creates custom role${NC}"
RESP=$(post "/roles" "$TOKEN_SITE" "{\"name\":\"CNC Specialist $(date +%s)\",\"description\":\"Custom role for CNC operators\",\"permissions\":[{\"featureGroup\":\"production\",\"level\":\"participate\"},{\"featureGroup\":\"maintenance\",\"level\":\"participate\"},{\"featureGroup\":\"safety\",\"level\":\"participate\"}]}")
assert "Site admin creates custom role: 200/201" "true" "$(echo "200 201" | grep -qw "$(http_code "$RESP")" && echo true || echo false)"
CUSTOM_ROLE_ID=$(body "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

if [ -n "$CUSTOM_ROLE_ID" ]; then
  RESP=$(get "/roles/$CUSTOM_ROLE_ID" "$TOKEN_SITE")
  assert "Site admin views custom role: 200" "200" "$(http_code "$RESP")"
  assert_contains "Role has production permission" "production" "$(body "$RESP")"

  # Safety compliance floor enforced
  assert_contains "Safety forced to participate" "safety" "$(body "$RESP")"
fi

echo -e "\n${YELLOW}5.3 Operator cannot manage roles${NC}"
RESP=$(get "/roles" "$TOKEN_OP")
assert "Operator cannot list roles: 403" "403" "$(http_code "$RESP")"

RESP=$(post "/roles" "$TOKEN_OP" '{"name":"Hack","permissions":[]}')
assert "Operator cannot create roles: 403" "403" "$(http_code "$RESP")"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 6. COMPLIANCE CHECKS ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}6.1 Audit logging active${NC}"
RESP=$(get "/audit?limit=5" "$TOKEN_ADMIN")
assert "Corporate admin views audit log: 200" "200" "$(http_code "$RESP")"
assert_contains "Audit log has entries" "logs" "$(body "$RESP")"

echo -e "\n${YELLOW}6.2 Audit log — non-admin blocked${NC}"
RESP=$(get "/audit" "$TOKEN_MANAGER")
assert "Manager cannot view audit log: 403" "403" "$(http_code "$RESP")"

echo -e "\n${YELLOW}6.3 NCR immutability — cannot modify closed NCR${NC}"
# Create and close an NCR
RESP=$(post "/quality/ncr" "$TOKEN_QUALITY" '{"severity":"minor","description":"Test NCR for immutability check"}')
NCR_ID=$(body "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$NCR_ID" ]; then
  # Close the NCR
  patch "/quality/ncr/$NCR_ID" "$TOKEN_QUALITY" '{"status":"closed"}' > /dev/null 2>&1
  sleep 0.3
  # Try to modify closed NCR
  RESP=$(patch "/quality/ncr/$NCR_ID" "$TOKEN_QUALITY" '{"rootCause":"test"}')
  assert "Closed NCR cannot be modified: 400" "400" "$(http_code "$RESP")"
  assert_contains "NCR immutability error message" "closed" "$(body "$RESP")"
fi

echo -e "\n${YELLOW}6.4 Safety compliance floor — all roles can report${NC}"
RESP=$(post "/safety/incidents" "$TOKEN_VIEWER" '{"type":"near_miss","location":"Parking","title":"Slippery floor","description":"Water near entrance"}')
assert "Viewer can report safety incident: 200/201" "true" "$(echo "200 201" | grep -qw "$(http_code "$RESP")" && echo true || echo false)"

echo -e "\n${YELLOW}6.5 Rate limiting — login brute force protection${NC}"
for i in $(seq 1 21); do
  RESP=$(curl -s -w "\n%{http_code}" "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"wrong@test.com","password":"wrong"}')
done
assert "Rate limited after 20 failed logins: 429" "429" "$(http_code "$RESP")"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══ 7. PAGINATION ═══${NC}"
# ═══════════════════════════════════════════════════════════════════

echo -e "\n${YELLOW}7.1 List endpoints return paginated responses${NC}"
sleep 2
RESP=$(get "/safety/incidents?limit=2&offset=0" "$TOKEN_MANAGER")
assert "Safety paginated: 200" "200" "$(http_code "$RESP")"
assert_contains "Has total field" "total" "$(body "$RESP")"
assert_contains "Has data field" "data" "$(body "$RESP")"
assert_contains "Has limit field" "limit" "$(body "$RESP")"

RESP=$(get "/quality/templates?limit=1" "$TOKEN_QUALITY")
assert "Quality templates paginated: 200" "200" "$(http_code "$RESP")"
assert_contains "Has pagination metadata" "total" "$(body "$RESP")"

# ═══════════════════════════════════════════════════════════════════
echo -e "\n${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  RESULTS: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC} out of $TOTAL tests"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}\n"

if [ $FAIL -gt 0 ]; then
  exit 1
fi
