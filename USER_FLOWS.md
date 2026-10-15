# YES HOTELS PMS — User Flows

For hotel staff and the people testing the system. Each flow lists who can do it, the steps, and the rules the system enforces (what it refuses and why). Dates are hotel business dates (India time).

---

## Roles at a glance

The hotel has four staff logins:

| Login | Main work |
|---|---|
| Admin (`admin@`) | Everything: settings, staff, master data, audit trail |
| Manager (`manager@`) | Operations and approvals: CRITICAL approvals, check-in overrides, plus the work of the retired logins: maintenance, restaurant/POS (orders, settle, void), night audit, finance and reports |
| Reception (`reception@`) | Front Desk & Reservations, the Verification Queue, and Cashier & Billing (payments, advances, refunds, shift) |
| Housekeeping (`housekeeping@`) | Room cleaning tasks; cleaned rooms go to Reception for verification |
| Customer | Their own stays: pay the balance, request changes, review, profile (not a staff login; see flow 13) |

The Supervisor, Cashier, Finance, Maintenance and Restaurant roles are retired. Their old accounts are disabled, and new staff accounts can only be Admin, Manager, Reception or Housekeeping.

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

0. **Front Desk:** open the stay's checkout, review the charges and choose **Send to Cashier & Billing**. The stay appears under **Bills to settle**; stays due out today or overdue appear there anyway.
1. **Cashier & Billing:** apply advances and record the final payment. A receipt opens after each payment, and submitting the same payment twice records it once.
   - A payment larger than the amount due is refused unless the excess is returned as a refund with a reason.
2. If the guest is in credit, the system refuses to check out until staff confirm a refund. It never refunds silently.
3. Check-out completes only when the balance is exactly ₹0. The folio is settled with a GST invoice number `PREFIX/2026-27/000001`, sequential per financial year with no gaps.
4. Settled folios can't be changed.

## 3a. Verification Queue (Reception login)

Completed work arrives here automatically; nothing can be verified before it is done.

| Task | Arrives when | Verify | Reject (reason required) |
|---|---|---|---|
| Room cleaned — release | Housekeeping marks the room cleaned | The room becomes CLEAN and available to sell | The room goes back to housekeeping as DIRTY with the reason, and returns here when re-cleaned |
| Cash variance | A shift closes with a variance above the threshold | The variance is accepted and the shift reconciled | Returned to Cashier & Billing; resubmit with a corrected explanation |
| Refund | A refund is given (bill credit, advance, payment, at checkout) | Recorded as checked | Returned to Cashier & Billing for correction, then resubmitted |
| Folio line voided | A charge or payment line is voided by reversal | Recorded as checked | Returned to Cashier & Billing |
| Tariff below default | A walk-in rate, edited bill rate, discount or complimentary credit is below the default | Recorded as checked | Returned to the Front Desk |
| Cancelled with advance | Staff cancel a booking that holds money | Recorded as checked | Returned to the Front Desk |

Each task shows who did the work and when, who verified or rejected it and when, every attempt, and its full history.

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

## 13. Guest (customer) portal

**Sign in.** Either email + password, or **booking number + mobile** (the mobile on that booking). The second needs no account: one is created for the guest, and the rooms booked with it are attached. A booking linked to a staff email can't be used this way.

From their account a guest can:

1. **Add a stay** booked at the desk, by phone or by someone else, with its booking number and mobile. A stay already on another account is refused.
2. **Pay the balance online**, in full or in part:
   - before arrival: booking total less payments and advances;
   - in-house: the open folio balance (the payment posts to the folio).
   Paying more than is due is refused, and one gateway payment is recorded once.
3. **Ask to change** dates or guests. One open request per booking; in-house guests can only change the check-out date or guests. The guest can withdraw a waiting request.
   - **Reception** (Reservations → Guest Change Requests): check availability and price, update the reservation with the normal booking tools, then **Approve** (optional message) or **Decline** (reason required). The guest sees the reply.
4. **Review** a completed stay (one review per stay; shown publicly after approval).
5. **Profile:** name and phone; saved address, ID, company and GSTIN (added to their next website booking); change password (current password required).

## 14. Extend, leave early, or move room (Front Desk)

- **Extend stay:** for a group, extend **all rooms** (default) or only one. Each room's bill gets the extra nights at its agreed rate plus GST, and the new check-out date shows on the registration card and bill.
- **Leave early:** when Reception sends an early-leaving guest to **Cashier & Billing**, the nights not stayed (and their GST) are taken off the bill, the check-out date updates, and those nights can be sold again.
- **Room move:** Front Desk → Move room. Choose a clean, vacant room and either keep the current rate or use the new room's rate. The old room goes to housekeeping as dirty, the new room shows occupied, and the bill adds (or takes off) the rate difference for nights already charged, with GST.

## 15. Live chat

1. A guest chats on the website; **Talk to Reception** passes the chat to staff.
2. **Live Chat** (Reception, Admin) shows it instantly with an unread count; reply in the box — the guest sees it immediately.
3. **Take over** to assign it to yourself; **Resolve** when done. Chats with no guest activity for 24 hours become *Abandoned*.

## 16. Guest sign-in

- Email + password, a **6-digit code emailed** from bookings@yeshotels.in (valid 10 minutes, 5 tries, used once), or **booking number + mobile**.
- Signing in links the guest's bookings to their account. Staff accounts never receive codes.

## 17. Passwords

- Everyone changes their own password with the key icon next to *Sign out*.
- Admin resets a forgotten staff password from **Staff**.
- The owner's master password opens staff logins only; each use appears in the audit log (see docs/OPERATIONS.md).
