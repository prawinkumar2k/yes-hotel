import { Guest } from "../models/Guest";

export class GuestBlockedError extends Error {
  constructor(message = "This guest is blocked from making new bookings") {
    super(message);
    this.name = "GuestBlockedError";
  }
}

export async function assertGuestNotBlocked(email: string) {
  const guest = await Guest.findOne({ email: email.trim().toLowerCase() });
  if (guest?.isBlocked) {
    throw new GuestBlockedError();
  }
}

/**
 * Keeps the Guest CRM record in sync with real booking activity. Without
 * this, Guest Management is disconnected from bookings entirely — isBlocked
 * can never matter, totalBookings/totalSpend are always 0, and the guest
 * list stays empty on a fresh install no matter how many bookings happen.
 */
export async function syncGuestOnBookingCreated(params: {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}) {
  const email = params.email.trim().toLowerCase();
  await Guest.findOneAndUpdate(
    { email },
    {
      $setOnInsert: {
        email,
        fullName: `${params.firstName} ${params.lastName}`.trim(),
        phone: params.phone,
      },
      $inc: { totalBookings: 1 },
    },
    { upsert: true }
  );
}

export async function syncGuestOnPaymentConfirmed(params: {
  email: string;
  amount: number;
  checkInDate: Date;
  checkOutDate: Date;
}) {
  const email = params.email.trim().toLowerCase();
  const guest = await Guest.findOne({ email });
  if (!guest) return;

  guest.totalSpend = (guest.totalSpend || 0) + params.amount;
  if (!guest.firstStay || params.checkInDate < guest.firstStay) guest.firstStay = params.checkInDate;
  if (!guest.lastStay || params.checkOutDate > guest.lastStay) guest.lastStay = params.checkOutDate;
  await guest.save();
}
