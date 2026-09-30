import "dotenv/config";
import mongoose from "mongoose";

const URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/yes_hotels";

async function main() {
  console.log(`Connecting to database at ${URI}...`);
  await mongoose.connect(URI);
  console.log("Connected successfully.\n");

  console.log("🧹 Clearing all operational data...");

  const collectionsToClear = [
    "bookings",
    "bookingevents",
    "bookinginventorydays",
    "folios",
    "foliolines",
    "advancepayments",
    "advanceadjustments",
    "payments",
    "refunds",
    "guests",
    "cashiershifts",
    "housekeepingtasks",
    "maintenancetickets",
    "auditlogs",
    "notificationlogs",
    "complaints",
    "bookingenquiries",
    "contactmessages",
    "banksettlements"
  ];

  for (const collName of collectionsToClear) {
    try {
      const collection = mongoose.connection.collection(collName);
      const result = await collection.deleteMany({});
      console.log(`- Deleted ${result.deletedCount} from ${collName}`);
    } catch (e: any) {
      console.log(`- Collection ${collName} could not be cleared: ${e.message}`);
    }
  }

  console.log("\n🧹 Resetting all Rooms to VACANT & CLEAN...");
  const roomResult = await mongoose.connection.collection("rooms").updateMany({}, {
    $set: {
      occupancyStatus: "VACANT",
      housekeepingStatus: "CLEAN",
      sellStatus: "SELLABLE",
      frontDeskStatus: "VACANT",
      currentBooking: null,
      notes: ""
    }
  });
  console.log(`- Updated ${roomResult.modifiedCount} Rooms.`);

  console.log("\n✅ All operational dummy data has been successfully cleared.");
  console.log("✅ Core configuration (Users, Rooms, Categories, Pricing, Settings) has been preserved.");
  
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Reset failed:", err);
  process.exit(1);
});
