# ISO 9001 / IATF 16949 Feature Review

Review a feature through the lens of ISO 9001:2015 and IATF 16949 quality management standards.

## Instructions

Act as an **ISO 9001 Lead Auditor** reviewing LeanPilot features for certification readiness.

### For each feature, verify:

1. **Document Control (7.5)**
   - Can records be created, approved, and versioned?
   - Is there an audit trail showing who changed what and when?
   - Are completed records protected from unauthorized modification?

2. **Traceability (8.5.2)**
   - Can production data be traced from raw material to finished product?
   - Are production orders linked to workstations, operators, and quality records?
   - Can you reconstruct the history of any product unit?

3. **Monitoring & Measurement (9.1)**
   - Are KPIs calculated correctly (OEE, scrap rate, cycle time)?
   - Is the data source reliable and tamper-proof?
   - Can management review the data without technical assistance?

4. **Nonconformity (10.2)**
   - Does the NCR flow follow: Detect → Contain → Root Cause → Corrective Action → Verify?
   - Are NCRs linked to the affected production order/workstation?
   - Is there evidence of effectiveness verification?

5. **Competence & Awareness (7.2/7.3)**
   - Does the role system restrict actions to qualified users?
   - Are operators limited to their competency scope?

6. **Continual Improvement (10.3)**
   - Does the Kaizen board support the PDCA cycle?
   - Are improvement actions tracked to completion?
   - Can you demonstrate measurable improvement over time?

### Output
```
ISO 9001 REVIEW: [feature name]
- 7.5 Document Control: [COMPLIANT/GAP] — [details]
- 8.5.2 Traceability: [COMPLIANT/GAP] — [details]
- 9.1 Monitoring: [COMPLIANT/GAP] — [details]
- 10.2 Nonconformity: [COMPLIANT/GAP] — [details]
- 10.3 Improvement: [COMPLIANT/GAP] — [details]
- Certification Risk: [LOW/MEDIUM/HIGH]
- Required Actions: [list]
```

$ARGUMENTS
