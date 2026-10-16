import type { BookingState } from "@/components/chatbot/types";

export type BookingEnquiryPayload = Partial<BookingState> & {
  guestName: string;
  phone: string;
  checkIn: string | Date;
  checkOut: string | Date;
  email?: string;
  nights?: number;
  adults?: number;
  children?: number;
  rooms?: number;
  roomType?: string;
  roomCategoryId?: string;
  pricePerNight?: number;
  roomSubtotal?: number;
  bookingStage?: string;
  source?: string;
};

export async function submitBookingEnquiry(booking: BookingEnquiryPayload) {
  const response = await fetch("/api/booking-enquiry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || "Unable to submit enquiry");
  }
  return payload;
}
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Records how far a guest got in the website booking (shown on the Enquiries page), once we have
 * their name, a 10-digit phone and an email. Best-effort: never blocks or breaks the booking.
 */
export function trackWebsiteBookingStage(
  stage: "WEBSITE_GUEST_DETAILS" | "WEBSITE_PAYMENT_PAGE" | "WEBSITE_BOOKING_FAILED",
  d: { category?: string | null; checkIn?: string | null; checkOut?: string | null; adults?: string | number | null; children?: string | number | null; guestDetails?: { firstName?: string; lastName?: string; email?: string; phone?: string } | null },
  reason?: string,
) {
  const g = d.guestDetails ?? {};
  const name = `${g.firstName ?? ""} ${g.lastName ?? ""}`.trim();
  if (name.length < 2 || !EMAIL_RX.test(String(g.email ?? "").trim()) || String(g.phone ?? "").replace(/\D/g, "").length < 10) return;
  if (!d.checkIn || !d.checkOut) return;
  submitBookingEnquiry({
    guestName: name,
    email: String(g.email).trim(),
    phone: String(g.phone).trim(),
    checkIn: d.checkIn,
    checkOut: d.checkOut,
    adults: Number(d.adults) || 1,
    children: Number(d.children) || 0,
    rooms: 1,
    roomType: "Room",
    roomCategoryId: d.category || undefined,
    bookingStage: stage,
    source: "WEBSITE",
    ...(reason ? { reason: reason.slice(0, 300) } : {}),
  } as BookingEnquiryPayload).catch(() => undefined);
}
