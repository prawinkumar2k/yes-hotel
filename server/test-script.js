const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27027/yes_hotels').then(async () => {
  try {
    const todayQuery = { 
      $gte: new Date('2026-09-30T00:00:00.000Z'), 
      $lte: new Date('2026-09-30T23:59:59.999Z') 
    };
    const checkIns = await mongoose.connection.collection('bookings').find({ checkInDate: todayQuery }).toArray();
    console.log('checkIns:', checkIns.length);
    const todayPayments = await mongoose.connection.collection('payments').find({ createdAt: todayQuery }).toArray();
    console.log('payments:', todayPayments.length);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
});
