/**
 * Terms, privacy and cancellation pages when the hotel has not written its own in
 * Admin → Content (keys "terms", "privacy", "cancellation"). Built only from the hotel's real
 * facts (shared/hotel-info, Admin → Settings) and the rules the system actually applies — so the
 * pages are never empty and never promise something the hotel does not do.
 */
import { HOTEL, hotelAddressOneLine } from "../../../shared/hotel-info";

export const LEGAL_KEYS = ["terms", "privacy", "cancellation"] as const;

export function defaultLegalContent(key: string, settings: any) {
  const email = settings?.email || "bookings@yeshotels.in";
  const phone = settings?.phone || HOTEL.phones[0];
  const checkIn = settings?.checkInTime || "12:00";
  const checkOut = settings?.checkOutTime || "11:00";
  const freeHours = Number(settings?.cancellationFreeHours) || 48;
  const partialHours = settings?.cancellationPartialHours != null && Number.isFinite(Number(settings.cancellationPartialHours)) ? Number(settings.cancellationPartialHours) : 24;
  const partialPercent = settings?.cancellationPartialPercent != null && Number.isFinite(Number(settings.cancellationPartialPercent)) ? Number(settings.cancellationPartialPercent) : 50;
  const gstIn = settings?.taxInclusiveRates ? "Room prices shown include GST." : "GST is added to room prices as per government rates.";
  const contact = `${HOTEL.name}, ${hotelAddressOneLine()}\nPhone: ${phone} · Email: ${email}`;

  const docs: Record<string, { title: string; description: string }> = {
    terms: {
      title: "Terms & Conditions",
      description: [
        "1. Check-in and check-out",
        `Check-in is from ${checkIn} and check-out is by ${checkOut}. Early check-in and late check-out are subject to availability and are charged by the hour (with GST); please ask the front desk.`,
        "",
        "2. Identification",
        "Every adult guest must show a valid government photo ID at check-in, as required by law. Foreign nationals must show their passport and visa.",
        "",
        "3. Prices and payment",
        `${gstIn} Payment can be made online at booking, or at the hotel by cash, card or UPI. A tax invoice is issued at check-out.`,
        "",
        "4. Cancellation",
        `Please see our Cancellation & Refund Policy. Cancelling more than ${freeHours} hours before check-in is free.`,
        "",
        "5. Conduct and damage",
        "Guests are responsible for their room during the stay. Damage to hotel property is charged at cost. Please follow the hotel's safety instructions; smoking is allowed only where permitted.",
        "",
        "6. Responsibility for the bill",
        "Whatever the billing arrangement, the guest remains responsible for paying the full bill for the stay.",
        "",
        "7. Disputes",
        "All disputes are subject to Bengaluru jurisdiction.",
        "",
        "Contact",
        contact,
      ].join("\n"),
    },
    privacy: {
      title: "Privacy Policy",
      description: [
        "What we collect",
        "To book and register your stay we collect your name, mobile number, email address (optional at the front desk), address, and the ID proof the law requires for hotel guests. We keep the record of your bookings, bills and payments, and any messages you send us through the website chat or enquiry forms.",
        "",
        "Payments",
        "Online payments are processed by our payment partner Razorpay. We do not store your card details.",
        "",
        "How we use it",
        "Only to manage your booking and stay, issue invoices, meet legal requirements (guest registration and tax records), and contact you about your booking. We do not sell or rent your information.",
        "",
        "Who can see it",
        "Hotel staff who need it for your stay, and authorities where the law requires it. Staff access is limited by role and recorded.",
        "",
        "Cookies",
        "The website uses a cookie only to keep you signed in. We do not use advertising cookies.",
        "",
        "Your choices",
        `You can ask to see or correct your details, or ask us to delete what we are not required by law to keep, by writing to ${email}.`,
        "",
        "Contact",
        contact,
      ].join("\n"),
    },
    cancellation: {
      title: "Cancellation & Refund Policy",
      description: [
        settings?.cancellationPolicy ? `${settings.cancellationPolicy}\n` : "",
        "When you cancel before check-in",
        `• More than ${freeHours} hours before check-in: free — full refund.`,
        `• Between ${partialHours} and ${freeHours} hours before check-in: ${partialPercent}% of the booking amount is charged.`,
        `• Less than ${partialHours} hours before check-in, or no-show: no refund (100% of the booking amount is charged).`,
        "• Genuine emergencies: please tell us the reason; emergency cancellations are refunded in full.",
        "",
        "Refunds",
        "Refunds go back to the original payment method. Online payments are refunded through Razorpay; bank processing usually takes 5–7 working days.",
        "",
        "After check-in",
        "A stay that has started is cancelled only by the front desk. Nights not used are not charged; any charge for the time the room was used is explained and shown on your bill.",
        "",
        "How to cancel",
        `Sign in to your account on the website and open your booking, or contact us at ${email} / ${phone}.`,
      ].filter((l, i) => i > 0 || l).join("\n"),
    },
  };
  const doc = docs[key];
  if (!doc) return null;
  // The page shows its own heading, so the document carries no second title.
  return { key, title: "", subtitle: "", description: doc.description, isPublished: true, isDefault: true, updatedAt: null };
}
