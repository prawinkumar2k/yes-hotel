import mongoose from "mongoose";

const uri = "mongodb://127.0.0.1:27027/yes_hotels";

async function addPermissions() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const roles = await db.collection("roles").find({ key: { $in: ["ADMIN", "MANAGER", "SUPER_ADMIN"] } }).toArray();
  
  for (const role of roles) {
    await db.collection("rolepermissions").updateOne(
      { roleId: role._id, pageKey: "COUPONS" },
      { 
        $set: { 
          actions: ["READ", "WRITE", "DELETE", "MANAGE"],
          isActive: true,
          propertyId: role.propertyId || null
        }
      },
      { upsert: true }
    );
    console.log(`Added COUPONS permission to ${role.key}`);
  }

  process.exit(0);
}

addPermissions().catch(console.error);
