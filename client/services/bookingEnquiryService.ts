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