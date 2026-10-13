# Folio ledger report (dry run)

Generated 2026-10-13T05:58:53.028Z. Nothing was changed. Ledger rule: balance = charges + tax + refunds − discounts − paid − advances; a REVERSAL undoes its target line.

- Folios: **56**, lines: **226**
- Folios whose stored balance differs from the ledger: **2**
- SETTLED/CLOSED folios with a non-zero ledger balance: **0**
- Legacy REFUND lines stored as CREDIT (now counted as debit): **2**

## Stored vs ledger balance

| Booking | Status | Stored balance | Ledger balance | Difference |
|---|---|---:|---:|---:|
| WALKIN-1011-001 | SETTLED | ₹-2,000.00 | ₹0.00 | ₹2,000.00 |
| YES-BKG-2020 | SETTLED | ₹-3,050.00 | ₹0.00 | ₹3,050.00 |

## SETTLED/CLOSED with non-zero balance

| Booking | Status | Invoice | Ledger balance | Charges+tax | Paid | Advances | Refunds |
|---|---|---|---:|---:|---:|---:|---:|

## Named repair bookings

### WALKIN-1011-001

Folio 6acbc3307cd243f7f87b80cb · SETTLED · stored ₹-2,000.00 → ledger ₹0.00

| Date | Type | Description | Amount | Linked record |
|---|---|---|---:|---|
| 2026-10-11 | ROOM_CHARGE | Room Tariff (1 Night @ ₹1,000/night) | ₹1,000.00 |  |
| 2026-10-11 | TAX_CGST | CGST (6%) on Room Tariff | ₹25.00 |  |
| 2026-10-11 | TAX_SGST | SGST (6%) on Room Tariff | ₹25.00 |  |
| 2026-10-11 | ADVANCE_ADJUSTMENT | Advance adjustment — ADV-202610-0011 | ₹1,000.00 | Advance |
| 2026-10-11 | PAYMENT | Checkout Payment (CASH) | ₹1,050.00 |  |
| 2026-10-11 | REFUND | Checkout Settlement (Excess Advance Refund) | ₹1,000.00 |  |

### WALKIN-1011-002

Folio 6acbd39b7cd243f7f87b80d6 · OPEN · stored ₹1,050.00 → ledger ₹1,050.00

| Date | Type | Description | Amount | Linked record |
|---|---|---|---:|---|
| 2026-10-11 | ROOM_CHARGE | Room Tariff (1 Night @ ₹1,000/night) | ₹1,000.00 |  |
| 2026-10-11 | TAX_CGST | CGST (6%) on Room Tariff | ₹25.00 |  |
| 2026-10-11 | TAX_SGST | SGST (6%) on Room Tariff | ₹25.00 |  |

### YES-BKG-2020

Folio 6acbce567cd243f7f87b80ce · SETTLED · stored ₹-3,050.00 → ledger ₹0.00

| Date | Type | Description | Amount | Linked record |
|---|---|---|---:|---|
| 2026-10-09 | ROOM_CHARGE | Room Tariff (3 Nights @ ₹16,500/night) | ₹49,500.00 |  |
| 2026-10-09 | TAX_CGST | CGST (6%) on Room Tariff | ₹1,237.50 |  |
| 2026-10-09 | TAX_SGST | SGST (6%) on Room Tariff | ₹1,237.50 |  |
| 2026-10-11 | ADVANCE_ADJUSTMENT | Advance Payment Received (CASH) | ₹54,000.00 |  |
| 2026-10-11 | RESTAURANT | food | ₹500.00 |  |
| 2026-10-11 | REFUND | Checkout Refund | ₹1,525.00 |  |

## Proposed repair (needs approval)

- Stored totals: rewrite each folio's totals from the ledger (no line changes).
- Non-zero SETTLED folios: post the correcting entry (REFUND for a guest credit, or reopen and collect a due amount) with reason "ledger repair", by approval per folio.
- Named bookings: as listed above; reversals only, nothing deleted.
