const mongoose = require('mongoose');

async function repair() {
  await mongoose.connect('mongodb://127.0.0.1:27027/yes_hotels');
  const db = mongoose.connection;
  
  const Folio = db.model('Folio', new mongoose.Schema({}, { strict: false }));
  const Booking = db.model('Booking', new mongoose.Schema({}, { strict: false }));
  
  const bookings = await Booking.find({});
  const folios = await Folio.find({});
  const folioBookingIds = new Set(folios.map(f => f.booking ? f.booking.toString() : null));

  for (const b of bookings) {
    if (!folioBookingIds.has(b._id.toString())) {
      console.log('Repairing booking:', b._id);
      const guestId = b.customer ? b.customer : b._id; // fallback
      
      await Folio.create({
        booking: b._id,
        guest: guestId,
        checkInDate: b.checkInDate || new Date(),
        checkOutDate: b.checkOutDate || new Date(),
        status: 'OPEN',
        totalCharges: 0,
        totalDiscounts: 0,
        totalTax: 0,
        totalPaid: 0, // Should be populated by actual payment logic later
        totalAdvanceAdjusted: 0,
        balance: 0,
        cgst: 0, sgst: 0, igst: 0
      });
      console.log('Created folio for booking', b._id);
    }
  }

  process.exit(0);
}

repair().catch(console.error);
