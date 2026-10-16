/**
 * How far a website / chatbot guest got before they stopped. The enquiry keeps the last stage
 * reached (bookingStage) plus the history, so Reception can see where each guest dropped off.
 * Listed in the order a guest moves through them.
 */
export type EnquiryStageInfo = { label: string; desc: string; tone: "gray" | "purple" | "indigo" | "blue" | "amber" | "rose" | "cyan" | "emerald" };

export const ENQUIRY_STAGES: Record<string, EnquiryStageInfo> = {
  CHATBOT_STARTED: { label: "Chatbot started", desc: "Opened the chatbot", tone: "gray" },
  CHATBOT_CONTACT_COLLECTED: { label: "Chatbot: contact shared", desc: "Gave name, phone and email in the chatbot, then stopped", tone: "purple" },
  CHATBOT_AVAILABILITY_CHECKED: { label: "Chatbot: checked rooms", desc: "Checked availability for their dates, did not pick a room", tone: "purple" },
  CHATBOT_ROOM_SELECTED: { label: "Chatbot: room selected", desc: "Picked a room in the chatbot, did not send the enquiry", tone: "indigo" },
  ENQUIRY_CONFIRMED: { label: "Enquiry sent", desc: "Sent the enquiry from the chatbot", tone: "cyan" },
  CHATBOT_TO_BOOKING: { label: "Chatbot → booking page", desc: "Went from the chatbot to the booking page, did not finish", tone: "amber" },
  WEBSITE_GUEST_DETAILS: { label: "Website: guest details", desc: "Filled in their details on the booking page, did not continue to payment", tone: "blue" },
  WEBSITE_PAYMENT_PAGE: { label: "Website: payment page", desc: "Reached the last step (payment), did not confirm the booking", tone: "amber" },
  WEBSITE_BOOKING_FAILED: { label: "Website: booking failed", desc: "Tried to confirm but the booking did not go through", tone: "rose" },
  BOOKING_COMPLETED: { label: "Booking completed", desc: "Booking made", tone: "emerald" },
  // Older names still on earlier enquiries
  GUEST_DETAILS_ENTERED: { label: "Website: guest details", desc: "Filled in their details on the booking page", tone: "blue" },
  PAYMENT_PENDING: { label: "Payment page", desc: "Reached payment, did not finish", tone: "amber" },
  ABANDONED_CHECKOUT: { label: "Abandoned checkout", desc: "Dropped off at checkout", tone: "rose" },
};

export const PUBLIC_ENQUIRY_STAGES = [
  "CHATBOT_CONTACT_COLLECTED", "CHATBOT_AVAILABILITY_CHECKED", "CHATBOT_ROOM_SELECTED", "ENQUIRY_CONFIRMED",
  "CHATBOT_TO_BOOKING", "WEBSITE_GUEST_DETAILS", "WEBSITE_PAYMENT_PAGE", "WEBSITE_BOOKING_FAILED",
] as const;

export const enquiryStageInfo = (stage?: string | null): EnquiryStageInfo =>
  (stage && ENQUIRY_STAGES[stage]) || { label: stage ? stage.replace(/_/g, " ").toLowerCase() : "Lead captured", desc: "In progress", tone: "gray" };
