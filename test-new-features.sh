#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# Test NEW features: GDPR, CAPA, Reason Codes, Shopfloor, Demo Data
# ═══════════════════════════════════════════════════════════════════

BASE="http://localhost:3001/api"
PASS=0; FAIL=0; TOTAL=0

G='\033[0;32m'; R='\033[0;31m'; C='\033[0;36m'; Y='\033[1;33m'; B='\033[1m'; N='\033[0m'

ok()  { TOTAL=$((TOTAL+1)); if echo "200 201 202" | grep -qw "$2"; then echo -e "  ${G}✓${N} $1"; PASS=$((PASS+1)); else echo -e "  ${R}✗${N} $1 (got $2)"; FAIL=$((FAIL+1)); fi; }
bl()  { TOTAL=$((TOTAL+1)); if echo "400 401 403" | grep -qw "$2"; then echo -e "  ${G}✓${N} $1"; PASS=$((PASS+1)); else echo -e "  ${R}✗${N} $1 (got $2)"; FAIL=$((FAIL+1)); fi; }
eq()  { TOTAL=$((TOTAL+1)); if [ "$2" = "$3" ]; then echo -e "  ${G}✓${N} $1"; PASS=$((PASS+1)); else echo -e "  ${R}✗${N} $1 (exp=$2 got=$3)"; FAIL=$((FAIL+1)); fi; }
has() { TOTAL=$((TOTAL+1)); if echo "$3" | grep -q "$2"; then echo -e "  ${G}✓${N} $1"; PASS=$((PASS+1)); else echo -e "  ${R}✗${N} $1 (missing '$2')"; FAIL=$((FAIL+1)); fi; }

