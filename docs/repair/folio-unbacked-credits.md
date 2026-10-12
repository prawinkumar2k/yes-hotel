# Folio credit lines without a backing record (dry-run report)

Generated 12 Oct 2026, 10:53 pm IST from `yes_hotels`. **Read-only: nothing was changed.**

## A. Fabricated “Advance Payment Received” lines

ADVANCE_ADJUSTMENT credit lines with no valid `advancePaymentId` and no valid `paymentId`. They were created by the old `GET /api/folios/booking/:id` seeding from `booking.paidAmount`.

**52 lines on 52 bookings, ₹10,16,825 of credit with no record behind it.**

“Balance if reversed” is the folio balance after a void entry cancels these credits. “Real payments” is the net of Payment documents for the booking: if it is also non-zero, the fabricated line double-counts money that was actually received.

| Booking | Booking status | Folio | Lines | Fabricated credit | Folio balance now | Balance if reversed | booking.paidAmount | Real payments (net) | First created (IST) |
|---|---|---|---|---|---|---|---|---|---|
| YES-BKG-H1035 | CHECKED_OUT | OPEN | 1 | ₹78,480 | ₹-2,880 | ₹75,600 | ₹78,480 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1018 | CHECKED_OUT | OPEN | 1 | ₹58,860 | ₹-2,160 | ₹56,700 | ₹58,860 | ₹58,860 | 12 Oct 2026, 1:07 pm |
| YES-BKG-2020 | CHECKED_OUT | SETTLED | 1 | ₹54,000 | ₹-3,050 | ₹50,950 | ₹54,000 | ₹0 | 11 Oct 2026, 11:28 pm |
| YES-BKG-H1015 | CHECKED_OUT | OPEN | 1 | ₹41,420 | ₹-1,520 | ₹39,900 | ₹41,420 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1031 | CHECKED_OUT | OPEN | 1 | ₹41,420 | ₹-1,520 | ₹39,900 | ₹41,420 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1017 | CHECKED_OUT | OPEN | 1 | ₹39,240 | ₹-1,440 | ₹37,800 | ₹39,240 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1037 | CHECKED_OUT | OPEN | 1 | ₹39,240 | ₹-1,440 | ₹37,800 | ₹39,240 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1014 | CHECKED_OUT | OPEN | 1 | ₹31,065 | ₹-1,140 | ₹29,925 | ₹31,065 | ₹31,065 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1034 | CHECKED_OUT | OPEN | 1 | ₹31,065 | ₹-1,140 | ₹29,925 | ₹31,065 | ₹31,065 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1007 | CHECKED_OUT | OPEN | 1 | ₹28,340 | ₹-1,040 | ₹27,300 | ₹28,340 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1011 | CHECKED_OUT | OPEN | 1 | ₹28,340 | ₹-1,040 | ₹27,300 | ₹28,340 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1027 | CHECKED_OUT | OPEN | 1 | ₹28,340 | ₹-1,040 | ₹27,300 | ₹28,340 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1047 | CHECKED_OUT | OPEN | 1 | ₹28,340 | ₹-1,040 | ₹27,300 | ₹28,340 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-3010 | CONFIRMED | OPEN | 1 | ₹22,420 | ₹-2,470 | ₹19,950 | ₹22,420 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1006 | CHECKED_OUT | OPEN | 1 | ₹21,255 | ₹-780 | ₹20,475 | ₹21,255 | ₹21,255 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1010 | CHECKED_OUT | OPEN | 1 | ₹21,255 | ₹-780 | ₹20,475 | ₹21,255 | ₹21,255 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1026 | CHECKED_OUT | OPEN | 1 | ₹21,255 | ₹-780 | ₹20,475 | ₹21,255 | ₹21,255 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1030 | CHECKED_OUT | OPEN | 1 | ₹21,255 | ₹-780 | ₹20,475 | ₹21,255 | ₹21,255 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1046 | CHECKED_OUT | OPEN | 1 | ₹21,255 | ₹-780 | ₹20,475 | ₹21,255 | ₹21,255 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1013 | CHECKED_OUT | OPEN | 1 | ₹20,710 | ₹-761.04 | ₹19,948.96 | ₹20,710 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1033 | CHECKED_OUT | OPEN | 1 | ₹20,710 | ₹-760 | ₹19,950 | ₹20,710 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1016 | CHECKED_OUT | OPEN | 1 | ₹19,620 | ₹-720 | ₹18,900 | ₹19,620 | ₹19,620 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1036 | CHECKED_OUT | OPEN | 1 | ₹19,620 | ₹-720 | ₹18,900 | ₹19,620 | ₹19,620 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1003 | CHECKED_OUT | OPEN | 1 | ₹15,260 | ₹-560 | ₹14,700 | ₹15,260 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1019 | CHECKED_OUT | OPEN | 1 | ₹15,260 | ₹-560 | ₹14,700 | ₹15,260 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1023 | CHECKED_OUT | OPEN | 1 | ₹15,260 | ₹-560 | ₹14,700 | ₹15,260 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1039 | CHECKED_OUT | OPEN | 1 | ₹15,260 | ₹-560 | ₹14,700 | ₹15,260 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1043 | CHECKED_OUT | OPEN | 1 | ₹15,260 | ₹-560 | ₹14,700 | ₹15,260 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1009 | CHECKED_OUT | OPEN | 1 | ₹14,170 | ₹-520 | ₹13,650 | ₹14,170 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1025 | CHECKED_OUT | OPEN | 1 | ₹14,170 | ₹-520 | ₹13,650 | ₹14,170 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1029 | CHECKED_OUT | OPEN | 1 | ₹14,170 | ₹-520 | ₹13,650 | ₹14,170 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1045 | CHECKED_OUT | OPEN | 1 | ₹14,170 | ₹-520 | ₹13,650 | ₹14,170 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1002 | CHECKED_OUT | OPEN | 1 | ₹11,445 | ₹-420 | ₹11,025 | ₹11,445 | ₹11,445 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1022 | CHECKED_OUT | OPEN | 1 | ₹11,445 | ₹-420 | ₹11,025 | ₹11,445 | ₹11,445 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1038 | CHECKED_OUT | OPEN | 1 | ₹11,445 | ₹-420 | ₹11,025 | ₹11,445 | ₹11,445 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1042 | CHECKED_OUT | OPEN | 1 | ₹11,445 | ₹-420 | ₹11,025 | ₹11,445 | ₹11,445 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1012 | CHECKED_OUT | OPEN | 1 | ₹10,355 | ₹-380 | ₹9,975 | ₹10,355 | ₹10,355 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1032 | CHECKED_OUT | OPEN | 1 | ₹10,355 | ₹-380 | ₹9,975 | ₹10,355 | ₹10,355 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1001 | CHECKED_OUT | OPEN | 1 | ₹7,630 | ₹-280 | ₹7,350 | ₹7,630 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1005 | CHECKED_OUT | OPEN | 1 | ₹7,630 | ₹-280 | ₹7,350 | ₹7,630 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1021 | CHECKED_OUT | OPEN | 1 | ₹7,630 | ₹-280 | ₹7,350 | ₹7,630 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1041 | CHECKED_OUT | OPEN | 1 | ₹7,630 | ₹-280 | ₹7,350 | ₹7,630 | ₹0 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1008 | CHECKED_OUT | OPEN | 1 | ₹7,085 | ₹-260 | ₹6,825 | ₹7,085 | ₹7,085 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1028 | CHECKED_OUT | OPEN | 1 | ₹7,085 | ₹-260 | ₹6,825 | ₹7,085 | ₹7,085 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1044 | CHECKED_OUT | OPEN | 1 | ₹7,085 | ₹-260 | ₹6,825 | ₹7,085 | ₹7,085 | 12 Oct 2026, 1:07 pm |
| YES-BKG-2010 | CHECKED_IN | OPEN | 1 | ₹5,000 | ₹-2,330 | ₹2,670 | ₹5,000 | ₹0 | 12 Oct 2026, 1:00 pm |
| YES-BKG-4001 | CANCELLED | OPEN | 1 | ₹4,000 | ₹3,560 | ₹7,560 | ₹4,000 | ₹500 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1000 | CHECKED_OUT | OPEN | 1 | ₹3,815 | ₹-140 | ₹3,675 | ₹3,815 | ₹3,815 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1004 | CHECKED_OUT | OPEN | 1 | ₹3,815 | ₹-140 | ₹3,675 | ₹3,815 | ₹3,815 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1020 | CHECKED_OUT | OPEN | 1 | ₹3,815 | ₹-140 | ₹3,675 | ₹3,815 | ₹3,815 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1024 | CHECKED_OUT | OPEN | 1 | ₹3,815 | ₹-140 | ₹3,675 | ₹3,815 | ₹3,815 | 12 Oct 2026, 1:07 pm |
| YES-BKG-H1040 | CHECKED_OUT | OPEN | 1 | ₹3,815 | ₹-140 | ₹3,675 | ₹3,815 | ₹3,815 | 12 Oct 2026, 1:07 pm |
| **Total** | | | **52** | **₹10,16,825** | ₹-38,471.04 | ₹9,78,353.96 | | ₹3,73,825 | |

Folios already settled/finalized among these: YES-BKG-2020.

## B. PAYMENT lines with no Payment document

Each must get a Payment record (created in the same transaction going forward). These are listed for repair in the folio step.

**2 lines on 2 bookings, ₹6,050.**

| Booking | Booking status | Folio | Posted (IST) | Amount | Description | postedBy |
|---|---|---|---|---|---|---|
| YES-BKG-2010 | CHECKED_IN | OPEN | 11 Oct 2026, 11:39 am | ₹5,000 | Advance Deposit via UPI | Front Desk |
| WALKIN-1011-001 | CHECKED_OUT | SETTLED | 12 Oct 2026, 2:06 am | ₹1,050 | Checkout Payment (CASH) | 6acb27a8209b29c1eb1ae44d |

## C. Other credit lines (for context, not repaired here)

- REFUND: 2

- ADVANCE_ADJUSTMENT lines with a valid record: 1
- ADVANCE_ADJUSTMENT lines without a record and not matching “Advance Payment Received”: 0
