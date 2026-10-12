# YES HOTELS — CHANGELOG

All changes, fixes, hardened services, and architectural migrations are documented chronologically in this file.

---

## [Phase 1 · Step 1 — Security] - 2026-10-12

### Security
- Folio mutations (charge, void line, bill edit, reconcile, finalize, settle) now require the money-desk role set (ADMIN, MANAGER, RECEPTIONIST, CASHIER; SUPER_ADMIN). Customers may read only their own folio, read-only.
- Advance, refund, cashier-shift and group-advance mutations use the same role set.
- One RBAC system: `server/src/config/permissions.ts` is the single permission map over the `UserRole` enum. `authorize()` was removed. Access Matrix edits (`source: "UI"`) override the map; legacy seed rows are inert.
- `requirePropertyAccess` reads property assignment from the user record (the JWT never carried it).
- Rate limiting re-enabled (`RATE_LIMIT_API_MAX`, `RATE_LIMIT_AUTH_MAX`, `RATE_LIMIT_REFRESH_MAX`).

### Added
- `npm run db:backup` / `npm run db:restore` (mongodump / mongorestore).
- `scripts/audit/rbac-matrix.ts`: per-route allowed-roles matrix and before/after diff (`docs/rbac/`).
- `scripts/audit/consistency-check.ts`: cross-module metric check against IST ground truth (`docs/consistency/`).
- Tests: `rbac.integration.spec.ts` (real app over HTTP) and `permissions.spec.ts`.

### Fixed
- SUPER_ADMIN no longer gets 403 on Settings, Staff, Gallery, Payment Channels, Group Bookings or Complaints.
- Cashier shifts can be opened and closed by cashiers (action-name mismatch).
- `/api/permissions/users/:id/effective` now uses the target user's role.
- Vitest no longer collects specs from `.claude/worktrees`.

---

## [Phase 0 — Reconnaissance & Connectivity Audit] - 2026-10-12

### Added
- `AUDIT_REPORT.md`: a connectivity matrix generated from source (94 frontend routes → client API calls → 243 mounted endpoints → controllers → models), a live read-only GET sweep against the seeded DB, RBAC probes, a duplicated-logic inventory, and the reproduction status of defects A–M.
- `CHANGELOG.md`.

### Changed
- Replaced the earlier, unverified Phase 0 draft of `AUDIT_REPORT.md`. It referenced non-existent models and listed unmounted endpoints as connected.

### Notes
- No application code changed in this phase.
- Router counts: 46 route files, 43 mounted, 3 unmounted (`pos`, `menu`, `ota`).
