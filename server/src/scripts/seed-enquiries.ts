import mongoose from "mongoose";
import dotenv from "dotenv";
import { BookingEnquiry, BookingEnquiryStatus, EnquirySource, EnquiryType, EnquiryPriority } from "../models/BookingEnquiry";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27027/yes_hotels";

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB");

  const existingCount = await BookingEnquiry.countDocuments();
  if (existingCount > 0) {
    console.log(`Already have ${existingCount} enquiries in DB. Ensuring bookingStage is populated.`);
    await BookingEnquiry.updateMany(
      { bookingStage: { $exists: false } },
      { $set: { bookingStage: "CHATBOT_CONTACT_COLLECTED" } }
    );
  }

  const today = new Date();
  const d1 = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000);
  const d2 = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
  const d3 = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000);
  const d4 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const sampleEnquiries = [
    {
      enquiryNumber: `ENQ-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}-0001`,
      guestName: "Arjun Verma",
      phone: "+91 98450 12345",
      email: "arjun.verma@example.com",
      checkIn: d1,
      checkOut: d2,
      nights: 2,
      adults: 2,
      children: 0,
      rooms: 1,
      roomType: "Executive Suite",
      source: EnquirySource.WEBSITE,
      bookingStage: "PAYMENT_PENDING",
      status: BookingEnquiryStatus.NEW,
      priority: EnquiryPriority.HIGH,
      notes: "Guest completed details page and navigated to payment gateway. Awaiting payment completion.",
    },
    {
      enquiryNumber: `ENQ-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}-0002`,
      guestName: "Priya Nair",
      phone: "+91 97412 88990",
      email: "priya.nair@outlook.com",
      checkIn: d2,
      checkOut: d3,
      nights: 2,
      adults: 2,
      children: 1,
      rooms: 1,
      roomType: "Deluxe King Room",
      source: EnquirySource.CHATBOT,
      bookingStage: "CHATBOT_ROOM_SELECTED",
      status: BookingEnquiryStatus.NEW,
      priority: EnquiryPriority.MEDIUM,
      notes: "Enquired via Concierge Chatbot about Deluxe King Room availability for weekend.",
    },
    {
      enquiryNumber: `ENQ-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}-0003`,
      guestName: "Karthik Subramanian",
      phone: "+91 98860 44556",
      email: "karthik.s@techcorp.in",
      company: "TechCorp Systems",
      checkIn: d3,
      checkOut: d4,
      nights: 2,
      adults: 4,
      children: 0,
      rooms: 2,
      roomType: "Deluxe Twin Room",
      source: EnquirySource.CHATBOT,
      bookingStage: "CHATBOT_CONTACT_COLLECTED",
      status: BookingEnquiryStatus.FOLLOW_UP,
      priority: EnquiryPriority.HIGH,
      notes: "Chatbot concierge lead. Shared phone and requirements, requesting corporate rate.",
      nextFollowUpDate: new Date(today.getTime() + 12 * 60 * 60 * 1000),
    },
  ];

  for (const enq of sampleEnquiries) {
    const exists = await BookingEnquiry.findOne({ enquiryNumber: enq.enquiryNumber });
    if (!exists) {
      await BookingEnquiry.create(enq);
      console.log(`Created enquiry: ${enq.enquiryNumber} (${enq.guestName}) - Stage: ${enq.bookingStage}`);
    } else {
      await BookingEnquiry.updateOne({ enquiryNumber: enq.enquiryNumber }, { $set: enq });
      console.log(`Updated enquiry: ${enq.enquiryNumber}`);
    }
  }

  const total = await BookingEnquiry.countDocuments();
  console.log(`Total enquiries in database now: ${total}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
