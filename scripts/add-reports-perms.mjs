import mongoose from "mongoose";

const uri = "mongodb://127.0.0.1:27027/yes_hotels";

async function addPermissions() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const roles = await db.collection("roles").find({ key: { $in: ["ADMIN", "MANAGER", "SUPER_ADMIN"] } }).toArray();
  
  const reportPerms = [
    "REPORTS_LAYOUT",
    "REPORTS_DAY_SUMMARY",
    "REPORTS_MONTHLY_MIS"
  ];

  for (const role of roles) {
    for (const p of reportPerms) {
      await db.collection("rolepermissions").updateOne(
        { roleId: role._id, pageKey: p },
        { 
          $set: { 
            actions: ["READ", "WRITE", "DELETE", "MANAGE"],
            isActive: true,
            propertyId: role.propertyId || null
          }
        },
        { upsert: true }
      );
    }
    console.log(`Added report permissions to ${role.key}`);
  }

  process.exit(0);
}

addPermissions().catch(console.error);
