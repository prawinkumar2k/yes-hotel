# YES HOTELS PMS — User Flows

For hotel staff and the people testing the system. Each flow lists who can do it, the steps, and the rules the system enforces (what it refuses and why). Dates are hotel business dates (India time).

---

## Roles at a glance

| Role | Main work |
|---|---|
| SUPER_ADMIN, ADMIN | Everything. Only SUPER_ADMIN can create, edit or disable SUPER_ADMIN/ADMIN accounts |
| MANAGER | Operations and approvals: CRITICAL approvals, POS voids, shift variances, night audit, check-in overrides |
| SUPERVISOR | Floor supervision: HIGH approvals, shift variances, night-audit status |
| RECEPTIONIST | Reservations, check-in/out, folios, payments, advances |
| CASHIER | Payments, advances, cashier shift, settling POS bills |
| FINANCE | Reports, night audit |
| HOUSEKEEPING, MAINTENANCE | Room cleaning tasks, maintenance tickets |
| RESTAURANT | POS orders and the kitchen (KOT) |
| CUSTOMER | Their own bookings, folio (read-only) and loyalty |

Staff only see and act on the property they're assigned to.

---

## 1. Reservation → check-in

1. **Create.** Use the website, Front Desk, Walk-in Registration, or convert an enquiry (flow 7). The price comes from the server: room rate per night, with GST of 5% at ≤ ₹7,500 a night or 18% above, split CGST/SGST.
2. **Assign a room** (room rack, or at check-in). Each room-night can be sold once; a second claim on the same room and night is refused.
3. **Check in.** Allowed only for a CONFIRMED booking. The arrival date is not enforced yet: an early check-in is the front desk's decision.
   - The room must be CLEAN. A MANAGER can override, with a reason that is logged.
   - A room that is out of order (an open CRITICAL maintenance ticket) can't be sold or checked into.
   - Check-in opens the guest's folio.

## 2. Folio, payments, advances

- **Charges** post to an OPEN folio. Postings dated on a business day the night audit has closed are refused.
- **Payments.** Every payment creates a Payment record (`TXN-YYYYMMDD-NNNNNN`) together with its folio line.
- **Advances** are received, applied to the folio (oldest first, across several advances if needed), or refunded (a reason is required).
  - Reversing an applied advance line on the folio returns the money to the advance.
- **Removing a line.** Lines are never deleted. "Void" posts a reversal with a reason, and the original stays visible.
- **Balance.** charges + tax + refunds − discounts − payments − advances. Above zero the guest owes; below zero the hotel owes the guest.

## 3. Check-out

1. Apply advances and take the final payment.
   - A payment larger than the amount due is refused unless the excess is returned as a refund with a reason.
2. If the guest is in credit, the system refuses to check out until staff confirm a refund. It never refunds silently.
3. Check-out completes only when the balance is exactly ₹0. The folio is settled with a GST invoice number `PREFIX/2026-27/000001`, sequential per financial year with no gaps.
4. Settled folios can't be changed.

## 4. Night audit (MANAGER, FINANCE)

- Status and preview only read; they never change anything.
- **Run:**
  - charges each in-house night not already charged, at the booking's rate
  - charges overstays once
  - marks arrivals that never came as NO_SHOW and frees their room
  - closes the day and moves the business date forward
- Running it twice for the same day is refused.

## 5. Cashier shift (CASHIER; MANAGER/SUPERVISOR oversee)

1. **Open** a shift on a drawer with the counted float. Each drawer and each cashier can have only one active shift.
2. During the shift, the drawer's expected cash = float + cash payments + cash restaurant bills + cash advances − cash refunds − paid-outs.
   - A paid-out can't exceed the drawer.
3. **Handover.** Count the drawer; the count is frozen at that moment. The incoming cashier confirms, and their shift opens with the counted float.
4. **Close.** Count the drawer; a denomination breakdown must add up to the amount entered.
   - Any difference needs a reason.
   - A difference above the threshold (default ₹100) stays "awaiting acceptance" until a manager or supervisor accepts it. The cashier can't accept their own.

## 6. Restaurant / POS

1. **RESTAURANT** takes the order. For room service, the room must have a checked-in guest. A KOT `KOT-YYYYMMDD-NNNN` is issued.
2. **Kitchen:** Pending → Preparing → Ready → Served.
3. **CASHIER** settles a served order:
   - to the guest's room folio, posting the food charge and GST
   - or by CASH, CARD or UPI (card and UPI need the approval code or UTR)
4. **MANAGER** can void an order before billing, with a reason.

## 7. Enquiries

1. Log the enquiry and choose the room category from the master list.
2. Follow up. An enquiry is **overdue** when its next follow-up date has passed, or when it is a new lead with no follow-up after 24 hours.
3. **Convert:**
   - choose the category
   - the price comes from the category rate, or the quotation (taken as the agreed pre-tax amount), plus GST
   - one booking is created per room
   - if the category is sold out for those dates, nothing is created
4. **Lost** needs a reason. A converted enquiry can't change status.

## 8. Groups

1. Create the group with its room blocks (category, rooms, rate per night).
2. **Confirm** to hold the rooms. If any block can't be held, nothing is held.
3. **Pickup.** Each named guest becomes a booking from the held rooms; the rooming list shows them.
4. **Release** unpicked rooms back to sale; cancelling the group releases all of them.
5. Group advances are recorded as real advance receipts against the organiser.

## 9. OTA bookings

Each OTA booking records the OTA's commission % and who collected the money:

- **Prepaid to the OTA:** the OTA owes the hotel the total minus commission.
- **Pay at hotel:** the hotel owes the OTA its commission.

Commission is calculated on the pre-tax room amount.

## 10. Maintenance (MAINTENANCE; approvals by priority)

1. Open a ticket against a room.
   - CRITICAL takes the room **out of order** (not sellable) until resolved.
   - Lower priorities don't take the room off sale.
2. Open → Assigned (needs an assignee) → In progress → Resolved → Closed.
   - Closing a ticket nobody worked on needs a reason.
3. Completing a CRITICAL ticket needs MANAGER or higher; HIGH needs SUPERVISOR or higher.
4. When the last CRITICAL ticket on a room is resolved, the room goes back on sale.

## 11. Reports and the dashboard

- **Room revenue:** pre-tax room revenue per night.
- **Occupancy:** rooms sold ÷ sellable rooms.
- **ADR:** revenue ÷ rooms sold.
- **RevPAR:** revenue ÷ sellable rooms.
- **Collections:** money received. Collections are shown separately and are never called revenue.

Every screen uses the same definitions.

## 12. Staff, access and audit

- **Last login** shows the last password login. **Last active** shows the last time the account was used, including through a still-open session.
- **Audit log** (ADMIN):
  - Every sensitive change, login and failed login is recorded, with before/after values, IP address and device.
  - Entries can't be edited or deleted.
  - Filter by action, role, item or date, and export to CSV.
