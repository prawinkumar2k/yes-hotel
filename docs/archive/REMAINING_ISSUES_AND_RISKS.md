# YES HOTELS — REMAINING ISSUES AND RISKS

Comprehensive register of known operational boundaries, concurrency risks, and architecture recommendations for production scaling.

---

## 1. Concurrency & High-Traffic Considerations

| Risk Area | Severity | Description | Current Mitigation | Recommended Production Hardening |
|---|---|---|---|---|
| **Simultaneous Walk-In Bookings** | Medium | Two receptionists assigning the exact same room at the exact same millisecond. | Database unique index on `(roomId, checkInDate, checkOutDate)` + `BookingIdempotency` check. | Implement MongoDB distributed document locking or Redis lock around room allocation critical sections. |
| **Shift Closing Race Condition** | Low | Cashier attempting to close shift while a front-office runner records a late mini-bar payment. | Closing shift marks status `CLOSING` and checks for uncommitted transactions. | Strict optimistic locking via Mongoose `__v` version key on `CashierShift`. |
| **Night Audit Mid-Posting Interruption** | Medium | Server restart or network drop during midnight room charge posting across 500+ rooms. | `NightAuditLog` records individual room posting IDs and is executed inside a transaction where replica sets permit. | Add idempotent retry resume flag so incomplete audit runs resume from the last unposted room. |

---

## 2. Infrastructure & Deployment Considerations

1. **MongoDB Replica Set Prerequisite for Transactions**:
   - Multi-document transactions (e.g., atomic check-in updating `Booking`, `Room`, and `Folio`) require an active replica set (`rs0`).
   - Standalone single-instance MongoDB fallback executes queries sequentially with compensating rollbacks if an error occurs.
2. **Timezone Uniformity**:
   - Hotel business dates depend on property local time (e.g., IST `Asia/Kolkata` for India properties).
   - Ensure server runtime environment runs with consistent `TZ=Asia/Kolkata` or enforces standard UTC conversion at the ORM layer.
3. **Receipt and Print Spooling**:
   - Large bulk print jobs (>100 GRCs / GST Invoices) generate sizable DOM trees in the browser.
   - For batch prints exceeding 200 documents, recommend streaming server-side PDF generation (e.g., Puppeteer microservice) to prevent browser memory exhaustion.

---

## 3. Maintenance & Monitoring Recommendations

- **Daily Audit Health Check**: Configure a daily alert monitoring that Night Audit completes between 01:00 AM and 03:00 AM local time.
- **Unadjusted Advances Review**: Run a weekly reconciliation report to ensure advances for checked-out guests have been either applied to the folio or refunded.
- **Database Index Optimization**: Ensure compound index on `{ propertyId: 1, checkInDate: 1, checkOutDate: 1, status: 1 }` remains healthy as booking volume scales.
