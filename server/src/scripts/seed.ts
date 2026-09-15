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

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yes_hotels";

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
    { firstName: "House", lastName: "Keeping", email: "housekeeping@yeshotels.com", password: "House@123", role: UserRole.HOUSEKEEPING },
    { firstName: "Main", lastName: "Tenance", email: "maintenance@yeshotels.com", password: "Main@123", role: UserRole.MAINTENANCE },
    { firstName: "John", lastName: "Doe", email: "customer@yeshotels.com", password: "Customer@123", role: UserRole.CUSTOMER },
  ];

  const userMap: Record<string, mongoose.Types.ObjectId> = {};
  let adminId: mongoose.Types.ObjectId | undefined;
  let receptionId: mongoose.Types.ObjectId | undefined;
  let hkUserId: mongoose.Types.ObjectId | undefined;
  let maintUserId: mongoose.Types.ObjectId | undefined;

  for (const u of USERS) {
    let user = await User.findOne({ email: u.email });
    if (user) {
      console.log(`  ⏭  User exists: ${u.email}`);
    } else {
      const passwordHash = await hashPassword(u.password);
      user = await User.create({ ...u, passwordHash, isActive: true, isEmailVerified: true });
      console.log(`  ✅ Created: ${u.email} [${u.role}]`);
    }
    userMap[u.role] = user._id as mongoose.Types.ObjectId;
    if (u.role === UserRole.ADMIN) adminId = user._id as mongoose.Types.ObjectId;
    if (u.role === UserRole.RECEPTIONIST) receptionId = user._id as mongoose.Types.ObjectId;
    if (u.role === UserRole.HOUSEKEEPING) hkUserId = user._id as mongoose.Types.ObjectId;
    if (u.role === UserRole.MAINTENANCE) maintUserId = user._id as mongoose.Types.ObjectId;
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
    { roomNumber: "201", floor: "2", slug: "deluxe-room" },
    { roomNumber: "202", floor: "2", slug: "deluxe-room" },
    { roomNumber: "203", floor: "2", slug: "deluxe-room" },
    { roomNumber: "204", floor: "2", slug: "deluxe-room" },
    { roomNumber: "301", floor: "3", slug: "executive-room" },
    { roomNumber: "302", floor: "3", slug: "executive-room" },
    { roomNumber: "303", floor: "3", slug: "executive-room" },
    { roomNumber: "401", floor: "4", slug: "suite" },
    { roomNumber: "402", floor: "4", slug: "suite" },
  ];

  const roomMap: Record<string, mongoose.Types.ObjectId> = {};
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
  }

  // ─── 5. CHANNEL MAPPINGS ────────────────────────────────────────────────────
  console.log("\n🌐 Seeding channel mappings...");
  const CHANNELS = [
    { channel: "BOOKING_COM", roomSlug: "deluxe-room", externalId: "BCOM-DLX-01", markup: 5 },
    { channel: "AGODA", roomSlug: "deluxe-room", externalId: "AGD-DLX-01", markup: 8 },
    { channel: "MAKE_MY_TRIP", roomSlug: "executive-room", externalId: "MMT-EXE-01", markup: 10 },
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
  let corpAccount = await CorporateAccount.findOne({ companyCode: "ACME-CORP" });
  if (!corpAccount) {
    corpAccount = await CorporateAccount.create({
      companyName: "Acme Corporation Technologies",
      companyCode: "ACME-CORP",
      gstNumber: "36AAACA9876E1Z2",
      contactPerson: "Rajesh Malhotra",
      contactEmail: "travel@acme.corp",
      contactPhone: "+91 98765 43210",
      creditLimit: 500000,
      currentOutstanding: 45000,
      discountPercentage: 15,
      isActive: true,
      notes: "Preferred IT Corporate Client with 30-day payment terms",
    });
    console.log("  ✅ Created Corporate Account: Acme Corporation");
  }

  // ─── 7. GUESTS (CRM) ────────────────────────────────────────────────────────
  console.log("\n👤 Seeding CRM guest profiles...");
  const GUESTS = [
    { fullName: "Rahul Sharma", email: "rahul.sharma@example.com", phone: "+91 98111 22334", city: "Mumbai", isVip: true, loyaltyPoints: 1250, loyaltyTier: "GOLD" },
    { fullName: "Ananya Verma", email: "ananya.v@example.com", phone: "+91 98222 33445", city: "Delhi", isVip: false, loyaltyPoints: 350, loyaltyTier: "SILVER" },
    { fullName: "Vikram Patel", email: "vikram.patel@example.com", phone: "+91 98333 44556", city: "Ahmedabad", isVip: true, loyaltyPoints: 3200, loyaltyTier: "PLATINUM" },
  ];

  const guestMap: Record<string, mongoose.Types.ObjectId> = {};
  for (const g of GUESTS) {
    let guest = await Guest.findOne({ email: g.email });
    if (!guest) {
      guest = await Guest.create({ ...g, totalBookings: 3, totalSpend: 28500 });
      console.log(`  ✅ Created Guest: ${g.fullName} [${g.loyaltyTier}]`);
    }
    guestMap[g.email] = guest._id as mongoose.Types.ObjectId;
  }

  // ─── 8. BOOKINGS & FOLIOS ──────────────────────────────────────────────────
  console.log("\n📅 Seeding bookings and live folios...");
  
  // A) Checked-In Booking (Room 201 - Rahul Sharma)
  let b1 = await Booking.findOne({ bookingReference: "YES-BKG-2010" });
  if (!b1) {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() - 1);
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 2);

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
      paidAmount: 5000,
      discountAmount: 0,
      numberOfGuests: { adults: 2, children: 0 },
      pricing: { basePrice: 6500, extraGuestCharge: 0, addOnTotal: 0, couponDiscount: 0, taxAmount: 1170, grandTotal: 14170 },
      status: BookingStatus.CHECKED_IN,
      paymentStatus: PaymentStatus.PARTIAL,
      source: BookingSource.DIRECT_WEBSITE,
      bookingType: BookingType.INDIVIDUAL,
      checkedInAt: checkIn,
    });

    await Room.findByIdAndUpdate(roomMap["201"], { status: RoomStatus.OCCUPIED });

    // Create Folio
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

    // Folio Lines
    await FolioLine.create([
      {
        folio: folio1._id,
        booking: b1._id,
        lineType: FolioLineType.ROOM_CHARGE,
        direction: FolioLineDirection.DEBIT,
        description: "Room Charge - Deluxe 201 (Night 1)",
        amount: 6500,
        cgst: 585,
        sgst: 585,
        igst: 0,
        taxTotal: 1170,
        netTotal: 7670,
        date: checkIn,
        postedBy: receptionId || adminId,
        postedAt: checkIn,
      },
      {
        folio: folio1._id,
        booking: b1._id,
        lineType: FolioLineType.PAYMENT,
        direction: FolioLineDirection.CREDIT,
        description: "Advance Deposit via UPI",
        amount: 5000,
        cgst: 0,
        sgst: 0,
        igst: 0,
        taxTotal: 0,
        netTotal: 5000,
        date: checkIn,
        postedBy: receptionId || adminId,
        postedAt: checkIn,
      },
    ]);
    console.log("  ✅ Created checked-in booking: YES-BKG-2010 (Room 201)");
  }

  // B) Upcoming Confirmed Booking (Room 301 - Ananya Verma)
  let b2 = await Booking.findOne({ bookingReference: "YES-BKG-3010" });
  if (!b2) {
    const checkIn = new Date();
    checkIn.setDate(checkIn.getDate() + 1);
    const checkOut = new Date();
    checkOut.setDate(checkOut.getDate() + 3);

    await Booking.create({
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
      paidAmount: 22420,
      discountAmount: 0,
      numberOfGuests: { adults: 1, children: 0 },
      pricing: { basePrice: 9500, extraGuestCharge: 0, addOnTotal: 0, couponDiscount: 0, taxAmount: 3420, grandTotal: 22420 },
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      source: BookingSource.DIRECT_WEBSITE,
      bookingType: BookingType.INDIVIDUAL,
    });
    console.log("  ✅ Created confirmed booking: YES-BKG-3010 (Room 301)");
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

  // ─── 13. VENDORS & INVENTORY ──────────────────────────────────────────────
  console.log("\n📦 Seeding vendors & inventory...");
  let vendor1 = await Vendor.findOne({ vendorCode: "VEND-001" });
  if (!vendor1) {
    vendor1 = await Vendor.create({
      vendorCode: "VEND-001",
      name: "Fresh Foods & Spices Pvt Ltd",
      gstin: "36AAACF1122D1Z3",
      contactPerson: "Suresh Kumar",
      email: "orders@freshfoods.in",
      phone: "+91 98444 55667",
      paymentTerms: "Net 30",
      rating: 5,
      isActive: true,
    });
    console.log("  ✅ Created Vendor: Fresh Foods & Spices");
  }

  const INVENTORY = [
    { itemCode: "INV-COFFEE", name: "Arabica Coffee Beans (1kg)", category: ItemCategory.FOOD_INGREDIENT, unit: "kg", minStockLevel: 5, currentStock: 25, unitCost: 850 },
    { itemCode: "INV-TOWEL-BAT", name: "Bath Towel 700 GSM White", category: ItemCategory.LINEN, unit: "pcs", minStockLevel: 20, currentStock: 150, unitCost: 450 },
    { itemCode: "INV-SHAMPOO", name: "Herbal Shampoo 50ml", category: ItemCategory.GUEST_AMENITY, unit: "pcs", minStockLevel: 50, currentStock: 300, unitCost: 35 },
  ];
  for (const inv of INVENTORY) {
    const exists = await InventoryItem.findOne({ itemCode: inv.itemCode });
    if (!exists) {
      await InventoryItem.create({ ...inv, isActive: true, storeLocation: "Main Store" });
      console.log(`  ✅ Created Inventory Item: ${inv.name}`);
    }
  }

  // ─── 14. FAQS ─────────────────────────────────────────────────────────────
  console.log("\n📦 Seeding FAQs...");
  const FAQS = [
    { question: "What time is check-in and check-out?", answer: "Check-in is from 2:00 PM and check-out is until 11:00 AM. Early check-in and late check-out may be arranged, subject to availability.", category: "Booking", displayOrder: 1 },
    { question: "Is breakfast included in the room rate?", answer: "Complimentary breakfast is included with Deluxe rooms and above. Standard Room guests may add breakfast at booking or at the front desk.", category: "Amenities", displayOrder: 2 },
    { question: "What is your cancellation policy?", answer: "Free cancellation up to 48 hours before check-in. Cancellations within 48 hours are subject to a one-night charge.", category: "Booking", displayOrder: 3 },
    { question: "Do you offer airport transfers?", answer: "Yes, complimentary airport transfers are available for Signature Suite guests.", category: "Amenities", displayOrder: 4 },
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
  ];
  for (const t of TESTIMONIALS) {
    const exists = await Testimonial.findOne({ name: t.name, comment: t.comment });
    if (!exists) {
      await Testimonial.create({ ...t, isPublished: true });
      console.log(`  ✅ Created testimonial: ${t.name}`);
    }
  }

  // ─── 16. COUPONS ──────────────────────────────────────────────────────────
  if (adminId) {
    console.log("\n📦 Seeding coupons...");
    const oneYearOut = new Date();
    oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
    const COUPONS = [
      { code: "WELCOME10", description: "10% off your first stay", discountType: DiscountType.PERCENTAGE, discountValue: 10, minBookingAmount: 2000, maxDiscount: 2000, usageLimit: 100, perUserLimit: 1 },
      { code: "FLAT500", description: "Flat ₹500 off bookings above ₹5000", discountType: DiscountType.FIXED, discountValue: 500, minBookingAmount: 5000, usageLimit: 50, perUserLimit: 1 },
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
  ];
  for (const g of GALLERY) {
    const exists = await Gallery.findOne({ title: g.title });
    if (!exists) {
      await Gallery.create({ ...g, published: true });
      console.log(`  ✅ Created gallery image: ${g.title}`);
    }
  }

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
  console.log("   Admin:       admin@yeshotels.com / Admin@123");
  console.log("   Manager:     manager@yeshotels.com / Manager@123");
  console.log("   Receptionist: reception@yeshotels.com / Reception@123");
  console.log("   Housekeeping: housekeeping@yeshotels.com / House@123");
  console.log("   Maintenance: maintenance@yeshotels.com / Main@123");
  console.log("   Customer:    customer@yeshotels.com / Customer@123");
  console.log("\n");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
