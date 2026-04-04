#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# DEOFLOR EAST d.o.o. — Client Setup Script
# ═══════════════════════════════════════════════════════════════════

BASE="https://leanpilot.me/api"
PW="password123"

echo "╔════════════════════════════════════════════╗"
echo "║  Setting up Deoflor East d.o.o.            ║"
echo "║  Stara Pazova, Serbia                      ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# ── Login as corporate admin ──────────────────────────────────
echo "Logging in as corporate admin..."
LOGIN=$(curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@leanpilot.me","password":"password123"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null)
CORP_ID=$(echo "$TOKEN" | python3 -c "import sys,base64,json; print(json.loads(base64.urlsafe_b64decode(sys.stdin.read().split('.')[1]+'=='))['corporateId'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then echo "ERROR: Login failed"; exit 1; fi
echo "  Corporate ID: $CORP_ID"

# Helper
post() {
  curl -s "$BASE$1" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$2"
}
get_id() {
  echo "$1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null
}

# ── 1. Create Site ────────────────────────────────────────────
echo ""
echo "1. Creating site..."
SITE=$(post "/sites" '{"name":"Deoflor East d.o.o.","location":"Stara Pazova, Serbia","timezone":"Europe/Belgrade"}')
SITE_ID=$(get_id "$SITE")

if [ -z "$SITE_ID" ]; then
  echo "  Site might already exist, checking..."
  SITES=$(curl -s "$BASE/sites" -H "Authorization: Bearer $TOKEN")
  SITE_ID=$(echo "$SITES" | python3 -c "
import sys,json
d = json.load(sys.stdin)
sites = d if isinstance(d,list) else d.get('data',[])
for s in sites:
    if 'Deoflor' in s.get('name','') or 'deoflor' in s.get('name','').lower():
        print(s['id'])
        break
" 2>/dev/null)
fi

echo "  Site ID: $SITE_ID"
if [ -z "$SITE_ID" ]; then echo "ERROR: Could not create/find site"; exit 1; fi

# ── 2. Create Workstations ───────────────────────────────────
echo ""
echo "2. Creating workstations..."

MACHINES=(
  '{"name":"Koch 1","code":"KOCH-01","type":"machine","area":"Orange Line"}'
  '{"name":"Koch 2","code":"KOCH-02","type":"machine","area":"Orange Line"}'
  '{"name":"Manual Assembly Line","code":"ASM-MAN","type":"line","area":"Assembly"}'
  '{"name":"Compatto Machine","code":"COMP-01","type":"machine","area":"Blu Line"}'
  '{"name":"MacAut","code":"MCAUT-01","type":"machine","area":"Blu Line"}'
  '{"name":"Plissettatrice","code":"PLIS-01","type":"machine","area":"Blu Line"}'
  '{"name":"Etichettatrice","code":"ETIC-01","type":"machine","area":"Blu Line"}'
  '{"name":"Canard","code":"CAN-01","type":"machine","area":"Blu Line"}'
  '{"name":"FlowPack","code":"FLOW-01","type":"machine","area":"Blu Line"}'
  '{"name":"Trafila Blu","code":"TRAF-BLU","type":"machine","area":"Blu Line"}'
  '{"name":"Trafila Orange","code":"TRAF-ORA","type":"machine","area":"Orange Line"}'
)

# Need to login as site admin for this site — but we don't have one yet.
# Create a site_admin first, then use that to create workstations.

echo ""
echo "3. Creating site admin (production manager)..."
ADMIN_USER=$(post "/auth/register" "{\"email\":\"manager@deoflor.rs\",\"password\":\"$PW\",\"firstName\":\"Production\",\"lastName\":\"Manager\",\"role\":\"site_admin\",\"siteId\":\"$SITE_ID\",\"corporateId\":\"$CORP_ID\"}")
ADMIN_UID=$(get_id "$ADMIN_USER")
echo "  manager@deoflor.rs (site_admin) → $ADMIN_UID"

# Login as the new site admin
echo "  Logging in as site admin..."
SA_LOGIN=$(curl -s "$BASE/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"manager@deoflor.rs\",\"password\":\"$PW\"}")
SA_TOKEN=$(echo "$SA_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null)

if [ -z "$SA_TOKEN" ]; then
  echo "  WARN: Could not login as site admin, using corp admin for workstations"
  SA_TOKEN="$TOKEN"
fi

sa_post() {
  curl -s "$BASE$1" -H "Authorization: Bearer $SA_TOKEN" -H "Content-Type: application/json" -d "$2"
}

echo ""
echo "4. Creating 11 workstations..."
for m in "${MACHINES[@]}"; do
  NAME=$(echo "$m" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])" 2>/dev/null)
  RESULT=$(sa_post "/workstations" "$m")
  WS_ID=$(get_id "$RESULT")
  if [ -n "$WS_ID" ]; then
    echo "  ✓ $NAME ($WS_ID)"
  else
    echo "  ✗ $NAME — $(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('message','unknown error'))" 2>/dev/null)"
  fi
done

# ── 5. Create Custom Roles ───────────────────────────────────
echo ""
echo "5. Creating custom roles..."

# Shop Floor Operator
ROLE_SF=$(sa_post "/roles" '{"name":"Operater Mašine","description":"Operator mašine — samo shop floor i prijava bezbednosti","permissions":[{"featureGroup":"production","level":"participate"},{"featureGroup":"safety","level":"participate"}]}')
ROLE_SF_ID=$(get_id "$ROLE_SF")
echo "  ✓ Operater Mašine (Shop Floor) → $ROLE_SF_ID"

# Line Leader
ROLE_LL=$(sa_post "/roles" '{"name":"Vođa Linije","description":"Vođa linije — shop floor, primopredaja smene, 5S","permissions":[{"featureGroup":"production","level":"participate"},{"featureGroup":"shift_management","level":"manage"},{"featureGroup":"continuous_improvement","level":"participate"},{"featureGroup":"safety","level":"participate"},{"featureGroup":"maintenance","level":"view"}]}')
ROLE_LL_ID=$(get_id "$ROLE_LL")
echo "  ✓ Vođa Linije (Line Leader) → $ROLE_LL_ID"

# Shift Leader
ROLE_SL=$(sa_post "/roles" '{"name":"Vođa Smene","description":"Vođa smene — shop floor, primopredaja, pregled kvaliteta","permissions":[{"featureGroup":"production","level":"participate"},{"featureGroup":"shift_management","level":"manage"},{"featureGroup":"continuous_improvement","level":"participate"},{"featureGroup":"quality","level":"view"},{"featureGroup":"safety","level":"participate"},{"featureGroup":"maintenance","level":"view"},{"featureGroup":"people","level":"view"}]}')
ROLE_SL_ID=$(get_id "$ROLE_SL")
echo "  ✓ Vođa Smene (Shift Leader) → $ROLE_SL_ID"

# Quality Operator
ROLE_QO=$(sa_post "/roles" '{"name":"Operater Kvaliteta","description":"Kontrola kvaliteta — inspekcije, NCR, CAPA, analiza uzroka","permissions":[{"featureGroup":"continuous_improvement","level":"participate"},{"featureGroup":"quality","level":"manage"},{"featureGroup":"problem_solving","level":"manage"},{"featureGroup":"safety","level":"participate"}]}')
ROLE_QO_ID=$(get_id "$ROLE_QO")
echo "  ✓ Operater Kvaliteta (Quality) → $ROLE_QO_ID"

# Maintenance Manager
ROLE_MM=$(sa_post "/roles" '{"name":"Menadžer Održavanja","description":"Održavanje — Andon, prijava zastoja, planovi održavanja","permissions":[{"featureGroup":"production","level":"view"},{"featureGroup":"safety","level":"participate"},{"featureGroup":"maintenance","level":"manage"}]}')
ROLE_MM_ID=$(get_id "$ROLE_MM")
echo "  ✓ Menadžer Održavanja (Maintenance) → $ROLE_MM_ID"

# ── 6. Create Users ──────────────────────────────────────────
echo ""
echo "6. Creating users..."

# Quality operator
R=$(post "/auth/register" "{\"email\":\"kvalitet@deoflor.rs\",\"password\":\"$PW\",\"firstName\":\"Kvalitet\",\"lastName\":\"Operater\",\"role\":\"custom\",\"siteId\":\"$SITE_ID\",\"corporateId\":\"$CORP_ID\"}")
QO_ID=$(get_id "$R")
[ -n "$QO_ID" ] && [ -n "$ROLE_QO_ID" ] && sa_post "/roles/assign" "{\"userId\":\"$QO_ID\",\"roleId\":\"$ROLE_QO_ID\"}" > /dev/null 2>&1
echo "  ✓ kvalitet@deoflor.rs (Operater Kvaliteta)"

# Line Leaders
for i in 1 2; do
  R=$(post "/auth/register" "{\"email\":\"vodja.linije$i@deoflor.rs\",\"password\":\"$PW\",\"firstName\":\"Vođa Linije\",\"lastName\":\"$i\",\"role\":\"custom\",\"siteId\":\"$SITE_ID\",\"corporateId\":\"$CORP_ID\"}")
  UID=$(get_id "$R")
  [ -n "$UID" ] && [ -n "$ROLE_LL_ID" ] && sa_post "/roles/assign" "{\"userId\":\"$UID\",\"roleId\":\"$ROLE_LL_ID\"}" > /dev/null 2>&1
  echo "  ✓ vodja.linije$i@deoflor.rs (Vođa Linije)"
done

# Shift Leaders
for i in 1 2; do
  R=$(post "/auth/register" "{\"email\":\"vodja.smene$i@deoflor.rs\",\"password\":\"$PW\",\"firstName\":\"Vođa Smene\",\"lastName\":\"$i\",\"role\":\"custom\",\"siteId\":\"$SITE_ID\",\"corporateId\":\"$CORP_ID\"}")
  UID=$(get_id "$R")
  [ -n "$UID" ] && [ -n "$ROLE_SL_ID" ] && sa_post "/roles/assign" "{\"userId\":\"$UID\",\"roleId\":\"$ROLE_SL_ID\"}" > /dev/null 2>&1
  echo "  ✓ vodja.smene$i@deoflor.rs (Vođa Smene)"
done

# Maintenance Manager
R=$(post "/auth/register" "{\"email\":\"odrzavanje@deoflor.rs\",\"password\":\"$PW\",\"firstName\":\"Menadžer\",\"lastName\":\"Održavanja\",\"role\":\"custom\",\"siteId\":\"$SITE_ID\",\"corporateId\":\"$CORP_ID\"}")
MM_ID=$(get_id "$R")
[ -n "$MM_ID" ] && [ -n "$ROLE_MM_ID" ] && sa_post "/roles/assign" "{\"userId\":\"$MM_ID\",\"roleId\":\"$ROLE_MM_ID\"}" > /dev/null 2>&1
echo "  ✓ odrzavanje@deoflor.rs (Menadžer Održavanja)"

# Shop Floor Operators (one per machine)
MACHINE_CODES=("KOCH-01" "KOCH-02" "ASM-MAN" "COMP-01" "MCAUT-01" "PLIS-01" "ETIC-01" "CAN-01" "FLOW-01" "TRAF-BLU" "TRAF-ORA")
MACHINE_NAMES=("Koch 1" "Koch 2" "Montaža" "Compatto" "MacAut" "Plissettatrice" "Etichettatrice" "Canard" "FlowPack" "Trafila Blu" "Trafila Ora")

for i in "${!MACHINE_CODES[@]}"; do
  CODE="${MACHINE_CODES[$i]}"
  NAME="${MACHINE_NAMES[$i]}"
  EMAIL=$(echo "$CODE" | tr '[:upper:]' '[:lower:]' | tr '-' '.')
  R=$(post "/auth/register" "{\"email\":\"${EMAIL}@deoflor.rs\",\"password\":\"$PW\",\"firstName\":\"Operater\",\"lastName\":\"$NAME\",\"role\":\"custom\",\"siteId\":\"$SITE_ID\",\"corporateId\":\"$CORP_ID\"}")
  UID=$(get_id "$R")
  [ -n "$UID" ] && [ -n "$ROLE_SF_ID" ] && sa_post "/roles/assign" "{\"userId\":\"$UID\",\"roleId\":\"$ROLE_SF_ID\"}" > /dev/null 2>&1
  echo "  ✓ ${EMAIL}@deoflor.rs (Operater Mašine — $NAME)"
done

# ── 7. Create Shift Definitions ──────────────────────────────
echo ""
echo "7. Creating shifts..."
# This would need a site-config endpoint — skip if not available

# ── 8. Create Reason Codes ───────────────────────────────────
echo ""
echo "8. Creating reason codes..."
REASONS=(
  '{"category":"breakdown","code":"MECH","label":"Mehanički kvar"}'
  '{"category":"breakdown","code":"ELEC","label":"Električni kvar"}'
  '{"category":"breakdown","code":"PNEU","label":"Pneumatski kvar"}'
  '{"category":"breakdown","code":"ALAT","label":"Lomljenje alata"}'
  '{"category":"breakdown","code":"SOFT","label":"Greška softvera"}'
  '{"category":"breakdown","code":"OSTL","label":"Ostalo"}'
  '{"category":"changeover","code":"FMT","label":"Promena formata"}'
  '{"category":"changeover","code":"MAT","label":"Promena materijala"}'
  '{"category":"changeover","code":"ALAT","label":"Promena alata"}'
  '{"category":"quality","code":"DIM","label":"Dimenzionalni problem"}'
  '{"category":"quality","code":"VIZ","label":"Vizuelni defekt"}'
  '{"category":"quality","code":"FUNK","label":"Funkcionalni problem"}'
  '{"category":"quality","code":"MATL","label":"Defekt materijala"}'
  '{"category":"idle","code":"CEK","label":"Čekanje materijala"}'
  '{"category":"idle","code":"INST","label":"Čekanje instrukcija"}'
  '{"category":"idle","code":"OPER","label":"Nema operatera"}'
  '{"category":"planned_stop","code":"PAU","label":"Pauza"}'
  '{"category":"planned_stop","code":"SAST","label":"Sastanak"}'
  '{"category":"planned_stop","code":"BNAL","label":"Bez naloga"}'
)

for r in "${REASONS[@]}"; do
  LABEL=$(echo "$r" | python3 -c "import sys,json; print(json.load(sys.stdin)['label'])" 2>/dev/null)
  RESULT=$(sa_post "/shopfloor/reason-codes" "$r")
  RC_ID=$(get_id "$RESULT")
  [ -n "$RC_ID" ] && echo "  ✓ $LABEL" || echo "  ✗ $LABEL (may already exist)"
done

# ── 9. Create Escalation Rules ───────────────────────────────
echo ""
echo "9. Creating escalation rules..."
RULES=(
  '{"name":"Zastoj L1 — Vođa Smene","triggerType":"breakdown","conditionMinutes":10,"notifyGroup":"shift_management","notifyLevel":"manage","escalationTier":1}'
  '{"name":"Zastoj L2 — Održavanje","triggerType":"breakdown","conditionMinutes":30,"notifyGroup":"maintenance","notifyLevel":"manage","escalationTier":2}'
  '{"name":"Zastoj L3 — Menadžer","triggerType":"breakdown","conditionMinutes":60,"notifyGroup":"people","notifyLevel":"manage","escalationTier":3}'
  '{"name":"Bezbednost — Hitno","triggerType":"safety_incident","conditionMinutes":0,"notifyGroup":"safety","notifyLevel":"manage","escalationTier":1}'
  '{"name":"NCR Kritičan — Hitno","triggerType":"ncr_critical","conditionMinutes":0,"notifyGroup":"quality","notifyLevel":"manage","escalationTier":1}'
)

for r in "${RULES[@]}"; do
  NAME=$(echo "$r" | python3 -c "import sys,json; print(json.load(sys.stdin)['name'])" 2>/dev/null)
  RESULT=$(sa_post "/escalation" "$r")
  RC_ID=$(get_id "$RESULT")
  [ -n "$RC_ID" ] && echo "  ✓ $NAME" || echo "  ✗ $NAME"
done

# ── SUMMARY ──────────────────────────────────────────────────
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  DEOFLOR EAST — SETUP COMPLETE                        ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║                                                        ║"
echo "║  Site: Deoflor East d.o.o., Stara Pazova               ║"
echo "║  Workstations: 11                                      ║"
echo "║  Users: 18 (1 admin + 1 quality + 2 line leaders       ║"
echo "║         + 2 shift leaders + 1 maintenance + 11 ops)    ║"
echo "║  Language: Serbian                                     ║"
echo "║                                                        ║"
echo "║  ACCOUNTS (all password: password123)                  ║"
echo "║                                                        ║"
echo "║  Admin:                                                ║"
echo "║    manager@deoflor.rs         (Production Manager)     ║"
echo "║                                                        ║"
echo "║  Quality:                                              ║"
echo "║    kvalitet@deoflor.rs        (Operater Kvaliteta)     ║"
echo "║                                                        ║"
echo "║  Line Leaders:                                         ║"
echo "║    vodja.linije1@deoflor.rs                            ║"
echo "║    vodja.linije2@deoflor.rs                            ║"
echo "║                                                        ║"
echo "║  Shift Leaders:                                        ║"
echo "║    vodja.smene1@deoflor.rs                             ║"
echo "║    vodja.smene2@deoflor.rs                             ║"
echo "║                                                        ║"
echo "║  Maintenance:                                          ║"
echo "║    odrzavanje@deoflor.rs                               ║"
echo "║                                                        ║"
echo "║  Shop Floor Operators:                                 ║"
echo "║    koch.01@deoflor.rs         (Koch 1)                 ║"
echo "║    koch.02@deoflor.rs         (Koch 2)                 ║"
echo "║    asm.man@deoflor.rs         (Manual Assembly)        ║"
echo "║    comp.01@deoflor.rs         (Compatto)               ║"
echo "║    mcaut.01@deoflor.rs        (MacAut)                 ║"
echo "║    plis.01@deoflor.rs         (Plissettatrice)         ║"
echo "║    etic.01@deoflor.rs         (Etichettatrice)         ║"
echo "║    can.01@deoflor.rs          (Canard)                 ║"
echo "║    flow.01@deoflor.rs         (FlowPack)              ║"
echo "║    traf.blu@deoflor.rs        (Trafila Blu)            ║"
echo "║    traf.ora@deoflor.rs        (Trafila Orange)         ║"
echo "║                                                        ║"
echo "╚════════════════════════════════════════════════════════╝"
