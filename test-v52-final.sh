#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# LeanPilot v5.2 FINAL — COMPLETE AUDIT + CAPA + RCA
# ═══════════════════════════════════════════════════════════════════

BASE="http://localhost:3001/api"
PASS=0; FAIL=0; TOTAL=0
SRC="/home/csg/repos/experiments/leanpilot-v4"

R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; C='\033[0;36m'; B='\033[1m'; N='\033[0m'

ok()  { TOTAL=$((TOTAL+1)); if echo "200 201 202" | grep -qw "$2"; then echo -e "  ${G}✓${N} $1"; PASS=$((PASS+1)); else echo -e "  ${R}✗${N} $1 (got $2)"; FAIL=$((FAIL+1)); fi; }
bl()  { TOTAL=$((TOTAL+1)); if echo "401 403" | grep -qw "$2"; then echo -e "  ${G}✓${N} $1"; PASS=$((PASS+1)); else echo -e "  ${R}✗${N} $1 (got $2)"; FAIL=$((FAIL+1)); fi; }
eq()  { TOTAL=$((TOTAL+1)); if [ "$2" = "$3" ]; then echo -e "  ${G}✓${N} $1"; PASS=$((PASS+1)); else echo -e "  ${R}✗${N} $1 (exp=$2 got=$3)"; FAIL=$((FAIL+1)); fi; }
has() { TOTAL=$((TOTAL+1)); if echo "$3" | grep -q "$2"; then echo -e "  ${G}✓${N} $1"; PASS=$((PASS+1)); else echo -e "  ${R}✗${N} $1"; FAIL=$((FAIL+1)); fi; }
no()  { TOTAL=$((TOTAL+1)); if echo "$3" | grep -q "$2"; then echo -e "  ${R}✗${N} $1"; FAIL=$((FAIL+1)); else echo -e "  ${G}✓${N} $1"; PASS=$((PASS+1)); fi; }
fe()  { TOTAL=$((TOTAL+1)); if [ -f "$1" ]; then echo -e "  ${G}✓${N} $2"; PASS=$((PASS+1)); else echo -e "  ${R}✗${N} $2"; FAIL=$((FAIL+1)); fi; }

