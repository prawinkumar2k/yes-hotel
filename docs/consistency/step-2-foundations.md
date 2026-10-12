# Cross-module consistency — step-2-foundations

Run: 2026-10-12T18:33:32.210Z · business day 2026-10-13 (Asia/Kolkata) · server http://localhost:8095

| Metric | DB truth | Module (source field) | Value | Agrees |
|---|---|---|---|---|
| **Occupied rooms** | 2 | Dashboard (hotelPulse.occupied) | 1 | ❌ |
|  |  | Front Desk (inHouse rooms) | 2 |  |
|  |  | Housekeeping (room rack OCCUPIED) | 1 |  |
|  |  | Rooms (occupancyStatus OCCUPIED) | 1 |  |
|  |  | Rooms (status OCCUPIED) | 2 |  |
|  |  | Reports (day-summary occupiedRooms) | 2 |  |
| **Occupancy %** | 11 | Dashboard (occupancyPct) | 5 | ❌ |
|  |  | Reports (executive occupancyPct) | 11 |  |
| **Dirty rooms** | 1 (room field) / 3 (HK tasks) | Dashboard (hotelPulse.dirty) | 1 | ❌ (no single DB source) |
|  |  | Dashboard (housekeeping.dirty) | 3 |  |
|  |  | Front Desk (dirtyRooms) | 2 |  |
|  |  | Housekeeping (tasks DIRTY) | 3 |  |
|  |  | Rooms (housekeepingStatus DIRTY) | 1 |  |
| **In-house guests (stays)** | 2 | Dashboard (inHouse.guests) | 1 | ❌ |
|  |  | Front Desk (counts.inHouse) | 2 |  |
|  |  | Reports (executive inHouseCount) | 2 |  |
|  |  | Reports (in-house-list rows) | 2 |  |
| **Today's collections ₹ (2026-10-13 IST)** | 0 (payments) / 0 (folio payment lines) | Dashboard (todayRevenue) | 0 | ✅ |
|  |  | Reports (executive paymentsToday) | 0 |  |
|  |  | Reports (day-summary page2.todayCashInward) | 0 |  |

**1/5 metrics consistent.**
