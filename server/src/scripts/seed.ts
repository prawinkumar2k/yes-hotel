import "dotenv/config";
import mongoose from "mongoose";
import { hashPassword } from "../utils/auth";
import { User, UserRole } from "../models/User";
import { RoomCategory } from "../models/RoomCategory";
import { Room, RoomStatus } from "../models/Room";
import { FAQ } from "../models/FAQ";
import { Testimonial } from "../models/Testimonial";
import { Coupon, DiscountType } from "../models/Coupon";
import { Gallery, GalleryCategory } from "../models/Gallery";
import { WebsiteContent } from "../models/WebsiteContent";

// Additional Enterprise Models
import { Property } from "../models/Property";
import { ChannelMapping } from "../models/ChannelMapping";
import { CorporateAccount } from "../models/CorporateAccount";
import { Guest } from "../models/Guest";
import { Booking, BookingStatus, PaymentStatus, BookingSource, BookingType } from "../models/Booking";
import { Folio, FolioStatus } from "../models/Folio";
import { FolioLine, FolioLineType, FolioLineDirection } from "../models/FolioLine";
import { CashierShift, CashierShiftStatus } from "../models/CashierShift";
import { RestaurantOrder, OrderStatus } from "../models/RestaurantOrder";
import { HousekeepingTask, HousekeepingStatus, HousekeepingPriority, HousekeepingTaskType } from "../models/HousekeepingTask";
import { MaintenanceTicket, MaintenancePriority, MaintenanceStatus } from "../models/MaintenanceTicket";
import { Vendor } from "../models/Vendor";
import { InventoryItem, ItemCategory } from "../models/InventoryItem";
import { Review, ReviewStatus } from "../models/Review";
import { MenuItem, MenuItemCategory, FoodType } from "../models/MenuItem";
import { RatePlan, MealPlanType } from "../models/RatePlan";
import { AncillaryService, ServiceCategory } from "../models/AncillaryService";
import { GroupBooking, GroupBookingStatus } from "../models/GroupBooking";
import { BanquetBooking, BanquetStatus } from "../models/BanquetBooking";
import { ContactMessage, ContactStatus } from "../models/ContactMessage";
import { Complaint } from "../models/Complaint";
import { Payment, PaymentMethod, PaymentTxStatus } from "../models/Payment";
import { AdvancePayment, AdvancePaymentStatus, AdvancePaymentMethod } from "../models/AdvancePayment";
import { Refund, RefundStatus } from "../models/Refund";
import { PurchaseOrder, PurchaseOrderStatus } from "../models/PurchaseOrder";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yes_hotels";

// ─── Helpers ──────────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

const FIRST_NAMES = [
  "Rahul", "Ananya", "Vikram", "Priya", "Arjun", "Kavya", "Rohan", "Sneha",
  "Aditya", "Meera", "Karan", "Isha", "Siddharth", "Divya", "Nikhil", "Pooja",
  "Amit", "Riya", "Sanjay", "Neha", "Varun", "Shreya", "Rajesh", "Tanya",
  "Manish", "Aditi", "Suresh", "Kritika", "Deepak", "Anjali",
] as const;
const LAST_NAMES = [
  "Sharma", "Verma", "Patel", "Nair", "Mehta", "Kapoor", "Reddy", "Iyer",
  "Chopra", "Malhotra", "Gupta", "Joshi", "Singh", "Rao", "Bhatia", "Desai",
  "Agarwal", "Menon", "Pillai", "Bose",
] as const;
const CITIES = [
  "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Kolkata",
  "Ahmedabad", "Jaipur", "Kochi", "Goa", "Chandigarh",
] as const;
const INDIA = "India";

function guestEmail(first: string, last: string, n: number) {
  return `${first.toLowerCase()}.${last.toLowerCase()}${n}@example.com`;
}
function guestPhone(n: number) {
  return `+91 9${String(700000000 + n * 137).padStart(9, "0")}`;
}

