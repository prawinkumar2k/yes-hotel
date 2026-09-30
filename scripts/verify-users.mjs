import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const URI = 'mongodb://127.0.0.1:27027/yes_hotels';

async function verifyAndFix() {
  console.log('Connecting to', URI);
  await mongoose.connect(URI);
  const db = mongoose.connection.db;

  // Verify user and passwordHash
  const user = await db.collection('users').findOne({ email: 'admin@yeshotels.com' });
  console.log('User found:', !!user);
  console.log('Role:', user?.role);
  console.log('Has passwordHash:', !!user?.passwordHash);
  console.log('Has old password field:', !!user?.password);

  if (user && !user.passwordHash && user.password) {
    console.log('FIXING: Moving password -> passwordHash for admin...');
    await db.collection('users').updateMany(
      { passwordHash: { $exists: false }, password: { $exists: true } },
      [{ $set: { passwordHash: '$password' } }]
    );
    console.log('Done fixing password field mapping');
  }

  // Now ensure ALL demo users have passwordHash
  const demoUsers = [
    { email: 'admin@yeshotels.com', pw: 'Admin@123' },
    { email: 'manager@yeshotels.com', pw: 'Manager@123' },
    { email: 'supervisor@yeshotels.com', pw: 'Supervisor@123' },
    { email: 'reception@yeshotels.com', pw: 'Reception@123' },
    { email: 'housekeeping@yeshotels.com', pw: 'House@123' },
  ];

  for (const u of demoUsers) {
    const existing = await db.collection('users').findOne({ email: u.email });
    if (!existing) {
      console.log('NOT FOUND:', u.email);
      continue;
    }
    if (!existing.passwordHash) {
      console.log('Fixing passwordHash for:', u.email);
      const hash = await bcrypt.hash(u.pw, 10);
      await db.collection('users').updateOne(
        { email: u.email },
        { $set: { passwordHash: hash }, $unset: { password: '' } }
      );
    } else {
      console.log('OK:', u.email, '| role:', existing.role, '| passwordHash: YES');
    }
  }

  process.exit(0);
}

verifyAndFix().catch(e => { console.error(e); process.exit(1); });
