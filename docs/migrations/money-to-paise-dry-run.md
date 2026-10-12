# Money → integer paise — dry run

Generated 2026-10-12T18:35:14.345Z against `yes_hotels`. **Nothing was changed.**

Conversion: paise = round(rupees × 100), half away from zero. **1413 values in 460 documents** across 25 collections; **0 values carry float drift** (more than 2 decimals) and are rounded to the paisa.

| Collection | Field | Docs | Values | >2 decimals | Min (₹) | Max (₹) | Sample before → after (paise) |
|---|---|---|---|---|---|---|---|
| advanceadjustments | `amount` | 1 | 1 |  | 1000 | 1000 | 1000 → 100000 |
| advancepayments | `amount` | 11 | 11 |  | 1000 | 9000 | 3000 → 300000; 4500 → 450000; 6000 → 600000 |
| advancepayments | `totalAdjusted` | 11 | 11 |  | 0 | 9000 | 3000 → 300000; 7500 → 750000; 4500 → 450000 |
| advancepayments | `totalRefunded` | 11 | 11 |  | 0 | 0 |  |
| advancepayments | `remainingBalance` | 11 | 11 |  | 0 | 9000 | 4500 → 450000; 6000 → 600000; 9000 → 900000 |
| ancillaryservices | `amount` | 12 | 12 |  | 450 | 5800 | 3200 → 320000; 2400 → 240000; 1200 → 120000 |
| ancillaryservices | `taxAmount` | 12 | 12 |  | 23 | 290 | 160 → 16000; 120 → 12000; 60 → 6000 |
| ancillaryservices | `totalAmount` | 12 | 12 |  | 473 | 6090 | 3360 → 336000; 2520 → 252000; 1260 → 126000 |
| banksettlements | — | 0 | 0 | | | | (empty collection) |
| banquetbookings | `ratePerPax` | 5 | 5 |  | 900 | 1800 | 1800 → 180000; 1200 → 120000; 1500 → 150000 |
| banquetbookings | `totalEstimatedAmount` | 5 | 5 |  | 54000 | 630000 | 630000 → 63000000; 144000 → 14400000; 300000 → 30000000 |
| banquetbookings | `advancePaid` | 5 | 5 |  | 0 | 252000 | 252000 → 25200000; 120000 → 12000000; 21600 → 2160000 |
| bookings | `ratePerNight` | 2 | 2 |  | 1000 | 1000 | 1000 → 100000; 1000 → 100000 |
| bookings | `totalAmount` | 56 | 56 |  | 1050 | 78480 | 14170 → 1417000; 22420 → 2242000; 54000 → 5400000 |
| bookings | `taxAmount` | 56 | 56 |  | 50 | 6480 | 1170 → 117000; 3420 → 342000; 4500 → 450000 |
| bookings | `cgstAmount` | 56 | 56 |  | 25 | 3240 | 585 → 58500; 1710 → 171000; 2250 → 225000 |
| bookings | `sgstAmount` | 56 | 56 |  | 25 | 3240 | 585 → 58500; 1710 → 171000; 2250 → 225000 |
| bookings | `paidAmount` | 56 | 56 |  | 0 | 78480 | 5000 → 500000; 22420 → 2242000; 54000 → 5400000 |
| bookings | `discountAmount` | 56 | 56 |  | 0 | 1950 | 350 → 35000; 1950 → 195000; 350 → 35000 |
| bookings | `rateOverrideAmount` | 0 | 0 |  |  |  |  |
| bookings | `cancellationPenalty` | 56 | 56 |  | 0 | 500 | 500 → 50000 |
| bookingenquiries | `expectedBudget` | 0 | 0 |  |  |  |  |
| bookingenquiries | `pricePerNight` | 0 | 0 |  |  |  |  |
| bookingenquiries | `roomSubtotal` | 0 | 0 |  |  |  |  |
| bookingenquiries | `quotationAmount` | 0 | 0 |  |  |  |  |
| businessdates | — | 0 | 0 | | | | (empty collection) |
| cashiershifts | `openingFloat` | 2 | 2 |  | 100 | 5000 | 5000 → 500000; 100 → 10000 |
| cashiershifts | `openingDenominations.coins` | 1 | 1 |  | 0 | 0 |  |
| cashiershifts | `openingDenominations.total` | 1 | 1 |  | 100 | 100 | 100 → 10000 |
| cashiershifts | `cashCollected` | 1 | 1 |  | 1050 | 1050 | 1050 → 105000 |
| cashiershifts | `cashAdvances` | 1 | 1 |  | 0 | 0 |  |
| cashiershifts | `cashRefunds` | 1 | 1 |  | 0 | 0 |  |
| cashiershifts | `paidOuts[].amount` | 0 | 0 |  |  |  |  |
| cashiershifts | `totalPaidOut` | 1 | 1 |  | 0 | 0 |  |
| cashiershifts | `expectedCash` | 2 | 2 |  | 1150 | 2500 | 2500 → 250000; 1150 → 115000 |
| cashiershifts | `expectedUpi` | 2 | 2 |  | 0 | 5000 | 5000 → 500000 |
| cashiershifts | `expectedCard` | 2 | 2 |  | 0 | 0 |  |
| cashiershifts | `expectedGateway` | 1 | 1 |  | 0 | 0 |  |
| cashiershifts | `expectedOther` | 1 | 1 |  | 0 | 0 |  |
| cashiershifts | `actualCashCounted` | 1 | 1 |  | 2400 | 2400 | 2400 → 240000 |
| cashiershifts | `closingDenominations.coins` | 1 | 1 |  | 0 | 0 |  |
| cashiershifts | `closingDenominations.total` | 1 | 1 |  | 2400 | 2400 | 2400 → 240000 |
| cashiershifts | `cashVariance` | 1 | 1 |  | 1250 | 1250 | 1250 → 125000 |
| companies | — | 0 | 0 | | | | (empty collection) |
| corporateaccounts | `creditLimit` | 3 | 3 |  | 300000 | 750000 | 500000 → 50000000; 300000 → 30000000; 750000 → 75000000 |
| corporateaccounts | `currentOutstanding` | 3 | 3 |  | 0 | 45000 | 45000 → 4500000; 12000 → 1200000 |
| coupons | `minBookingAmount` | 4 | 4 |  | 2000 | 8000 | 2000 → 200000; 5000 → 500000; 8000 → 800000 |
| coupons | `maxDiscount` | 3 | 3 |  | 2000 | 5000 | 2000 → 200000; 5000 → 500000; 4000 → 400000 |
| coupons | `discountValue` (only discountType=FIXED) | 1 | 1 |  | 500 | 500 | 500 → 50000 |
| folios | `totalCharges` | 56 | 56 |  | 0 | 72000 | 6500 → 650000; 48475 → 4847500; 1000 → 100000 |
| folios | `totalDiscounts` | 56 | 56 |  | 0 | 0 |  |
| folios | `totalTax` | 56 | 56 |  | 50 | 3600 | 1170 → 117000; 50 → 5000; 2475 → 247500 |
| folios | `totalPaid` | 56 | 56 |  | 0 | 5000 | 5000 → 500000; 1050 → 105000 |
| folios | `totalAdvanceAdjusted` | 56 | 56 |  | 0 | 78480 | 5000 → 500000; 1000 → 100000; 54000 → 5400000 |
| folios | `balance` | 56 | 56 |  | -3050 | 7560 | -2330 → -233000; -2000 → -200000; -3050 → -305000 |
| folios | `cgst` | 56 | 56 |  | 25 | 1800 | 585 → 58500; 25 → 2500; 1237.5 → 123750 |
| folios | `sgst` | 56 | 56 |  | 25 | 1800 | 585 → 58500; 25 → 2500; 1237.5 → 123750 |
| folios | `igst` | 56 | 56 |  | 0 | 0 |  |
| foliolines | `amount` | 226 | 226 |  | 25 | 78480 | 6500 → 650000; 585 → 58500; 585 → 58500 |
| foliolines | `unitPrice` | 1 | 1 |  | 500 | 500 | 500 → 50000 |
| groupbookings | `roomBlocks[].ratePerRoom` | 4 | 4 |  | 3500 | 9500 | 6500 → 650000; 6500 → 650000; 9500 → 950000 |
| groupbookings | `totalEstimatedValue` | 4 | 4 |  | 56000 | 520000 | 234000 → 23400000; 520000 → 52000000; 285000 → 28500000 |
| groupbookings | `advancePaid` | 4 | 4 |  | 0 | 85500 | 70200 → 7020000; 85500 → 8550000 |
| groupbookings | `balance` | 4 | 4 |  | 56000 | 520000 | 163800 → 16380000; 520000 → 52000000; 199500 → 19950000 |
| guests | `totalSpend` | 27 | 27 |  | 2100 | 99190 | 14170 → 1417000; 7800 → 780000; 30600 → 3060000 |
| hotelsettings | `earlyCheckInFee` | 1 | 1 |  | 0 | 0 |  |
| hotelsettings | `lateCheckOutFee` | 1 | 1 |  | 0 | 0 |  |
| hotelsettings | `extraPersonRate` | 1 | 1 |  | 800 | 800 | 800 → 80000 |
| hotelsettings | `extraBedRate` | 1 | 1 |  | 1200 | 1200 | 1200 → 120000 |
| hotelsettings | `childRateNoBed` | 1 | 1 |  | 400 | 400 | 400 → 40000 |
| hotelsettings | `childRateWithBed` | 1 | 1 |  | 600 | 600 | 600 → 60000 |
| hotelsettings | `mealPlanRates.EP` | 1 | 1 |  | 0 | 0 |  |
| hotelsettings | `mealPlanRates.CP` | 1 | 1 |  | 500 | 500 | 500 → 50000 |
| hotelsettings | `mealPlanRates.MAP` | 1 | 1 |  | 1000 | 1000 | 1000 → 100000 |
| hotelsettings | `mealPlanRates.AP` | 1 | 1 |  | 1500 | 1500 | 1500 → 150000 |
| hotelsettings | `mealPlanRates.RO` | 1 | 1 |  | 0 | 0 |  |
| hotelsettings | `mealPlanRates.BB` | 1 | 1 |  | 500 | 500 | 500 → 50000 |
| hotelsettings | `gstRules[].bands[].upTo` | 0 | 0 |  |  |  |  |
| menuitems | `price` | 18 | 18 |  | 60 | 520 | 120 → 12000; 90 → 9000; 100 → 10000 |
| menuitems | `modifiers[].priceDelta` | 0 | 0 |  |  |  |  |
| payments | `amount` | 25 | 25 |  | 3815 | 58860 | 3815 → 381500; 11445 → 1144500; 3815 → 381500 |
| payments | `refundedAmount` | 25 | 25 |  | 0 | 7500 | 7500 → 750000 |
| paymentchannels | — | 0 | 0 | | | | (empty collection) |
| pricingrules | — | 0 | 0 | | | | (empty collection) |
| refunds | `amount` | 1 | 1 |  | 7500 | 7500 | 7500 → 750000 |
| restaurantorders | `items[].unitPrice` | 4 | 7 |  | 60 | 450 | 380 → 38000; 60 → 6000; 120 → 12000 |
| restaurantorders | `items[].totalPrice` | 4 | 7 |  | 180 | 700 | 380 → 38000; 180 → 18000; 240 → 24000 |
| restaurantorders | `subtotal` | 4 | 4 |  | 450 | 820 | 800 → 80000; 820 → 82000; 450 → 45000 |
| restaurantorders | `taxAmount` | 4 | 4 |  | 23 | 41 | 40 → 4000; 41 → 4100; 23 → 2300 |
| restaurantorders | `grandTotal` | 4 | 4 |  | 473 | 861 | 840 → 84000; 861 → 86100; 473 → 47300 |
| roomcategories | `basePrice` | 4 | 4 |  | 3500 | 18000 | 3500 → 350000; 6500 → 650000; 9500 → 950000 |
| roomcategories | `hourlyPrice` | 4 | 4 |  | 0 | 0 |  |
| taskapprovals | — | 0 | 0 | | | | (empty collection) |

Excluded on purpose: counts (quantities, pax, cash denominations n2000…n10, usage limits), percentages and rates (GST %, commission %, discount %, markup %, `taxRatePercent`, `gstRules[].bands[].rate`), ratings, sort orders, `RatePlan.multiplier`, loyalty points, and `PaymentChannel.taxOnFee` (unit unclear; 0 documents).

Applying: one transaction, then a marker document in `migrations` so it cannot run twice. Restore point: `npm run db:backup` immediately before.
