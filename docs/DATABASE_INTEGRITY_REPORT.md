# DATABASE INTEGRITY REPORT

Generated at: 2026-09-30T11:41:14.573Z
Database URI: mongodb://127.0.0.1:27027/yes_hotels

## Collections Overview

| Collection | Document Count | Indexes |
|------------|----------------|---------|
| businessdates | 0 | 4 |
| restaurantorders | 4 | 2 |
| auditlogs | 4 | 5 |
| roles | 11 | 2 |
| testimonials | 5 | 1 |
| roomcategories | 4 | 2 |
| stocktransactions | 0 | 2 |
| corporateaccounts | 3 | 2 |
| inspectionresults | 0 | 4 |
| coupons | 4 | 2 |
| hotelsettings | 1 | 1 |
| userpermissionoverrides | 0 | 2 |
| ancillaryservices | 12 | 2 |
| loyaltytransactions | 0 | 1 |
| paymentchannels | 0 | 2 |
| purchaseorders | 4 | 2 |
| contactmessages | 0 | 1 |
| taskapprovals | 0 | 3 |
| cashiershifts | 0 | 2 |
| channelmappings | 5 | 2 |
| properties | 1 | 2 |
| refreshtokens | 36 | 5 |
| staffprofiles | 0 | 2 |
| reviews | 10 | 2 |
| refunds | 0 | 3 |
| pageresources | 35 | 2 |
| vendors | 4 | 2 |
| bookings | 1 | 14 |
| bookingevents | 1 | 4 |
| users | 14 | 2 |
| menuitems | 18 | 4 |
| galleries | 15 | 1 |
| bookinginventorydays | 1 | 3 |
| rateplans | 5 | 2 |
| inventoryitems | 8 | 2 |
| rolepermissions | 99 | 2 |
| jobs | 0 | 3 |
| banquetbookings | 5 | 2 |
| advancepayments | 0 | 6 |
| webhookevents | 0 | 2 |
| inspectiontemplates | 0 | 2 |
| maintenancetickets | 0 | 1 |
| rooms | 19 | 7 |
| complaints | 0 | 1 |
| bookingidempotencies | 1 | 3 |
| passwordresettokens | 0 | 2 |
| notificationlogs | 0 | 3 |
| bookingenquiries | 0 | 1 |
| folios | 1 | 4 |
| foliolines | 2 | 8 |
| websitecontents | 2 | 2 |
| housekeepingtasks | 1 | 4 |
| advanceadjustments | 0 | 4 |
| faqs | 8 | 1 |
| payments | 0 | 4 |
| guests | 1 | 3 |
| groupbookings | 4 | 2 |
| pricingrules | 0 | 1 |

## Detailed Collection Analysis

### businessdates
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - isCurrentDate_1 (Keys: {"isCurrentDate":1})
  - date_1 (Keys: {"date":1})
  - state_1 (Keys: {"state":1})

### restaurantorders
- **Count:** 4
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, kotNumber, roomNumber, bookingId, items, subtotal, taxAmount, grandTotal, status, chargeToFolio, notes, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - kotNumber_1 (Keys: {"kotNumber":1})

### auditlogs
- **Count:** 4
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, actorType, actorId, actorRole, action, resourceType, resourceId, metadata, ipAddress, userAgent, createdAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - actorId_1 (Keys: {"actorId":1})
  - action_1 (Keys: {"action":1})
  - resourceType_1_resourceId_1 (Keys: {"resourceType":1,"resourceId":1})
  - createdAt_-1 (Keys: {"createdAt":-1})

### roles
- **Count:** 11
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, key, createdAt, description, isActive, isSystem, name, updatedAt, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - key_1 (Keys: {"key":1})

### testimonials
- **Count:** 5
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, name, location, rating, comment, isPublished, displayOrder, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})

### roomcategories
- **Count:** 4
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, slug, name, description, basePrice, capacity, bedType, amenities, images, isActive, displayOrder, featured, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - slug_1 (Keys: {"slug":1})

### stocktransactions
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - transactionNumber_1 (Keys: {"transactionNumber":1})

### corporateaccounts
- **Count:** 3
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, companyName, companyCode, gstNumber, contactPerson, contactEmail, contactPhone, creditLimit, currentOutstanding, discountPercentage, isActive, notes, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - companyCode_1 (Keys: {"companyCode":1})

### inspectionresults
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - room_1 (Keys: {"room":1})
  - room_1_inspectedAt_-1 (Keys: {"room":1,"inspectedAt":-1})
  - housekeepingTask_1 (Keys: {"housekeepingTask":1})

