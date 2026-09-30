const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://127.0.0.1:27027/yes_hotels');
  const db = mongoose.connection.db;
  const user = await db.collection('users').findOne({ email: 'admin@yeshotels.com' });
  console.log('Real DB Role:', user?.role);
  process.exit(0);
}
test();