L() { sleep 0.15; curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"password123\"}"; }
T() { echo "$1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null; }
GE() { curl -s -w "\n%{http_code}" "$BASE$1" -H "Authorization: Bearer $2"; }
PO() { curl -s -w "\n%{http_code}" "$BASE$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3"; }
PA() { curl -s -w "\n%{http_code}" -X PATCH "$BASE$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3"; }
CO() { echo "$1" | tail -1; }
BO() { echo "$1" | sed '$d'; }

echo -e "\n${B}${C}╔════════════════════════════════════════════════════════╗${N}"
echo -e "${B}${C}║  LEANPILOT v5.2 FINAL AUDIT — $(date +%Y-%m-%d %H:%M)      ║${N}"
echo -e "${B}${C}╚════════════════════════════════════════════════════════╝${N}"

# ═══ 1. HEALTH ═════════════════════════════════════════════════════
echo -e "\n${C}═══ 1. HEALTH & INFRASTRUCTURE ═══${N}"
H=$(curl -s "$BASE/health")
has "Health: ok" "\"ok\"" "$H"
has "Health: DB connected" "connected" "$H"
ok "Health: public (no auth)" "$(CO "$(curl -s -w "\n%{http_code}" "$BASE/health")")"

# ═══ 2. AUTH ═══════════════════════════════════════════════════════
echo -e "\n${C}═══ 2. AUTHENTICATION (8 roles) ═══${N}"
TA=$(T "$(L admin@leanpilot.me)")
TS=$(T "$(L site.admin@leanpilot.me)")
TM=$(T "$(L manager@leanpilot.me)")
TQ=$(T "$(L quality@leanpilot.me)")
TSH=$(T "$(L shift.leader@leanpilot.me)")
TO=$(T "$(L operator1@leanpilot.me)")
TF=$(T "$(L floor@leanpilot.me)")
TV=$(T "$(L viewer@leanpilot.me)")

for v in TA TS TM TQ TSH TO TF TV; do
  eq "Login: ${v}" "true" "$([ -n "${!v}" ] && echo true || echo false)"
done

echo -e "\n${Y}Password Reset${N}"
ok "Forgot password" "$(CO "$(PO "/auth/forgot-password" "" '{"email":"admin@leanpilot.me"}')")"
eq "Invalid reset token → 401" "401" "$(CO "$(PO "/auth/reset-password" "" '{"token":"bad","password":"x"}')")"

# ═══ 3. PERMISSIONS ═══════════════════════════════════════════════
echo -e "\n${C}═══ 3. PERMISSION MATRIX ═══${N}"

echo -e "${Y}Floor Operator${N}"
ok "Floor → shopfloor" "$(CO "$(GE "/shopfloor/reason-codes?category=breakdown" "$TF")")"
bl "Floor → quality" "$(CO "$(GE "/quality/templates" "$TF")")"
bl "Floor → 5S" "$(CO "$(GE "/tools/five-s" "$TF")")"
bl "Floor → gemba" "$(CO "$(GE "/gemba" "$TF")")"
ok "Floor → safety (compliance)" "$(CO "$(GE "/safety/incidents" "$TF")")"
ok "Floor → dashboard" "$(CO "$(GE "/dashboard/overview" "$TF")")"

echo -e "${Y}Operator${N}"
ok "Op → 5S" "$(CO "$(GE "/tools/five-s" "$TO")")"
ok "Op → kaizen" "$(CO "$(GE "/tools/kaizen" "$TO")")"
ok "Op → shopfloor" "$(CO "$(GE "/shopfloor/reason-codes?category=breakdown" "$TO")")"

echo -e "${Y}Quality Engineer${N}"
ok "Qual → quality" "$(CO "$(GE "/quality/templates" "$TQ")")"
ok "Qual → root cause" "$(CO "$(GE "/rca/five-why" "$TQ")")"
ok "Qual → CAPA" "$(CO "$(GE "/capa" "$TQ")")"
bl "Qual → shopfloor" "$(CO "$(GE "/shopfloor/reason-codes?category=breakdown" "$TQ")")"

echo -e "${Y}Shift Leader${N}"
ok "Shift → shopfloor" "$(CO "$(GE "/shopfloor/reason-codes?category=breakdown" "$TSH")")"
ok "Shift → shift handover" "$(CO "$(GE "/dashboard/shift-handover" "$TSH")")"
ok "Shift → 5S" "$(CO "$(GE "/tools/five-s" "$TSH")")"

echo -e "${Y}Site Admin bypass${N}"
ok "Admin → quality" "$(CO "$(GE "/quality/templates" "$TS")")"
ok "Admin → CAPA" "$(CO "$(GE "/capa" "$TS")")"
ok "Admin → roles" "$(CO "$(GE "/roles" "$TS")")"
ok "Admin → escalation" "$(CO "$(GE "/escalation" "$TS")")"

echo -e "${Y}Safety compliance floor (ALL)${N}"
for T in "$TF" "$TO" "$TV" "$TSH" "$TQ" "$TM"; do
  RR=$(PO "/safety/incidents" "$T" "{\"type\":\"near_miss\",\"location\":\"X\",\"title\":\"Audit $(date +%s%N)\",\"description\":\"X\"}")
  ok "Safety report" "$(CO "$RR")"
done

# ═══ 4. DATA FLOW ═════════════════════════════════════════════════
echo -e "\n${C}═══ 4. DATA FLOW — CORE TOOLS ═══${N}"

echo -e "${Y}5S Audit${N}"
RR=$(PO "/tools/five-s" "$TO" '{"area":"Final Audit Area"}')
ok "Create 5S audit" "$(CO "$RR")"

echo -e "${Y}Kaizen${N}"
RR=$(PO "/tools/kaizen" "$TO" '{"title":"Audit kaizen idea","problem":"Test","proposedSolution":"Test","expectedImpact":"low","area":"Test"}')
ok "Submit kaizen" "$(CO "$RR")"

echo -e "${Y}Safety → Investigation${N}"
RR=$(PO "/safety/incidents" "$TF" '{"type":"near_miss","location":"Line A","title":"Audit incident","description":"Test"}')
ok "Floor reports incident" "$(CO "$RR")"
IID=$(BO "$RR" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
[ -n "$IID" ] && {
  bl "Floor cannot investigate" "$(CO "$(PA "/safety/incidents/$IID" "$TF" '{"status":"investigating"}')")"
  ok "Manager investigates" "$(CO "$(PA "/safety/incidents/$IID" "$TM" '{"status":"investigating"}')")"
}

echo -e "${Y}Quality: Template → Inspection${N}"
RR=$(PO "/quality/templates" "$TQ" '{"name":"Audit Template Final","checkpoints":[{"sequence":1,"description":"Dim check","measurementType":"measurement","lowerLimit":9.9,"upperLimit":10.1,"targetValue":10.0}]}')
ok "Create quality template" "$(CO "$RR")"
bl "Operator cannot create template" "$(CO "$(PO "/quality/templates" "$TO" '{"name":"x","checkpoints":[]}')")"

echo -e "${Y}Quality: NCR → RCA → CAPA (FULL CHAIN)${N}"
# Create NCR
RR=$(PO "/quality/ncr" "$TQ" '{"severity":"major","description":"Hardness below spec on batch 47"}')
ok "Create NCR" "$(CO "$RR")"
NID=$(BO "$RR" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
[ -n "$NID" ] && {
  # Check RCA endpoint for NCR
  RR=$(GE "/quality/ncr/$NID/rca" "$TQ")
  ok "NCR → RCA endpoint" "$(CO "$RR")"
  has "RCA has fiveWhy array" "fiveWhy" "$(BO "$RR")"

  # Start 5-Why from NCR
  RR=$(PO "/rca/five-why" "$TQ" "{\"title\":\"RCA for NCR hardness\",\"ncrId\":\"$NID\"}")
  ok "Start 5-Why from NCR" "$(CO "$RR")"

  # Check CAPA endpoint for NCR
  RR=$(GE "/quality/ncr/$NID/capas" "$TQ")
  ok "NCR → CAPAs endpoint" "$(CO "$RR")"

  # Create CAPA from NCR
  sleep 0.3
  QU=$(BO "$(GE "/users" "$TS")")
  ASSIGNEE=$(echo "$QU" | python3 -c "import sys,json; d=json.load(sys.stdin); users=d if isinstance(d,list) else d.get('data',[]); print(users[0]['id'] if users else '')" 2>/dev/null)
  RR=$(PO "/capa" "$TQ" "{\"ncrId\":\"$NID\",\"type\":\"corrective\",\"title\":\"CAPA for hardness NCR\",\"description\":\"Replace tooling\",\"assigneeId\":\"$ASSIGNEE\",\"dueDate\":\"2026-05-01\"}")
  ok "Create CAPA from NCR" "$(CO "$RR")"
  CID=$(BO "$RR" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

  [ -n "$CID" ] && {
    has "CAPA has auto-number" "CAPA-2026" "$(BO "$RR")"
    # Advance CAPA status
    ok "CAPA → in_progress" "$(CO "$(PA "/capa/$CID" "$TQ" '{"status":"in_progress"}')")"
    ok "CAPA → implemented" "$(CO "$(PA "/capa/$CID" "$TQ" '{"status":"implemented","actionTaken":"Replaced tool insert"}')")"
    ok "CAPA → verification" "$(CO "$(PA "/capa/$CID" "$TQ" '{"status":"verification","verificationMethod":"Check next 5 batches"}')")"
    ok "CAPA → effective" "$(CO "$(PA "/capa/$CID" "$TQ" '{"status":"effective","effectivenessCheck":"5 batches passed","effectiveResult":"effective"}')")"

    # Verify immutability
    RR=$(PA "/capa/$CID" "$TQ" '{"title":"hack"}')
    eq "Closed CAPA immutable" "400" "$(CO "$RR")"
  }

  # NCR immutability
  PA "/quality/ncr/$NID" "$TQ" '{"status":"closed"}' > /dev/null 2>&1; sleep 0.2
  eq "Closed NCR immutable" "400" "$(CO "$(PA "/quality/ncr/$NID" "$TQ" '{"rootCause":"hack"}')")"
}

echo -e "${Y}CAPA Summary${N}"
RR=$(GE "/capa/summary" "$TQ")
ok "CAPA summary endpoint" "$(CO "$RR")"

echo -e "${Y}Orders${N}"
ok "View orders" "$(CO "$(GE "/orders" "$TO")")"
bl "Operator cannot create" "$(CO "$(PO "/orders" "$TO" '{"poNumber":"X","productName":"X","targetQuantity":1,"unit":"pcs"}')")"
ok "Manager creates" "$(CO "$(PO "/orders" "$TM" "{\"poNumber\":\"AUD-$(date +%s)\",\"productName\":\"Test\",\"targetQuantity\":50,\"unit\":\"pcs\",\"priority\":\"normal\",\"status\":\"released\",\"dueDate\":\"2026-12-31\"}")")"

echo -e "${Y}Dashboard aggregation${N}"
ok "Dashboard overview" "$(CO "$(GE "/dashboard/overview" "$TM")")"
ok "OEE" "$(CO "$(GE "/dashboard/oee" "$TM")")"
ok "Pareto" "$(CO "$(GE "/dashboard/pareto" "$TM")")"
ok "Shift handover" "$(CO "$(GE "/dashboard/shift-handover" "$TSH")")"

echo -e "${Y}Multi-tenant isolation${N}"
TB=$(T "$(L belgrade.operator@leanpilot.me)")
RR=$(GE "/tools/five-s" "$TB")
ok "Belgrade → 5S" "$(CO "$RR")"
no "Belgrade no Milan data" "Final Audit Area" "$(BO "$RR")"

# ═══ 5. COMPLIANCE ═════════════════════════════════════════════════
echo -e "\n${C}═══ 5. GDPR / ZZLP / ISO COMPLIANCE ═══${N}"

echo -e "${Y}Audit Logging (GDPR Art. 30)${N}"
sleep 1
TAA=$(T "$(L admin@leanpilot.me)")
RR=$(GE "/audit?limit=3" "$TAA")
ok "Audit log accessible" "$(CO "$RR")"
has "Audit has entries" "logs" "$(BO "$RR")"
ASVC=$(cat "$SRC/apps/api/src/audit/audit.service.ts" 2>/dev/null)
no "No update in audit" "\.update(" "$ASVC"
no "No delete in audit" "\.delete(" "$ASVC"
has "Audit append-only" "\.create(" "$ASVC"

echo -e "${Y}Data Minimization (GDPR Art. 5)${N}"
RR=$(L "operator1@leanpilot.me")
no "No password in login" "\"password\"" "$RR"

echo -e "${Y}Record Immutability (ISO 9001 / 45001)${N}"
has "5S immutable check" "Cannot edit a completed audit" "$(cat "$SRC/apps/api/src/tools/five-s/five-s.service.ts" 2>/dev/null)"
has "NCR immutable check" "Cannot modify a closed NCR" "$(cat "$SRC/apps/api/src/quality/quality.service.ts" 2>/dev/null)"
has "Safety immutable check" "Cannot modify a closed safety" "$(cat "$SRC/apps/api/src/safety/safety.service.ts" 2>/dev/null)"

echo -e "${Y}CAPA Immutability${N}"
has "CAPA immutable check" "immutable" "$(cat "$SRC/apps/api/src/capa/capa.service.ts" 2>/dev/null)"

echo -e "${Y}No external data processors (ZZLP)${N}"
PKG=$(cat "$SRC/apps/web/package.json" 2>/dev/null)
no "No Google Analytics" "google-analytics" "$PKG"
no "No Sentry" "sentry" "$PKG"
no "No Mixpanel" "mixpanel" "$PKG"

# ═══ 6. SECURITY ═══════════════════════════════════════════════════
echo -e "\n${C}═══ 6. SECURITY ═══${N}"
has "Helmet.js" "helmet" "$(cat "$SRC/apps/api/src/main.ts" 2>/dev/null)"
has "CSP headers" "contentSecurityPolicy" "$(cat "$SRC/apps/api/src/main.ts" 2>/dev/null)"
has "Prisma ORM" "PrismaService" "$(grep -r PrismaService "$SRC/apps/api/src/quality/quality.service.ts" 2>/dev/null)"
has "Throttler" "ThrottlerGuard" "$(cat "$SRC/apps/api/src/app.module.ts" 2>/dev/null)"
has "CORS restricted" "production" "$(grep -A5 enableCors "$SRC/apps/api/src/main.ts" 2>/dev/null)"
no "No .env in git" "^\.env$" "$(git -C "$SRC" ls-files 2>/dev/null)"

# ═══ 7. ESCALATION ═════════════════════════════════════════════════
echo -e "\n${C}═══ 7. ESCALATION ENGINE ═══${N}"
RR=$(GE "/escalation" "$TS")
ok "Escalation rules" "$(CO "$RR")"
has "Breakdown L1" "Breakdown L1" "$(BO "$RR")"
has "Safety Critical" "Safety Critical" "$(BO "$RR")"
bl "Operator blocked" "$(CO "$(GE "/escalation" "$TO")")"

# ═══ 8. EMAIL ══════════════════════════════════════════════════════
echo -e "\n${C}═══ 8. EMAIL SERVICE ═══${N}"
ESVC=$(cat "$SRC/apps/api/src/email/email.service.ts" 2>/dev/null)
has "Nodemailer" "nodemailer" "$ESVC"
has "Password reset template" "sendPasswordReset" "$ESVC"
has "Escalation template" "sendEscalationAlert" "$ESVC"

# ═══ 9. PWA ════════════════════════════════════════════════════════
echo -e "\n${C}═══ 9. PWA & OFFLINE ═══${N}"
fe "$SRC/apps/web/public/manifest.json" "PWA manifest"
fe "$SRC/apps/web/public/sw.js" "Service worker"
has "Standalone" "standalone" "$(cat "$SRC/apps/web/public/manifest.json" 2>/dev/null)"
has "IndexedDB queue" "indexedDB" "$(cat "$SRC/apps/web/public/sw.js" 2>/dev/null)"

# ═══ 10. ANALYTICS ═════════════════════════════════════════════════
echo -e "\n${C}═══ 10. ANALYTICS ═══${N}"
ok "OEE trend" "$(CO "$(GE "/dashboard/oee-trend?period=7d" "$TM")")"
ok "5S trends" "$(CO "$(GE "/tools/five-s/trends?months=6" "$TM")")"
ok "Safety trends" "$(CO "$(GE "/safety/trends?months=12" "$TM")")"
ok "Gemba waste pareto" "$(CO "$(GE "/gemba/waste-pareto?months=3" "$TM")")"

# ═══ 11. EXPORT ════════════════════════════════════════════════════
echo -e "\n${C}═══ 11. EXPORT & TOOLS ═══${N}"
fe "$SRC/apps/web/src/lib/csv-export.ts" "CSV export"
fe "$SRC/apps/web/src/components/ui/PhotoCapture.tsx" "Camera capture"
fe "$SRC/apps/web/src/app/(dashboard)/admin/tools/page.tsx" "Tool chooser"

# ═══ 12. DEPLOYMENT ════════════════════════════════════════════════
echo -e "\n${C}═══ 12. DEPLOYMENT ═══${N}"
fe "$SRC/docker/Dockerfile.api" "API Dockerfile"
fe "$SRC/docker/Dockerfile.web" "Web Dockerfile"
fe "$SRC/docker/docker-compose.prod.yml" "Prod compose"
fe "$SRC/scripts/backup.sh" "Backup script"
fe "$SRC/scripts/restore.sh" "Restore script"
fe "$SRC/scripts/monitor.sh" "Monitor script"
fe "$SRC/.github/workflows/ci.yml" "CI/CD pipeline"
MIG=$(ls -d "$SRC/apps/api/prisma/migrations/"*/ 2>/dev/null | wc -l)
TOTAL=$((TOTAL+1)); if [ "$MIG" -ge 7 ]; then echo -e "  ${G}✓${N} $MIG migrations"; PASS=$((PASS+1)); else echo -e "  ${R}✗${N} Only $MIG migrations"; FAIL=$((FAIL+1)); fi

# ═══ 13. CODE QUALITY ══════════════════════════════════════════════
echo -e "\n${C}═══ 13. CODE QUALITY ═══${N}"
TOTAL=$((TOTAL+1))
TS_ERR=$(cd "$SRC/apps/api" && npx tsc --noEmit 2>&1 | grep -c "error TS" 2>/dev/null || echo "0")
if [ "$TS_ERR" = "0" ]; then echo -e "  ${G}✓${N} Zero TS errors"; PASS=$((PASS+1)); else echo -e "  ${R}✗${N} $TS_ERR TS errors"; FAIL=$((FAIL+1)); fi

TOTAL=$((TOTAL+1))
TEST_OUT=$(cd "$SRC/apps/api" && npx jest --no-cache 2>&1)
if echo "$TEST_OUT" | grep -q "49 passed"; then echo -e "  ${G}✓${N} 49/49 tests"; PASS=$((PASS+1)); else echo -e "  ${R}✗${N} Tests failed"; FAIL=$((FAIL+1)); fi

# ═══ RESULTS ═══════════════════════════════════════════════════════
echo -e "\n${B}${C}╔════════════════════════════════════════════════════════╗${N}"
echo -e "${B}${C}║                    FINAL RESULTS                        ║${N}"
echo -e "${B}${C}╠════════════════════════════════════════════════════════╣${N}"
echo -e "${B}  ${G}PASSED:  $PASS${N}"
echo -e "${B}  ${R}FAILED:  $FAIL${N}"
echo -e "${B}  TOTAL:   $TOTAL${N}"
PCT=$((PASS * 100 / TOTAL))
echo -e "${B}  RATE:    ${PCT}%${N}"
echo -e "${B}${C}╚════════════════════════════════════════════════════════╝${N}\n"

[ $FAIL -gt 0 ] && echo -e "${R}$FAIL issues to resolve${N}\n" && exit 1 || echo -e "${G}ALL CLEAR — v5.2 production ready${N}\n"
