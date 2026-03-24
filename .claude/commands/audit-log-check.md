# Audit Log Verification

Verify that all data-modifying operations have proper audit logging.

## Instructions

Check every POST, PATCH, PUT, DELETE endpoint in the codebase and verify:

1. **Audit log entry is created** for every state-changing operation
2. **Log contains required fields**: userId, action, entityType, entityId, timestamp, ipAddress, result
3. **Personal data access is logged** (viewing user profiles, exporting data)
4. **Authentication events are logged** (login success/failure, token refresh, logout)
5. **Quality records are immutable** — completed inspections, closed NCRs, completed audits cannot be modified without creating an amendment record
6. **Log integrity** — logs are append-only, stored in a separate table, no cascade delete

## Required Audit Events
- `user.login` / `user.login_failed` / `user.logout`
- `user.create` / `user.update` / `user.deactivate`
- `inspection.create` / `inspection.submit_results` / `inspection.complete`
- `ncr.create` / `ncr.update_status` / `ncr.close`
- `audit_5s.create` / `audit_5s.score` / `audit_5s.complete`
- `kaizen.create` / `kaizen.status_change`
- `gemba.start_walk` / `gemba.add_observation` / `gemba.complete`
- `shopfloor.start_run` / `shopfloor.status_change` / `shopfloor.close_run`
- `order.create`
- `file.upload` / `file.delete`
- `settings.change`

$ARGUMENTS
