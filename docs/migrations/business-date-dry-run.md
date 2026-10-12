# businessDate as YYYY-MM-DD (Asia/Kolkata) — dry run

Generated 2026-10-12T18:35:43.158Z against `yes_hotels`. **Nothing was changed.**

**310 documents** would be updated. “UTC day differs” counts the documents whose UTC calendar day is not their IST day, i.e. those any UTC-based day bucketing put on the wrong day (defect B).

| Collection | Field | Mode | Docs | Converted Date→string | Backfilled | Already string | No source time | UTC day differs | Source (preference) | Samples |
|---|---|---|---|---|---|---|---|---|---|---|
| businessdates | `date` | convert | 0 | 0 | 0 | 0 | 0 | 0 | date |  |
| cashiershifts | `businessDate` | convert | 2 | 1 | 1 | 0 | 0 | 1 | businessDate → openedAt → createdAt | 2026-10-11T06:09:43.549Z (openedAt) → "2026-10-11"<br>2026-10-11T19:47:12.382Z (businessDate) → "2026-10-12" |
| foliolines | `businessDate` | convert | 226 | 0 | 226 | 0 | 0 | 7 | businessDate → postedAt → createdAt | 2026-10-10T06:09:43.051Z (postedAt) → "2026-10-10"<br>2026-10-10T06:09:43.051Z (postedAt) → "2026-10-10"<br>2026-10-10T06:09:43.051Z (postedAt) → "2026-10-10" |
| payments | `businessDate` | backfill | 25 | 0 | 25 | 0 | 0 | 0 | paidAt → createdAt | 2026-10-11T06:09:43.365Z (createdAt) → "2026-10-11"<br>2026-10-11T06:09:43.373Z (createdAt) → "2026-10-11"<br>2026-10-11T06:09:43.380Z (createdAt) → "2026-10-11" |
| refunds | `businessDate` | backfill | 1 | 0 | 1 | 0 | 0 | 0 | processedAt → createdAt | 2026-10-11T06:09:43.545Z (createdAt) → "2026-10-11" |
| advancepayments | `businessDate` | backfill | 11 | 0 | 11 | 0 | 0 | 0 | receivedAt → createdAt | 2026-10-11T06:09:43.498Z (receivedAt) → "2026-10-11"<br>2026-10-09T06:09:43.502Z (receivedAt) → "2026-10-09"<br>2026-10-07T06:09:43.507Z (receivedAt) → "2026-10-07" |
| advanceadjustments | `businessDate` | backfill | 1 | 0 | 1 | 0 | 0 | 1 | adjustedAt → createdAt | 2026-10-11T20:36:14.455Z (createdAt) → "2026-10-12" |
| restaurantorders | `businessDate` | backfill | 4 | 0 | 4 | 0 | 0 | 0 | createdAt | 2026-10-11T06:09:43.557Z (createdAt) → "2026-10-11"<br>2026-10-11T06:09:43.562Z (createdAt) → "2026-10-11"<br>2026-10-11T06:09:43.565Z (createdAt) → "2026-10-11" |
| ancillaryservices | `businessDate` | backfill | 12 | 0 | 12 | 0 | 0 | 0 | createdAt | 2026-10-11T06:09:43.983Z (createdAt) → "2026-10-11"<br>2026-10-11T06:09:43.987Z (createdAt) → "2026-10-11"<br>2026-10-11T06:09:43.992Z (createdAt) → "2026-10-11" |
| housekeepingtasks | `businessDate` | backfill | 17 | 0 | 17 | 0 | 0 | 2 | createdAt | 2026-10-11T06:09:43.576Z (createdAt) → "2026-10-11"<br>2026-10-11T06:09:43.582Z (createdAt) → "2026-10-11"<br>2026-10-11T06:09:43.587Z (createdAt) → "2026-10-11" |
| maintenancetickets | `businessDate` | backfill | 11 | 0 | 11 | 0 | 0 | 0 | createdAt | 2026-10-11T06:09:43.646Z (createdAt) → "2026-10-11"<br>2026-10-11T06:09:43.649Z (createdAt) → "2026-10-11"<br>2026-10-11T06:09:43.654Z (createdAt) → "2026-10-11" |

Schema change shipped with the apply: these fields become `String` matching `^\d{4}-\d{2}-\d{2}$`, written via `toBusinessDate()` from `shared/dates.ts`; new documents get it on create.