async function seed() {
  console.log("🌱 YES Hotels — Comprehensive Enterprise Seed Script");
  console.log("Connecting to:", MONGODB_URI.replace(/\/\/.*@/, "//***@"));

  await mongoose.connect(MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  // ─── 1. PROPERTY ────────────────────────────────────────────────────────────
  console.log("\n🏢 Seeding property...");
  let property = await Property.findOne({ code: "YES-HYD" });
  if (!property) {
    property = await Property.create({
      name: "YES Hotels Main Resort & Spa",
      code: "YES-HYD",
      legalName: "YES Hospitality Private Limited",
      gstin: "36AAACY1234F1Z5",
      pan: "AAACY1234F",
      addressLine1: "Plot 42, Jubilee Hills Road No. 36",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500033",
      country: "India",
      phone: "+91 40 4567 8900",
      email: "hyderabad@yeshotels.com",
      website: "https://yeshotels.com",
      starRating: 5,
      totalRooms: 13,
      timezone: "Asia/Kolkata",
      currency: "INR",
      isActive: true,
      isHeadOffice: true,
    });
    console.log("  ✅ Created property: YES Hotels Main Resort & Spa (YES-HYD)");
  } else {
    console.log("  ⏭  Property exists: YES-HYD");
  }

  // ─── 2. USERS ───────────────────────────────────────────────────────────────
  console.log("\n📦 Seeding users...");
  const USERS = [
    { firstName: "Super", lastName: "Admin", email: "admin@yeshotels.com", password: "Admin@123", role: UserRole.ADMIN },
    { firstName: "Hotel", lastName: "Manager", email: "manager@yeshotels.com", password: "Manager@123", role: UserRole.MANAGER },
    { firstName: "Front", lastName: "Desk", email: "reception@yeshotels.com", password: "Reception@123", role: UserRole.RECEPTIONIST },
    { firstName: "Ravi", lastName: "Kumar", email: "reception2@yeshotels.com", password: "Reception@123", role: UserRole.RECEPTIONIST },
    { firstName: "House", lastName: "Keeping", email: "housekeeping@yeshotels.com", password: "House@123", role: UserRole.HOUSEKEEPING },
    { firstName: "Lakshmi", lastName: "Devi", email: "housekeeping2@yeshotels.com", password: "House@123", role: UserRole.HOUSEKEEPING },
    { firstName: "Main", lastName: "Tenance", email: "maintenance@yeshotels.com", password: "Main@123", role: UserRole.MAINTENANCE },
    { firstName: "Ramesh", lastName: "Babu", email: "maintenance2@yeshotels.com", password: "Main@123", role: UserRole.MAINTENANCE },
    { firstName: "John", lastName: "Doe", email: "customer@yeshotels.com", password: "Customer@123", role: UserRole.CUSTOMER },
  ];

  const userMap: Record<string, mongoose.Types.ObjectId> = {};
  const receptionistIds: mongoose.Types.ObjectId[] = [];
  const housekeeperIds: mongoose.Types.ObjectId[] = [];
  const maintainerIds: mongoose.Types.ObjectId[] = [];
  let adminId: mongoose.Types.ObjectId | undefined;
  let managerId: mongoose.Types.ObjectId | undefined;
  let receptionId: mongoose.Types.ObjectId | undefined;
  let hkUserId: mongoose.Types.ObjectId | undefined;
  let maintUserId: mongoose.Types.ObjectId | undefined;
  let customerId: mongoose.Types.ObjectId | undefined;

  for (const u of USERS) {
    let user = await User.findOne({ email: u.email });
    if (user) {
      console.log(`  ⏭  User exists: ${u.email}`);
    } else {
      const passwordHash = await hashPassword(u.password);
      user = await User.create({ ...u, passwordHash, isActive: true, isEmailVerified: true });
      console.log(`  ✅ Created: ${u.email} [${u.role}]`);
    }
    const id = user._id as mongoose.Types.ObjectId;
    userMap[u.role] = id;
    if (u.role === UserRole.ADMIN) adminId = id;
    if (u.role === UserRole.MANAGER) managerId = id;
    if (u.role === UserRole.RECEPTIONIST) { receptionId = receptionId || id; receptionistIds.push(id); }
    if (u.role === UserRole.HOUSEKEEPING) { hkUserId = hkUserId || id; housekeeperIds.push(id); }
    if (u.role === UserRole.MAINTENANCE) { maintUserId = maintUserId || id; maintainerIds.push(id); }
    if (u.role === UserRole.CUSTOMER) customerId = id;
  }

  // ─── 3. ROOM CATEGORIES ────────────────────────────────────────────────────
  console.log("\n📦 Seeding room categories...");
  const CATEGORIES = [
    {
      slug: "standard-room",
      name: "Standard Room",
      description: "A thoughtfully appointed room with all essential amenities for a comfortable stay. Features a plush queen bed, contemporary décor, and a well-equipped workspace.",
      basePrice: 3500,
      capacity: { adults: 2, children: 1 },
      bedType: "Queen Bed",
      size: 320,
      amenities: ["Free Wi-Fi", "Air Conditioning", "Smart TV", "Mini Fridge", "Coffee Maker", "Work Desk", "In-room Safe", "Daily Housekeeping"],
      images: [
        "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1200&q=80",
      ],
    },
    {
      slug: "deluxe-room",
      name: "Deluxe Room",
      description: "An elevated experience featuring a king-sized bed, premium linens, and a partial city view. Modern marble bathroom and curated minibar.",
      basePrice: 6500,
      capacity: { adults: 2, children: 2 },
      bedType: "King Bed",
      size: 480,
      amenities: ["Free Wi-Fi", "Air Conditioning", "55\" Smart TV", "Minibar", "Coffee Maker", "Work Desk", "In-room Safe", "Premium Toiletries", "Bathtub & Shower", "City View"],
      images: [
        "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
      ],
    },
    {
      slug: "executive-room",
      name: "Executive Room",
      description: "Designed for professionals with dedicated living area, high-speed connectivity, and executive lounge access.",
      basePrice: 9500,
      capacity: { adults: 2, children: 2 },
      bedType: "King Bed",
      size: 620,
      amenities: ["Free Wi-Fi (1Gbps)", "Nespresso Machine", "65\" Smart TV", "Full Minibar", "Executive Lounge Access", "In-room Safe", "Rainfall Shower"],
      images: [
        "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80",
      ],
    },
    {
      slug: "suite",
      name: "Signature Suite",
      description: "The pinnacle of luxury at YES Hotels. Featuring living room with private dining, grand master bedroom, and private terrace.",
      basePrice: 18000,
      capacity: { adults: 4, children: 2 },
      bedType: "Super King Bed",
      size: 1200,
      amenities: ["Free Wi-Fi (1Gbps)", "Butler Service", "Private Terrace", "Jacuzzi Bathtub", "Rainfall Shower", "75\" Smart TV"],
      images: [
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80",
      ],
    },
  ];

  const categoryMap: Record<string, mongoose.Types.ObjectId> = {};
  for (const cat of CATEGORIES) {
    let category = await RoomCategory.findOne({ slug: cat.slug });
    if (!category) {
      category = await RoomCategory.create({ ...cat, isActive: true });
      console.log(`  ✅ Created category: ${cat.name} (₹${cat.basePrice}/night)`);
    } else {
      console.log(`  ⏭  Category exists: ${cat.name}`);
    }
    categoryMap[cat.slug] = category._id as mongoose.Types.ObjectId;
  }

  // ─── 4. PHYSICAL ROOMS ──────────────────────────────────────────────────────
  console.log("\n📦 Seeding physical rooms...");
  const ROOMS = [
    { roomNumber: "101", floor: "1", slug: "standard-room" },
    { roomNumber: "102", floor: "1", slug: "standard-room" },
    { roomNumber: "103", floor: "1", slug: "standard-room" },
    { roomNumber: "104", floor: "1", slug: "standard-room" },
    { roomNumber: "105", floor: "1", slug: "standard-room" },
    { roomNumber: "106", floor: "1", slug: "standard-room" },
    { roomNumber: "201", floor: "2", slug: "deluxe-room" },
    { roomNumber: "202", floor: "2", slug: "deluxe-room" },
    { roomNumber: "203", floor: "2", slug: "deluxe-room" },
    { roomNumber: "204", floor: "2", slug: "deluxe-room" },
    { roomNumber: "205", floor: "2", slug: "deluxe-room" },
    { roomNumber: "206", floor: "2", slug: "deluxe-room" },
    { roomNumber: "301", floor: "3", slug: "executive-room" },
    { roomNumber: "302", floor: "3", slug: "executive-room" },
    { roomNumber: "303", floor: "3", slug: "executive-room" },
    { roomNumber: "304", floor: "3", slug: "executive-room" },
    { roomNumber: "401", floor: "4", slug: "suite" },
    { roomNumber: "402", floor: "4", slug: "suite" },
    { roomNumber: "403", floor: "4", slug: "suite" },
  ];

  const roomMap: Record<string, mongoose.Types.ObjectId> = {};
  const roomsBySlug: Record<string, string[]> = {};
  for (const r of ROOMS) {
    let room = await Room.findOne({ roomNumber: r.roomNumber });
    if (!room) {
      room = await Room.create({
        roomNumber: r.roomNumber,
        floor: r.floor,
        category: categoryMap[r.slug],
        status: RoomStatus.AVAILABLE,
      });
      console.log(`  ✅ Created room: ${r.roomNumber} (Floor ${r.floor}) — ${r.slug}`);
    } else {
      console.log(`  ⏭  Room exists: ${r.roomNumber}`);
    }
    roomMap[r.roomNumber] = room._id as mongoose.Types.ObjectId;
    (roomsBySlug[r.slug] ||= []).push(r.roomNumber);
  }
  const ALL_ROOM_NUMBERS = ROOMS.map((r) => r.roomNumber);

  // ─── 5. CHANNEL MAPPINGS ────────────────────────────────────────────────────
  console.log("\n🌐 Seeding channel mappings...");
  const CHANNEL_VALUES = ["BOOKING_COM", "AGODA", "MAKE_MY_TRIP", "STAAH", "GOIBIBO"] as const;
  const CHANNELS: { channel: typeof CHANNEL_VALUES[number]; roomSlug: string; externalId: string; markup: number }[] = [
    { channel: "BOOKING_COM", roomSlug: "deluxe-room", externalId: "BCOM-DLX-01", markup: 5 },
    { channel: "AGODA", roomSlug: "deluxe-room", externalId: "AGD-DLX-01", markup: 8 },
    { channel: "MAKE_MY_TRIP", roomSlug: "executive-room", externalId: "MMT-EXE-01", markup: 10 },
    { channel: "STAAH", roomSlug: "standard-room", externalId: "STAAH-STD-01", markup: 6 },
    { channel: "GOIBIBO", roomSlug: "suite", externalId: "GOIB-SUI-01", markup: 12 },
  ];
  for (const ch of CHANNELS) {
    const exists = await ChannelMapping.findOne({ channel: ch.channel, roomCategoryId: categoryMap[ch.roomSlug] });
    if (!exists) {
      await ChannelMapping.create({
        propertyId: property._id,
        roomCategoryId: categoryMap[ch.roomSlug],
        channel: ch.channel,
        channelRoomTypeId: ch.externalId,
        channelPropertyId: "YES-HYD-PROP",
        isActive: true,
        markupPercent: ch.markup,
        lastSyncedAt: new Date(),
        lastSyncStatus: "SUCCESS",
      });
      console.log(`  ✅ Mapped ${ch.channel} -> ${ch.roomSlug}`);
    }
  }

  // ─── 6. CORPORATE ACCOUNTS ──────────────────────────────────────────────────
  console.log("\n🏢 Seeding corporate accounts...");
  const CORPORATE_ACCOUNTS = [
    { companyName: "Acme Corporation Technologies", companyCode: "ACME-CORP", gstNumber: "36AAACA9876E1Z2", contactPerson: "Rajesh Malhotra", contactEmail: "travel@acme.corp", contactPhone: "+91 98765 43210", creditLimit: 500000, currentOutstanding: 45000, discountPercentage: 15, notes: "Preferred IT Corporate Client with 30-day payment terms" },
    { companyName: "Zenith Pharmaceuticals Ltd", companyCode: "ZENITH-PHARMA", gstNumber: "36AAACZ5566F1Z8", contactPerson: "Deepa Nair", contactEmail: "travel@zenithpharma.com", contactPhone: "+91 98123 45678", creditLimit: 300000, currentOutstanding: 12000, discountPercentage: 10, notes: "Frequent conference bookings" },
    { companyName: "Orion Financial Services", companyCode: "ORION-FIN", gstNumber: "36AAACO3344G1Z1", contactPerson: "Vikas Chandra", contactEmail: "admin@orionfinance.in", contactPhone: "+91 98456 78901", creditLimit: 750000, currentOutstanding: 0, discountPercentage: 20, notes: "Annual retainer client" },
  ];
  const corpAccountMap: Record<string, mongoose.Types.ObjectId> = {};
  for (const ca of CORPORATE_ACCOUNTS) {
    let corpAccount = await CorporateAccount.findOne({ companyCode: ca.companyCode });
    if (!corpAccount) {
      corpAccount = await CorporateAccount.create({ ...ca, isActive: true });
      console.log(`  ✅ Created Corporate Account: ${ca.companyName}`);
    }
    corpAccountMap[ca.companyCode] = corpAccount._id as mongoose.Types.ObjectId;
  }

  // ─── 7. GUESTS (CRM) ────────────────────────────────────────────────────────
  console.log("\n👤 Seeding CRM guest profiles...");
  const LOYALTY_TIERS = ["MEMBER", "SILVER", "GOLD", "PLATINUM"] as const;
  const GUESTS: { fullName: string; email: string; phone: string; city: string; isVip: boolean; loyaltyPoints: number; loyaltyTier: typeof LOYALTY_TIERS[number] }[] = [
    { fullName: "Rahul Sharma", email: "rahul.sharma@example.com", phone: "+91 98111 22334", city: "Mumbai", isVip: true, loyaltyPoints: 1250, loyaltyTier: "GOLD" },
    { fullName: "Ananya Verma", email: "ananya.v@example.com", phone: "+91 98222 33445", city: "Delhi", isVip: false, loyaltyPoints: 350, loyaltyTier: "SILVER" },
    { fullName: "Vikram Patel", email: "vikram.patel@example.com", phone: "+91 98333 44556", city: "Ahmedabad", isVip: true, loyaltyPoints: 3200, loyaltyTier: "PLATINUM" },
  ];
  // Bulk-generate 22 more guests for a realistic CRM volume
  for (let i = 0; i < 22; i++) {
    const first = pick(FIRST_NAMES, i);
    const last = pick(LAST_NAMES, i + 3);
    GUESTS.push({
      fullName: `${first} ${last}`,
      email: guestEmail(first, last, i),
      phone: guestPhone(i),
      city: pick(CITIES, i),
      isVip: i % 6 === 0,
      loyaltyPoints: (i * 137) % 4000,
      loyaltyTier: pick(LOYALTY_TIERS, i),
    });
  }

  const guestMap: Record<string, mongoose.Types.ObjectId> = {};
  const guestIds: mongoose.Types.ObjectId[] = [];
  for (const g of GUESTS) {
    let guest = await Guest.findOne({ email: g.email });
    if (!guest) {
      guest = await Guest.create({ ...g, totalBookings: 1 + (g.loyaltyPoints % 5), totalSpend: 5000 + (g.loyaltyPoints * 8) });
      console.log(`  ✅ Created Guest: ${g.fullName} [${g.loyaltyTier}]`);
    }
    guestMap[g.email] = guest._id as mongoose.Types.ObjectId;
    guestIds.push(guest._id as mongoose.Types.ObjectId);
  }

  // ─── 8. BOOKINGS & FOLIOS ──────────────────────────────────────────────────
  console.log("\n📅 Seeding bookings and live folios...");

  // A) Checked-In Booking (Room 201 - Rahul Sharma)
  let b1 = await Booking.findOne({ bookingReference: "YES-BKG-2010" });
  if (!b1) {
    const checkIn = daysAgo(1);
    const checkOut = daysFromNow(2);

    b1 = await Booking.create({
      bookingReference: "YES-BKG-2010",
      customer: userMap[UserRole.CUSTOMER],
      guestDetails: {
        firstName: "Rahul",
        lastName: "Sharma",
        email: "rahul.sharma@example.com",
        phone: "+91 98111 22334",
        idType: "AADHAAR",
        idNumber: "1234-5678-9012",
        city: "Mumbai",
        country: "India",
      },
      roomCategory: categoryMap["deluxe-room"],
      assignedRoom: roomMap["201"],
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adults: 2,
      children: 0,
      totalAmount: 14170,
      taxAmount: 1170,
      cgstAmount: 585,
      sgstAmount: 585,
      paidAmount: 5000,
      discountAmount: 0,
      status: BookingStatus.CHECKED_IN,
      paymentStatus: PaymentStatus.PARTIAL,
      source: BookingSource.DIRECT_WEBSITE,
      bookingType: BookingType.INDIVIDUAL,
      checkedInAt: checkIn,
    });

    await Room.findByIdAndUpdate(roomMap["201"], { status: RoomStatus.OCCUPIED });

    const folio1 = await Folio.create({
      booking: b1._id,
      guest: guestMap["rahul.sharma@example.com"],
      room: roomMap["201"],
      checkInDate: checkIn,
      checkOutDate: checkOut,
      status: FolioStatus.OPEN,
      totalCharges: 13000,
      totalDiscounts: 0,
      totalTax: 2340,
      totalPaid: 5000,
      totalAdvanceAdjusted: 0,
      balance: 10340,
      cgst: 1170,
      sgst: 1170,
      igst: 0,
    });

    await FolioLine.create({
      folio: folio1._id,
      booking: b1._id,
      lineType: FolioLineType.ROOM_CHARGE,
      direction: FolioLineDirection.DEBIT,
      description: "Room Charge - Deluxe 201 (Night 1)",
      amount: 6500,
      date: checkIn,
      postedBy: "Front Desk",
      postedAt: checkIn,
    });
    await FolioLine.create({
      folio: folio1._id,
      booking: b1._id,
      lineType: FolioLineType.TAX_CGST,
      direction: FolioLineDirection.DEBIT,
      description: "CGST on Room Charge",
      amount: 585,
      date: checkIn,
      postedBy: "Front Desk",
      postedAt: checkIn,
    });
    await FolioLine.create({
      folio: folio1._id,
      booking: b1._id,
      lineType: FolioLineType.TAX_SGST,
      direction: FolioLineDirection.DEBIT,
      description: "SGST on Room Charge",
      amount: 585,
      date: checkIn,
      postedBy: "Front Desk",
      postedAt: checkIn,
    });
    await FolioLine.create({
      folio: folio1._id,
      booking: b1._id,
      lineType: FolioLineType.PAYMENT,
      direction: FolioLineDirection.CREDIT,
      description: "Advance Deposit via UPI",
      amount: 5000,
      date: checkIn,
      postedBy: "Front Desk",
      postedAt: checkIn,
    });
    console.log("  ✅ Created checked-in booking: YES-BKG-2010 (Room 201)");
  }

  // B) Upcoming Confirmed Booking (Room 301 - Ananya Verma)
  let b2 = await Booking.findOne({ bookingReference: "YES-BKG-3010" });
  if (!b2) {
    const checkIn = daysFromNow(1);
    const checkOut = daysFromNow(3);

    b2 = await Booking.create({
      bookingReference: "YES-BKG-3010",
      guestDetails: {
        firstName: "Ananya",
        lastName: "Verma",
        email: "ananya.v@example.com",
        phone: "+91 98222 33445",
        city: "Delhi",
        country: "India",
      },
      roomCategory: categoryMap["executive-room"],
      assignedRoom: roomMap["301"],
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adults: 1,
      children: 0,
      totalAmount: 22420,
      taxAmount: 3420,
      cgstAmount: 1710,
      sgstAmount: 1710,
      paidAmount: 22420,
      discountAmount: 0,
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      source: BookingSource.DIRECT_WEBSITE,
      bookingType: BookingType.INDIVIDUAL,
    });
    console.log("  ✅ Created confirmed booking: YES-BKG-3010 (Room 301)");
  }

  // C) A second checked-in stay, a cancelled booking, a no-show and a pending
  // walk-in — so front-desk views (arrivals/departures/cancellations) aren't
  // showing an empty state during a demo.
  let b3 = await Booking.findOne({ bookingReference: "YES-BKG-2020" });
  if (!b3) {
    const checkIn = daysAgo(2);
    const checkOut = daysFromNow(1);
    b3 = await Booking.create({
      bookingReference: "YES-BKG-2020",
      guestDetails: { firstName: "Vikram", lastName: "Patel", email: "vikram.patel@example.com", phone: "+91 98333 44556", city: "Ahmedabad", country: INDIA, idType: "PASSPORT", idNumber: "P1234567" },
      roomCategory: categoryMap["suite"],
      assignedRoom: roomMap["401"],
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adults: 2,
      children: 1,
      totalAmount: 54000,
      taxAmount: 4500,
      cgstAmount: 2250,
      sgstAmount: 2250,
      paidAmount: 54000,
      discountAmount: 0,
      status: BookingStatus.CHECKED_IN,
      paymentStatus: PaymentStatus.PAID,
      source: BookingSource.OTA,
      otaName: "MakeMyTrip",
      bookingType: BookingType.INDIVIDUAL,
      isVipGuest: true,
      checkedInAt: checkIn,
    });
    await Room.findByIdAndUpdate(roomMap["401"], { status: RoomStatus.OCCUPIED });
    console.log("  ✅ Created checked-in booking: YES-BKG-2020 (Room 401)");
  }

  const bReferenceExtras = [
    { ref: "YES-BKG-4001", first: "Karan", last: "Kapoor", room: "102", slug: "standard-room", status: BookingStatus.CANCELLED, offsetIn: 5, nights: 2, cancelled: true },
    { ref: "YES-BKG-4002", first: "Isha", last: "Reddy", room: "302", slug: "executive-room", status: BookingStatus.NO_SHOW, offsetIn: -3, nights: 2, noShow: true },
    { ref: "YES-BKG-4003", first: "Nikhil", last: "Joshi", room: "104", slug: "standard-room", status: BookingStatus.PENDING, offsetIn: 4, nights: 1 },
  ];
  for (const x of bReferenceExtras) {
    let bx = await Booking.findOne({ bookingReference: x.ref });
    if (!bx) {
      const checkIn = daysFromNow(x.offsetIn);
      const checkOut = daysFromNow(x.offsetIn + x.nights);
      const base = categoryMap[x.slug];
      bx = await Booking.create({
        bookingReference: x.ref,
        guestDetails: { firstName: x.first, lastName: x.last, email: guestEmail(x.first, x.last, 900), phone: guestPhone(900), city: pick(CITIES, 1), country: INDIA },
        roomCategory: base,
        assignedRoom: x.status === BookingStatus.CANCELLED || x.status === BookingStatus.NO_SHOW ? undefined : roomMap[x.room],
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: 1,
        children: 0,
        totalAmount: 4000 * x.nights,
        taxAmount: 400 * x.nights,
        cgstAmount: 200 * x.nights,
        sgstAmount: 200 * x.nights,
        paidAmount: x.cancelled ? 4000 : 0,
        discountAmount: 0,
        status: x.status,
        paymentStatus: x.cancelled ? PaymentStatus.REFUNDED : PaymentStatus.UNPAID,
        source: BookingSource.DIRECT_WEBSITE,
        bookingType: BookingType.INDIVIDUAL,
        cancelledAt: x.cancelled ? daysAgo(1) : undefined,
        cancelledBy: x.cancelled ? managerId : undefined,
        cancellationReason: x.cancelled ? "Guest requested cancellation — plans changed" : undefined,
        cancellationPenalty: x.cancelled ? 500 : undefined,
        noShowAt: x.noShow ? checkIn : undefined,
        noShowProcessedBy: x.noShow ? receptionId : undefined,
      });
      console.log(`  ✅ Created ${x.status} booking: ${x.ref}`);
    }
  }

  // D) Bulk historical CHECKED_OUT bookings — the bulk of the volume, spread
  // across the last 75 days so reports/revenue-trend/reviews have real data.
  console.log("\n📅 Seeding historical stay history (bulk)...");
  const HIST_COUNT = 48;
  const SOURCES = [BookingSource.DIRECT_WEBSITE, BookingSource.OTA, BookingSource.WALK_IN, BookingSource.CORPORATE, BookingSource.PHONE, BookingSource.TRAVEL_AGENT];
  const OTA_NAMES = ["Booking.com", "Agoda", "MakeMyTrip", "Goibibo"];
  const historicalBookingIds: mongoose.Types.ObjectId[] = [];
  const historicalBookings: { id: mongoose.Types.ObjectId; guestEmail: string; guestName: string; roomNumber: string }[] = [];

  for (let i = 0; i < HIST_COUNT; i++) {
    const ref = `YES-BKG-H${String(1000 + i)}`;
    const guest = GUESTS[3 + (i % (GUESTS.length - 3))]; // skip the 3 "live" guests, cycle the bulk pool
    const roomNumber = pick(ALL_ROOM_NUMBERS, i);

    const exists = await Booking.findOne({ bookingReference: ref });
    if (exists) {
      historicalBookingIds.push(exists._id as mongoose.Types.ObjectId);
      historicalBookings.push({ id: exists._id as mongoose.Types.ObjectId, guestEmail: guest.email, guestName: guest.fullName, roomNumber });
      continue;
    }

    const roomSlug = Object.keys(roomsBySlug).find((slug) => roomsBySlug[slug].includes(roomNumber))!;
    const nights = 1 + (i % 4);
    const startOffset = 3 + i * 1.5; // spread across ~75 days back
    const checkIn = daysAgo(Math.round(startOffset) + nights);
    const checkOut = daysAgo(Math.round(startOffset));
    const basePrice = CATEGORIES.find((c) => c.slug === roomSlug)!.basePrice;
    const total = basePrice * nights;
    const tax = Math.round(total * 0.09);
    const source = pick(SOURCES, i);
    const isOta = source === BookingSource.OTA;

    const bh = await Booking.create({
      bookingReference: ref,
      guestDetails: {
        firstName: guest.fullName.split(" ")[0],
        lastName: guest.fullName.split(" ")[1] || "Guest",
        email: guest.email,
        phone: guest.phone,
        city: guest.city,
        country: INDIA,
        idType: i % 2 === 0 ? "AADHAAR" : "PASSPORT",
        idNumber: `ID-${1000 + i}`,
      },
      roomCategory: categoryMap[roomSlug],
      assignedRoom: roomMap[roomNumber],
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adults: 1 + (i % 3 === 0 ? 1 : 0),
      children: i % 7 === 0 ? 1 : 0,
      totalAmount: total + tax,
      taxAmount: tax,
      cgstAmount: Math.round(tax / 2),
      sgstAmount: Math.round(tax / 2),
      paidAmount: total + tax,
      discountAmount: i % 10 === 0 ? Math.round(total * 0.1) : 0,
      status: BookingStatus.CHECKED_OUT,
      paymentStatus: PaymentStatus.PAID,
      source,
      otaName: isOta ? pick(OTA_NAMES, i) : undefined,
      bookingType: BookingType.INDIVIDUAL,
      isVipGuest: guest.isVip,
      checkedInAt: checkIn,
      checkedOutAt: checkOut,
      checkedInBy: pick(receptionistIds.length ? receptionistIds : [adminId!], i),
      checkedOutBy: pick(receptionistIds.length ? receptionistIds : [adminId!], i + 1),
    });

    historicalBookingIds.push(bh._id as mongoose.Types.ObjectId);
    historicalBookings.push({ id: bh._id as mongoose.Types.ObjectId, guestEmail: guest.email, guestName: guest.fullName, roomNumber });
  }
  console.log(`  ✅ Created ${HIST_COUNT} historical checked-out bookings`);

  // ─── 8b. PAYMENTS, ADVANCES & REFUNDS ──────────────────────────────────────
  console.log("\n💳 Seeding payment ledger...");
  const PAYMENT_METHODS: PaymentMethod[] = [PaymentMethod.RAZORPAY, PaymentMethod.CARD, PaymentMethod.UPI, PaymentMethod.CASH];
  let paymentsCreated = 0;
  for (let i = 0; i < historicalBookings.length; i += 2) {
    const hb = historicalBookings[i];
    const booking = await Booking.findById(hb.id);
    if (!booking) continue;
    const exists = await Payment.findOne({ booking: booking._id });
    if (exists) continue;
    const method = pick(PAYMENT_METHODS, i);
    await Payment.create({
      booking: booking._id,
      amount: booking.totalAmount,
      currency: "INR",
      method,
      transactionId: `TXN-${booking.bookingReference}`,
      razorpayPaymentId: method === PaymentMethod.RAZORPAY ? `pay_${booking.bookingReference}` : undefined,
      status: PaymentTxStatus.COMPLETED,
      refundedAmount: 0,
    });
    paymentsCreated++;
  }
  console.log(`  ✅ Created ${paymentsCreated} payment records`);

  console.log("\n💰 Seeding advance payments...");
  const ADVANCE_METHODS: AdvancePaymentMethod[] = [AdvancePaymentMethod.UPI, AdvancePaymentMethod.CARD, AdvancePaymentMethod.CASH, AdvancePaymentMethod.BANK_TRANSFER];
  for (let i = 0; i < 10; i++) {
    const advNumber = `ADV-2026-${String(1000 + i)}`;
    const exists = await AdvancePayment.findOne({ advanceNumber: advNumber });
    if (exists) continue;
    const guestId = guestIds[i % guestIds.length];
    const amount = 3000 + (i % 5) * 1500;
    const adjusted = i % 3 === 0 ? amount : 0;
    await AdvancePayment.create({
      advanceNumber: advNumber,
      guest: guestId,
      amount,
      totalAdjusted: adjusted,
      totalRefunded: 0,
      remainingBalance: amount - adjusted,
      method: pick(ADVANCE_METHODS, i),
      referenceNumber: `REF-${1000 + i}`,
      status: adjusted > 0 ? AdvancePaymentStatus.FULLY_ADJUSTED : AdvancePaymentStatus.RECEIVED,
      receivedAt: daysAgo(i * 2),
      receivedBy: receptionId || adminId,
      purpose: "Booking deposit",
    });
  }
  console.log("  ✅ Created 10 advance payment records");

  console.log("\n↩️  Seeding refunds...");
  const cancelledBooking = await Booking.findOne({ bookingReference: "YES-BKG-4001" });
  if (cancelledBooking) {
    const refundPayment = await Payment.findOneAndUpdate(
      { booking: cancelledBooking._id },
      {},
      { upsert: false }
    ) || await Payment.create({
      booking: cancelledBooking._id,
      amount: cancelledBooking.totalAmount,
      currency: "INR",
      method: PaymentMethod.UPI,
      transactionId: `TXN-${cancelledBooking.bookingReference}`,
      status: PaymentTxStatus.REFUNDED,
      refundedAmount: cancelledBooking.totalAmount - 500,
    });
    const refundExists = await Refund.findOne({ booking: cancelledBooking._id });
    if (!refundExists) {
      await Refund.create({
        booking: cancelledBooking._id,
        payment: refundPayment._id,
        amount: cancelledBooking.totalAmount - 500,
        reason: "Guest cancellation — refunded minus cancellation penalty",
        status: RefundStatus.COMPLETED,
        initiatedBy: managerId || adminId,
      });
      console.log("  ✅ Created refund for YES-BKG-4001");
    }
  }

  // ─── 9. CASHIER SHIFT ─────────────────────────────────────────────────────
  console.log("\n💵 Seeding active cashier shift...");
  let shift = await CashierShift.findOne({ shiftNumber: "CS-2026-001" });
  if (!shift && receptionId) {
    await CashierShift.create({
      shiftNumber: "CS-2026-001",
      cashier: receptionId,
      openedAt: new Date(),
      openingFloat: 5000,
      expectedCash: 2500,
      expectedUpi: 5000,
      expectedCard: 0,
      status: CashierShiftStatus.OPEN,
      notes: "Morning Front Desk Shift",
    });
    console.log("  ✅ Created active cashier shift: CS-2026-001");
  }

  // ─── 10. RESTAURANT & POS ORDERS ──────────────────────────────────────────
  console.log("\n🍽️ Seeding restaurant & KOT orders...");
  let order1 = await RestaurantOrder.findOne({ kotNumber: "KOT-101" });
  if (!order1) {
    await RestaurantOrder.create({
      kotNumber: "KOT-101",
      roomNumber: "201",
      bookingId: b1?._id,
      items: [
        { name: "Paneer Butter Masala", quantity: 1, unitPrice: 380, totalPrice: 380 },
        { name: "Butter Naan", quantity: 3, unitPrice: 60, totalPrice: 180 },
        { name: "Fresh Lime Soda", quantity: 2, unitPrice: 120, totalPrice: 240 },
      ],
      subtotal: 800,
      taxAmount: 40,
      grandTotal: 840,
      status: OrderStatus.SERVED,
      chargeToFolio: true,
      notes: "Room service delivery for Room 201",
    });
    console.log("  ✅ Created KOT order: KOT-101 (Room 201)");
  }
  const KOT_EXTRAS = [
    { num: "KOT-102", room: "401", items: [{ name: "Club Sandwich", quantity: 2, unitPrice: 320, totalPrice: 640 }, { name: "Masala Chai", quantity: 2, unitPrice: 90, totalPrice: 180 }] },
    { num: "KOT-103", room: "202", items: [{ name: "Chicken Biryani", quantity: 1, unitPrice: 450, totalPrice: 450 }] },
    { num: "KOT-104", room: "302", items: [{ name: "Continental Breakfast", quantity: 2, unitPrice: 350, totalPrice: 700 }] },
  ];
  for (const k of KOT_EXTRAS) {
    const exists = await RestaurantOrder.findOne({ kotNumber: k.num });
    if (exists) continue;
    const subtotal = k.items.reduce((s, it) => s + it.totalPrice, 0);
    const tax = Math.round(subtotal * 0.05);
    await RestaurantOrder.create({
      kotNumber: k.num,
      roomNumber: k.room,
      items: k.items,
      subtotal,
      taxAmount: tax,
      grandTotal: subtotal + tax,
      status: OrderStatus.SERVED,
      chargeToFolio: true,
      notes: `Room service delivery for Room ${k.room}`,
    });
  }
  console.log(`  ✅ Created ${KOT_EXTRAS.length} additional KOT orders`);

  // ─── 11. HOUSEKEEPING TASKS ───────────────────────────────────────────────
  console.log("\n🧹 Seeding housekeeping tasks...");
  let hkTask = await HousekeepingTask.findOne({ notes: "Routine Checkout Cleaning for Room 401" });
  if (!hkTask) {
    await HousekeepingTask.create({
      room: roomMap["401"],
      taskType: HousekeepingTaskType.CHECKOUT_CLEAN,
      assignedTo: hkUserId,
      assignedBy: adminId,
      assignedAt: new Date(),
      status: HousekeepingStatus.CLEANING,
      priority: HousekeepingPriority.HIGH,
      notes: "Routine Checkout Cleaning for Room 401",
    });
    console.log("  ✅ Created Housekeeping Task for Room 401");
  }
  const HK_STATUSES = [HousekeepingStatus.DIRTY, HousekeepingStatus.ASSIGNED, HousekeepingStatus.CLEANING, HousekeepingStatus.CLEANING_COMPLETED, HousekeepingStatus.INSPECTION, HousekeepingStatus.CLEAN];
  const HK_TYPES = [HousekeepingTaskType.CHECKOUT_CLEAN, HousekeepingTaskType.STAYOVER_CLEAN, HousekeepingTaskType.TURNDOWN, HousekeepingTaskType.DEEP_CLEAN];
  const HK_PRIORITIES = [HousekeepingPriority.LOW, HousekeepingPriority.NORMAL, HousekeepingPriority.HIGH];
  let hkExtraCount = 0;
  for (let i = 0; i < 14; i++) {
    const roomNumber = pick(ALL_ROOM_NUMBERS, i + 5);
    const note = `Bulk-seeded housekeeping task #${i + 1} for Room ${roomNumber}`;
    const exists = await HousekeepingTask.findOne({ notes: note });
    if (exists) continue;
    await HousekeepingTask.create({
      room: roomMap[roomNumber],
      taskType: pick(HK_TYPES, i),
      assignedTo: pick(housekeeperIds.length ? housekeeperIds : [hkUserId!], i),
      assignedBy: adminId,
      assignedAt: daysAgo(i % 5),
      status: pick(HK_STATUSES, i),
      priority: pick(HK_PRIORITIES, i),
      notes: note,
    });
    hkExtraCount++;
  }
  console.log(`  ✅ Created ${hkExtraCount} additional housekeeping tasks`);

  // ─── 12. MAINTENANCE TICKETS ──────────────────────────────────────────────
  console.log("\n🔧 Seeding maintenance tickets...");
  let ticket = await MaintenanceTicket.findOne({ issueTitle: "AC Cooling Insufficient" });
  if (!ticket) {
    await MaintenanceTicket.create({
      room: roomMap["103"],
      issueTitle: "AC Cooling Insufficient",
      description: "Guest reported AC thermostat not dropping below 24 degrees.",
      priority: MaintenancePriority.MEDIUM,
      assignedTo: maintUserId,
      status: MaintenanceStatus.IN_PROGRESS,
    });
    console.log("  ✅ Created Maintenance Ticket for Room 103");
  }
  const TICKET_ISSUES = [
    "Leaking bathroom faucet", "TV remote not working", "Wi-Fi signal weak", "Door lock jammed",
    "Bathtub drain clogged", "Minibar not cooling", "Curtain rail broken", "Balcony door won't lock",
    "Smoke detector beeping", "Shower pressure low",
  ];
  const TICKET_PRIORITIES = [MaintenancePriority.LOW, MaintenancePriority.MEDIUM, MaintenancePriority.HIGH, MaintenancePriority.CRITICAL];
  const TICKET_STATUSES = [MaintenanceStatus.OPEN, MaintenanceStatus.ASSIGNED, MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.RESOLVED, MaintenanceStatus.CLOSED];
  let ticketExtraCount = 0;
  for (let i = 0; i < TICKET_ISSUES.length; i++) {
    const roomNumber = pick(ALL_ROOM_NUMBERS, i + 2);
    const title = TICKET_ISSUES[i];
    const exists = await MaintenanceTicket.findOne({ issueTitle: title, room: roomMap[roomNumber] });
    if (exists) continue;
    const status = pick(TICKET_STATUSES, i);
    await MaintenanceTicket.create({
      room: roomMap[roomNumber],
      issueTitle: title,
      description: `Guest/staff reported: ${title.toLowerCase()}.`,
      priority: pick(TICKET_PRIORITIES, i),
      assignedTo: pick(maintainerIds.length ? maintainerIds : [maintUserId!], i),
      status,
      resolvedAt: status === MaintenanceStatus.RESOLVED || status === MaintenanceStatus.CLOSED ? daysAgo(i % 4) : undefined,
    });
    ticketExtraCount++;
  }
  console.log(`  ✅ Created ${ticketExtraCount} additional maintenance tickets`);

  // ─── 13. VENDORS & INVENTORY ──────────────────────────────────────────────
  console.log("\n📦 Seeding vendors & inventory...");
  const VENDORS = [
    { vendorCode: "VEND-001", name: "Fresh Foods & Spices Pvt Ltd", gstin: "36AAACF1122D1Z3", contactPerson: "Suresh Kumar", email: "orders@freshfoods.in", phone: "+91 98444 55667", paymentTerms: "Net 30", rating: 5 },
    { vendorCode: "VEND-002", name: "Royal Linen Supplies", gstin: "36AAACR3344E1Z4", contactPerson: "Meena Iyer", email: "sales@royallinen.in", phone: "+91 98555 66778", paymentTerms: "Net 15", rating: 4 },
    { vendorCode: "VEND-003", name: "Sparkle Housekeeping Chemicals", gstin: "36AAACS5566F1Z5", contactPerson: "Anil Kumar", email: "orders@sparklechem.in", phone: "+91 98666 77889", paymentTerms: "Net 30", rating: 4 },
    { vendorCode: "VEND-004", name: "Prime Beverages Distributors", gstin: "36AAACP7788G1Z6", contactPerson: "Farhan Sheikh", email: "sales@primebev.in", phone: "+91 98777 88990", paymentTerms: "Net 45", rating: 5 },
  ];
  const vendorMap: Record<string, mongoose.Types.ObjectId> = {};
  for (const v of VENDORS) {
    let vendor = await Vendor.findOne({ vendorCode: v.vendorCode });
    if (!vendor) {
      vendor = await Vendor.create({ ...v, isActive: true });
      console.log(`  ✅ Created Vendor: ${v.name}`);
    }
    vendorMap[v.vendorCode] = vendor._id as mongoose.Types.ObjectId;
  }

  const INVENTORY = [
    { itemCode: "INV-COFFEE", name: "Arabica Coffee Beans (1kg)", category: ItemCategory.FOOD_INGREDIENT, unit: "kg", minStockLevel: 5, currentStock: 25, unitCost: 850 },
    { itemCode: "INV-TOWEL-BAT", name: "Bath Towel 700 GSM White", category: ItemCategory.LINEN, unit: "pcs", minStockLevel: 20, currentStock: 150, unitCost: 450 },
    { itemCode: "INV-SHAMPOO", name: "Herbal Shampoo 50ml", category: ItemCategory.GUEST_AMENITY, unit: "pcs", minStockLevel: 50, currentStock: 300, unitCost: 35 },
    { itemCode: "INV-BEDSHEET", name: "Cotton Bedsheet King Size", category: ItemCategory.LINEN, unit: "pcs", minStockLevel: 15, currentStock: 8, unitCost: 950 },
    { itemCode: "INV-GLASS-CLEAN", name: "Glass Cleaner 5L", category: ItemCategory.CLEANING_SUPPLY, unit: "ltr", minStockLevel: 10, currentStock: 4, unitCost: 220 },
    { itemCode: "INV-SOAP", name: "Guest Soap Bar 25g", category: ItemCategory.GUEST_AMENITY, unit: "pcs", minStockLevel: 100, currentStock: 620, unitCost: 12 },
    { itemCode: "INV-MILK", name: "Full Cream Milk (1L)", category: ItemCategory.FOOD_INGREDIENT, unit: "ltr", minStockLevel: 20, currentStock: 12, unitCost: 68 },
    { itemCode: "INV-PILLOW", name: "Hypoallergenic Pillow", category: ItemCategory.LINEN, unit: "pcs", minStockLevel: 15, currentStock: 40, unitCost: 650 },
  ];
  const inventoryMap: Record<string, mongoose.Types.ObjectId> = {};
  for (const inv of INVENTORY) {
    let item = await InventoryItem.findOne({ itemCode: inv.itemCode });
    if (!item) {
      item = await InventoryItem.create({ ...inv, isActive: true, storeLocation: "Main Store" });
      console.log(`  ✅ Created Inventory Item: ${inv.name}`);
    }
    inventoryMap[inv.itemCode] = item._id as mongoose.Types.ObjectId;
  }

  // ─── 13b. PURCHASE ORDERS ──────────────────────────────────────────────────
  console.log("\n📑 Seeding purchase orders...");
  const PURCHASE_ORDERS = [
    { poNumber: "PO-2026-001", vendorCode: "VEND-001", vendorName: "Fresh Foods & Spices Pvt Ltd", items: [{ code: "INV-COFFEE", qty: 20, cost: 850 }, { code: "INV-MILK", qty: 100, cost: 68 }], status: PurchaseOrderStatus.COMPLETED },
    { poNumber: "PO-2026-002", vendorCode: "VEND-002", vendorName: "Royal Linen Supplies", items: [{ code: "INV-BEDSHEET", qty: 30, cost: 950 }, { code: "INV-TOWEL-BAT", qty: 50, cost: 450 }], status: PurchaseOrderStatus.ISSUED },
    { poNumber: "PO-2026-003", vendorCode: "VEND-003", vendorName: "Sparkle Housekeeping Chemicals", items: [{ code: "INV-GLASS-CLEAN", qty: 25, cost: 220 }], status: PurchaseOrderStatus.PARTIALLY_RECEIVED },
    { poNumber: "PO-2026-004", vendorCode: "VEND-004", vendorName: "Prime Beverages Distributors", items: [{ code: "INV-MILK", qty: 150, cost: 68 }], status: PurchaseOrderStatus.DRAFT },
  ];
  for (const po of PURCHASE_ORDERS) {
    const exists = await PurchaseOrder.findOne({ poNumber: po.poNumber });
    if (exists) continue;
    const items = po.items.map((it) => ({
      item: inventoryMap[it.code],
      itemName: INVENTORY.find((i) => i.itemCode === it.code)!.name,
      quantity: it.qty,
      unitCost: it.cost,
      totalCost: it.qty * it.cost,
      receivedQuantity: po.status === PurchaseOrderStatus.COMPLETED ? it.qty : 0,
    }));
    await PurchaseOrder.create({
      poNumber: po.poNumber,
      vendor: vendorMap[po.vendorCode],
      vendorName: po.vendorName,
      items,
      totalAmount: items.reduce((s, it) => s + it.totalCost, 0),
      status: po.status,
      issuedDate: daysAgo(10),
      expectedDeliveryDate: daysFromNow(5),
      createdBy: adminId,
    });
    console.log(`  ✅ Created Purchase Order: ${po.poNumber}`);
  }

  // ─── 14. FAQS ─────────────────────────────────────────────────────────────
  console.log("\n📦 Seeding FAQs...");
  const FAQS = [
    { question: "What time is check-in and check-out?", answer: "Check-in is from 2:00 PM and check-out is until 11:00 AM. Early check-in and late check-out may be arranged, subject to availability.", category: "Booking", displayOrder: 1 },
    { question: "Is breakfast included in the room rate?", answer: "Complimentary breakfast is included with Deluxe rooms and above. Standard Room guests may add breakfast at booking or at the front desk.", category: "Amenities", displayOrder: 2 },
    { question: "What is your cancellation policy?", answer: "Free cancellation up to 48 hours before check-in. Cancellations within 48 hours are subject to a one-night charge.", category: "Booking", displayOrder: 3 },
    { question: "Do you offer airport transfers?", answer: "Yes, complimentary airport transfers are available for Signature Suite guests.", category: "Amenities", displayOrder: 4 },
    { question: "Is parking available on-site?", answer: "Yes, complimentary valet and self-parking is available for all in-house guests.", category: "Amenities", displayOrder: 5 },
    { question: "Do you allow pets?", answer: "We welcome small, well-behaved pets in designated pet-friendly rooms. Please inform us at the time of booking.", category: "Policies", displayOrder: 6 },
    { question: "Is there a swimming pool?", answer: "Yes, an outdoor infinity pool is open from 6 AM to 9 PM daily, along with a dedicated kids' pool.", category: "Amenities", displayOrder: 7 },
    { question: "Can I book banquet or conference halls?", answer: "Yes, our Grand Ball Room and Emerald Convention Hall can be booked for weddings, conferences, and events. Contact our banquets team for a quotation.", category: "Events", displayOrder: 8 },
  ];
  for (const f of FAQS) {
    const exists = await FAQ.findOne({ question: f.question });
    if (!exists) {
      await FAQ.create({ ...f, isPublished: true });
      console.log(`  ✅ Created FAQ: ${f.question}`);
    }
  }

  // ─── 15. TESTIMONIALS ─────────────────────────────────────────────────────
  console.log("\n📦 Seeding testimonials...");
  const TESTIMONIALS = [
    { name: "Priya Sharma", location: "Mumbai, India", rating: 5, comment: "Absolutely stunning property with impeccable service. The Executive Room exceeded every expectation.", displayOrder: 1 },
    { name: "James Whitfield", location: "London, UK", rating: 5, comment: "From check-in to check-out, every detail was thoughtfully handled. Will definitely return.", displayOrder: 2 },
    { name: "Ananya Iyer", location: "Bengaluru, India", rating: 5, comment: "The Signature Suite was worth every rupee — the private terrace and butler service made our anniversary unforgettable.", displayOrder: 3 },
    { name: "Marco Rossi", location: "Milan, Italy", rating: 4, comment: "Great location and beautiful rooms. Restaurant food was excellent, though room service was a touch slow at peak hours.", displayOrder: 4 },
    { name: "Fatima Al-Sayed", location: "Dubai, UAE", rating: 5, comment: "Staff went above and beyond to make our family stay comfortable. The kids' pool and spa were a huge hit.", displayOrder: 5 },
  ];
  for (const t of TESTIMONIALS) {
    const exists = await Testimonial.findOne({ name: t.name, comment: t.comment });
    if (!exists) {
      await Testimonial.create({ ...t, isPublished: true });
      console.log(`  ✅ Created testimonial: ${t.name}`);
    }
  }

  // ─── 15b. REVIEWS ──────────────────────────────────────────────────────────
  console.log("\n⭐ Seeding guest reviews...");
  const REVIEW_TITLES = [
    "Wonderful stay!", "Exceeded expectations", "Great value for money", "Will visit again",
    "Perfect for a family trip", "Impeccable service", "A relaxing getaway", "Loved the amenities",
    "Comfortable and clean", "Highly recommended",
  ];
  const REVIEW_COMMENTS = [
    "The room was spacious and spotless, and the staff were incredibly attentive throughout our stay.",
    "Checked in without any hassle and the front desk team upgraded us at no extra cost — such a pleasant surprise.",
    "Loved the breakfast spread and the pool area. Would definitely come back with the family.",
    "The location is convenient and the rooms are modern. Housekeeping was prompt every single day.",
    "A bit noisy on the lower floors, but otherwise a solid stay with friendly staff.",
    "The spa treatment was outstanding and the in-room dining was delicious and quick.",
    "Great business hotel — fast Wi-Fi, comfortable work desk, and quiet rooms.",
    "Our suite had a beautiful view and the butler service made check-in effortless.",
  ];
  const REVIEW_STATUSES = [ReviewStatus.APPROVED, ReviewStatus.APPROVED, ReviewStatus.APPROVED, ReviewStatus.PENDING];
  let reviewsCreated = 0;
  for (let i = 0; i < Math.min(20, historicalBookingIds.length); i += 2) {
    const bookingId = historicalBookingIds[i];
    const exists = await Review.findOne({ booking: bookingId });
    if (exists) continue;
    await Review.create({
      user: customerId,
      booking: bookingId,
      rating: 3 + (i % 3),
      title: pick(REVIEW_TITLES, i),
      comment: pick(REVIEW_COMMENTS, i),
      status: pick(REVIEW_STATUSES, i),
    });
    reviewsCreated++;
  }
  console.log(`  ✅ Created ${reviewsCreated} guest reviews`);

  // ─── 16. COUPONS ──────────────────────────────────────────────────────────
  if (adminId) {
    console.log("\n📦 Seeding coupons...");
    const oneYearOut = daysFromNow(365);
    const COUPONS = [
      { code: "WELCOME10", description: "10% off your first stay", discountType: DiscountType.PERCENTAGE, discountValue: 10, minBookingAmount: 2000, maxDiscount: 2000, usageLimit: 100, perUserLimit: 1 },
      { code: "FLAT500", description: "Flat ₹500 off bookings above ₹5000", discountType: DiscountType.FIXED, discountValue: 500, minBookingAmount: 5000, usageLimit: 50, perUserLimit: 1 },
      { code: "SUMMER20", description: "20% off summer getaway bookings", discountType: DiscountType.PERCENTAGE, discountValue: 20, minBookingAmount: 8000, maxDiscount: 5000, usageLimit: 40, perUserLimit: 1 },
      { code: "CORP15", description: "15% off for corporate travel bookings", discountType: DiscountType.PERCENTAGE, discountValue: 15, minBookingAmount: 6000, maxDiscount: 4000, usageLimit: 200, perUserLimit: 3 },
    ];
    for (const c of COUPONS) {
      const exists = await Coupon.findOne({ code: c.code });
      if (!exists) {
        await Coupon.create({ ...c, startDate: new Date(), expiryDate: oneYearOut, isActive: true, createdBy: adminId });
        console.log(`  ✅ Created coupon: ${c.code}`);
      }
    }
  }

  // ─── 17. GALLERY ──────────────────────────────────────────────────────────
  console.log("\n📦 Seeding gallery...");
  const GALLERY = [
    { title: "Hotel Exterior at Dusk", category: GalleryCategory.EXTERIOR, imageUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80", altText: "YES Hotels exterior at dusk", featured: true, displayOrder: 1 },
    { title: "The Lobby", category: GalleryCategory.HOTEL, imageUrl: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80", altText: "Hotel lobby", featured: true, displayOrder: 2 },
    { title: "Deluxe Room", category: GalleryCategory.ROOMS, imageUrl: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80", altText: "Deluxe room interior", featured: false, displayOrder: 3 },
    { title: "Signature Suite Living Area", category: GalleryCategory.ROOMS, imageUrl: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80", altText: "Suite living area", featured: true, displayOrder: 4 },
    { title: "Infinity Pool", category: GalleryCategory.EXTERIOR, imageUrl: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=1200&q=80", altText: "Outdoor infinity pool", featured: true, displayOrder: 5 },
    { title: "Spa Treatment Room", category: GalleryCategory.EXPERIENCE, imageUrl: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=80", altText: "Spa treatment room", featured: false, displayOrder: 6 },
    { title: "Fine Dining Restaurant", category: GalleryCategory.DINING, imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80", altText: "Restaurant interior", featured: true, displayOrder: 7 },
    { title: "Grand Ball Room", category: GalleryCategory.HOTEL, imageUrl: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=80", altText: "Banquet ball room", featured: false, displayOrder: 8 },
    { title: "Executive Room Workspace", category: GalleryCategory.ROOMS, imageUrl: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80", altText: "Executive room desk", featured: false, displayOrder: 9 },
    { title: "Rooftop Lounge", category: GalleryCategory.DINING, imageUrl: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=1200&q=80", altText: "Rooftop lounge at night", featured: true, displayOrder: 10 },
    { title: "Fitness Centre", category: GalleryCategory.EXPERIENCE, imageUrl: "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=1200&q=80", altText: "Hotel gym", featured: false, displayOrder: 11 },
    { title: "Standard Room", category: GalleryCategory.ROOMS, imageUrl: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80", altText: "Standard room interior", featured: false, displayOrder: 12 },
    { title: "Garden Courtyard", category: GalleryCategory.EXTERIOR, imageUrl: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80", altText: "Landscaped garden courtyard", featured: false, displayOrder: 13 },
    { title: "Bar & Lounge", category: GalleryCategory.DINING, imageUrl: "https://images.unsplash.com/photo-1546171753-97d7676e4602?auto=format&fit=crop&w=1200&q=80", altText: "Hotel bar", featured: false, displayOrder: 14 },
    { title: "Wedding Setup, Grand Ball Room", category: GalleryCategory.HOTEL, imageUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80", altText: "Wedding banquet setup", featured: false, displayOrder: 15 },
  ];
  for (const g of GALLERY) {
    const exists = await Gallery.findOne({ title: g.title });
    if (!exists) {
      await Gallery.create({ ...g, published: true });
      console.log(`  ✅ Created gallery image: ${g.title}`);
    }
  }

  // ─── 17b. MENU ITEMS ────────────────────────────────────────────────────
  console.log("\n🍴 Seeding restaurant menu...");
  const MENU_ITEMS = [
    { sku: "BEV-001", name: "Fresh Lime Soda", category: MenuItemCategory.BEVERAGE, price: 120, foodType: FoodType.VEG, kdsStation: "BEVERAGE" },
    { sku: "BEV-002", name: "Masala Chai", category: MenuItemCategory.BEVERAGE, price: 90, foodType: FoodType.VEG, kdsStation: "BEVERAGE" },
    { sku: "BEV-003", name: "Filter Coffee", category: MenuItemCategory.BEVERAGE, price: 100, foodType: FoodType.VEG, kdsStation: "BEVERAGE" },
    { sku: "STR-001", name: "Paneer Tikka", category: MenuItemCategory.STARTER, price: 340, foodType: FoodType.VEG, kdsStation: "GRILL" },
    { sku: "STR-002", name: "Chicken Seekh Kebab", category: MenuItemCategory.STARTER, price: 420, foodType: FoodType.NON_VEG, kdsStation: "GRILL" },
    { sku: "STR-003", name: "Crispy Corn Chaat", category: MenuItemCategory.STARTER, price: 260, foodType: FoodType.VEG, kdsStation: "GRILL" },
    { sku: "MAIN-001", name: "Paneer Butter Masala", category: MenuItemCategory.MAIN_COURSE, price: 380, foodType: FoodType.VEG, kdsStation: "TANDOOR" },
    { sku: "MAIN-002", name: "Butter Chicken", category: MenuItemCategory.MAIN_COURSE, price: 460, foodType: FoodType.NON_VEG, kdsStation: "TANDOOR" },
    { sku: "MAIN-003", name: "Dal Makhani", category: MenuItemCategory.MAIN_COURSE, price: 320, foodType: FoodType.VEG, kdsStation: "TANDOOR" },
    { sku: "MAIN-004", name: "Grilled Fish Tikka", category: MenuItemCategory.MAIN_COURSE, price: 520, foodType: FoodType.NON_VEG, kdsStation: "GRILL" },
    { sku: "BRD-001", name: "Butter Naan", category: MenuItemCategory.BREAD, price: 60, foodType: FoodType.VEG, kdsStation: "TANDOOR" },
    { sku: "BRD-002", name: "Garlic Naan", category: MenuItemCategory.BREAD, price: 75, foodType: FoodType.VEG, kdsStation: "TANDOOR" },
    { sku: "RICE-001", name: "Chicken Biryani", category: MenuItemCategory.RICE_BIRYANI, price: 450, foodType: FoodType.NON_VEG, kdsStation: "TANDOOR" },
    { sku: "RICE-002", name: "Vegetable Biryani", category: MenuItemCategory.RICE_BIRYANI, price: 350, foodType: FoodType.VEG, kdsStation: "TANDOOR" },
    { sku: "DES-001", name: "Gulab Jamun", category: MenuItemCategory.DESSERT, price: 150, foodType: FoodType.VEG },
    { sku: "DES-002", name: "Chocolate Lava Cake", category: MenuItemCategory.DESSERT, price: 220, foodType: FoodType.EGG },
    { sku: "SNK-001", name: "Club Sandwich", category: MenuItemCategory.SNACK, price: 320, foodType: FoodType.VEG },
    { sku: "SNK-002", name: "French Fries", category: MenuItemCategory.SNACK, price: 180, foodType: FoodType.VEG },
  ];
  for (const [i, m] of MENU_ITEMS.entries()) {
    const exists = await MenuItem.findOne({ sku: m.sku });
    if (!exists) {
      await MenuItem.create({ ...m, taxRatePercent: 5, isAvailable: true, isActive: true, modifiers: [], displayOrder: i + 1 });
      console.log(`  ✅ Created Menu Item: ${m.name}`);
    }
  }

  // ─── 17c. RATE PLANS ────────────────────────────────────────────────────
  console.log("\n💲 Seeding rate plans...");
  const RATE_PLANS = [
    { name: "Best Available Rate", code: "BAR", mealPlan: MealPlanType.EP, multiplier: 1.0, notes: "Standard flexible rate, room only" },
    { name: "Bed & Breakfast", code: "BB", mealPlan: MealPlanType.CP, multiplier: 1.12, notes: "Includes daily breakfast for all registered guests" },
    { name: "Corporate Rate", code: "CORP", mealPlan: MealPlanType.CP, multiplier: 0.85, notes: "Negotiated rate for corporate account bookings" },
    { name: "Half Board", code: "HB", mealPlan: MealPlanType.MAP, multiplier: 1.3, notes: "Includes breakfast and either lunch or dinner" },
    { name: "Advance Purchase (Non-Refundable)", code: "APNR", mealPlan: MealPlanType.EP, multiplier: 0.8, cancellationPolicy: "Non-refundable, full prepayment required", notes: "Best value for guests who book early and won't need to cancel" },
  ];
  for (const rp of RATE_PLANS) {
    const exists = await RatePlan.findOne({ code: rp.code });
    if (!exists) {
      await RatePlan.create({ ...rp, isActive: true });
      console.log(`  ✅ Created Rate Plan: ${rp.name}`);
    }
  }

  // ─── 17d. ANCILLARY SERVICES ────────────────────────────────────────────
  console.log("\n🛎️  Seeding ancillary services...");
  const ANCILLARY = [
    { category: ServiceCategory.SPA, serviceName: "Swedish Full Body Massage (60 min)", amount: 3200, performedBy: "Therapist Kavya" },
    { category: ServiceCategory.SPA, serviceName: "Signature Facial Treatment", amount: 2400, performedBy: "Therapist Meena" },
    { category: ServiceCategory.TRANSPORT, serviceName: "Airport Pickup — Sedan", amount: 1200, performedBy: "Driver Ramu" },
    { category: ServiceCategory.TRANSPORT, serviceName: "City Tour — Half Day", amount: 2800, performedBy: "Driver Suresh" },
    { category: ServiceCategory.LAUNDRY, serviceName: "Express Laundry Service", amount: 450 },
    { category: ServiceCategory.LAUNDRY, serviceName: "Dry Cleaning — Formal Wear", amount: 650 },
    { category: ServiceCategory.MINIBAR, serviceName: "Minibar Restock — Premium", amount: 1800 },
    { category: ServiceCategory.MINIBAR, serviceName: "Minibar Restock — Standard", amount: 900 },
    { category: ServiceCategory.OTHER, serviceName: "Late Check-out (until 4 PM)", amount: 1500 },
    { category: ServiceCategory.OTHER, serviceName: "Early Check-in (from 9 AM)", amount: 1200 },
    { category: ServiceCategory.SPA, serviceName: "Couples Spa Package", amount: 5800, performedBy: "Therapist Priya" },
    { category: ServiceCategory.TRANSPORT, serviceName: "Airport Drop — SUV", amount: 1600, performedBy: "Driver Ramu" },
  ];
  let ancillaryCount = 0;
  for (let i = 0; i < ANCILLARY.length; i++) {
    const svcNumber = `SVC-${String(1000 + i)}`;
    const exists = await AncillaryService.findOne({ serviceNumber: svcNumber });
    if (exists) continue;
    const hb = historicalBookings.length ? pick(historicalBookings, i) : { guestName: "Walk-in Guest", roomNumber: "101" };
    const tax = Math.round(ANCILLARY[i].amount * 0.05);
    await AncillaryService.create({
      serviceNumber: svcNumber,
      category: ANCILLARY[i].category,
      serviceName: ANCILLARY[i].serviceName,
      roomNumber: hb.roomNumber,
      guestName: hb.guestName,
      amount: ANCILLARY[i].amount,
      taxAmount: tax,
      totalAmount: ANCILLARY[i].amount + tax,
      isChargedToFolio: i % 2 === 0,
      performedBy: (ANCILLARY[i] as any).performedBy,
    });
    ancillaryCount++;
  }
  console.log(`  ✅ Created ${ancillaryCount} ancillary service records`);

  // ─── 17e. GROUP BOOKINGS (MICE) ─────────────────────────────────────────
  console.log("\n👥 Seeding group bookings...");
  const GROUP_BOOKINGS = [
    { groupName: "Acme Corp Annual Offsite", groupCode: "GRP-2026-001", organiserName: "Rajesh Malhotra", organiserEmail: "travel@acme.corp", organiserPhone: "+91 98765 43210", corp: "ACME-CORP", checkIn: daysFromNow(20), nights: 3, totalRooms: 12, pax: 24, eventType: "corporate", status: GroupBookingStatus.CONFIRMED, rate: 6500 },
    { groupName: "Sharma-Verma Wedding Party", groupCode: "GRP-2026-002", organiserName: "Rohan Sharma", organiserEmail: "rohan.wedding@example.com", organiserPhone: "+91 98111 22001", checkIn: daysFromNow(35), nights: 4, totalRooms: 20, pax: 55, eventType: "wedding", status: GroupBookingStatus.TENTATIVE, rate: 6500 },
    { groupName: "Zenith Pharma Sales Conference", groupCode: "GRP-2026-003", organiserName: "Deepa Nair", organiserEmail: "travel@zenithpharma.com", organiserPhone: "+91 98123 45678", corp: "ZENITH-PHARMA", checkIn: daysFromNow(10), nights: 2, totalRooms: 15, pax: 30, eventType: "conference", status: GroupBookingStatus.CONFIRMED, rate: 9500 },
    { groupName: "College Reunion Weekend", groupCode: "GRP-2026-004", organiserName: "Kavya Reddy", organiserEmail: "kavya.reunion@example.com", organiserPhone: "+91 98222 11009", checkIn: daysFromNow(50), nights: 2, totalRooms: 8, pax: 18, eventType: "leisure", status: GroupBookingStatus.ENQUIRY, rate: 3500 },
  ];
  for (const gb of GROUP_BOOKINGS) {
    const exists = await GroupBooking.findOne({ groupCode: gb.groupCode });
    if (exists) continue;
    const checkOut = new Date(gb.checkIn);
    checkOut.setDate(checkOut.getDate() + gb.nights);
    const totalEstimatedValue = gb.rate * gb.totalRooms * gb.nights;
    await GroupBooking.create({
      groupName: gb.groupName,
      groupCode: gb.groupCode,
      organiserName: gb.organiserName,
      organiserEmail: gb.organiserEmail,
      organiserPhone: gb.organiserPhone,
      corporateAccountId: gb.corp ? corpAccountMap[gb.corp] : undefined,
      checkIn: gb.checkIn,
      checkOut,
      nights: gb.nights,
      totalRooms: gb.totalRooms,
      roomBlocks: [{ categoryName: "Deluxe Room", roomsRequired: gb.totalRooms, roomsConfirmed: gb.status === GroupBookingStatus.CONFIRMED ? gb.totalRooms : 0, ratePerRoom: gb.rate }],
      totalPax: gb.pax,
      eventType: gb.eventType,
      mealPlan: "CP",
      totalEstimatedValue,
      advancePaid: gb.status === GroupBookingStatus.CONFIRMED ? Math.round(totalEstimatedValue * 0.3) : 0,
      status: gb.status,
      notes: `Bulk-seeded group booking for ${gb.eventType}`,
    });
    console.log(`  ✅ Created Group Booking: ${gb.groupName}`);
  }

  // ─── 17f. BANQUET BOOKINGS ──────────────────────────────────────────────
  console.log("\n🎉 Seeding banquet bookings...");
  const BANQUETS = [
    { bookingNumber: "BQ-2026-001", eventName: "Malhotra-Kapoor Wedding Reception", clientName: "Rajesh Malhotra", clientPhone: "+91 98765 43210", hallName: "Grand Ball Room", eventDate: daysFromNow(45), pax: 350, package: "Royal Wedding Buffet", rate: 1800, status: BanquetStatus.CONFIRMED },
    { bookingNumber: "BQ-2026-002", eventName: "Zenith Pharma Product Launch", clientName: "Deepa Nair", clientPhone: "+91 98123 45678", hallName: "Emerald Convention Hall", eventDate: daysFromNow(12), pax: 120, package: "Corporate Seminar CP", rate: 1200, status: BanquetStatus.QUOTATION_SENT },
    { bookingNumber: "BQ-2026-003", eventName: "Diwali Community Gala", clientName: "Orion Financial Services", clientPhone: "+91 98456 78901", hallName: "Grand Ball Room", eventDate: daysFromNow(30), pax: 200, package: "Festive Gala Dinner", rate: 1500, status: BanquetStatus.CONFIRMED },
    { bookingNumber: "BQ-2026-004", eventName: "Sharma 25th Anniversary", clientName: "Anjali Sharma", clientPhone: "+91 98333 22110", hallName: "Emerald Convention Hall", eventDate: daysFromNow(60), pax: 80, package: "Standard Buffet", rate: 1000, status: BanquetStatus.INQUIRY },
    { bookingNumber: "BQ-2026-005", eventName: "Tech Founders Meetup", clientName: "Nikhil Joshi", clientPhone: "+91 98999 88776", hallName: "Emerald Convention Hall", eventDate: daysAgo(10), pax: 60, package: "Corporate Seminar CP", rate: 900, status: BanquetStatus.COMPLETED },
  ];
  for (const bq of BANQUETS) {
    const exists = await BanquetBooking.findOne({ bookingNumber: bq.bookingNumber });
    if (exists) continue;
    const totalEstimatedAmount = bq.pax * bq.rate;
    await BanquetBooking.create({
      bookingNumber: bq.bookingNumber,
      eventName: bq.eventName,
      clientName: bq.clientName,
      clientPhone: bq.clientPhone,
      hallName: bq.hallName,
      eventDate: bq.eventDate,
      expectedPax: bq.pax,
      menuPackage: bq.package,
      ratePerPax: bq.rate,
      totalEstimatedAmount,
      advancePaid: bq.status === BanquetStatus.CONFIRMED || bq.status === BanquetStatus.COMPLETED ? Math.round(totalEstimatedAmount * 0.4) : 0,
      status: bq.status,
    });
    console.log(`  ✅ Created Banquet Booking: ${bq.eventName}`);
  }

  // ─── 17g. CONTACT MESSAGES ───────────────────────────────────────────────
  console.log("\n✉️  Seeding contact messages...");
  const CONTACT_MESSAGES = [
    { name: "Sanjay Rao", email: "sanjay.rao@example.com", subject: "Question about wedding venue pricing", message: "Hi, we're planning a wedding for ~300 guests in December. Could you share your banquet packages and availability?", status: ContactStatus.NEW },
    { name: "Tanya Bhatia", email: "tanya.b@example.com", subject: "Accessible room availability", message: "Do you have wheelchair-accessible rooms with roll-in showers? Traveling with my father who uses a wheelchair.", status: ContactStatus.RESPONDED },
    { name: "Manish Agarwal", email: "manish.a@example.com", subject: "Corporate rate enquiry", message: "We're looking to set up a corporate account for frequent business travel. Who should I speak to?", status: ContactStatus.READ },
    { name: "Kritika Desai", email: "kritika.d@example.com", subject: "Lost item follow-up", message: "I think I left a charger in room 204 during my stay last week. Could someone check the lost and found?", status: ContactStatus.NEW },
    { name: "Deepak Menon", email: "deepak.m@example.com", subject: "Feedback on recent stay", message: "Just wanted to say the staff at the front desk were exceptional during our anniversary stay. Thank you!", status: ContactStatus.ARCHIVED },
    { name: "Aditi Pillai", email: "aditi.p@example.com", subject: "Group booking for college reunion", message: "We need about 8 rooms for a weekend in November. What discount can you offer for group bookings?", status: ContactStatus.NEW },
    { name: "Suresh Bose", email: "suresh.b@example.com", subject: "Spa package details", message: "Could you send me the full spa menu with pricing? Interested in a couples package.", status: ContactStatus.RESPONDED },
    { name: "Neha Chopra", email: "neha.c@example.com", subject: "Airport transfer timing", message: "My flight lands at 2 AM — is airport pickup available at that hour?", status: ContactStatus.NEW },
  ];
  for (const cm of CONTACT_MESSAGES) {
    const exists = await ContactMessage.findOne({ email: cm.email, subject: cm.subject });
    if (!exists) {
      await ContactMessage.create(cm);
      console.log(`  ✅ Created Contact Message: ${cm.subject}`);
    }
  }

  // ─── 17h. COMPLAINTS ──────────────────────────────────────────────────────
  console.log("\n🚩 Seeding complaints...");
  const COMPLAINT_DEPTS: Array<"HOUSEKEEPING" | "MAINTENANCE" | "FRONT_DESK" | "F_AND_B" | "OTHER"> = ["HOUSEKEEPING", "MAINTENANCE", "FRONT_DESK", "F_AND_B", "OTHER"];
  const COMPLAINT_STATUSES: Array<"OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"> = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
  const COMPLAINT_PRIORITIES: Array<"LOW" | "MEDIUM" | "HIGH" | "URGENT"> = ["LOW", "MEDIUM", "HIGH", "URGENT"];
  const COMPLAINT_ISSUES = [
    "Room was not cleaned before check-in", "AC unit making loud noise all night", "Late response from front desk for extra towels",
    "Room service order took over an hour", "Wi-Fi kept disconnecting throughout the stay", "Noise complaint from adjoining room",
    "Billing discrepancy on final folio", "Minibar items were missing at check-in",
  ];
  let complaintCount = 0;
  for (let i = 0; i < COMPLAINT_ISSUES.length; i++) {
    const issue = COMPLAINT_ISSUES[i];
    const exists = await Complaint.findOne({ issue });
    if (exists) continue;
    const status = pick(COMPLAINT_STATUSES, i);
    const reportedAt = daysAgo(i + 1);
    const slaBreachTime = new Date(reportedAt);
    slaBreachTime.setHours(slaBreachTime.getHours() + 24);
    await Complaint.create({
      guestId: guestIds[i % guestIds.length],
      roomNumber: pick(ALL_ROOM_NUMBERS, i),
      department: pick(COMPLAINT_DEPTS, i),
      issue,
      status,
      priority: pick(COMPLAINT_PRIORITIES, i),
      reportedAt,
      slaBreachTime,
      resolvedAt: status === "RESOLVED" || status === "CLOSED" ? daysAgo(i) : undefined,
      resolutionNotes: status === "RESOLVED" || status === "CLOSED" ? "Issue addressed and guest compensated with a service credit." : undefined,
    });
    complaintCount++;
  }
  console.log(`  ✅ Created ${complaintCount} complaints`);

  // ─── 18. WEBSITE CONTENT (CMS) ────────────────────────────────────────────
  console.log("\n📦 Seeding website content...");
  const CONTENT = [
    {
      key: "homepage-hero",
      title: "Say yes to\ntime well spent.",
      subtitle: "Thoughtful rooms and warm hospitality—beautifully brought together.",
      images: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2000&q=80"],
      metadata: { label: "A Signature Stay by YES Hotels" },
    },
    {
      key: "about",
      title: "Our Story",
      subtitle: "Redefining luxury hospitality since 2010.",
      description: "At YES Hotels, we believe that true luxury lies in the details. From the moment you step into our grand lobby, you are enveloped in an atmosphere of refined elegance.",
      images: ["https://images.unsplash.com/photo-1542314831-c6a4d27df08f?auto=format&fit=crop&q=80"],
    },
  ];
  for (const c of CONTENT) {
    const exists = await WebsiteContent.findOne({ key: c.key });
    if (!exists) {
      await WebsiteContent.create({ ...c, isPublished: true });
      console.log(`  ✅ Created content: ${c.key}`);
    }
  }

  // ─── DONE ───────────────────────────────────────────────────────────────────
  console.log("\n🎉 Enterprise Seed complete!");
  console.log("\n📋 Development Login Credentials:");
  console.log("   Admin:        admin@yeshotels.com / Admin@123");
  console.log("   Manager:      manager@yeshotels.com / Manager@123");
  console.log("   Receptionist: reception@yeshotels.com / Reception@123");
  console.log("   Housekeeping: housekeeping@yeshotels.com / House@123");
  console.log("   Maintenance:  maintenance@yeshotels.com / Main@123");
  console.log("   Customer:     customer@yeshotels.com / Customer@123");
  console.log("\n");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
