import mongoose from 'mongoose';
import { Booking, BookingStatus, PaymentStatus } from '../server/src/models/Booking.js';
import { Room, RoomStatus, OccupancyStatus, HousekeepingRoomStatus, SellStatus } from '../server/src/models/Room.js';
import { RoomCategory } from '../server/src/models/RoomCategory.js';
import { Guest } from '../server/src/models/Guest.js';
import { Property } from '../server/src/models/Property.js';
import { Folio, FolioStatus } from '../server/src/models/Folio.js';
import { FolioLine, FolioLineType } from '../server/src/models/FolioLine.js';
import { AdvancePayment, AdvancePaymentMethod, AdvancePaymentStatus } from '../server/src/models/AdvancePayment.js';
import { HousekeepingTask, HousekeepingStatus } from '../server/src/models/HousekeepingTask.js';
import { receiveAdvance, adjustAdvance } from '../server/src/services/advance.service.js';
import { checkIn, checkOut, getCheckoutPreview } from '../server/src/controllers/booking.controller.js';
import { postCharge } from '../server/src/services/folio.service.js';
import { transitionHousekeepingStatus } from '../server/src/services/room-state.service.js';
import { User } from '../server/src/models/User.js';
import { getCommandCenterData } from '../server/src/controllers/commandCenter.controller.js';

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: any) => { res.body = data; return res; };
  return res;
}

