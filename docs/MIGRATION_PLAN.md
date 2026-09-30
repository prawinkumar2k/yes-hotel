# Property Isolation Migration Plan

## Overview
This plan outlines the steps to safely migrate the existing Yes Hotels database to support strict property isolation, ensuring every property-owned record belongs to a specific property.

## 1. Schema Updates
We will add `propertyId` (Single property) and/or `propertyIds` (Multiple properties) to the relevant Mongoose schemas.
- **User Model**: Add `propertyId` and `propertyIds`.
- **Property-Owned Models**: Add `propertyId` to `Booking`, `Room`, `Folio`, `Payment`, `AdvancePayment`, `Guest`, `HousekeepingTask`, `MaintenanceTicket`, `InventoryItem`, `PurchaseOrder`, `RestaurantOrder`, etc.
- **Child Models**: Models like `FolioLine`, `BookingEvent`, `PaymentReceipt` inherit property context from their parent, but we may denormalize `propertyId` onto them for easier querying if needed, or enforce via parent verification.

## 2. Default Property Selection
To ensure existing records are not orphaned during migration, we will identify the default property (or create one if none exists, e.g., "Yes Hotels Hyderabad"). All existing non-assigned records will be assigned to this default property.

## 3. Migration Script Execution
A script `scripts/migrate-property-ownership.mjs` has been created.
It will:
1. Find or create the default property.
2. Iterate through all major collections (`users`, `bookings`, `rooms`, `folios`, `payments`, etc.).
3. If a record lacks a `propertyId`, update it with the default property's ID.
4. Provide counts (Before, After, Unassigned) for each collection.
5. Dry-run capability can be enabled to verify counts without modifying data.

## 4. Codebase Updates
After data migration:
- **Server Context**: Implement `requirePropertyAccess` middleware to validate `req.headers['x-property-id']` against the user's `propertyId`/`propertyIds`.
- **Query Scoping**: Audit all Mongoose queries to include `propertyId: authorizedPropertyId`.
- **IDOR Protection**: Ensure all endpoints verify the record's `propertyId` matches the user's authorized property.
- **Frontend Context**: Add a property switcher (for multi-property users) and ensure all API requests include the active property context.

## 5. Verification
- Run a 2-property test workflow.
- Ensure cross-property data access returns 403.
- Verify financial reports (Revenue, Payments) are strictly isolated.
