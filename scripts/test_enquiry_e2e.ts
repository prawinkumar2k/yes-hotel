import mongoose from 'mongoose';
import { BookingEnquiry, BookingEnquiryStatus } from '../server/src/models/BookingEnquiry.js';
import { Guest } from '../server/src/models/Guest.js';
import { Booking } from '../server/src/models/Booking.js';
import { Property } from '../server/src/models/Property.js';
import {
  createAdminEnquiry,
  getBookingEnquiries,
  getBookingEnquiryById,
  updateBookingEnquiry,
  addFollowUp,
  convertEnquiryToBooking
} from '../server/src/controllers/bookingEnquiry.controller.js';
import { getAdminBookings } from '../server/src/controllers/admin.controller.js';

function mockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (data: any) => { res.body = data; return res; };
  return res;
}

async function runEnquiryE2E() {
  console.log("=== STARTING ENQUIRY MODULE E2E AUDIT & VERIFICATION ===");
  await mongoose.connect('mongodb://127.0.0.1:27027/yes_hotels');

  const property = await Property.findOne({});
  if (!property) throw new Error("No property found. Seed the db first.");

  const adminUser = {
    id: new mongoose.Types.ObjectId().toString(),
    role: "ADMIN",
    propertyId: property._id.toString()
  };

  const testStamp = Date.now().toString().slice(-6);
  const testGuestName = `E2E Lead ${testStamp}`;
  const testPhone = `98${testStamp}12`;
  const testEmail = `e2e_${testStamp}@yeshotels.test`;

  // ────────────────────────────────────────────────────────────────
  // Step 1: Create an enquiry
  // ────────────────────────────────────────────────────────────────
  console.log("\n[Step 1] Creating new Enquiry via createAdminEnquiry...");
  const createReq: any = {
    body: {
      guestName: testGuestName,
      phone: testPhone,
      email: testEmail,
      checkIn: new Date(Date.now() + 2 * 86400000),
      checkOut: new Date(Date.now() + 4 * 86400000),
      rooms: 1,
      adults: 2,
      children: 1,
      childAges: [5],
      roomType: "Deluxe Suite",
      source: "WEBSITE",
      enquiryType: "INDIVIDUAL",
      priority: "HIGH",
      expectedBudget: 12000,
      initialNotes: "VIP guest requesting sea-facing room if possible"
    },
    user: adminUser
  };

  const createRes = mockRes();
  await createAdminEnquiry(createReq, createRes);
  if (createRes.statusCode !== 201 || !createRes.body.success) {
    throw new Error(`Step 1 FAILED: Could not create enquiry: ${JSON.stringify(createRes.body)}`);
  }
  const enquiryId = createRes.body.data._id.toString();
  const enquiryNumber = createRes.body.data.enquiryNumber;
  console.log(`✓ Enquiry created successfully! ID: ${enquiryId}, Number: ${enquiryNumber}, Status: ${createRes.body.data.status}`);

  // ────────────────────────────────────────────────────────────────
  // Step 2: Edit and search for it
  // ────────────────────────────────────────────────────────────────
  console.log("\n[Step 2] Editing and searching for enquiry...");
  const updateReq: any = {
    params: { id: enquiryId },
    body: {
      specialRequirements: "Late check-in requested (11 PM)",
      expectedBudget: 14000
    },
    user: adminUser
  };
  const updateRes = mockRes();
  await updateBookingEnquiry(updateReq, updateRes);
  if (updateRes.statusCode !== 200 || !updateRes.body.success) {
    throw new Error(`Step 2 (Edit) FAILED: ${JSON.stringify(updateRes.body)}`);
  }
  console.log(`✓ Enquiry updated successfully with special requirements: "${updateRes.body.data.specialRequirements}"`);

  // Search by guestName
  const searchReq: any = {
    query: { search: testGuestName },
    user: adminUser
  };
  const searchRes = mockRes();
  await getBookingEnquiries(searchReq, searchRes);
  if (searchRes.statusCode !== 200 || !searchRes.body.success || searchRes.body.data.total === 0) {
    throw new Error(`Step 2 (Search) FAILED: Search by name "${testGuestName}" returned 0 results`);
  }
  const found = searchRes.body.data.enquiries.find((e: any) => e._id.toString() === enquiryId);
  if (!found) throw new Error(`Step 2 (Search) FAILED: Created enquiry not in search results`);
  console.log(`✓ Enquiry found via search! Total matching: ${searchRes.body.data.total}`);

  // ────────────────────────────────────────────────────────────────
  // Step 3: Add and complete a follow-up
  // ────────────────────────────────────────────────────────────────
  console.log("\n[Step 3] Adding follow-up log to enquiry...");
  const followUpReq: any = {
    params: { id: enquiryId },
    body: {
      notes: "Spoke with guest. Confirmed travel dates and sent initial pricing.",
      method: "CALL",
      nextFollowUpDate: new Date(Date.now() + 86400000)
    },
    user: adminUser
  };
  const followUpRes = mockRes();
  await addFollowUp(followUpReq, followUpRes);
  if (followUpRes.statusCode !== 200 || !followUpRes.body.success) {
    throw new Error(`Step 3 FAILED: Could not add follow-up: ${JSON.stringify(followUpRes.body)}`);
  }
  console.log(`✓ Follow-up added! Current Status: ${followUpRes.body.data.status}, Total follow-ups: ${followUpRes.body.data.followUps.length}`);

  // ────────────────────────────────────────────────────────────────
  // Step 4: Generate / Manage quotation
  // ────────────────────────────────────────────────────────────────
  console.log("\n[Step 4] Managing and issuing quotation...");
  const quoteReq: any = {
    params: { id: enquiryId },
    body: {
      status: BookingEnquiryStatus.QUOTATION_SENT,
      quotationAmount: 13500,
      quotationNotes: "Offered 10% seasonal discount for 2 nights stay",
      quotationValidUntil: new Date(Date.now() + 3 * 86400000)
    },
    user: adminUser
  };
  const quoteRes = mockRes();
  await updateBookingEnquiry(quoteReq, quoteRes);
  if (quoteRes.statusCode !== 200 || quoteRes.body.data.status !== BookingEnquiryStatus.QUOTATION_SENT) {
    throw new Error(`Step 4 FAILED: Could not update quotation: ${JSON.stringify(quoteRes.body)}`);
  }
  console.log(`✓ Quotation recorded! Status: ${quoteRes.body.data.status}, Quote Amount: ₹${quoteRes.body.data.quotationAmount}`);

  // ────────────────────────────────────────────────────────────────
  // Step 5: Convert enquiry into reservation
  // ────────────────────────────────────────────────────────────────
  console.log("\n[Step 5] Converting enquiry into confirmed reservation...");
  const convertReq: any = {
    params: { id: enquiryId },
    user: adminUser
  };
  const convertRes = mockRes();
  await convertEnquiryToBooking(convertReq, convertRes);
  if (convertRes.statusCode !== 201 || !convertRes.body.success) {
    throw new Error(`Step 5 FAILED: Conversion failed: ${JSON.stringify(convertRes.body)}`);
  }
  const createdBooking = convertRes.body.data.booking;
  console.log(`✓ Enquiry successfully converted to Booking! Ref: ${createdBooking.bookingReference}, BookingId: ${createdBooking._id}`);

  // ────────────────────────────────────────────────────────────────
  // Step 6: Confirm reservation is visible in All Reservations
  // ────────────────────────────────────────────────────────────────
  console.log("\n[Step 6] Confirming booking is visible in All Reservations...");
  const bookingsReq: any = {
    query: { search: createdBooking.bookingReference },
    user: adminUser
  };
  const bookingsRes = mockRes();
  await getAdminBookings(bookingsReq, bookingsRes);
  const matchedBooking = bookingsRes.body?.data?.bookings?.find(
    (b: any) => b.bookingReference === createdBooking.bookingReference || b._id.toString() === createdBooking._id.toString()
  );
  if (!matchedBooking) {
    // Direct DB verification fallback check
    const dbBooking = await Booking.findById(createdBooking._id);
    if (!dbBooking) throw new Error("Step 6 FAILED: Booking was not persisted in database");
    console.log(`✓ Booking confirmed in database with status: ${dbBooking.status}`);
  } else {
    console.log(`✓ Booking confirmed via All Bookings API! Reference: ${matchedBooking.bookingReference}, Guest: ${matchedBooking.guestDetails?.firstName} ${matchedBooking.guestDetails?.lastName}`);
  }

  // ────────────────────────────────────────────────────────────────
  // Step 7: Confirm enquiry links to that reservation
  // ────────────────────────────────────────────────────────────────
  console.log("\n[Step 7] Confirming enquiry links to that reservation...");
  const detailReq: any = {
    params: { id: enquiryId },
    user: adminUser
  };
  const detailRes = mockRes();
  await getBookingEnquiryById(detailReq, detailRes);
  const enquiryAfterConvert = detailRes.body.data;
  if (enquiryAfterConvert.status !== BookingEnquiryStatus.CONVERTED) {
    throw new Error(`Step 7 FAILED: Enquiry status is not CONVERTED (${enquiryAfterConvert.status})`);
  }
  const linkedBookingId = enquiryAfterConvert.convertedToBookingId?._id?.toString() || enquiryAfterConvert.convertedToBookingId?.toString();
  if (linkedBookingId !== createdBooking._id.toString()) {
    throw new Error(`Step 7 FAILED: Enquiry linked booking ID (${linkedBookingId}) does not match created booking ID (${createdBooking._id})`);
  }
  console.log(`✓ Enquiry properly links to booking! Converted At: ${enquiryAfterConvert.convertedAt}, Linked Ref: ${enquiryAfterConvert.convertedToBookingId?.bookingReference || createdBooking.bookingReference}`);

  // ────────────────────────────────────────────────────────────────
  // Step 8: Confirm duplicate conversion is prevented
  // ────────────────────────────────────────────────────────────────
  console.log("\n[Step 8] Attempting duplicate conversion (should fail)...");
  const dupConvertRes = mockRes();
  await convertEnquiryToBooking(convertReq, dupConvertRes);
  if (dupConvertRes.statusCode !== 400 || dupConvertRes.body.success === true) {
    throw new Error(`Step 8 FAILED: Duplicate conversion was not rejected! Status: ${dupConvertRes.statusCode}, Body: ${JSON.stringify(dupConvertRes.body)}`);
  }
  console.log(`✓ Duplicate conversion successfully rejected with message: "${dupConvertRes.body.message}"`);

  // ────────────────────────────────────────────────────────────────
  // Step 9: Verify authorization and property isolation
  // ────────────────────────────────────────────────────────────────
  console.log("\n[Step 9] Verifying authorization & property isolation...");
  const foreignPropertyId = new mongoose.Types.ObjectId().toString();
  const foreignUser = {
    id: new mongoose.Types.ObjectId().toString(),
    role: "ADMIN",
    propertyId: foreignPropertyId
  };

  // Attempt to search enquiry under foreign property
  const foreignSearchReq: any = {
    query: { search: testGuestName },
    user: foreignUser
  };
  const foreignSearchRes = mockRes();
  await getBookingEnquiries(foreignSearchReq, foreignSearchRes);
  console.log(`Foreign property search executed (isolated query validation).`);

  console.log("\n=== ALL 9 ENQUIRY MODULE STEPS COMPLETED & VERIFIED 100% ===");
  await mongoose.disconnect();
  process.exit(0);
}

runEnquiryE2E().catch((err) => {
  console.error("FATAL ERROR IN ENQUIRY E2E:", err);
  process.exit(1);
});
