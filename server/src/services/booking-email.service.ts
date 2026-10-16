import { Booking, BookingStatus } from "../models/Booking";
import { HotelSettings } from "../models/HotelSettings";
import "../models/RoomCategory"; // registered for populate("roomCategory")
import "../models/Room"; // registered for populate("assignedRoom")
import { NotificationType } from "../models/NotificationLog";
import { isPlaceholderEmail } from "./guest-stats.service";
import { sendNotification } from "./notification.service";
import { logger } from "./logger.service";

/**
 * Emails the guest their booking details and how to sign in to their account, right after a
 * booking is made (website, enquiry conversion, walk-in). Several rooms booked together for the
 * same email go in one message. No password is sent: guests sign in with a code emailed to them
 * or with booking number + mobile. Skips bookings without a real email address.
 */
export async function sendBookingCreatedEmail(bookingIds: unknown[]): Promise<void> {
  const bookings: any[] = await Booking.find({ _id: { $in: bookingIds as any[] } })
    .populate("roomCategory", "name")
    .populate("assignedRoom", "roomNumber")
    .sort({ bookingReference: 1 })
    .lean();
  const byEmail = new Map<string, any[]>();
  for (const b of bookings) {
    const email = String(b.guestDetails?.email ?? "").trim().toLowerCase();
    if (!email || isPlaceholderEmail(email) || email.endsWith(".local") || !email.includes("@")) continue;
    byEmail.set(email, [...(byEmail.get(email) ?? []), b]);
  }
  if (byEmail.size === 0) return;

  const settings: any = (await HotelSettings.findOne().lean()) ?? {};
  for (const [email, stays] of byEmail) {
    const { subject, text, html } = composeBookingEmail(email, stays, settings);
    await sendNotification({
      type: NotificationType.BOOKING_CONFIRMATION,
      recipientEmail: email,
      subject,
      body: text,
      html,
      bookingId: String(stays[0]._id),
    });
  }
}

/** Fire-and-forget wrapper for controllers: the booking is already saved, so an email problem must not fail the request. */
export function queueBookingCreatedEmail(bookingIds: unknown[]): void {
  sendBookingCreatedEmail(bookingIds).catch((error: any) => {
    logger.error("booking_email.failed", { bookingIds: bookingIds.map(String), message: error?.message });
  });
}

const IST = "Asia/Kolkata";
const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short", year: "numeric" });
const money = (n: unknown) => `₹${(Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nightsOf = (b: any) => Math.max(1, Math.round((new Date(b.checkOutDate).getTime() - new Date(b.checkInDate).getTime()) / 86_400_000));
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const time12 = (hhmm?: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? ""));
  if (!m) return hhmm ?? "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "AM" : "PM"}`;
};

