import "dotenv/config";
import mongoose from "mongoose";

const URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27027/yes_hotels";

async function main() {
  console.log(`Connecting to ${URI}...`);
  await mongoose.connect(URI);

  const collectionsBefore = await mongoose.connection.db.listCollections().toArray();
  console.log(`Found ${collectionsBefore.length} collections in database before wipe:`);
  collectionsBefore.forEach((c) => console.log(` - ${c.name}`));

  console.log("\nDropping database completely...");
  await mongoose.connection.dropDatabase();
  console.log("Database dropped successfully.");

  const collectionsAfter = await mongoose.connection.db.listCollections().toArray();
  console.log(`\nRemaining collections after wipe: ${collectionsAfter.length}`);

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");
}

main().catch((err) => {
  console.error("Wipe failed:", err);
  process.exit(1);
});
