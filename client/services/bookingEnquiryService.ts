import type { BookingState } from "@/components/chatbot/types";

export async function submitBookingEnquiry(booking: BookingState) {
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