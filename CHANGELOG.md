# YES HOTELS — CHANGELOG

All changes, fixes, hardened services, and architectural migrations are documented chronologically in this file.

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
