import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import { User } from '../src/models/User';

async function updateAdmin() {
  await mongoose.connect('mongodb://localhost:27017/yes-hotels');
  const user = await User.findOneAndUpdate(
    { email: 'admin@yeshotels.com' },
    { $set: { role: 'SUPER_ADMIN' } },
    { new: true }
  );
  console.log(user ? 'Updated admin to SUPER_ADMIN' : 'User not found');
  process.exit(0);
}
updateAdmin();