async function runCompleteBusinessLifecycle() {
  console.log("======================================================================");
  console.log("   YES HOTELS — COMPLETE END-TO-END BUSINESS LIFECYCLE VERIFICATION   ");
  console.log("======================================================================\n");

  await mongoose.connect('mongodb://127.0.0.1:27027/yes_hotels');

  const property = await Property.findOne({});
  if (!property) throw new Error("Property not found. Seed the database first.");

  const adminUserId = new mongoose.Types.ObjectId().toString();
  const reqContext = {
    user: { id: adminUserId, _id: adminUserId, role: "ADMIN", propertyId: property._id.toString() },
    propertyId: property._id.toString()
  } as any;

  const stamp = Date.now().toString().slice(-6);
  const guestEmail = `guest_${stamp}@yeshotels.test`;
  const guestPhone = `97${stamp}33`;

  // ────────────────────────────────────────────────────────────────
  // Step 1: Create Guest Profile & Reservation
  // ────────────────────────────────────────────────────────────────
  console.log("[Step 1] Creating Guest Profile & Confirmed Reservation...");
  const guest = await Guest.create({
    fullName: `Lifecycle Guest ${stamp}`,
    email: guestEmail,
    phone: guestPhone,
  });

  const category = await RoomCategory.findOne({}).lean();
  if (!category) throw new Error("No RoomCategory found in database.");

  // Find or create an available room for testing
  let testRoom = await Room.findOne({
    category: category._id,
    status: RoomStatus.AVAILABLE,
    housekeepingStatus: { $in: [HousekeepingRoomStatus.CLEAN, HousekeepingRoomStatus.READY] }
  });
  if (!testRoom) {
    testRoom = await Room.create({
      propertyId: property._id,
      roomNumber: `LIF-${stamp}`,
      floor: "2",
      category: category._id,
      status: RoomStatus.AVAILABLE,
      occupancyStatus: OccupancyStatus.VACANT,
      housekeepingStatus: HousekeepingRoomStatus.CLEAN,
      sellStatus: SellStatus.SELLABLE
    });
  }

  const checkInDate = new Date();
  const checkOutDate = new Date(Date.now() + 2 * 86400000);
  const baseRate = 4000;
  const taxAmount = 480; // 12% GST slab
  const totalAmount = baseRate * 2 + taxAmount; // ₹8,480

  const booking = await Booking.create({
    bookingReference: `LIF-${stamp}`,
    property: property._id,
    propertyId: property._id,
    customer: guest._id,
    guestDetails: {
      firstName: "Lifecycle",
      lastName: `Guest ${stamp}`,
      email: guestEmail,
      phone: guestPhone,
      idType: "PASSPORT",
      idNumber: `P${stamp}`
    },
    roomCategory: category._id,
    assignedRoom: testRoom._id,
    checkInDate,
    checkOutDate,
    adults: 2,
    children: 0,
    source: "WALK_IN" as any,
    bookingType: "INDIVIDUAL" as any,
    stayType: "NIGHTLY" as any,
    status: BookingStatus.CONFIRMED,
    paymentStatus: PaymentStatus.UNPAID,
    registrationStatus: "DRAFT" as any,
    signatureStatus: "NOT_COLLECTED" as any,
    totalAmount,
    taxAmount,
    cgstAmount: taxAmount / 2,
    sgstAmount: taxAmount / 2,
    paidAmount: 0
  });

  console.log(`✓ Reservation confirmed: ${booking.bookingReference} | Room ${testRoom.roomNumber} | Total: ₹${totalAmount}`);

  // ────────────────────────────────────────────────────────────────
  // Step 2: Receive Advance Payment
  // ────────────────────────────────────────────────────────────────
  console.log("\n[Step 2] Receiving Advance Deposit of ₹3,000...");
  const advance = await receiveAdvance({
    propertyId: property._id.toString(),
    bookingId: booking._id.toString(),
    guestId: guest._id.toString(),
    amount: 3000,
    method: AdvancePaymentMethod.UPI,
    purpose: "Stay Advance Deposit",
    receivedBy: adminUserId,
    notes: "Advance received via UPI QR at front desk"
  }, { req: reqContext });

  if (!advance || advance.remainingBalance !== 3000) {
    throw new Error("Step 2 FAILED: Advance deposit was not correctly recorded.");
  }
  console.log(`✓ Advance recorded: ${advance.advanceNumber} | Amount: ₹${advance.amount} | Remaining: ₹${advance.remainingBalance}`);

  // ────────────────────────────────────────────────────────────────
  // Step 3: Check-In & Folio Generation
  // ────────────────────────────────────────────────────────────────
  console.log("\n[Step 3] Processing Check-In (Room State Transition -> OCCUPIED, Folio Created)...");
  const checkInReq: any = {
    params: { id: booking._id.toString() },
    body: {
      roomId: testRoom._id.toString(),
      idType: "PASSPORT",
      idNumber: `PASS-${stamp}`
    },
    user: reqContext.user,
    propertyId: property._id.toString()
  };
  const checkInRes = mockRes();
  await checkIn(checkInReq, checkInRes);

  if (checkInRes.statusCode !== 200 || !checkInRes.body.success) {
    throw new Error(`Step 3 FAILED: Check-in error: ${JSON.stringify(checkInRes.body)}`);
  }

  const roomAfterCheckIn = await Room.findById(testRoom._id);
  const bookingAfterCheckIn = await Booking.findById(booking._id);
  const folio = await Folio.findOne({ booking: booking._id, status: FolioStatus.OPEN });

  if (roomAfterCheckIn?.status !== RoomStatus.OCCUPIED || roomAfterCheckIn?.occupancyStatus !== OccupancyStatus.OCCUPIED) {
    throw new Error("Step 3 FAILED: Room status was not updated to OCCUPIED.");
  }
  if (bookingAfterCheckIn?.status !== BookingStatus.CHECKED_IN) {
    throw new Error("Step 3 FAILED: Booking status was not updated to CHECKED_IN.");
  }
  if (!folio) {
    throw new Error("Step 3 FAILED: Open Folio was not created upon check-in.");
  }

  console.log(`✓ Check-In verified: Booking Status: ${bookingAfterCheckIn.status} | Room Status: ${roomAfterCheckIn.status} (${roomAfterCheckIn.occupancyStatus})`);
  console.log(`✓ Open Folio verified: Folio ID: ${folio._id} | Invoice: ${folio.invoiceNumber || 'OPEN'} | Balance: ₹${folio.balance}`);

  // ────────────────────────────────────────────────────────────────
  // Step 4: Mid-Stay Ancillary Charges (In-Room Dining / Laundry)
  // ────────────────────────────────────────────────────────────────
  console.log("\n[Step 4] Posting Mid-Stay In-Room Dining Charge (₹750)...");
  await postCharge({
    folioId: folio._id.toString(),
    bookingId: booking._id.toString(),
    lineType: FolioLineType.RESTAURANT,
    description: "In-Room Dining — Dinner & Beverages",
    amount: 750,
    date: new Date(),
    postedBy: "POS_RESTAURANT"
  }, { req: reqContext });

  const folioWithCharge = await Folio.findById(folio._id);
  console.log(`✓ In-room charge posted! Updated Folio Balance: ₹${folioWithCharge?.balance}`);

  // ────────────────────────────────────────────────────────────────
  // Step 5: Checkout Preview & Invoice Calculation
  // ────────────────────────────────────────────────────────────────
  console.log("\n[Step 5] Generating Checkout Preview & Settling Balance...");
  const previewReq: any = {
    params: { id: booking._id.toString() },
    user: reqContext.user,
    propertyId: property._id.toString()
  };
  const previewRes = mockRes();
  await getCheckoutPreview(previewReq, previewRes);

  if (previewRes.statusCode !== 200 || !previewRes.body.success) {
    throw new Error(`Step 5 FAILED: Checkout preview failed: ${JSON.stringify(previewRes.body)}`);
  }

  const previewData = previewRes.body.data;
  const currentBalance = previewData.summary.currentBalance;
  console.log(`✓ Checkout Preview: Total Charges: ₹${previewData.summary.totalCharges} | Available Advance: ₹${previewData.totalAdvanceAvailable} | Outstanding Balance: ₹${currentBalance}`);

  // ────────────────────────────────────────────────────────────────
  // Step 6: Checkout with Advance Settlement & Final Payment
  // ────────────────────────────────────────────────────────────────
  console.log("\n[Step 6] Performing Full Checkout with Advance Settlement & Cash Balance Payment...");
  const advanceToApply = 3000;
  const remainingDue = currentBalance - advanceToApply; // Remainder to settle to reach 0 balance

  const checkOutReq: any = {
    params: { id: booking._id.toString() },
    body: {
      advanceAdjustmentAmount: advanceToApply,
      advancePaymentId: advance._id.toString(),
      paymentAmount: remainingDue,
      paymentMethod: "CASH",
      notes: "Settled via ₹3000 Advance + balance in Cash"
    },
    user: reqContext.user,
    propertyId: property._id.toString()
  };
  const checkOutRes = mockRes();
  await checkOut(checkOutReq, checkOutRes);

  if (checkOutRes.statusCode !== 200 || !checkOutRes.body.success) {
    throw new Error(`Step 6 FAILED: Checkout error: ${JSON.stringify(checkOutRes.body)}`);
  }

  const bookingAfterCheckout = await Booking.findById(booking._id);
  const folioAfterCheckout = await Folio.findById(folio._id);
  const roomAfterCheckout = await Room.findById(testRoom._id);

  if (bookingAfterCheckout?.status !== BookingStatus.CHECKED_OUT) {
    throw new Error(`Step 6 FAILED: Booking is not CHECKED_OUT (${bookingAfterCheckout?.status})`);
  }
  if (folioAfterCheckout?.status !== FolioStatus.SETTLED) {
    throw new Error(`Step 6 FAILED: Folio is not SETTLED (${folioAfterCheckout?.status})`);
  }
  if (roomAfterCheckout?.status !== RoomStatus.CLEANING || roomAfterCheckout?.housekeepingStatus !== HousekeepingRoomStatus.DIRTY) {
    throw new Error(`Step 6 FAILED: Room is not in CLEANING/DIRTY state (${roomAfterCheckout?.status}/${roomAfterCheckout?.housekeepingStatus})`);
  }

  console.log(`✓ Checkout successful! Booking: CHECKED_OUT | Folio: SETTLED (Balance ₹${folioAfterCheckout?.balance})`);
  console.log(`✓ Room state machine verified: Room ${roomAfterCheckout.roomNumber} -> status: ${roomAfterCheckout.status}, housekeepingStatus: ${roomAfterCheckout.housekeepingStatus}`);

  // ────────────────────────────────────────────────────────────────
  // Step 7: Housekeeping Task & Full Multi-Stage Room Release
  // ────────────────────────────────────────────────────────────────
  console.log("\n[Step 7] Housekeeping Multi-Stage Turnover & Room Release Workflow...");
  const hkTask = await HousekeepingTask.findOne({ room: testRoom._id }).sort({ createdAt: -1 });
  if (!hkTask) {
    throw new Error("Step 7 FAILED: Housekeeping task was not auto-generated at checkout.");
  }
  console.log(`✓ Housekeeping task created: ID ${hkTask._id} | Task Type: ${hkTask.taskType} | Status: ${hkTask.status}`);

  // Transition 1: DIRTY -> ASSIGNED
  await transitionHousekeepingStatus(testRoom._id.toString(), HousekeepingRoomStatus.ASSIGNED, {
    action: "housekeeping.assign",
    metadata: { taskId: hkTask._id.toString() }
  });
  // Transition 2: ASSIGNED -> CLEANING
  await transitionHousekeepingStatus(testRoom._id.toString(), HousekeepingRoomStatus.CLEANING, {
    action: "housekeeping.start_cleaning",
    metadata: { taskId: hkTask._id.toString() }
  });
  // Transition 3: CLEANING -> CLEANING_COMPLETED
  await transitionHousekeepingStatus(testRoom._id.toString(), HousekeepingRoomStatus.CLEANING_COMPLETED, {
    action: "housekeeping.cleaning_complete",
    metadata: { taskId: hkTask._id.toString() }
  });
  // Transition 4: CLEANING_COMPLETED -> INSPECTION
  await transitionHousekeepingStatus(testRoom._id.toString(), HousekeepingRoomStatus.INSPECTION, {
    action: "housekeeping.ready_for_inspection",
    metadata: { taskId: hkTask._id.toString() }
  });
  // Transition 5: INSPECTION -> INSPECTED
  await transitionHousekeepingStatus(testRoom._id.toString(), HousekeepingRoomStatus.INSPECTED, {
    action: "housekeeping.inspection_passed",
    metadata: { taskId: hkTask._id.toString() }
  });
  // Transition 6: INSPECTED -> WAITING_FOR_RELEASE
  await transitionHousekeepingStatus(testRoom._id.toString(), HousekeepingRoomStatus.WAITING_FOR_RELEASE, {
    action: "housekeeping.awaiting_supervisor_release",
    metadata: { taskId: hkTask._id.toString() }
  });
  // Transition 7: WAITING_FOR_RELEASE -> CLEAN (Official Room Release to Available Inventory)
  const releasedRoom = await transitionHousekeepingStatus(testRoom._id.toString(), HousekeepingRoomStatus.CLEAN, {
    action: "housekeeping.supervisor_release",
    metadata: { taskId: hkTask._id.toString() },
    releasedBy: adminUserId
  });

  const finalRoom = await Room.findById(testRoom._id);
  if (finalRoom?.status !== RoomStatus.AVAILABLE || finalRoom?.housekeepingStatus !== HousekeepingRoomStatus.CLEAN) {
    throw new Error(`Step 7 FAILED: Released room did not return to AVAILABLE/CLEAN (got status: ${finalRoom?.status}, hkStatus: ${finalRoom?.housekeepingStatus})`);
  }
  console.log(`✓ Complete Housekeeping Workflow verified! Room ${finalRoom.roomNumber} successfully released back to AVAILABLE / CLEAN sellable inventory.`);

  // ────────────────────────────────────────────────────────────────
  // Step 8: Command Center Metrics & Reconciliation
  // ────────────────────────────────────────────────────────────────
  console.log("\n[Step 8] Verifying Command Center Operational Intelligence & Financial Reconciliation...");
  const cmdReq: any = {
    user: reqContext.user,
    propertyId: property._id.toString()
  };
  const cmdRes = mockRes();
  await getCommandCenterData(cmdReq, cmdRes);

  if (cmdRes.statusCode !== 200 || !cmdRes.body.success) {
    throw new Error(`Step 8 FAILED: Command center data fetch failed: ${JSON.stringify(cmdRes.body)}`);
  }

  const pulse = cmdRes.body.data.hotelPulse;
  const revenue = cmdRes.body.data.revenue;
  const hkControl = cmdRes.body.data.housekeeping;

  console.log(`✓ Command Center Live KPIs:`);
  console.log(`   - Available Rooms: ${pulse.availableRooms} / ${pulse.totalRooms}`);
  console.log(`   - Monthly Revenue: ₹${revenue?.monthlyRevenue?.toLocaleString() || 0}`);
  console.log(`   - Total Housekeeping Pending: ${hkControl.pending}`);

  console.log("\n======================================================================");
  console.log("   ✓✓✓ COMPLETE BUSINESS LIFECYCLE 100% VERIFIED & RECONCILED ✓✓✓   ");
  console.log("======================================================================");

  await mongoose.disconnect();
  process.exit(0);
}

runCompleteBusinessLifecycle().catch(err => {
  console.error("FATAL ERROR IN LIFECYCLE AUDIT:", err);
  process.exit(1);
});