### coupons
- **Count:** 4
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, code, description, discountType, discountValue, minBookingAmount, maxDiscount, applicableRoomCategories, startDate, expiryDate, usageLimit, perUserLimit, timesUsed, isActive, createdBy, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - code_1 (Keys: {"code":1})

### hotelsettings
- **Count:** 1
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, hotelName, phone, email, address, checkInTime, checkOutTime, earlyCheckInFee, lateCheckOutFee, maxOccupancyBuffer, currency, currencySymbol, gstPercentage, cgstPercentage, sgstPercentage, igstPercentage, taxInclusiveRates, invoicePrefix, advancePrefix, receiptPrefix, cancellationPolicy, cancellationFreeHours, cancellationPenaltyPercentage, businessDateEnabled, nightAuditTime, allowBackdatedCorrections, requireInspectionBeforeRelease, requireManualReleaseAfterInspection, updatedBy, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})

### userpermissionoverrides
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - userId_1_propertyId_1_pageKey_1 (Keys: {"userId":1,"propertyId":1,"pageKey":1})

### ancillaryservices
- **Count:** 12
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, serviceNumber, category, serviceName, roomNumber, guestName, amount, taxAmount, totalAmount, isChargedToFolio, performedBy, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - serviceNumber_1 (Keys: {"serviceNumber":1})

### loyaltytransactions
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})

### paymentchannels
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - code_1 (Keys: {"code":1})

### purchaseorders
- **Count:** 4
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, poNumber, vendor, vendorName, items, totalAmount, status, issuedDate, expectedDeliveryDate, createdBy, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - poNumber_1 (Keys: {"poNumber":1})

### contactmessages
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})

### taskapprovals
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - status_1_createdAt_-1 (Keys: {"status":1,"createdAt":-1})
  - requestedBy_1 (Keys: {"requestedBy":1})

### cashiershifts
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - shiftNumber_1 (Keys: {"shiftNumber":1})

### channelmappings
- **Count:** 5
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, propertyId, roomCategoryId, channel, channelRoomTypeId, channelPropertyId, isActive, lastSyncedAt, lastSyncStatus, markupPercent, createdAt, updatedAt, __v
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - propertyId_1_roomCategoryId_1_channel_1 (Keys: {"propertyId":1,"roomCategoryId":1,"channel":1})

### properties
- **Count:** 1
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, name, code, legalName, gstin, pan, addressLine1, city, state, pincode, country, phone, email, website, starRating, totalRooms, timezone, currency, isActive, isHeadOffice, createdAt, updatedAt, __v
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - code_1 (Keys: {"code":1})

### refreshtokens
- **Count:** 36
- **Missing PropertyId:** 1 (If applicable)
- **Sample Fields:** _id, user, tokenHash, family, expiresAt, createdAt, __v, revokedAt, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - tokenHash_1 (Keys: {"tokenHash":1})
  - family_1 (Keys: {"family":1})
  - expiresAt_1 (Keys: {"expiresAt":1})
  - user_1 (Keys: {"user":1})

### staffprofiles
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - user_1 (Keys: {"user":1})

### reviews
- **Count:** 10
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, user, booking, rating, title, comment, status, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - booking_1 (Keys: {"booking":1})

### refunds
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - payment_1 (Keys: {"payment":1})
  - status_1_createdAt_-1 (Keys: {"status":1,"createdAt":-1})

### pageresources
- **Count:** 35
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, key, actions, createdAt, isActive, isSystem, module, name, propertyScoped, route, updatedAt, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - key_1 (Keys: {"key":1})

### vendors
- **Count:** 4
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, vendorCode, name, gstin, contactPerson, email, phone, paymentTerms, rating, isActive, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - vendorCode_1 (Keys: {"vendorCode":1})

