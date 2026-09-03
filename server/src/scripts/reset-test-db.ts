import "dotenv/config";
import mongoose from "mongoose";

// This script is only ever allowed to target a database whose name ends in
// "_test" — it will refuse to run against anything else, specifically to
// make it impossible for this to be pointed at the real dev/demo database
// by accident (which is exactly how the earlier incident happened).
const TEST_URI = process.env.TEST_MONGODB_URI || "mongodb://localhost:27017/yes_hotels_test";

async function main() {
  const dbName = new URL(TEST_URI.replace("mongodb://", "http://")).pathname.replace("/", "");
  if (!dbName.endsWith("_test")) {
    console.error(`❌ Refusing to reset "${dbName}" — this script only targets databases whose name ends in "_test".`);
    process.exit(1);
  }

  await mongoose.connect(TEST_URI);
  console.log(`🧹 Dropping isolated test database: ${dbName}`);
  await mongoose.connection.dropDatabase();
  console.log("✅ Test database reset.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Reset failed:", err);
  process.exit(1);
});
