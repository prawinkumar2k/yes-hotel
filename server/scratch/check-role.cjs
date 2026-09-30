const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/yes-hotels');
  const db = mongoose.connection.db;
  const user = await db.collection('users').findOne({ email: 'admin@yeshotels.com' });
  console.log('Role:', user.role);
  process.exit(0);
}
test();
