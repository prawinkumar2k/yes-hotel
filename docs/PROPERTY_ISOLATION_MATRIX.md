# PROPERTY ISOLATION MATRIX

## OVERVIEW
Property Isolation is a P0 requirement. Currently, the database models do not enforce property references consistently. This document outlines which models have `property` references and which are missing them.

## MODEL ISOLATION STATUS

| Model | Has Property Ref | Notes |
|-------|-----------------|-------|
| Booking | Partial | `property` field exists but is optional. |
| ChannelMapping | Yes | `propertyId` exists and is required. |
| Folio | No | Missing property isolation. Inherits from Booking? |
| Room | No | Rooms are currently global. |
| Guest | No | Guests are global across properties. |
| AdvancePayment | No | Financial records are not scoped to a property. |
| PaymentReceipt | No | Financial records are not scoped to a property. |
| User | No | Users lack strict property scoping for authorization. |

## CONTROLLER ISOLATION STATUS

| Controller | Isolation Enforced | Notes |
|------------|--------------------|-------|
| BookingController | No | `Booking.find()` does not consistently inject `req.user.propertyId`. |
| RoomController | No | `Room.find()` fetches all rooms. |
| FolioController | No | `Folio.find()` fetches globally. |

## ACTION PLAN
1. Add `property` (`Schema.Types.ObjectId`) to `Room`, `Folio`, `AdvancePayment`, `PaymentReceipt`, `Guest`, and `User`.
2. Update all API endpoints (GET lists, POST creations) to require and validate `req.user.propertyId`.
3. Update the `authorize` middleware to inject `req.user.propertyId` into query objects automatically.
