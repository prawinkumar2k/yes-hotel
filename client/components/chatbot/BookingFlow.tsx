import { useState } from "react";
import DatePicker from "./DatePicker";
import GuestForm from "./GuestForm";
import type { BookingState } from "./types";

type Props = {
  step: "checkin" | "checkout" | "guests" | "guestName" | "phone" | "email";
  booking: BookingState;
  onDate: (date: string) => void;
  onBack: () => void;
  onGuests: (values: Pick<BookingState, "adults" | "children" | "childAges" | "rooms">) => void;
  onText: (field: "guestName" | "phone" | "email", value: string) => void;
  requireEmail?: boolean;
};

export default function BookingFlow({ step, booking, onDate, onBack, onGuests, onText, requireEmail = false }: Props) {
  const [value, setValue] = useState("");
  if (step === "checkin") return <DatePicker label="Select check-in" onSubmit={onDate} onBack={onBack} />;
  if (step === "checkout") return <DatePicker label="Select check-out" min={booking.checkIn} onSubmit={onDate} onBack={onBack} />;
  if (step === "guests") return <GuestForm onSubmit={onGuests} />;

  const labels = { guestName: "Full name", phone: "Phone number", email: "Email address (optional)" };
  return <form className="border-t border-hotel-black/10 bg-hotel-white px-4 py-3" onSubmit={(event) => { event.preventDefault(); onText(step, value.trim()); setValue(""); }}>
    <label htmlFor={`chat-${step}`} className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-hotel-black/60">{labels[step]}</label>
    <div className="flex gap-2">
      <input id={`chat-${step}`} autoFocus required={step !== "email" || requireEmail} type={step === "email" ? "email" : step === "phone" ? "tel" : "text"} value={value} onChange={(event) => setValue(event.target.value)} className="min-w-0 flex-1 border border-hotel-black/15 bg-hotel-ivory px-3 py-2 text-sm outline-none focus:border-hotel-gold" />
      <button className="bg-hotel-black px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-hotel-white hover:bg-hotel-gold hover:text-hotel-black">Next</button>
    </div>
  </form>;
}