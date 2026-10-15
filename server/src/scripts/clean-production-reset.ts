import mongoose from "mongoose";
import * as dotenv from "dotenv";
import crypto from "node:crypto";
import { hashPassword } from "../utils/auth";
import { User, UserRole } from "../models/User";
import { Property } from "../models/Property";
import { RoomCategory } from "../models/RoomCategory";
import { Room, RoomStatus, OccupancyStatus, HousekeepingRoomStatus, SellStatus } from "../models/Room";
import { HotelSettings } from "../models/HotelSettings";
import { PaymentChannel } from "../models/PaymentChannel";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/yes_hotels";

async function cleanProductionSeed() {
  // This wipes every booking, payment, folio and guest. Never by accident: it needs an explicit flag.
  if (!process.argv.includes("--confirm-wipe-all-hotel-data")) {
    console.error("Refusing to run: this deletes ALL bookings, payments, folios and guests.");
    console.error("Take a backup first, then re-run with --confirm-wipe-all-hotel-data.");
    process.exit(1);
  }
  console.log("🧹 Resetting to Fresh Clean Production State...");
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB:", MONGODB_URI);

  const db = mongoose.connection.db;
  if (!db) throw new Error("No DB handle");

  // 1. Wipe operational transactional collections completely
  const collectionsToClear = [
    "bookings",
    "folios",
    "foliolines",
    "payments",
    "advancepayments",
    "advanceadjustments",
    "refunds",
    "cashiershifts",
    "cashierdrawers",
    "housekeepingtasks",
    "maintenancetickets",
    "inspectionresults",
    "verificationrequests",
    "restaurantorders",
    "complaints",
    "taskapprovals",
    "guestchangerequests",
    "otaconfigs",
    "contactmessages",
    "guests",
  ];

  for (const col of collectionsToClear) {
    try {
      await db.collection(col).deleteMany({});
      console.log(`  🗑️ Cleared: ${col}`);
    } catch (e: any) {
      console.log(`  (skipped ${col}: ${e.message})`);
    }
  }

  // 2. Ensure property
  let property = await Property.findOne({ code: "YES-BLR" });
  if (!property) {
    property = await Property.create({
      name: "YES HOTELS",
      code: "YES-BLR",
      addressLine1: "2nd Floor, Building No. 51 / A51, Khata No. 749, Hosur Main Road, Hosa Road Junction, Parappana Agrahara, Begur, Electronic City",
      city: "Bengaluru",
      state: "Karnataka",
      country: "India",
      pincode: "560100",
      phone: "+91 87698 28787",
      timezone: "Asia/Kolkata",
      currency: "INR",
      totalRooms: 19,
      isActive: true,
      isHeadOffice: true,
      starRating: 3,
    });
  }

  // 3. Ensure Hotel Settings
  await HotelSettings.findOneAndUpdate(
    {},
    {
      hotelName: "YES Hotels Bengaluru",
      address: "2nd Floor, Building No. 51 / A51, Khata No. 749, Hosur Main Road, Hosa Road Junction, Parappana Agrahara, Begur, Electronic City, Bengaluru, Karnataka 560100",
      phone: "+91 87698 28787",
      checkInTime: "12:00",
      checkOutTime: "11:00",
      currency: "INR",
      currencySymbol: "₹",
    },
    { upsert: true, returnDocument: "after" }
  );

  // 4. Ensure Categories
  const CATEGORIES = [
    { name: "Standard Room", slug: "standard-room", basePrice: 3500, maxOccupancy: 2, size: 320 },
    { name: "Deluxe Room", slug: "deluxe-room", basePrice: 6500, maxOccupancy: 3, size: 480 },
    { name: "Executive Room", slug: "executive-room", basePrice: 9500, maxOccupancy: 3, size: 620 },
    { name: "Signature Suite", slug: "suite", basePrice: 18000, maxOccupancy: 4, size: 1200 },
  ];

  const categoryMap: Record<string, mongoose.Types.ObjectId> = {};
  for (const cat of CATEGORIES) {
    const c = await RoomCategory.findOneAndUpdate(
      { slug: cat.slug },
      { ...cat, isActive: true },
      { upsert: true, returnDocument: "after" }
    );
    categoryMap[cat.slug] = c._id as mongoose.Types.ObjectId;
  }

  // 5. Reset all 19 physical rooms to 100% CLEAN, VACANT, AVAILABLE, SELLABLE
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

  // Remove any legacy rooms that are not in the 19
  const validNumbers = ROOMS.map(r => r.roomNumber);
  await Room.deleteMany({ roomNumber: { $nin: validNumbers } });

  for (const r of ROOMS) {
    await Room.findOneAndUpdate(
      { roomNumber: r.roomNumber },
      {
        roomNumber: r.roomNumber,
        floor: r.floor,
        category: categoryMap[r.slug],
        propertyId: property._id,
        status: RoomStatus.AVAILABLE,
        occupancyStatus: OccupancyStatus.VACANT,
        housekeepingStatus: HousekeepingRoomStatus.CLEAN,
        sellStatus: SellStatus.SELLABLE,
        currentBooking: undefined,
        maintenanceHold: undefined,
      },
      { upsert: true, returnDocument: "after" }
    );
  }
  console.log(`  ✅ All 19 rooms reset to AVAILABLE, VACANT & CLEAN`);

  // 6. Ensure default staff users exist
  const USERS = [
    { email: "admin@yeshotels.com", role: UserRole.ADMIN, firstName: "Super", lastName: "Admin" },
    { email: "manager@yeshotels.com", role: UserRole.MANAGER, firstName: "Vikram", lastName: "Mehta" },
    { email: "reception@yeshotels.com", role: UserRole.RECEPTIONIST, firstName: "Priya", lastName: "Nair" },
    { email: "housekeeping@yeshotels.com", role: UserRole.HOUSEKEEPING, firstName: "Ramesh", lastName: "Kumar" },
  ];

  for (const u of USERS) {
    const exists = await User.findOne({ email: u.email });
    if (!exists) {
      // A fresh random password, shown once here. Never a published demo password.
      const password = `Yh-${crypto.randomBytes(9).toString("base64url")}#7`;
      await User.create({
        email: u.email,
        passwordHash: await hashPassword(password),
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        propertyId: property._id,
        isActive: true,
      });
      console.log(`  ✅ Created staff user: ${u.email}  password (shown once): ${password}`);
    }
  }

  // 7. Ensure Payment Channels
  const CHANNELS = [
    { code: "CASH", name: "Cash Counter", type: "CASH", isActive: true, isDefault: true },
    { code: "UPI_COUNTER", name: "UPI QR (Counter)", type: "UPI", isActive: true },
    { code: "CARD_EDC_01", name: "POS Terminal (EDC 01)", type: "CARD", isActive: true },
    { code: "BANK_TRANSFER", name: "NEFT / RTGS / IMPS", type: "BANK_TRANSFER", isActive: true },
  ];
  for (const ch of CHANNELS) {
    await PaymentChannel.findOneAndUpdate(
      { code: ch.code },
      { ...ch, propertyId: property._id },
      { upsert: true, returnDocument: "after" }
    );
  }

  console.log("\n✨ System is now 100% clean and ready for real production use!");
  console.log("   - 0 dummy bookings, 0 mock folios, 0 mock orders");
  console.log("   - 19 rooms all Available, Clean & Ready");
  console.log("   - Staff logins active and ready");

  await mongoose.disconnect();
  process.exit(0);
}

cleanProductionSeed().catch(err => {
  console.error("Clean seed error:", err);
  process.exit(1);
});
