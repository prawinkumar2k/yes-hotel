import mongoose from "mongoose";

async function check() {
  await mongoose.connect("mongodb://127.0.0.1:27027/yes_hotels");
  const guests = await mongoose.connection.collection("guests").find({}).toArray();
  console.log("Total guests:", guests.length);
  for (const g of guests) {
    const bookings = await mongoose.connection.collection("bookings").find({
      $or: [
        { "guestDetails.email": g.email },
        { "guestDetails.phone": g.phone },
        { "guestDetails.phoneNumber": g.phone },
      ],
    }).toArray();
    const totalSpend = bookings.reduce((sum, b) => sum + (b.totalAmount || b.totalPrice || 0), 0);
    const lastStay = bookings.reduce((latest, b) => {
      const d = b.checkOutDate ? new Date(b.checkOutDate) : (b.checkInDate ? new Date(b.checkInDate) : null);
      if (!d) return latest;
      return !latest || d > latest ? d : latest;
    }, null);

    console.log({
      name: g.fullName,
      email: g.email,
      phone: g.phone,
      existingSpend: g.totalSpend,
      calculatedSpend: totalSpend,
      bookingsCount: bookings.length,
      lastStay: lastStay ? lastStay.toISOString() : "None",
    });
  }
  process.exit(0);
}

check().catch(console.error);
