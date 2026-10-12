# CASHIER SHIFT MANAGEMENT & NIGHT AUDIT — GAP ANALYSIS
**Project:** YES HOTELS Operating System  
**Audit Date:** 12 October 2026  
**Auditor Roles:** Principal Hospitality Software Architect, Hotel Finance Controller, Security Engineer

---

## 1. Executive Summary & Existing Architecture

The YES HOTELS PMS/ERP codebase has sophisticated infrastructure for double-entry folios ([`Folio.ts`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models/Folio.ts)), immutable ledger lines ([`FolioLine.ts`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models/FolioLine.ts)), non-revenue advance deposits ([`AdvancePayment.ts`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models/AdvancePayment.ts)), payments ([`Payment.ts`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models/Payment.ts)), payment channels ([`PaymentChannel.ts`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models/PaymentChannel.ts)), and business date control ([`BusinessDate.ts`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models/BusinessDate.ts)).

However, the existing Cashier Shift page (`/admin/cashier-shifts` — [`AdminCashierShifts.tsx`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/client/pages/admin/AdminCashierShifts.tsx)) and backend controller ([`cashier-shift.controller.ts`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/controllers/cashier-shift.controller.ts)) were minimal prototypes lacking enterprise cashiering rigor:
- No denomination breakdown (₹2000, ₹500, ₹200, ₹100, ₹50, ₹20, ₹10, coins).
- No shift handover workflow between outgoing and incoming cashiers.
- Missing payout/paid-out management and drawer transfer tracking.
- Drawer identifiers were absent (cannot enforce 1 active shift per drawer terminal).
- Handover dual-acknowledgment and supervisor override were missing.
- The night-audit workspace (`/admin/night-audit` — [`AdminNightAudit.tsx`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/client/pages/admin/AdminNightAudit.tsx)) had only a simple run button without detailed financial review (room revenue vs taxes vs collections, open shifts blocking with drilldown, and audit history ledger).

---

## 2. Feature-by-Feature Gap Analysis

| Feature Domain | Existing State | Gap / Risk | Target Enterprise State |
| :--- | :--- | :--- | :--- |
| **Shift Identification & Concurrency** | `shiftNumber = SHIFT-${Date.now()}` | Non-atomic, prone to collisions in clustered environments | Concurrency-safe sequenced shift number generation: `SHF-YYYYMM-XXXX` with property scoping. |
| **Drawer & Terminal Identification** | None | Drawer not identified; cannot prevent concurrent cashier conflicts on the same physical till. | Drawer/Till identifier (e.g., `DRAWER-01`, `FRONT_DESK_MAIN`). Enforce max 1 OPEN shift per drawer per property. |
| **Denomination Counting** | Only a raw numeric input field | Cashiers can enter arbitrary numbers without counting notes; high fraud & human error risk. | Structured denomination matrix (500, 200, 100, 50, 20, 10, coins) for both Opening Float and Closing Count with server verification. |
| **Financial Ledger Reconcile** | Looks up `postedBy` in `FolioLine` & `receivedBy` in `AdvancePayment` | Misses refunds, paid-outs, transfers, and gateway splits. Lacks drill-down transaction list. | Full ledger calculation: `Opening Float + Cash Collections + Cash Advances - Cash Refunds - Approved Paid-outs = Expected Cash`. Itemized transaction drilldown. |
| **Shift Handover** | Non-existent | Shifts could only be closed or left open; no handover between incoming and outgoing cashier. | Complete handover workflow: status `HANDOVER_PENDING`, outgoing cash count, incoming cashier verification, dual acknowledgment. |
| **Supervisor Override & Variance** | Basic numeric diff | No variance thresholds, supervisor approval workflow, or immutable override audit. | Configurable variance threshold; mandatory supervisor approval & reason when variance exceeds threshold. |
| **Property Isolation** | `requirePropertyAccess` applied in routes, but controller didn't scope `getAllShifts` or `findOne` by `propertyId` | Potential cross-property data leakage in multi-property setup. | Strict `propertyId` scoping on all queries and mutations from `req.propertyId`. |
| **Night Audit Financial Review** | Only checklist counts (arrivals, departures, dirty rooms, open shifts) | No revenue-to-collection breakdown, tax summaries, or audit run history. | Comprehensive financial review tab: Room revenue, F&B, taxes, cash/digital collections, unposted folios, and detailed audit history. |

