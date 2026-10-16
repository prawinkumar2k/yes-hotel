import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, LoaderCircle, Minus, RotateCcw, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nights as countNights, addDays, todayBusinessDate } from "@shared/dates";
import { checkRoomAvailability, type AvailableRoom } from "@/services/availabilityService";
import { submitBookingEnquiry } from "@/services/bookingEnquiryService";
import { getHotelInformation, hotelContact } from "@/services/chatService";
import { saveBookingDetails, splitFullName } from "@/lib/bookingSession";
import BookingFlow from "./BookingFlow";
import BookingSummary from "./BookingSummary";
import MessageList from "./MessageList";
import QuickActions from "./QuickActions";
import type { BookingState, ChatMessage } from "./types";
import { useLiveChat } from "./useLiveChat";

type Step = "idle" | "checkin" | "checkout" | "guests" | "checking" | "guestName" | "guestLastName" | "phone" | "email" | "summary" | "submitted";
type PendingAction = "Check Room Availability" | "Hotel Information" | "Contact YES Hotels" | "Talk to Reception" | null;
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hasContact = (b: BookingState) => Boolean(b.guestName && b.phone && b.email);
// What Reception sees as the guest's current step in the chatbot.
const STEP_LABEL: Record<string, string> = {
  idle: "Browsing options", checkin: "Choosing check-in date", checkout: "Choosing check-out date", guests: "Entering guests & rooms",
  checking: "Checking availability", guestName: "Entering first name", guestLastName: "Entering last name", phone: "Entering phone",
  email: "Entering email", summary: "Reviewing enquiry", submitted: "Enquiry sent",
};
const initialBooking: BookingState = { checkIn: "", checkOut: "", nights: 0, adults: 1, children: 0, childAges: [], rooms: 1, roomType: "", guestName: "", phone: "", email: "", availabilityStatus: "idle" };
const newMessage = (sender: ChatMessage["sender"], text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ id: `${Date.now()}-${Math.random()}`, sender, text, ...extra });