### bookings
- **Count:** 1
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, bookingReference, billNumber, guestDetails, arrivalTime, departureTime, mealPlan, extraPersonsNoBed, extraPersonsWithBed, extraChildrenNoBed, extraChildrenWithBed, kidsUnder3, ratePerNight, billingInstruction, registrationStatus, signatureStatus, roomCategory, assignedRoom, checkInDate, checkOutDate, adults, children, status, totalAmount, taxAmount, cgstAmount, sgstAmount, paidAmount, paymentStatus, discountAmount, couponRedeemed, source, bookingType, stayType, isVipGuest, cancellationPenalty, createdAt, updatedAt, __v, checkedInAt, checkedInBy, folio, propertyId, checkedOutAt, checkedOutBy
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - bookingReference_1 (Keys: {"bookingReference":1})
  - status_1_checkInDate_1_checkOutDate_1 (Keys: {"status":1,"checkInDate":1,"checkOutDate":1})
  - customer_1_createdAt_-1 (Keys: {"customer":1,"createdAt":-1})
  - roomCategory_1 (Keys: {"roomCategory":1})
  - checkInDate_1_status_1 (Keys: {"checkInDate":1,"status":1})
  - checkOutDate_1_status_1 (Keys: {"checkOutDate":1,"status":1})
  - assignedRoom_1_status_1 (Keys: {"assignedRoom":1,"status":1})
  - source_1_createdAt_-1 (Keys: {"source":1,"createdAt":-1})
  - isVipGuest_1_checkInDate_1 (Keys: {"isVipGuest":1,"checkInDate":1})
  - billNumber_1 (Keys: {"billNumber":1})
  - guestDetails.phone_1 (Keys: {"guestDetails.phone":1})
  - property_1_checkInDate_1 (Keys: {"property":1,"checkInDate":1})
  - registrationStatus_1_checkInDate_-1 (Keys: {"registrationStatus":1,"checkInDate":-1})

### bookingevents
- **Count:** 1
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, booking, eventType, description, performedBy, performedByRole, roomId, performedAt, createdAt, __v
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - booking_1 (Keys: {"booking":1})
  - booking_1_performedAt_-1 (Keys: {"booking":1,"performedAt":-1})
  - eventType_1_performedAt_-1 (Keys: {"eventType":1,"performedAt":-1})

### users
- **Count:** 14
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, firstName, lastName, email, passwordHash, role, isActive, isEmailVerified, createdAt, updatedAt, __v, lastLogin, propertyIds, name, password, status, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - email_1 (Keys: {"email":1})

### menuitems
- **Count:** 18
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, name, sku, category, price, taxRatePercent, foodType, isAvailable, isActive, kdsStation, modifiers, displayOrder, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - sku_1 (Keys: {"sku":1})
  - category_1_displayOrder_1 (Keys: {"category":1,"displayOrder":1})
  - isActive_1_isAvailable_1 (Keys: {"isActive":1,"isAvailable":1})

### galleries
- **Count:** 15
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, title, imageUrl, category, altText, featured, published, displayOrder, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})

### bookinginventorydays
- **Count:** 1
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, stayDate, roomCategory, __v, capacity, createdAt, reservedCount, updatedAt, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - roomCategory_1_stayDate_1 (Keys: {"roomCategory":1,"stayDate":1})
  - stayDate_1 (Keys: {"stayDate":1})

### rateplans
- **Count:** 5
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, name, code, mealPlan, cancellationPolicy, multiplier, isActive, notes, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - code_1 (Keys: {"code":1})

### inventoryitems
- **Count:** 8
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, itemCode, name, category, unit, minStockLevel, currentStock, reorderQuantity, unitCost, storeLocation, isActive, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - itemCode_1 (Keys: {"itemCode":1})

### rolepermissions
- **Count:** 99
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, roleId, pageKey, actions, createdAt, isActive, updatedAt, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - roleId_1_pageKey_1 (Keys: {"roleId":1,"pageKey":1})

### jobs
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - status_1_nextAttemptAt_1 (Keys: {"status":1,"nextAttemptAt":1})
  - type_1_status_1 (Keys: {"type":1,"status":1})

### banquetbookings
- **Count:** 5
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, bookingNumber, eventName, clientName, clientPhone, hallName, eventDate, startTime, endTime, expectedPax, menuPackage, ratePerPax, totalEstimatedAmount, advancePaid, status, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - bookingNumber_1 (Keys: {"bookingNumber":1})

### advancepayments
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - advanceNumber_1 (Keys: {"advanceNumber":1})
  - booking_1 (Keys: {"booking":1})
  - guest_1_status_1 (Keys: {"guest":1,"status":1})
  - status_1_createdAt_-1 (Keys: {"status":1,"createdAt":-1})
  - receivedAt_-1 (Keys: {"receivedAt":-1})

### webhookevents
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - provider_1_eventId_1 (Keys: {"provider":1,"eventId":1})

### inspectiontemplates
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - isDefault_1 (Keys: {"isDefault":1})

### maintenancetickets
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})

### rooms
- **Count:** 19
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, roomNumber, category, floor, status, occupancyStatus, housekeepingStatus, sellStatus, isAccessible, isConnecting, isSmokingAllowed, sortOrder, createdAt, updatedAt, __v, frontDeskStatus, notes, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - roomNumber_1 (Keys: {"roomNumber":1})
  - floor_number_1_sortOrder_1 (Keys: {"floor_number":1,"sortOrder":1})
  - housekeepingStatus_1 (Keys: {"housekeepingStatus":1})
  - sellStatus_1_category_1 (Keys: {"sellStatus":1,"category":1})
  - status_1_category_1 (Keys: {"status":1,"category":1})
  - currentBooking_1 (Keys: {"currentBooking":1})

