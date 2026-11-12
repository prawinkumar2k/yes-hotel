# Incident report: multi-room bill showed a "Checkout Refund" and a doubled total

Reported 2026-11-12 by the client. Seen on two walk-in group bookings (7 rooms, guest JYOTHSSNA; 10 rooms, guest MURTHY L).

## What the client saw
- GST invoice total far above the real room charges (7 rooms: 26,130.13 instead of 14,070.07).
- A "Checkout Refund" line (12,060.06 and 2,499.96) listed as an "Others" charge.
- Six or nine extra payments at checkout, balance 0.
- Registration card "Stay Total" showed one room only while Advance showed the whole group.

## Root cause
1. `walk-in-registration.controller.ts` posted the WHOLE walk-in payment as a credit on the first room's folio only (and set `paidAmount` on that booking only).
2. The first room therefore held a credit larger than its own bill, so checkout refunded the excess ("Checkout Refund").
3. Every other room showed as unpaid and was charged again at its own checkout.
4. The invoice (`AdminFolioPrint`, `AdminBulkDocViewer`) counted the refund line (stored as a debit) as a charge, so the invoice total was inflated by the refund and balanced only because the extra payments were added too.
5. The registration card used the first booking's total, not the group's.

Money actually kept by the hotel was correct in each case (the total of the rooms); only the documents and the per-room records were wrong.

## Fix (commit "billing: split group advance across rooms...")
- `server/src/services/advance-split.ts`: one payment is shared across the rooms in proportion to each room's cost, exactly to the paisa, never above a room's total. Used at walk-in registration; each room gets its own advance line, `paidAmount` and PAID/PARTIAL status.
- `client/lib/invoiceSettlement.ts` + `InvoiceBottom.tsx`: refund lines are never charges. Bill = charges + tax + extras. Paid (net) = advance + checkout payments - refunds. Balance = bill - paid (net). Shown as separate lines on the invoice (single and bulk).
- GRC (single and bulk): group Stay Total, balance 0 once checked out and paid, "Tariff / room / night" no longer cut off.

## Why it should not come back
- Unit tests: `advance-split.spec.ts` (full, part, uneven rooms, cap), `invoiceSettlement.spec.ts` (the client's exact 7-room bill; 17,000 bill with 4,000 advance gives 13,000 balance; refund stored as credit).
- The invoice rule lives in one shared helper used by both print pages, so the two copies cannot drift.

## Existing records (NOT changed)
Bookings created before this fix keep their old internal data (advance on the first room, a refund line on it). Their invoices and cards now print correctly, but the per-room Front Desk balances of those old group bookings may still look off. No database record was altered. If wanted, a reviewed one-off correction can be prepared per booking.

## Limits of verification
Walk-in/group integration tests need a MongoDB replica set and could not run on the development PC; run one multi-room walk-in (full and part payment) after deploy and check the invoice and card.