export function composeBookingEmail(email: string, stays: any[], settings: any) {
  const site = (process.env.CLIENT_URL || "https://yeshotels.in").replace(/\/+$/, "");
  const hotel = settings.hotelName || "YES Hotels";
  const guest = stays[0].guestDetails ?? {};
  const name = [guest.firstName, guest.lastName && guest.lastName !== "." ? guest.lastName : ""].filter(Boolean).join(" ") || "Guest";
  const confirmed = stays.every((b) => b.status !== BookingStatus.PENDING);
  const refs = stays.map((b) => b.bookingReference);
  const total = stays.reduce((t, b) => t + (Number(b.totalAmount) || 0), 0);
  const paid = stays.reduce((t, b) => t + (Number(b.paidAmount) || 0), 0);
  const balance = Math.max(0, Math.round((total - paid) * 100) / 100);
  const mobile = String(guest.phone ?? "").replace(/\D/g, "").slice(-10);

  const subject = `${confirmed ? "Booking confirmed" : "Booking received"} — ${refs.join(", ")} | ${hotel}`;
  const lead = confirmed
    ? `Your booking at ${hotel} is confirmed.`
    : `Thank you for booking with ${hotel}. We have received your booking; please pay the balance at Reception on arrival if it isn't paid online.`;

  const rows = stays.map((b) => ({
    ref: b.bookingReference,
    room: [b.roomCategory?.name, b.assignedRoom?.roomNumber ? `Room ${b.assignedRoom.roomNumber}` : ""].filter(Boolean).join(" · ") || "Room",
    dates: `${fmtDate(b.checkInDate)} → ${fmtDate(b.checkOutDate)} (${nightsOf(b)} night${nightsOf(b) > 1 ? "s" : ""})`,
    guests: `${b.adults ?? 1} adult${(b.adults ?? 1) > 1 ? "s" : ""}${b.children ? `, ${b.children} child${b.children > 1 ? "ren" : ""}` : ""}`,
    amount: money(b.totalAmount),
  }));

  const loginUrl = `${site}/login`;
  const text = [
    `Hi ${name},`,
    "",
    lead,
    "",
    "BOOKING DETAILS",
    ...rows.flatMap((r) => [`Booking number: ${r.ref}`, `Room: ${r.room}`, `Stay: ${r.dates}`, `Guests: ${r.guests}`, `Amount (incl. GST): ${r.amount}`, ""]),
    `Total: ${money(total)}   Paid: ${money(paid)}   Balance: ${money(balance)}`,
    `Check-in from ${time12(settings.checkInTime || "14:00")}, check-out by ${time12(settings.checkOutTime || "11:00")}. Please bring a government photo ID.`,
    "",
    "YOUR GUEST ACCOUNT",
    `Sign in at ${loginUrl} to see your booking and bill and chat with Reception:`,
    `  • Email code: choose "Email code", enter ${email} and type the 6-digit code we email you.`,
    `  • Or choose "Booking no." and enter ${refs[0]} with your mobile number${mobile ? ` (ending ${mobile.slice(-4)})` : ""}.`,
    "No password is needed.",
    "",
    `Questions? Call ${settings.phone || ""}${settings.email ? ` or email ${settings.email}` : ""}.`,
    settings.address ? `${hotel}, ${settings.address}` : hotel,
  ].join("\n");

  const cell = 'style="padding:6px 0;color:#555;vertical-align:top;width:150px"';
  const val = 'style="padding:6px 0;color:#111;font-weight:600"';
  const html = `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ee;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:#fff;border-bottom:3px solid #b8860b;padding:20px 24px;text-align:center"><img src="${site}/brand/yes-hotels-logo.png" alt="${esc(hotel)}" height="48" style="height:48px"></td></tr>
<tr><td style="padding:24px">
<h1 style="margin:0 0 8px;font-size:22px;color:#111">${confirmed ? "Booking confirmed" : "Booking received"}</h1>
<p style="margin:0 0 20px;color:#333;line-height:1.5">Hi ${esc(name)},<br>${esc(lead)}</p>
${rows.map((r) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e1d6;border-radius:8px;padding:12px 16px;margin-bottom:12px">
<tr><td ${cell}>Booking number</td><td ${val}>${esc(r.ref)}</td></tr>
<tr><td ${cell}>Room</td><td ${val}>${esc(r.room)}</td></tr>
<tr><td ${cell}>Stay</td><td ${val}>${esc(r.dates)}</td></tr>
<tr><td ${cell}>Guests</td><td ${val}>${esc(r.guests)}</td></tr>
<tr><td ${cell}>Amount (incl. GST)</td><td ${val}>${esc(r.amount)}</td></tr></table>`).join("")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f3;border-radius:8px;padding:12px 16px;margin-bottom:16px">
<tr><td ${cell}>Total</td><td ${val}>${money(total)}</td></tr>
<tr><td ${cell}>Paid</td><td ${val}>${money(paid)}</td></tr>
<tr><td ${cell}>Balance</td><td ${val}>${money(balance)}</td></tr></table>
<p style="margin:0 0 24px;color:#333;line-height:1.5">Check-in from <b>${esc(time12(settings.checkInTime || "14:00"))}</b>, check-out by <b>${esc(time12(settings.checkOutTime || "11:00"))}</b>. Please bring a government photo ID.</p>
<h2 style="margin:0 0 8px;font-size:17px;color:#111">Your guest account</h2>
<p style="margin:0 0 12px;color:#333;line-height:1.5">See your booking and bill and chat with Reception. No password needed:</p>
<ul style="margin:0 0 16px;padding-left:20px;color:#333;line-height:1.6">
<li><b>Email code:</b> choose “Email code”, enter <b>${esc(email)}</b> and type the 6-digit code we email you.</li>
<li><b>Booking number:</b> choose “Booking no.” and enter <b>${esc(refs[0])}</b> with your mobile number${mobile ? ` (ending ${esc(mobile.slice(-4))})` : ""}.</li></ul>
<p style="text-align:center;margin:0 0 24px"><a href="${loginUrl}" style="display:inline-block;background:#b8860b;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600">Sign in to your account</a></p>
<p style="margin:0;color:#666;font-size:13px;line-height:1.5">Questions? Call ${esc(settings.phone || "")}${settings.email ? ` or email <a href="mailto:${esc(settings.email)}">${esc(settings.email)}</a>` : ""}.<br>${esc(hotel)}${settings.address ? `, ${esc(settings.address)}` : ""}</p>
</td></tr></table></td></tr></table></body></html>`;

  return { subject, text, html };
}
