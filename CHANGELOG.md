# YES HOTELS — CHANGELOG

All changes, fixes, hardened services, and architectural migrations are documented chronologically in this file.

---
## [Phase 1 · Step D — Advances] - 2026-10-13

- Advance numbers come from an atomic monthly counter, so they no longer duplicate under load.
- At checkout, advances are applied oldest first, across several advances if needed, capped at the amount due.
- Reversing an advance line on the folio returns the money to the advance.
- Refunds and manual adjustments are transactional, and a refund needs a reason.
- Advance status follows one rule; advances can't be taken against closed bookings.
- `GET /api/advances/reconciliation`; dry-run report in `docs/repair/advance-reconciliation.md`.

---
## [Phase 1 · Steps B and C — Night audit, folio ledger] - 2026-10-13

- Night audit: status and preview are read-only. The audit charges only nights not already covered, at the booking rate, and charges overstays once. No-shows release their room-nights. Each run is pinned to one date (409 on a repeat). Audited days are locked to postings, and the summary is computed from the day's data.
- Folio ledger (`folio-ledger.ts`): one balance rule, recomputed from all lines. REFUND is a debit, and a reversal undoes its target line.
- Settlement needs a balance of exactly ₹0. Checkout no longer bypasses the balance check or refunds silently. A guest credit must be refunded explicitly, and an overpayment is refused unless the excess is refunded with a reason.
- Each folio payment creates its Payment record in the same transaction (INR, TXN-YYYYMMDD-NNNNNN).
- Folio lines are voided by a reversal with a reason, never deleted. Settled folios are immutable.
- GST invoice numbers: PREFIX/FY/NNNNNN, gapless per financial year.
- Dry-run report: `docs/repair/folio-ledger-report.md`.

---
## [Phase 1 · Step F — Reservations and front desk] - 2026-10-13

- Room-night inventory (`roomnights`, unique on room + date). Nights are claimed inside the check-in, assignment, walk-in and extension transactions and released on cancel or no-show. Backfilled: 130 nights, 0 conflicts.
- Check-in requires a CLEAN room; a manager can override with a reason. The calendar and the reservation list share one query.

---
## [Phase 1 · Step 3 — Room status single source of truth] - 2026-10-13

- `room-status.service.ts`: `getSnapshot(businessDate)` derives occupancy (bookings), housekeeping (latest task) and sell status (sell field + open critical maintenance); Dashboard, Front Desk, Housekeeping, Rooms, Room Rack and Reports read it. Consistency check 5/5.
- Housekeeping cards show the real room category; no-op transitions are no longer logged; task updates log before/after.
- Departures include overdue stays; in-house counts every checked-in stay.
- Fixed: dev server failed to start after step 2 (`@shared` alias in server code).

---

## [Phase 1 · Step 2 — Foundations: business date, nights, tax] - 2026-10-13

### Added
- `shared/dates.ts`: business dates in Asia/Kolkata, one `nights()`; shared by server and client.
- `server/src/services/tax.service.ts`: effective-dated GST slabs (ROOM by per-night value after discount, FOOD, SERVICE), CGST/SGST split, configurable through `HotelSettings.gstRules`.
- `POST /api/bookings/quote` and `POST /api/pos/orders/quote`: read-only price quotes using the same functions as booking and order creation.
- Migration dry runs (not applied): `scripts/migrations/2026-10-13-business-date-strings.mjs`, `scripts/migrations/2026-10-13-money-to-paise.mjs`.

### Fixed
- Day bucketing everywhere uses IST, not the server timezone or UTC.
- Nights are calendar-date changes; YES-BKG-3010 shows 2 nights.
- GST: ≤ ₹7,500/night is 5% (was 12%); the slab is chosen per night after discount (was the whole stay's total for online bookings); no client-side tax.
- Dashboard: no random or placeholder figures; booking sources group by the real `source` field.
- Coupon editor no longer shifts validity by 5h30 on each save.

---

## [Phase 1 · Step 1b — Folio hotfix, property assignment, access rules N1–N5] - 2026-10-12

### Fixed
- Opening a folio never writes. Folio creation is the explicit, idempotent `openFolioForBooking`; credits come only from real Payment records.
- Non-admin staff can use the app: staff are assigned to the property (migration applied after backup and dry run), and property-scoped documents can no longer be saved without a property.
- `GET /api/reports/day-summary` 500 for property-scoped users.
- POS and the report pages used client page keys that blocked the roles meant to use them.

### Security
- Only SUPER_ADMIN can manage SUPER_ADMIN/ADMIN accounts, and nobody can grant a role above their own.
- HOUSEKEEPING can no longer create, edit or delete rooms. Property listing is admin-only.

### Changed
- Role grants for night audit, POS (restaurant / cashier settle / manager void with reason), approvals by priority, coupons, banquets, rate plans, corporate accounts, reports and task approvals. See `docs/rbac/n1-n5-access-diff.txt`.
- `pos` and `menu` routers mounted.

### Added
- `scripts/migrations/2026-10-12-assign-property.mjs`, `scripts/repair/folio-unbacked-credits-report.mjs` (read-only), `scripts/audit/role-sweep.ts`.

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
