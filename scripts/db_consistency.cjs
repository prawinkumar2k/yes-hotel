const mongoose = require('mongoose');

async function auditDB() {
  await mongoose.connect('mongodb://127.0.0.1:27027/yes_hotels');
  const db = mongoose.connection;
  
  console.log("=== DATABASE CONSISTENCY AUDIT ===");

  const bookings = await db.collection('bookings').find().toArray();
  const folios = await db.collection('folios').find().toArray();
  const rooms = await db.collection('rooms').find().toArray();
  
  console.log(`Total Bookings: ${bookings.length}`);
  console.log(`Total Folios: ${folios.length}`);
  console.log(`Total Rooms: ${rooms.length}`);

  // Find orphan folios
  const bookingIds = new Set(bookings.map(b => b._id.toString()));
  const orphanFolios = folios.filter(f => f.booking && !bookingIds.has(f.booking.toString()));
  console.log(`Orphan Folios (no matching booking): ${orphanFolios.length}`);

  // Find bookings with no folios
  const folioBookingIds = new Set(folios.map(f => f.booking ? f.booking.toString() : null));
  const orphanBookings = bookings.filter(b => !folioBookingIds.has(b._id.toString()) && b.status !== 'CANCELLED');
  console.log(`Bookings without folios: ${orphanBookings.length}`);

  // Find duplicate room assignments
  const activeBookings = bookings.filter(b => ['CHECKED_IN', 'CONFIRMED'].includes(b.status));
  const assignedRooms = activeBookings.map(b => b.assignedRoom ? b.assignedRoom.toString() : null).filter(r => r);
  const duplicates = assignedRooms.filter((item, index) => assignedRooms.indexOf(item) !== index);
  console.log(`Duplicate room assignments (active bookings on same room): ${duplicates.length}`);

  process.exit(0);
}

auditDB().catch(console.error);