### complaints
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})

### bookingidempotencies
- **Count:** 1
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, key, __v, createdAt, requestHash, status, updatedAt, errorMessage, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - key_1 (Keys: {"key":1})
  - status_1_createdAt_-1 (Keys: {"status":1,"createdAt":-1})

### passwordresettokens
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - expiresAt_1 (Keys: {"expiresAt":1})

### notificationlogs
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - recipientEmail_1_createdAt_-1 (Keys: {"recipientEmail":1,"createdAt":-1})
  - bookingId_1 (Keys: {"bookingId":1})

### bookingenquiries
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})

### folios
- **Count:** 1
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, booking, guest, room, checkInDate, checkOutDate, status, totalCharges, totalDiscounts, totalTax, totalPaid, totalAdvanceAdjusted, balance, cgst, sgst, igst, createdAt, updatedAt, __v, propertyId, closedAt, closedBy, invoiceGeneratedAt, invoiceNumber
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - booking_1 (Keys: {"booking":1})
  - status_1_booking_1 (Keys: {"status":1,"booking":1})
  - invoiceNumber_1 (Keys: {"invoiceNumber":1})

### foliolines
- **Count:** 2
- **Missing PropertyId:** 1 (If applicable)
- **Sample Fields:** _id, folio, booking, lineType, direction, description, amount, quantity, date, postedAt, postedBy, createdAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - folio_1 (Keys: {"folio":1})
  - folio_1_postedAt_1 (Keys: {"folio":1,"postedAt":1})
  - businessDate_1_lineType_1 (Keys: {"businessDate":1,"lineType":1})
  - booking_1_lineType_1 (Keys: {"booking":1,"lineType":1})
  - folio_1_createdAt_-1 (Keys: {"folio":1,"createdAt":-1})
  - direction_1_createdAt_-1 (Keys: {"direction":1,"createdAt":-1})
  - lineType_1_direction_1_createdAt_-1 (Keys: {"lineType":1,"direction":1,"createdAt":-1})

### websitecontents
- **Count:** 2
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, key, title, subtitle, images, metadata, isPublished, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - key_1 (Keys: {"key":1})

### housekeepingtasks
- **Count:** 1
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, propertyId, room, taskType, status, priority, notes, amenitiesDelivered, reportedIssues, createdAt, updatedAt, __v
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - status_1_priority_-1_createdAt_1 (Keys: {"status":1,"priority":-1,"createdAt":1})
  - assignedTo_1_status_1 (Keys: {"assignedTo":1,"status":1})
  - room_1_createdAt_-1 (Keys: {"room":1,"createdAt":-1})

### advanceadjustments
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - advancePayment_1 (Keys: {"advancePayment":1})
  - booking_1_type_1 (Keys: {"booking":1,"type":1})
  - folio_1 (Keys: {"folio":1})

### faqs
- **Count:** 8
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, question, answer, category, displayOrder, isPublished, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})

### payments
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - razorpayPaymentId_1 (Keys: {"razorpayPaymentId":1})
  - booking_1 (Keys: {"booking":1})
  - status_1_createdAt_-1 (Keys: {"status":1,"createdAt":-1})

### guests
- **Count:** 1
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, __v, address, createdAt, dateOfBirth, email, fullName, gender, idNumber, idType, isBlocked, isVip, loyaltyPoints, loyaltyTier, nationality, phone, totalBookings, totalSpend, updatedAt, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - email_1 (Keys: {"email":1})
  - fullName_text_email_text_phone_text (Keys: {"_fts":"text","_ftsx":1})

### groupbookings
- **Count:** 4
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** _id, groupName, groupCode, organiserName, organiserEmail, organiserPhone, corporateAccountId, checkIn, checkOut, nights, totalRooms, roomBlocks, totalPax, eventType, mealPlan, totalEstimatedValue, advancePaid, balance, status, assignedBookings, notes, createdAt, updatedAt, __v, propertyId
- **Indexes:**
  - _id_ (Keys: {"_id":1})
  - groupCode_1 (Keys: {"groupCode":1})

### pricingrules
- **Count:** 0
- **Missing PropertyId:** 0 (If applicable)
- **Sample Fields:** No documents
- **Indexes:**
  - _id_ (Keys: {"_id":1})

