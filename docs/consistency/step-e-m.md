# Cross-module consistency — step-e-m

Run: 2026-10-13T12:14:19.721Z · business day 2026-10-13 (Asia/Kolkata) · server http://localhost:8096

| Metric | DB truth | Module (source field) | Value | Agrees |
|---|---|---|---|---|
| **Occupied rooms** | 4 | Dashboard (hotelPulse.occupied) | 4 | ✅ |
|  |  | Front Desk (inHouse rooms) | 4 |  |
|  |  | Housekeeping (room rack OCCUPIED) | 4 |  |
|  |  | Rooms (occupancyStatus OCCUPIED) | 4 |  |
|  |  | Rooms (status OCCUPIED) | 4 |  |
|  |  | Reports (day-summary occupiedRooms) | 4 |  |
| **Occupancy %** | 22 | Dashboard (occupancyPct) | 22 | ✅ |
|  |  | Reports (executive occupancyPct) | 22 |  |
| **Dirty rooms** | 6 | Dashboard (hotelPulse.dirty) | 6 | ✅ |
|  |  | Dashboard (housekeeping.dirty) | 6 |  |
|  |  | Front Desk (dirtyRooms) | 6 |  |
|  |  | Housekeeping (room rack DIRTY) | 6 |  |
|  |  | Rooms (housekeepingStatus DIRTY) | 6 |  |
| **In-house guests (stays)** | 4 | Dashboard (inHouse.guests) | 4 | ✅ |
|  |  | Front Desk (counts.inHouse) | 4 |  |
|  |  | Reports (executive inHouseCount) | 4 |  |
|  |  | Reports (in-house-list, in-house rows) | 4 |  |
| **Today's collections ₹ (2026-10-13 IST)** | 1050 (payments) / 1050 (folio payment lines) | Dashboard (todayRevenue) | 1050 | ✅ |
|  |  | Reports (executive paymentsToday) | 1050 |  |
|  |  | Reports (day-summary credits) | 1050 |  |

**5/5 metrics consistent.**
