# Room-night inventory backfill — dry run

Generated 2026-10-13T05:14:17.069Z against `yes_hotels`. **Nothing was changed.**

- Bookings with an assigned room (CONFIRMED / CHECKED_IN / CHECKED_OUT): **53**
- Room-night documents to insert into the new `roomnights` collection: **130** (unique index on room + date)
- Bookings with no nights (same-day): 0
- **Conflicts (same room, same night, more than one booking): 0**

No conflicts: the unique index can be created as-is.

Existing data is not modified; this only inserts into a new collection.
