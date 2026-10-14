# Cross-module consistency — reception

Run: 2026-10-14T05:42:23.922Z · business day 2026-10-14 (Asia/Kolkata) · server http://localhost:8096

| Metric | DB truth | Module (source field) | Value | Agrees |
|---|---|---|---|---|
| **Occupied rooms** | 10 | Dashboard (hotelPulse.occupied) | 10 | ✅ |
|  |  | Front Desk (inHouse rooms) | 10 |  |
|  |  | Housekeeping (room rack OCCUPIED) | 10 |  |
|  |  | Rooms (occupancyStatus OCCUPIED) | 10 |  |
|  |  | Rooms (status OCCUPIED) | 10 |  |
|  |  | Reports (day-summary occupiedRooms) | 10 |  |
| **Occupancy %** | 56 | Dashboard (occupancyPct) | 56 | ✅ |
|  |  | Reports (executive occupancyPct) | 56 |  |
| **Dirty rooms** | 6 | Dashboard (hotelPulse.dirty) | 6 | ✅ |
|  |  | Dashboard (housekeeping.dirty) | 6 |  |
|  |  | Front Desk (dirtyRooms) | 6 |  |
|  |  | Housekeeping (room rack DIRTY) | 6 |  |
|  |  | Rooms (housekeepingStatus DIRTY) | 6 |  |
| **In-house guests (stays)** | 10 | Dashboard (inHouse.guests) | 10 | ✅ |
|  |  | Front Desk (counts.inHouse) | 10 |  |
|  |  | Reports (executive inHouseCount) | 10 |  |
|  |  | Reports (in-house-list, in-house rows) | 10 |  |
| **Today's collections ₹ (2026-10-14 IST)** | 0 (payments) / 0 (folio payment lines) | Dashboard (todayRevenue) | 0 | ✅ |
|  |  | Reports (executive paymentsToday) | 0 |  |
|  |  | Reports (day-summary credits) | 0 |  |

**5/5 metrics consistent.**
