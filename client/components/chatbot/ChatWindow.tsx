import { useEffect, useRef, useState } from "react";
import { ArrowUp, LoaderCircle, Minus, RotateCcw, X } from "lucide-react";
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { checkRoomAvailability, type AvailableRoom } from "@/services/availabilityService";
import { submitBookingEnquiry } from "@/services/bookingEnquiryService";
import { getHotelInformation, hotelContact } from "@/services/chatService";
import BookingFlow from "./BookingFlow";
import BookingSummary from "./BookingSummary";
import MessageList from "./MessageList";
import QuickActions from "./QuickActions";
import type { BookingState, ChatMessage } from "./types";

type Step = "idle" | "checkin" | "checkout" | "guests" | "checking" | "guestName" | "phone" | "email" | "summary" | "submitted";
type PendingAction = "Check Room Availability" | "Hotel Information" | "Contact YES Hotels" | null;
const initialBooking: BookingState = { checkIn: "", checkOut: "", nights: 0, adults: 1, children: 0, childAges: [], rooms: 1, roomType: "", guestName: "", phone: "", email: "", availabilityStatus: "idle" };
const newMessage = (sender: ChatMessage["sender"], text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ id: `${Date.now()}-${Math.random()}`, sender, text, ...extra });

export default function ChatWindow({ onMinimize, onClose }: { onMinimize: () => void; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([newMessage("assistant", "Welcome to YES Hotels. How can I help you today?")]);
  const [booking, setBooking] = useState<BookingState>(initialBooking);
  const [step, setStep] = useState<Step>("idle");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lastRooms, setLastRooms] = useState<AvailableRoom[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, step]);
  const say = (text: string, extra: Partial<ChatMessage> = {}) => setMessages((current) => [...current, newMessage("assistant", text, extra)]);
  const userSays = (text: string) => setMessages((current) => [...current, newMessage("user", text)]);

  function beginAvailability() { userSays("Check Room Availability"); say("Please select your check-in date."); setStep("checkin"); setBooking((current) => ({ ...current, checkIn: "", checkOut: "", nights: 0, availabilityStatus: "idle" })); }

  function beginActionWithContact(action: PendingAction) {
    if (!action) return;
    userSays(action);
    setPendingAction(action);
    say("Before I continue, what is your full name?");
    setStep("guestName");
  }

  function processPendingAction(action: PendingAction) {
    setPendingAction(null);
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
    if (action === "Check Room Availability" || action === "Hotel Information" || action === "Contact YES Hotels") {
      return beginActionWithContact(action);
    }
    if (action === "Contact YES Hotels") {
      userSays(action);
      const details = [hotelContact.phone && `Phone: ${hotelContact.phone}`, hotelContact.whatsapp && `WhatsApp: ${hotelContact.whatsapp}`, hotelContact.email && `Email: ${hotelContact.email}`, hotelContact.address && `Address: ${hotelContact.address}`].filter(Boolean);
      say(details.length ? details.join("\n") : "YES Hotels contact details have not been configured yet. Please use the Contact page on this website.");
      return;
    }
    if (action === "Book on Website" || action === "Continue to Booking & Payment") { window.location.assign(hotelContact.bookingUrl); return; }
    if (action === "Change Dates") { say("Let’s start again. Please select your check-in date."); setStep("checkin"); return; }
    if (action === "Try Another Room") { say("I’ll check the current inventory for the same dates again."); void checkAvailability(); return; }
    if (action.startsWith("select-room:")) { const room = lastRooms.find((item) => item._id === action.slice(12)); if (room) { setBooking((current) => ({ ...current, roomType: room.name, roomCategoryId: room._id, pricePerNight: room.pricePerNight ?? room.basePrice, roomSubtotal: (room.pricePerNight ?? room.basePrice ?? 0) * current.nights * current.rooms, availabilityStatus: "available" })); say("Please share the guest’s full name."); setStep("guestName"); } }
  }

  function handleDate(value: string) {
    if (step === "checkin") { setBooking((current) => ({ ...current, checkIn: value })); userSays(format(parseISO(value), "d MMMM yyyy")); say("Please select your check-out date."); setStep("checkout"); return; }
    if (value <= booking.checkIn) { say("Check-out must be after check-in. Please choose a later date."); return; }
    const nights = differenceInCalendarDays(parseISO(value), parseISO(booking.checkIn));
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
      setStep("idle");
    } catch { setBooking((current) => ({ ...current, availabilityStatus: "error" })); say("Sorry, we couldn't check live room availability right now. Please try again or continue through the YES Hotels booking website.", { kind: "error" }); setStep("idle"); }
  }

  function handleGuestText(field: "guestName" | "phone" | "email", value: string) {
    if (field === "guestName" && value.length < 2) return say("Please enter your full name so our team knows who to contact.");
    if (field === "phone" && value.replace(/\D/g, "").length !== 10) return say("Please re-enter your phone number. It must contain exactly 10 digits.");
    setBooking((current) => ({ ...current, [field]: value })); userSays(field === "email" && !value ? "I prefer not to share an email" : value);
    if (field === "guestName") { say("What phone number should our team use?"); setStep("phone"); }
    else if (field === "phone") { say("What is your email address?"); setStep("email"); }
    else if (pendingAction) { processPendingAction(pendingAction); }
    else { say("Please review your booking enquiry before sending it."); setStep("summary"); }
  }

  async function confirmEnquiry() {
    setSubmitting(true);
    try { await submitBookingEnquiry(booking); say("Your booking enquiry has been sent to YES Hotels. You can continue your reservation through the official YES Hotels booking page."); setStep("submitted"); }
    catch { say("We couldn't submit your enquiry right now. Please try again or contact YES Hotels directly.", { kind: "error" }); }
    finally { setSubmitting(false); }
  }

  function reloadConversation() {
    setMessages([newMessage("assistant", "Welcome to YES Hotels. How can I help you today?")]);
    setBooking(initialBooking);
    setPendingAction(null);
    setLastRooms([]);
    setInput("");
    setSubmitting(false);
    setStep("idle");
  }

  const showQuick = step === "idle" && booking.availabilityStatus !== "available" && booking.availabilityStatus !== "checking" || booking.availabilityStatus === "unavailable";
  return <section data-lenis-prevent className="fixed bottom-20 right-4 z-[70] flex h-[min(700px,calc(100vh-6rem))] w-[min(390px,calc(100vw-2rem))] flex-col overscroll-contain overflow-hidden rounded-2xl border border-hotel-black/10 bg-hotel-white shadow-[0_24px_80px_rgba(0,0,0,0.25)] touch-pan-y md:bottom-24 md:right-7" aria-label="YES Hotels concierge">
    <header className="flex items-center justify-between bg-hotel-black px-4 py-3 text-hotel-white"><div><p className="font-serif text-lg">YES Hotels</p><p className="text-[10px] uppercase tracking-[0.18em] text-hotel-gold">Your Hotel Concierge</p></div><div className="flex items-center gap-1"><button type="button" aria-label="Restart concierge conversation" title="Restart conversation" onClick={reloadConversation} className="p-2 text-hotel-white/70 hover:text-hotel-gold"><RotateCcw size={16} /></button><button type="button" aria-label="Minimize concierge" onClick={onMinimize} className="p-2 text-hotel-white/70 hover:text-hotel-gold"><Minus size={17} /></button><button type="button" aria-label="Close concierge" onClick={onClose} className="p-2 text-hotel-white/70 hover:text-hotel-gold"><X size={17} /></button></div></header>
    <MessageList messages={messages} onQuickAction={handleAction} endRef={endRef} />
    {step === "checking" && <div className="flex items-center gap-2 border-t border-hotel-black/10 bg-hotel-white px-4 py-3 text-xs text-hotel-black/60"><LoaderCircle size={15} className="animate-spin text-hotel-gold" /> Checking live room availability...</div>}
    {step === "checkin" || step === "checkout" || step === "guests" || step === "guestName" || step === "phone" || step === "email" ? <BookingFlow step={step} booking={booking} onDate={handleDate} onBack={handleDateBack} onGuests={handleGuests} onText={handleGuestText} requireEmail={Boolean(pendingAction)} /> : null}
    {step === "summary" && <BookingSummary booking={booking} onConfirm={confirmEnquiry} submitting={submitting} />}
    {step === "submitted" && <button type="button" onClick={() => window.location.assign(hotelContact.bookingUrl)} className="m-4 bg-hotel-gold px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-hotel-black">Continue to Booking &amp; Payment</button>}
    {showQuick && <QuickActions onAction={handleAction} unavailable={booking.availabilityStatus === "unavailable"} />}
    {step === "idle" && !showQuick && <form className="flex gap-2 border-t border-hotel-black/10 bg-hotel-white p-3" onSubmit={(event) => { event.preventDefault(); if (input.trim()) { userSays(input.trim()); say("Please choose one of the options above so I can help with your stay."); setInput(""); } }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask your concierge" className="min-w-0 flex-1 bg-hotel-ivory px-3 py-2 text-sm outline-none" aria-label="Message YES Hotels concierge" /><button type="submit" aria-label="Send message" className="bg-hotel-black p-2 text-hotel-gold hover:bg-hotel-gold hover:text-hotel-black"><ArrowUp size={17} /></button></form>}
  </section>;
}