# Role Permission Matrix

## Administrator (ADMIN)

| Module | Page | VIEW | CREATE | EDIT | DELETE | APPROVE | REJECT | EXPORT | PRINT | SPECIAL ACTIONS |
|--------|------|------|--------|------|--------|---------|--------|--------|-------|-----------------|
| ADMINISTRATION | Access Matrix | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| ADMINISTRATION | Property Management | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| ADMINISTRATION | Role Management | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| ADMINISTRATION | User Management | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| DASHBOARDS | Admin Dashboard | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |

## Cashier (CASHIER)

| Module | Page | VIEW | CREATE | EDIT | DELETE | APPROVE | REJECT | EXPORT | PRINT | SPECIAL ACTIONS |
|--------|------|------|--------|------|--------|---------|--------|--------|-------|-----------------|
| DASHBOARDS | Cashier Dashboard | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| FINANCE | Advances | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |  |
| FINANCE | Cashier Shifts | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | OPEN_SHIFT, CLOSE_SHIFT |
| FINANCE | Payments | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |  |

## Customer (CUSTOMER)

| Module | Page | VIEW | CREATE | EDIT | DELETE | APPROVE | REJECT | EXPORT | PRINT | SPECIAL ACTIONS |
|--------|------|------|--------|------|--------|---------|--------|--------|-------|-----------------|

## Events (EVENTS)

| Module | Page | VIEW | CREATE | EDIT | DELETE | APPROVE | REJECT | EXPORT | PRINT | SPECIAL ACTIONS |
|--------|------|------|--------|------|--------|---------|--------|--------|-------|-----------------|
| CORPORATE | Banquets | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| CORPORATE | Group Bookings | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| DASHBOARDS | Events Dashboard | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |

## Finance (FINANCE)

| Module | Page | VIEW | CREATE | EDIT | DELETE | APPROVE | REJECT | EXPORT | PRINT | SPECIAL ACTIONS |
|--------|------|------|--------|------|--------|---------|--------|--------|-------|-----------------|
| DASHBOARDS | Finance Dashboard | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| FINANCE | Accounting | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |  |
| FINANCE | Advances | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | REFUND, ADJUST |
| FINANCE | Cashier Shifts | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | OPEN_SHIFT, CLOSE_SHIFT, RECONCILE |
| FINANCE | Night Audit | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | EXECUTE |
| FINANCE | Payments | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | REFUND |
| FINANCE | Refunds | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ |  |
| REPORTS | Day Sales Summary | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |  |
| REPORTS | Monthly MIS | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |  |
| REPORTS | Reports | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |

## Housekeeping (HOUSEKEEPING)

| Module | Page | VIEW | CREATE | EDIT | DELETE | APPROVE | REJECT | EXPORT | PRINT | SPECIAL ACTIONS |
|--------|------|------|--------|------|--------|---------|--------|--------|-------|-----------------|
| DASHBOARDS | Housekeeping Dashboard | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| FRONT_OFFICE | Room Rack | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| ROOM_MANAGEMENT | Housekeeping | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ASSIGN, UPDATE, INSPECT, RELEASE |
| ROOM_MANAGEMENT | Rooms | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |

## Inventory (INVENTORY)

| Module | Page | VIEW | CREATE | EDIT | DELETE | APPROVE | REJECT | EXPORT | PRINT | SPECIAL ACTIONS |
|--------|------|------|--------|------|--------|---------|--------|--------|-------|-----------------|
| DASHBOARDS | Inventory Dashboard | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| INVENTORY | Inventory | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |  |
| INVENTORY | Procurement | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |  |
| INVENTORY | Vendors | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |  |

## Maintenance (MAINTENANCE)

| Module | Page | VIEW | CREATE | EDIT | DELETE | APPROVE | REJECT | EXPORT | PRINT | SPECIAL ACTIONS |
|--------|------|------|--------|------|--------|---------|--------|--------|-------|-----------------|
| DASHBOARDS | Maintenance Dashboard | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| ROOM_MANAGEMENT | Maintenance | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ASSIGN, RESOLVE, CLOSE |
| ROOM_MANAGEMENT | Rooms | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |

## Manager (MANAGER)

| Module | Page | VIEW | CREATE | EDIT | DELETE | APPROVE | REJECT | EXPORT | PRINT | SPECIAL ACTIONS |
|--------|------|------|--------|------|--------|---------|--------|--------|-------|-----------------|
| DASHBOARDS | Admin Dashboard | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| DASHBOARDS | Executive Dashboard | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| FRONT_OFFICE | Bookings | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| FRONT_OFFICE | Front Desk | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| FRONT_OFFICE | Guests | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| FRONT_OFFICE | In-House Guests | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| FRONT_OFFICE | Room Rack | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| REPORTS | Day Sales Summary | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| REPORTS | Monthly MIS | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| REPORTS | Reports | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| ROOM_MANAGEMENT | Housekeeping | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| ROOM_MANAGEMENT | Maintenance | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |

## Procurement (PROCUREMENT)

| Module | Page | VIEW | CREATE | EDIT | DELETE | APPROVE | REJECT | EXPORT | PRINT | SPECIAL ACTIONS |
|--------|------|------|--------|------|--------|---------|--------|--------|-------|-----------------|
| DASHBOARDS | Procurement Dashboard | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| INVENTORY | Inventory | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| INVENTORY | Procurement | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |  |
| INVENTORY | Vendors | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |  |

## Receptionist (RECEPTIONIST)

| Module | Page | VIEW | CREATE | EDIT | DELETE | APPROVE | REJECT | EXPORT | PRINT | SPECIAL ACTIONS |
|--------|------|------|--------|------|--------|---------|--------|--------|-------|-----------------|
| DASHBOARDS | Front Desk Dashboard | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| FRONT_OFFICE | Bookings | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |  |
| FRONT_OFFICE | Calendar | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| FRONT_OFFICE | Check-In | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | CHECK_IN |
| FRONT_OFFICE | Check-Out | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | CHECK_OUT |
| FRONT_OFFICE | Enquiries | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| FRONT_OFFICE | Front Desk | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| FRONT_OFFICE | Guests | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| FRONT_OFFICE | Guest Registration | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |  |
| FRONT_OFFICE | In-House Guests | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |  |
| FRONT_OFFICE | Room Rack | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |

## Restaurant (RESTAURANT)

| Module | Page | VIEW | CREATE | EDIT | DELETE | APPROVE | REJECT | EXPORT | PRINT | SPECIAL ACTIONS |
|--------|------|------|--------|------|--------|---------|--------|--------|-------|-----------------|
| DASHBOARDS | Restaurant Dashboard | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| RESTAURANT | Menu Management | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |  |
| RESTAURANT | Restaurant POS | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ORDER, SERVE |