L() { sleep 0.15; curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"password123\"}"; }
T() { echo "$1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null; }
GE() { curl -s -w "\n%{http_code}" "$BASE$1" -H "Authorization: Bearer $2"; }
PO() { curl -s -w "\n%{http_code}" "$BASE$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3"; }
PA() { curl -s -w "\n%{http_code}" -X PATCH "$BASE$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3"; }
DE() { curl -s -w "\n%{http_code}" -X DELETE "$BASE$1" -H "Authorization: Bearer $2"; }
CO() { echo "$1" | tail -1; }
BO() { echo "$1" | sed '$d'; }

echo -e "\n${B}${C}╔═══════════════════════════════════════════════════════╗${N}"
echo -e "${B}${C}║  NEW FEATURES TEST — $(date +%Y-%m-%d)                      ║${N}"
echo -e "${B}${C}╚═══════════════════════════════════════════════════════╝${N}"

# Login
TS=$(T "$(L site.admin@leanpilot.me)")
TQ=$(T "$(L quality@leanpilot.me)")
TM=$(T "$(L manager@leanpilot.me)")
TO=$(T "$(L operator1@leanpilot.me)")
TF=$(T "$(L floor@leanpilot.me)")
TV=$(T "$(L viewer@leanpilot.me)")

# ═══ 1. GDPR ENDPOINTS ═══════════════════════════════════════════
echo -e "\n${C}═══ 1. GDPR ENDPOINTS ═══${N}"

echo -e "${Y}Password Reset${N}"
RR=$(PO "/auth/forgot-password" "" '{"email":"admin@leanpilot.me"}')
ok "Forgot password" "$(CO "$RR")"
has "Generic response" "reset email" "$(BO "$RR")"
bl "Invalid token rejected" "$(CO "$(PO "/auth/reset-password" "" '{"token":"bad","password":"newpass"}')")"

echo -e "${Y}User Data Export (GDPR Art. 20)${N}"
RR=$(GE "/users/me/export" "$TO")
ok "Operator exports own data" "$(CO "$RR")"
has "Export has personalData" "personalData" "$(BO "$RR")"
has "Export has activityData" "activityData" "$(BO "$RR")"
has "Export has auditLog" "auditLog" "$(BO "$RR")"

echo -e "${Y}GDPR Delete (Art. 17)${N}"
# Create a test user first, then GDPR delete
RR=$(PO "/auth/register" "$TS" '{"email":"gdpr-test@leanpilot.me","password":"password123","firstName":"GDPR","lastName":"Test","siteId":"'$(echo "$TS" | python3 -c "import sys,base64,json; p=sys.stdin.read().split('.')[1]; print(json.loads(base64.urlsafe_b64decode(p+'=='))['siteId'])" 2>/dev/null)'","corporateId":"'$(echo "$TS" | python3 -c "import sys,base64,json; p=sys.stdin.read().split('.')[1]; print(json.loads(base64.urlsafe_b64decode(p+'=='))['corporateId'])" 2>/dev/null)'"}')
TEST_UID=$(BO "$RR" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
if [ -n "$TEST_UID" ]; then
  RR=$(DE "/users/$TEST_UID/gdpr" "$TS")
  ok "GDPR delete user" "$(CO "$RR")"
  has "User anonymized" "anonymized" "$(BO "$RR")"
fi

echo -e "${Y}Token Cleanup Scheduler${N}"
TOTAL=$((TOTAL+1))
if [ -f "$SRC/apps/api/src/auth/token-cleanup.scheduler.ts" ] 2>/dev/null || [ -f "/home/csg/repos/experiments/leanpilot-v4/apps/api/src/auth/token-cleanup.scheduler.ts" ]; then
  echo -e "  ${G}✓${N} Token cleanup scheduler exists"; PASS=$((PASS+1))
else
  echo -e "  ${R}✗${N} Token cleanup scheduler missing"; FAIL=$((FAIL+1))
fi

echo -e "${Y}Retention Scheduler${N}"
TOTAL=$((TOTAL+1))
if [ -f "/home/csg/repos/experiments/leanpilot-v4/apps/api/src/cleanup/retention.scheduler.ts" ]; then
  echo -e "  ${G}✓${N} Retention scheduler exists"; PASS=$((PASS+1))
else
  echo -e "  ${R}✗${N} Retention scheduler missing"; FAIL=$((FAIL+1))
fi

echo -e "${Y}Privacy & Terms Pages${N}"
TOTAL=$((TOTAL+1))
if [ -f "/home/csg/repos/experiments/leanpilot-v4/apps/web/src/app/(auth)/privacy/page.tsx" ]; then
  echo -e "  ${G}✓${N} Privacy policy page exists"; PASS=$((PASS+1))
else
  echo -e "  ${R}✗${N} Privacy policy page missing"; FAIL=$((FAIL+1))
fi
TOTAL=$((TOTAL+1))
if [ -f "/home/csg/repos/experiments/leanpilot-v4/apps/web/src/app/(auth)/terms/page.tsx" ]; then
  echo -e "  ${G}✓${N} Terms of service page exists"; PASS=$((PASS+1))
else
  echo -e "  ${R}✗${N} Terms of service page missing"; FAIL=$((FAIL+1))
fi

# ═══ 2. CAPA REGISTER ════════════════════════════════════════════
echo -e "\n${C}═══ 2. CAPA REGISTER ═══${N}"

echo -e "${Y}CAPA CRUD${N}"
ok "CAPA list" "$(CO "$(GE "/capa" "$TQ")")"
ok "CAPA summary" "$(CO "$(GE "/capa/summary" "$TQ")")"

# Create NCR first, then CAPA from it
RR=$(PO "/quality/ncr" "$TQ" '{"severity":"major","description":"CAPA test NCR"}')
NCR_ID=$(BO "$RR" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

ASSIGNEE_ID=$(BO "$(GE "/users" "$TS")" | python3 -c "import sys,json; d=json.load(sys.stdin); u=d if isinstance(d,list) else d.get('data',[]); print(u[0]['id'] if u else '')" 2>/dev/null)

if [ -n "$NCR_ID" ] && [ -n "$ASSIGNEE_ID" ]; then
  RR=$(PO "/capa" "$TQ" "{\"ncrId\":\"$NCR_ID\",\"type\":\"corrective\",\"title\":\"Test CAPA\",\"description\":\"Fix the issue\",\"assigneeId\":\"$ASSIGNEE_ID\",\"dueDate\":\"2026-06-01\"}")
  ok "Create CAPA from NCR" "$(CO "$RR")"
  CAPA_ID=$(BO "$RR" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
  has "CAPA auto-numbered" "CAPA-2026" "$(BO "$RR")"

  if [ -n "$CAPA_ID" ]; then
    # Status progression
    ok "CAPA → in_progress" "$(CO "$(PA "/capa/$CAPA_ID" "$TQ" '{"status":"in_progress"}')")"
    ok "CAPA → implemented" "$(CO "$(PA "/capa/$CAPA_ID" "$TQ" '{"status":"implemented","actionTaken":"Fixed"}')")"
    ok "CAPA → verification" "$(CO "$(PA "/capa/$CAPA_ID" "$TQ" '{"status":"verification"}')")"
    ok "CAPA → effective" "$(CO "$(PA "/capa/$CAPA_ID" "$TQ" '{"status":"effective","effectiveResult":"effective"}')")"

    # Immutability
    bl "Closed CAPA immutable" "$(CO "$(PA "/capa/$CAPA_ID" "$TQ" '{"title":"hack"}')")"
  fi
fi

echo -e "${Y}NCR → RCA → CAPA chain${N}"
if [ -n "$NCR_ID" ]; then
  ok "NCR → RCA endpoint" "$(CO "$(GE "/quality/ncr/$NCR_ID/rca" "$TQ")")"
  has "RCA has fiveWhy" "fiveWhy" "$(BO "$(GE "/quality/ncr/$NCR_ID/rca" "$TQ")")"
  ok "NCR → CAPAs endpoint" "$(CO "$(GE "/quality/ncr/$NCR_ID/capas" "$TQ")")"

  # Start 5-Why from NCR
  RR=$(PO "/rca/five-why" "$TQ" "{\"title\":\"RCA for test NCR\",\"ncrId\":\"$NCR_ID\"}")
  ok "Start 5-Why from NCR" "$(CO "$RR")"
fi

echo -e "${Y}CAPA Permissions${N}"
bl "Operator cannot create CAPA" "$(CO "$(PO "/capa" "$TO" '{"type":"corrective","title":"x","description":"x","assigneeId":"x","dueDate":"2026-06-01"}')")"
ok "Operator can view CAPA list" "$(CO "$(GE "/capa" "$TO")")"

# ═══ 3. REASON CODES ADMIN ═══════════════════════════════════════
echo -e "\n${C}═══ 3. REASON CODES ADMIN ═══${N}"

echo -e "${Y}CRUD${N}"
ok "List all reason codes" "$(CO "$(GE "/shopfloor/reason-codes/all" "$TS")")"

# Create a new code
RR=$(PO "/shopfloor/reason-codes" "$TS" '{"category":"breakdown","code":"TEST","label":"Test reason","color":"#ef4444","workstationTypes":"[\"machine\"]"}')
ok "Create reason code" "$(CO "$RR")"
RC_ID=$(BO "$RR" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

if [ -n "$RC_ID" ]; then
  # Update
  ok "Update reason code" "$(CO "$(PA "/shopfloor/reason-codes/$RC_ID" "$TS" '{"label":"Updated test reason"}')")"

  # Toggle active
  ok "Toggle inactive" "$(CO "$(PA "/shopfloor/reason-codes/$RC_ID" "$TS" '{"isActive":false}')")"

  # Delete
  ok "Delete reason code" "$(CO "$(DE "/shopfloor/reason-codes/$RC_ID" "$TS")")"
fi

echo -e "${Y}Workstation Type Filtering${N}"
# Create codes for specific types
PO "/shopfloor/reason-codes" "$TS" '{"category":"breakdown","code":"MACH1","label":"Machine-only code","workstationTypes":"[\"machine\"]"}' > /dev/null 2>&1
PO "/shopfloor/reason-codes" "$TS" '{"category":"breakdown","code":"MAN1","label":"Manual-only code","workstationTypes":"[\"manual\"]"}' > /dev/null 2>&1
PO "/shopfloor/reason-codes" "$TS" '{"category":"breakdown","code":"ALL1","label":"All types code"}' > /dev/null 2>&1

# Fetch for machine type — should see MACH1 + ALL1, not MAN1
RR=$(GE "/shopfloor/reason-codes?category=breakdown&workstationType=machine" "$TO")
ok "Reason codes for machine type" "$(CO "$RR")"
has "Machine code visible" "MACH1\|Machine-only" "$(BO "$RR")"

# Fetch for manual type — should see MAN1 + ALL1, not MACH1
RR=$(GE "/shopfloor/reason-codes?category=breakdown&workstationType=manual" "$TO")
ok "Reason codes for manual type" "$(CO "$RR")"
has "Manual code visible" "MAN1\|Manual-only" "$(BO "$RR")"

echo -e "${Y}Permissions${N}"
bl "Operator cannot manage reason codes" "$(CO "$(GE "/shopfloor/reason-codes/all" "$TO")")"
bl "Floor cannot manage reason codes" "$(CO "$(GE "/shopfloor/reason-codes/all" "$TF")")"

# Cleanup test codes
for code_id in $(curl -s "$BASE/shopfloor/reason-codes/all" -H "Authorization: Bearer $TS" | python3 -c "import sys,json; [print(c['id']) for c in json.load(sys.stdin) if c['code'] in ['MACH1','MAN1','ALL1','TEST']]" 2>/dev/null); do
  curl -s -X DELETE "$BASE/shopfloor/reason-codes/$code_id" -H "Authorization: Bearer $TS" > /dev/null 2>&1
done

# ═══ 4. SHOP FLOOR IMPROVEMENTS ══════════════════════════════════
echo -e "\n${C}═══ 4. SHOP FLOOR ═══${N}"

echo -e "${Y}Close Run with completePo flag${N}"
# Start a run
RR=$(GE "/shopfloor/workstation/$(curl -s "$BASE/workstations" -H "Authorization: Bearer $TO" | python3 -c "import sys,json; d=json.load(sys.stdin); ws=d if isinstance(d,list) else d.get('data',[]); print(ws[0]['id'] if ws else '')" 2>/dev/null)/pos" "$TO")
ok "Get available POs" "$(CO "$RR")"

echo -e "${Y}Logout button${N}"
TOTAL=$((TOTAL+1))
if grep -q "LogOut" /home/csg/repos/experiments/leanpilot-v4/apps/web/src/app/\(shopfloor\)/shopfloor/page.tsx; then
  echo -e "  ${G}✓${N} Logout button in shopfloor header"; PASS=$((PASS+1))
else
  echo -e "  ${R}✗${N} Logout button missing"; FAIL=$((FAIL+1))
fi

echo -e "${Y}End Shift options${N}"
TOTAL=$((TOTAL+1))
if grep -q "closePoClosed" /home/csg/repos/experiments/leanpilot-v4/apps/web/src/app/\(shopfloor\)/shopfloor/page.tsx; then
  echo -e "  ${G}✓${N} Two end-shift options (PO open / PO complete)"; PASS=$((PASS+1))
else
  echo -e "  ${R}✗${N} Missing PO open/close options"; FAIL=$((FAIL+1))
fi

echo -e "${Y}Elapsed time fix${N}"
TOTAL=$((TOTAL+1))
if grep -q "ms < 0.*0m" /home/csg/repos/experiments/leanpilot-v4/apps/web/src/app/\(shopfloor\)/shopfloor/page.tsx; then
  echo -e "  ${G}✓${N} Negative elapsed time clamped to 0m"; PASS=$((PASS+1))
else
  echo -e "  ${R}✗${N} Elapsed time fix missing"; FAIL=$((FAIL+1))
fi

# ═══ 5. DEMO DATA ════════════════════════════════════════════════
echo -e "\n${C}═══ 5. DEMO DATA ═══${N}"

echo -e "${Y}Dashboard has data${N}"
RR=$(GE "/dashboard/overview" "$TM")
ok "Dashboard overview" "$(CO "$RR")"
has "Has production data" "totalProduced" "$(BO "$RR")"

echo -e "${Y}5S audits exist${N}"
RR=$(GE "/tools/five-s" "$TM")
ok "5S list" "$(CO "$RR")"
has "Has audit data" "Assembly\|Machining\|Finishing" "$(BO "$RR")"

echo -e "${Y}Safety incidents exist${N}"
RR=$(GE "/safety/incidents" "$TM")
ok "Safety list" "$(CO "$RR")"

echo -e "${Y}Quality data${N}"
RR=$(GE "/quality/ncr" "$TQ")
ok "NCR list" "$(CO "$RR")"

echo -e "${Y}Kaizen ideas${N}"
RR=$(GE "/tools/kaizen" "$TO")
ok "Kaizen list" "$(CO "$RR")"

echo -e "${Y}Gemba walk${N}"
RR=$(GE "/gemba" "$TM")
ok "Gemba list" "$(CO "$RR")"

echo -e "${Y}OEE has data${N}"
RR=$(GE "/dashboard/oee" "$TM")
ok "OEE endpoint" "$(CO "$RR")"

echo -e "${Y}CAPA from seed${N}"
RR=$(GE "/capa" "$TQ")
ok "CAPA list" "$(CO "$RR")"

# ═══ 6. EQUIPMENT MANAGEMENT ════════════════════════════════════
echo -e "\n${C}═══ 6. EQUIPMENT MANAGEMENT ═══${N}"

echo -e "${Y}Add Workstation${N}"
TOTAL=$((TOTAL+1))
if grep -q "createWorkstation\|Add Workstation" /home/csg/repos/experiments/leanpilot-v4/apps/web/src/app/\(dashboard\)/equipment/page.tsx; then
  echo -e "  ${G}✓${N} Add Workstation button exists"; PASS=$((PASS+1))
else
  echo -e "  ${R}✗${N} Add Workstation missing"; FAIL=$((FAIL+1))
fi

RR=$(PO "/workstations" "$TS" "{\"name\":\"Test WS $(date +%s)\",\"code\":\"TST-$(date +%s | tail -c 4)\",\"type\":\"machine\",\"area\":\"Testing\"}")
ok "Create workstation via API" "$(CO "$RR")"

# ═══ RESULTS ══════════════════════════════════════════════════════
echo -e "\n${B}${C}╔═══════════════════════════════════════════════════════╗${N}"
echo -e "${B}${C}║                    RESULTS                              ║${N}"
echo -e "${B}${C}╠═══════════════════════════════════════════════════════╣${N}"
echo -e "${B}  ${G}PASSED:  $PASS${N}"
echo -e "${B}  ${R}FAILED:  $FAIL${N}"
echo -e "${B}  TOTAL:   $TOTAL${N}"
PCT=$((PASS * 100 / TOTAL))
echo -e "${B}  RATE:    ${PCT}%${N}"
echo -e "${B}${C}╚═══════════════════════════════════════════════════════╝${N}\n"

[ $FAIL -gt 0 ] && exit 1 || echo -e "${G}ALL CLEAR${N}\n"