---

## 3. Reusable Models & Services (Strict Non-Duplication)

We will **reuse** 100% of the existing foundational models and services:
1. [`CashierShift.ts`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models/CashierShift.ts) — Extend existing schema with denominations, drawerId, handover, approvals, paid-outs, and businessDate.
2. [`BusinessDate.ts`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models/BusinessDate.ts) — Source of truth for hotel operational date.
3. [`Folio.ts`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models/Folio.ts) & [`FolioLine.ts`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models/FolioLine.ts) — Authoritative guest charges, taxes, and settlement payments.
4. [`AdvancePayment.ts`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models/AdvancePayment.ts) — Non-revenue deposit tracking.
5. [`Payment.ts`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models/Payment.ts) & [`PaymentChannel.ts`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models/PaymentChannel.ts) — Payment modes, cards, UPI, gateways.
6. [`Refund.ts`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models/Refund.ts) — Cash and online refund deductions.
7. [`AuditLog.ts`](file:///c:/Users/Hp/Downloads/yes-hotels-booking-b40/server/src/models/AuditLog.ts) & `createAuditLog` — Immutable audit trail.

---

## 4. Implementation Phase Checklist

- [x] **Phase 0:** Gap analysis & architectural audit (`CASHIER_NIGHT_AUDIT_GAP_ANALYSIS.md`).
- [ ] **Phase 1 (Module A & B - Backend):**
  - Extend `CashierShift` schema with:
    - `drawerId`, `businessDate`
    - `openingDenominations`, `closingDenominations`
    - `handoverToCashier`, `handoverAt`, `handoverStatus`
    - `paidOuts` (cash drops, emergency expenses)
    - `varianceReason`, `supervisorApproval` (`approvedBy`, `approvedAt`, `notes`)
    - `status`: `OPEN`, `HANDOVER_PENDING`, `CLOSED`, `RECONCILED`
  - Enhance `cashier-shift.controller.ts`:
    - Concurrency-safe shift number generator.
    - Property isolation and business date binding.
    - Shift opening with denomination validation.
    - Shift handover initiate & accept endpoints.
    - Live transaction aggregation & expected cash calculation with breakdown.
    - Cash payout (paid-out) recording.
    - Close & reconcile with denomination breakdown and supervisor approval check.
    - Shift printable report endpoint.
- [ ] **Phase 2 (Module C & D - Night Audit Backend):**
  - Enhance `night-audit.controller.ts`:
    - Add financial preview endpoint (`GET /api/night-audit/preview`): calculates revenue (room, f&b, addon, tax), collections (cash, card, upi, gateway), advances, and open balances.
    - Audit history ledger endpoint (`GET /api/night-audit/history`).
    - Enforce open cashier shifts check (blocks night audit until all shifts are closed or supervised).
- [ ] **Phase 3 (Frontend - Cashier Shift & Drawer):**
  - Reusable Denomination Counter component.
  - Active Shift Flight Deck with live metrics (opening float, cash in, cash out, net cash, digital collections).
  - Transaction Drilldown Table (folio payments, advances, refunds, paid-outs).
  - Handover Modal & workflow.
  - Paid-out (Cash Drop) Modal.
  - Reconcile & Close Modal with denomination counting and variance explanation.
  - Print Shift Summary sheet.
- [ ] **Phase 4 (Frontend - Night Audit Workspace):**
  - Financial Review summary cards & reconciliation table.
  - Operational Readiness checklist with direct action links.
  - Step-by-step Audit Preview & Execution modal.
  - Audit Run History table with downloadable/printable summaries.
- [ ] **Phase 5 (Testing & Quality Assurance):**
  - Concurrency tests for shift opening and drawer conflicts.
  - Denomination and variance calculation tests.
  - Integration verification with `npm run typecheck` and `npx vitest run`.
  - Comprehensive documentation (`CASHIER_NIGHT_AUDIT_IMPLEMENTATION_REPORT.md` and `CASHIER_NIGHT_AUDIT_TEST_REPORT.md`).
