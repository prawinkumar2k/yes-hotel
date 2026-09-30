# RBAC Property Scope Matrix

This matrix documents whether a specific `PageResource` is `propertyScoped` (data belongs to a specific property and requires `propertyId` context) or `systemScoped` (applies globally across the platform).

## Property-Scoped Pages
*These pages require the user to have explicitly granted property access for the selected property.*

- **DASHBOARDS**: All Dashboards (Admin, Executive, Front Desk, Housekeeping, Maintenance, Cashier, Restaurant, Finance)
- **FRONT OFFICE**: Front Desk, Guest Registration, Room Rack, Bookings, Check-In, Check-Out, In-House Guests, Guests, Calendar, Enquiries
- **ROOM MANAGEMENT**: Rooms, Room Categories, Housekeeping, Maintenance
- **FINANCE**: Payments, Advances, Refunds, Cashier Shifts, Night Audit, Accounting
- **REVENUE**: Rate Plans, Pricing, Coupons
- **RESTAURANT**: Restaurant POS, Menu Management
- **INVENTORY**: Inventory, Vendors, Procurement
- **CORPORATE**: Corporate Accounts, Group Bookings, Banquets, Ancillary
- **REPORTS**: Reports Layout, Day Sales Summary, Monthly MIS
- **CRM**: Complaints, Reviews, Contact Messages
- **ADMINISTRATION**: Staff Profiles, Task Approvals

## System-Scoped Pages
*These pages evaluate permissions globally across the tenant.*

- **SYSTEM ADMINISTRATION**:
  - `USERS`: User Management
  - `ROLES`: Role Management
  - `PERMISSIONS`: Access Matrix
  - `PROPERTIES`: Property Management
  - `SETTINGS`: Global System Settings
  - `PAYMENT_CHANNELS`: Global Payment Gateway Configuration
  - `AUDIT_LOGS`: System-Wide Audit Logs
  - `CONTENT_MANAGEMENT`: Website Content, FAQs, Gallery, Testimonials
