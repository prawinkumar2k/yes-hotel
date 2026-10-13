# Cross-module consistency — step-c-folio-ledger

Run: 2026-10-13T06:03:11.518Z · business day 2026-10-13 (Asia/Kolkata) · server http://localhost:8095

| Metric | DB truth | Module (source field) | Value | Agrees |
|---|---|---|---|---|
| **Occupied rooms** | 2 | Dashboard (hotelPulse.occupied) | 2 | ✅ |
|  |  | Front Desk (inHouse rooms) | 2 |  |
|  |  | Housekeeping (room rack OCCUPIED) | 2 |  |
|  |  | Rooms (occupancyStatus OCCUPIED) | 2 |  |
|  |  | Rooms (status OCCUPIED) | 2 |  |
|  |  | Reports (day-summary occupiedRooms) | 2 |  |
| **Occupancy %** | 11 | Dashboard (occupancyPct) | 11 | ✅ |
|  |  | Reports (executive occupancyPct) | 11 |  |
| **Dirty rooms** | 6 | Dashboard (hotelPulse.dirty) | 6 | ✅ |
|  |  | Dashboard (housekeeping.dirty) | 6 |  |
|  |  | Front Desk (dirtyRooms) | 6 |  |
|  |  | Housekeeping (room rack DIRTY) | 6 |  |
|  |  | Rooms (housekeepingStatus DIRTY) | 6 |  |
| **In-house guests (stays)** | 2 | Dashboard (inHouse.guests) | 2 | ✅ |
|  |  | Front Desk (counts.inHouse) | 2 |  |
|  |  | Reports (executive inHouseCount) | 2 |  |
|  |  | Reports (in-house-list, in-house rows) | 2 |  |
| **Today's collections ₹ (2026-10-13 IST)** | 0 (payments) / 0 (folio payment lines) | Dashboard (todayRevenue) | 0 | ✅ |
|  |  | Reports (executive paymentsToday) | 0 |  |
|  |  | Reports (day-summary page2.todayCashInward) | 0 |  |

**5/5 metrics consistent.**
