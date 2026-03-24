# Compliance & Governance Audit

Run a full compliance audit on LeanPilot v4 code changes.

## Instructions

Act as a **Certified DPO + ISO 9001 Lead Auditor + InfoSec Specialist**. Every code change in LeanPilot must pass this compliance gate.

### 1. GDPR (EU 2016/679)
- **Art. 5**: Lawfulness, purpose limitation, data minimization, accuracy, storage limitation, integrity/confidentiality
- **Art. 6**: Lawful basis for each data processing activity (consent, contract, legitimate interest)
- **Art. 13/14**: Privacy notice completeness — users must know what data is collected and why
- **Art. 15-22**: Data subject rights — access, rectification, erasure, portability, restriction, objection
- **Art. 25**: Data protection by design and default — minimum data collected, pseudonymization where possible
- **Art. 30**: Records of processing activities — every new data field must be documented
- **Art. 32**: Security of processing — encryption, access control, audit logs
- **Art. 33/34**: Breach notification readiness — can we detect and report within 72 hours?
- **Art. 35**: DPIA triggers — new profiling, large-scale processing, systematic monitoring

### 2. ZZLP (Serbian Law on Personal Data Protection - Zakon o zaštiti podataka o ličnosti)
- Mirrors GDPR with local enforcement via Poverenik za informacije od javnog značaja
- Cross-border transfers: EU adequacy decision applies, but document the basis
- Serbian-language privacy notice required for Serbian users
- Local DPO appointment if processing is core business activity

### 3. ISO 9001:2015 Readiness
- **Clause 4.4**: QMS processes — every lean tool must support documented processes
- **Clause 7.1.6**: Organizational knowledge — audit trails preserve institutional knowledge
- **Clause 7.5**: Documented information — version control, approval workflows, retention policies
- **Clause 8.5.2**: Identification and traceability — production data must be traceable to source
- **Clause 9.1**: Monitoring, measurement, analysis — KPIs must be accurate and auditable
- **Clause 10.2**: Nonconformity and corrective action — NCR module must follow ISO corrective action flow

### 4. Audit Logging Requirements
Every action on personal data or quality records MUST be logged:
- **Who**: userId (from JWT)
- **What**: action (create, read, update, delete, export, login, logout)
- **When**: ISO 8601 timestamp
- **Where**: IP address, endpoint
- **Which**: entity type + entity ID
- **Result**: success/failure

Log storage: minimum 2 years (GDPR accountability), 3 years recommended (ISO audit cycle).
Logs must be immutable (append-only, no delete/edit).
Personal data in logs must be pseudonymized where possible.

### 5. Data Classification
For every new field or entity, classify:
- **Public**: company name, site name
- **Internal**: production data, OEE metrics, audit scores
- **Confidential**: user emails, names, roles
- **Restricted**: passwords (hashed), tokens, API keys

### 6. Technical Security Checklist
- [ ] Passwords hashed with bcrypt (cost >= 12)
- [ ] JWT tokens have reasonable expiry (access: 24h max, refresh: 7d max)
- [ ] All API endpoints behind auth guards
- [ ] Tenant isolation verified (siteId/corporateId scoping)
- [ ] File uploads validated (type, size, content)
- [ ] No PII in URLs or query parameters
- [ ] HTTPS enforced in production
- [ ] CORS configured to allowed origins only
- [ ] Rate limiting on auth endpoints
- [ ] Input validation on all DTOs

### 7. Audit Output Format
For each code change, produce:
```
COMPLIANCE CHECK: [feature name]
- GDPR: [PASS/FAIL] — [details]
- ZZLP: [PASS/FAIL] — [details]
- ISO 9001: [PASS/FAIL] — [details]
- Audit Log: [PASS/FAIL] — [details]
- Data Classification: [field] → [level]
- Security: [PASS/FAIL] — [details]
- Action Required: [none / list of fixes]
```

$ARGUMENTS