export default function ChatWindow({ onMinimize, onClose }: { onMinimize: () => void; onClose: () => void }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([newMessage("assistant", "Welcome to YES Hotels. How can I help you today?")]);
  const [booking, setBooking] = useState<BookingState>(initialBooking);
  const [step, setStep] = useState<Step>("idle");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastRooms, setLastRooms] = useState<AvailableRoom[]>([]);
  const [input, setInput] = useState("");
  // Live connection to Reception / Admin (saved on the server; replies arrive in real time)
  const live = useLiveChat({
    onIncoming: (incoming) => setMessages((current) => {
      const known = new Set(current.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      if (!fresh.length) return current;
      // A restored conversation replaces the default welcome line.
      const base = current.length === 1 && current[0].sender === "assistant" && fresh.length > 1 ? [] : current;
      return [...base, ...fresh];
    }),
  });
  useEffect(() => { live.sync(messages).catch(() => undefined); }, [messages, live.sync]);
  // Opening the chat (or restarting it) puts the guest "online" for Reception.
  useEffect(() => { if (!live.hasSession) live.open().catch(() => undefined); }, [live.hasSession, live.open]);
  useEffect(() => { live.activity({ step: STEP_LABEL[step] ?? step, field: "", text: "" }); }, [step, live.activity]);
  // A sent line clears the "typing" preview Reception sees.
  const userLines = messages.filter((m) => m.sender === "user").length;
  useEffect(() => { if (userLines) live.activity({ text: "" }); }, [userLines, live.activity]);
  useEffect(() => {
    if (booking.guestName || booking.phone || booking.email) live.setDetails({ name: booking.guestName || undefined, phone: booking.phone || undefined, email: booking.email || undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.guestName, booking.phone, booking.email, live.hasSession]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, step]);
  const say = (text: string, extra: Partial<ChatMessage> = {}) => setMessages((current) => [...current, newMessage("assistant", text, extra)]);
  const userSays = (text: string) => setMessages((current) => [...current, newMessage("user", text)]);

  function beginAvailability() { userSays("Check Room Availability"); say("Please select your check-in date."); setStep("checkin"); setBooking((current) => ({ ...current, checkIn: "", checkOut: "", nights: 0, availabilityStatus: "idle" })); }

  function beginActionWithContact(action: PendingAction) {
    if (!action) return;
    userSays(action);
    // Already have what we need from earlier in this conversation — don't ask again.
    if (hasContact(booking)) {
      processPendingAction(action);
      return;
    }
    setPendingAction(action);
    if (!booking.guestName) { say("Before I continue, what is your first name?"); setStep("guestName"); }
    else if (!booking.phone) { say("What phone number should our team use?"); setStep("phone"); }
    else { say("What is your email address?"); setStep("email"); }
  }

  function processPendingAction(action: PendingAction) {
    setPendingAction(null);
    if (action === "Talk to Reception") {
      say("I've let our front desk know. A team member will reply right here — you can keep typing your question below.");
      live.requestStaff().catch(() => say("Sorry, I couldn't reach the front desk. Please call +91 87698 28787."));
      setStep("idle");
      return;
    }
    if (action === "Check Room Availability") {
      say("Thank you. Please select your check-in date.");
      setStep("checkin");
      return;
    }
    if (action === "Hotel Information") {
      say(getHotelInformation());
      setStep("idle");
      return;
    }
    if (action === "Contact YES Hotels") {
      const details = [hotelContact.phone && `Phone: ${hotelContact.phone}`, hotelContact.whatsapp && `WhatsApp: ${hotelContact.whatsapp}`, hotelContact.email && `Email: ${hotelContact.email}`, hotelContact.address && `Address: ${hotelContact.address}`].filter(Boolean);
      say(details.length ? details.join("\n") : "YES Hotels contact details have not been configured yet. Please use the Contact page on this website.");
      setStep("idle");
    }
  }

  function handleAction(action: string) {
    if (action === "Talk to Reception") {
      return beginActionWithContact(action);
    }
    if (action === "Check Room Availability" || action === "Hotel Information" || action === "Contact YES Hotels") {
      return beginActionWithContact(action);
    }
    if (action === "Contact YES Hotels") {
      userSays(action);
      const details = [hotelContact.phone && `Phone: ${hotelContact.phone}`, hotelContact.whatsapp && `WhatsApp: ${hotelContact.whatsapp}`, hotelContact.email && `Email: ${hotelContact.email}`, hotelContact.address && `Address: ${hotelContact.address}`].filter(Boolean);
      say(details.length ? details.join("\n") : "YES Hotels contact details have not been configured yet. Please use the Contact page on this website.");
      return;
    }
    if (action === "Book on Website" || action === "Continue to Booking & Payment") { goToPayment(); return; }
    if (action === "Change Dates") { say("Let’s start again. Please select your check-in date."); setStep("checkin"); return; }
    if (action === "Try Another Room") { say("I’ll check the current inventory for the same dates again."); void checkAvailability(); return; }
    if (action.startsWith("select-room:")) {
      const room = lastRooms.find((item) => item._id === action.slice(12));
      if (!room) return;
      const next = {
        ...booking,
        roomType: room.name,
        roomCategoryId: room._id,
        pricePerNight: room.pricePerNight ?? room.basePrice,
        roomSubtotal: (room.pricePerNight ?? room.basePrice ?? 0) * booking.nights * booking.rooms,
        availabilityStatus: "available" as const,
      };
      setBooking(next);
      if (hasContact(next)) {
        submitBookingEnquiry({
          ...next,
          bookingStage: "CHATBOT_ROOM_SELECTED",
          source: "CHATBOT",
        }).catch(() => undefined);
      }
      // Skip re-asking for whatever contact details we already collected earlier in this chat.
      if (hasContact(next)) {
        say("I still have your contact details from earlier. Please review your booking enquiry before sending it.");
        setStep("summary");
      } else if (next.guestName && next.phone) {
        say("What is your email address?");
        setStep("email");
      } else if (next.guestName) {
        say("What phone number should our team use?");
        setStep("phone");
      } else {
        say("Please share the guest’s first name.");
        setStep("guestName");
      }
    }
  }

  // Hands the already-collected guest details + room selection straight to
  // the site's payment page, skipping the separate guest-details form
  // entirely when nothing is missing — the whole point being fixed here.
  function goToPayment() {
    if (!booking.roomCategoryId) { navigate("/search"); return; }
    const { firstName, lastName } = splitFullName(booking.guestName);
    const guestDetails = { firstName, lastName, email: booking.email, phone: booking.phone };

    // Reception sees the guest moved on to the booking page (the website steps take over from here).
    if (hasContact(booking)) {
      submitBookingEnquiry({
        ...booking,
        bookingStage: "CHATBOT_TO_BOOKING",
        source: "CHATBOT",
      }).catch(() => undefined);
    }

    // Save whatever contact info we already have — even if incomplete — so
    // the guest-details form (if it still needs to render) pre-fills from
    // this chat instead of falling back to a logged-in staff account.
    saveBookingDetails({
      category: booking.roomCategoryId,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      adults: booking.adults,
      children: booking.children,
      guestDetails,
      specialRequests: "",
      idempotencyKey: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    });
    if (firstName && lastName && booking.phone && booking.email) {
      navigate("/booking/payment");
      return;
    }
    // Missing something (e.g. guest skipped email) — still skip the dead-end
    // /search page and go straight to the guest-details form, pre-filled
    // with whatever we do have.
    navigate(`/booking/guest-details?category=${booking.roomCategoryId}&checkIn=${booking.checkIn}&checkOut=${booking.checkOut}&adults=${booking.adults}&children=${booking.children}`);
  }

  function handleDate(value: string) {
    if (step === "checkin") { setBooking((current) => ({ ...current, checkIn: value })); userSays(format(parseISO(value), "d MMMM yyyy")); say("Please select your check-out date."); setStep("checkout"); return; }
    if (value <= booking.checkIn) { say("Check-out must be after check-in. Please choose a later date."); return; }
    const nights = countNights(booking.checkIn, value);
    setBooking((current) => ({ ...current, checkOut: value, nights })); userSays(format(parseISO(value), "d MMMM yyyy")); say("How many guests will be staying?"); setStep("guests");
  }

  function handleDateBack() {
    if (step === "checkout") {
      say("Please select your check-in date.");
      setStep("checkin");
      return;
    }
    setBooking(initialBooking);
    say("What would you like help with today?");
    setStep("idle");
  }

  function handleGuests(values: Pick<BookingState, "adults" | "children" | "childAges" | "rooms">) {
    const next = { ...booking, ...values, availabilityStatus: "checking" as const };
    setBooking(next);
    userSays(`${values.adults} adult${values.adults === 1 ? "" : "s"}, ${values.children} child${values.children === 1 ? "" : "ren"}, ${values.rooms} room${values.rooms === 1 ? "" : "s"}`);
    say([
      "Here are the details I have for your enquiry:",
      `Name: ${next.guestName || "Not provided"}`,
      `Phone: ${next.phone || "Not provided"}`,
      `Email: ${next.email || "Not provided"}`,
      `Check-in: ${format(parseISO(next.checkIn), "d MMMM yyyy")}`,
      `Check-out: ${format(parseISO(next.checkOut), "d MMMM yyyy")}`,
      `Stay: ${next.nights} night${next.nights === 1 ? "" : "s"}`,
      `Guests: ${values.adults} adult${values.adults === 1 ? "" : "s"}, ${values.children} child${values.children === 1 ? "" : "ren"}`,
      `Rooms: ${values.rooms}`,
      "I’ll now check live room availability for these details.",
    ].join("\n"), { kind: "details" });
    setStep("checking");
    void checkAvailability(next);
  }

  async function checkAvailability(request = booking) {
    try {
      const rooms = await checkRoomAvailability({ checkIn: request.checkIn, checkOut: request.checkOut, adults: request.adults, children: request.children, rooms: request.rooms });
      setLastRooms(rooms);
      if (!rooms.length) { setBooking((current) => ({ ...current, availabilityStatus: "unavailable" })); say("Sorry, no rooms are currently available for your selected dates."); return; }
      setBooking((current) => ({ ...current, availabilityStatus: "available" })); say("Good news! A room is available for your selected dates.", { kind: "availability", rooms });
      if (hasContact(request)) submitBookingEnquiry({ ...request, source: "CHATBOT", bookingStage: "CHATBOT_AVAILABILITY_CHECKED" }).catch(() => undefined);
      setStep("idle");
    } catch { setBooking((current) => ({ ...current, availabilityStatus: "error" })); say("Sorry, we couldn't check live room availability right now. Please try again or continue through the YES Hotels booking website.", { kind: "error" }); setStep("idle"); }
  }

  function handleGuestText(field: "guestName" | "guestLastName" | "phone" | "email", value: string) {
    if (field === "guestName") {
      if (value.length < 2) return say("Please enter your first name so our team knows who to contact.");
      setBooking((current) => ({ ...current, guestName: value }));
      userSays(value);
      say("And your last name?");
      setStep("guestLastName");
      return;
    }
    if (field === "guestLastName") {
      if (value.length < 2) return say("Please enter your last name so our team knows who to contact.");
      setBooking((current) => ({ ...current, guestName: `${current.guestName} ${value}`.trim() }));
      userSays(value);
      say("What phone number should our team use?");
      setStep("phone");
      return;
    }
    if (field === "phone" && value.replace(/\D/g, "").length !== 10) return say("Please re-enter your phone number. It must contain exactly 10 digits.");
    if (field === "email" && !EMAIL_RX.test(value)) return say("Please enter a valid email address — we send your booking details and sign-in code there.");
    const updated = { ...booking, [field]: value };
    setBooking(updated);
    userSays(value);

    // Sync enquiry lead in the background as soon as name, phone and email are gathered
    if (hasContact(updated)) {
      submitBookingEnquiry({
        ...updated,
        checkIn: updated.checkIn || addDays(todayBusinessDate(), 1),
        checkOut: updated.checkOut || addDays(todayBusinessDate(), 2),
        nights: updated.nights || 1,
        source: "CHATBOT",
        bookingStage: "CHATBOT_CONTACT_COLLECTED",
      }).catch(() => undefined);
    }

    if (field === "phone" && !updated.email) { say("What is your email address?"); setStep("email"); }
    else if (pendingAction) { processPendingAction(pendingAction); }
    else { say("Please review your booking enquiry before sending it."); setStep("summary"); }
  }

  async function confirmEnquiry() {
    setSubmitting(true);
    try {
      await submitBookingEnquiry({
        ...booking,
        bookingStage: "ENQUIRY_CONFIRMED",
        source: "CHATBOT",
      });
      say("Your booking enquiry has been sent to YES Hotels. You can continue your reservation through the official YES Hotels booking page.");
      setStep("submitted");
    } catch {
      say("We couldn't submit your enquiry right now. Please try again or contact YES Hotels directly.", { kind: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  function reloadConversation() {
    live.reset();
    setMessages([newMessage("assistant", "Welcome to YES Hotels. How can I help you today?")]);
    setBooking(initialBooking);
    setPendingAction(null);
    setLastRooms([]);
    setInput("");
    setSubmitting(false);
    setStep("idle");
  }

  const showQuick = step === "idle" && booking.availabilityStatus !== "available" && booking.availabilityStatus !== "checking" || booking.availabilityStatus === "unavailable";
  // Reception sees what the guest is typing in any field of the chat window, live.
  const onTyping = (event: React.FormEvent<HTMLElement>) => {
    const el = event.target as HTMLInputElement;
    if (!el || !("value" in el) || el.type === "number" || el.type === "date") return;
    const label = el.id?.startsWith("chat-") ? STEP_LABEL[el.id.slice(5)] ?? el.id.slice(5) : el.getAttribute("aria-label") || "Message";
    live.activity({ field: label, text: String(el.value ?? "") });
  };

  return <section onInput={onTyping} data-lenis-prevent className="fixed bottom-20 right-4 z-[70] flex h-[min(700px,calc(100vh-6rem))] w-[min(390px,calc(100vw-2rem))] flex-col overscroll-contain overflow-hidden rounded-2xl border border-hotel-black/10 bg-hotel-white shadow-[0_24px_80px_rgba(0,0,0,0.25)] touch-pan-y md:bottom-24 md:right-7" aria-label="YES Hotels concierge">
    <header className="flex items-center justify-between bg-hotel-black px-4 py-3 text-hotel-white"><div><p className="font-serif text-lg">YES Hotels</p><p className="text-[10px] uppercase tracking-[0.18em] text-hotel-gold">Your Hotel Concierge</p><p className="mt-0.5 text-[10px] text-hotel-white/50">Our front desk can see this chat live, as you type.</p></div><div className="flex items-center gap-1"><button type="button" aria-label="Restart concierge conversation" title="Restart conversation" onClick={reloadConversation} className="p-2 text-hotel-white/70 hover:text-hotel-gold"><RotateCcw size={16} /></button><button type="button" aria-label="Minimize concierge" onClick={onMinimize} className="p-2 text-hotel-white/70 hover:text-hotel-gold"><Minus size={17} /></button><button type="button" aria-label="Close concierge" onClick={onClose} className="p-2 text-hotel-white/70 hover:text-hotel-gold"><X size={17} /></button></div></header>
    <MessageList messages={messages} onQuickAction={handleAction} endRef={endRef} />
    {step === "checking" && <div className="flex items-center gap-2 border-t border-hotel-black/10 bg-hotel-white px-4 py-3 text-xs text-hotel-black/60"><LoaderCircle size={15} className="animate-spin text-hotel-gold" /> Checking live room availability...</div>}
    {step === "checkin" || step === "checkout" || step === "guests" || step === "guestName" || step === "guestLastName" || step === "phone" || step === "email" ? <BookingFlow step={step} booking={booking} onDate={handleDate} onBack={handleDateBack} onGuests={handleGuests} onText={handleGuestText} /> : null}
    {step === "summary" && <BookingSummary booking={booking} onConfirm={confirmEnquiry} submitting={submitting} />}
    {step === "submitted" && <button type="button" onClick={goToPayment} className="m-4 bg-hotel-gold px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-hotel-black">Continue to Booking &amp; Payment</button>}
    {live.staffTyping && <p className="border-t border-hotel-black/10 bg-hotel-white px-4 py-2 text-[11px] italic text-hotel-black/60">Reception is typing…</p>}
    {live.withStaff && <p className="border-t border-hotel-black/10 bg-amber-50 px-4 py-2 text-[11px] text-hotel-black/70">{live.status === "ASSIGNED" ? "You're chatting with our front desk." : "Waiting for the front desk to reply…"}{!live.connected && " (reconnecting…)"}</p>}
    {showQuick && !live.withStaff && <QuickActions onAction={handleAction} unavailable={booking.availabilityStatus === "unavailable"} />}
    {step === "idle" && (!showQuick || live.withStaff) && <form className="flex gap-2 border-t border-hotel-black/10 bg-hotel-white p-3" onSubmit={(event) => { event.preventDefault(); if (input.trim()) { userSays(input.trim()); if (!live.withStaff) say("Please choose one of the options above, or tap \"Talk to Reception\" to chat with our front desk."); setInput(""); } }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder={live.withStaff ? "Message the front desk" : "Ask your concierge"} className="min-w-0 flex-1 bg-hotel-ivory px-3 py-2 text-sm outline-none" aria-label="Message YES Hotels concierge" /><button type="submit" aria-label="Send message" className="bg-hotel-black p-2 text-hotel-gold hover:bg-hotel-gold hover:text-hotel-black"><ArrowUp size={17} /></button></form>}
  </section>;
}