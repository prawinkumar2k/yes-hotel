import mongoose from "mongoose";

const uri = "mongodb://127.0.0.1:27027/yes_hotels";

async function fixPermissions() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  await db.collection("rolepermissions").updateMany(
    { pageKey: "COUPONS" },
    { $set: { actions: ["VIEW", "CREATE", "EDIT", "DELETE"] } }
  );

  console.log("Fixed COUPONS actions");
  process.exit(0);
}

fixPermissions().catch(console.error);
