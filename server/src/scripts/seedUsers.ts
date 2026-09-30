import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  password: { type: String, select: false },
  role: String,
}, { strict: false });
const User = mongoose.model("User", userSchema);

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const roles = [
    { role: "CASHIER", email: "cashier@yeshotels.com", password: "Cashier@123", firstName: "Cashier", lastName: "User" },
    { role: "FINANCE", email: "finance@yeshotels.com", password: "Finance@123", firstName: "Finance", lastName: "User" },
    { role: "EVENTS", email: "events@yeshotels.com", password: "Events@123", firstName: "Events", lastName: "User" },
    { role: "INVENTORY", email: "inventory@yeshotels.com", password: "Inventory@123", firstName: "Inventory", lastName: "User" },
    { role: "PROCUREMENT", email: "procurement@yeshotels.com", password: "Procurement@123", firstName: "Procurement", lastName: "User" },
    { role: "SUPER_ADMIN", email: "superadmin@yeshotels.com", password: "Superadmin@123", firstName: "Super", lastName: "Admin" },
  ];

  await User.deleteMany({ email: { $in: roles.map(r => r.email) } });

  for (const r of roles) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(r.password, salt);
    await User.create({ ...r, password: hash });
    console.log(`Created ${r.role}`);
  }

  await mongoose.disconnect();
}

seed().catch(console.error);
