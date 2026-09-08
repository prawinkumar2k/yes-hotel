import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Zap, BadgePercent } from "lucide-react";
import { format, addDays } from "date-fns";
import Reveal from "./Reveal";
import SectionLabel from "./SectionLabel";
import { GoldButton } from "./HotelButtons";

const ROOM_TYPES = ["Standard Room", "Deluxe Room", "Executive Room"];

function FormField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-hotel-white/15 py-4">
      <label htmlFor={htmlFor} className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-hotel-white/50">
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

const inputClasses =
  "w-full bg-transparent text-sm text-hotel-white outline-none placeholder:text-hotel-white/30 [color-scheme:dark]";

export default function FeaturedBooking() {
  const navigate = useNavigate();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [room, setRoom] = useState(ROOM_TYPES[0]);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    params.set("adults", String(adults));
    params.set("children", String(children));
    navigate(`/search?${params.toString()}`);
  };

  // Same real bug found and fixed on SearchPage.tsx/BookingBar.tsx: setting
  // check-in on/after the already-picked check-out left check-out stale
  // and invalid. Closed at this source too.
  function handleCheckInChange(value: string) {
    setCheckIn(value);
    if (checkOut && value && checkOut <= value) {
      setCheckOut(format(addDays(new Date(value), 1), "yyyy-MM-dd"));
    }
  }

  return (
    <section
      id="booking"
      className="relative overflow-hidden bg-hotel-black py-24 sm:py-32"
    >
      <div className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-hotel-gold/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-hotel-gold/5 blur-3xl" />

      <div className="container relative grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center">
        <Reveal>
          <SectionLabel light>Plan Your Perfect Stay</SectionLabel>
          <h2 className="mt-6 font-serif text-4xl leading-tight text-hotel-white sm:text-5xl">
            Your stay,
            <br />
            beautifully simple.
          </h2>
          <p className="mt-5 max-w-md text-base text-hotel-white/60">
            Check real-time availability and secure your room in moments,
            with rates crafted for every kind of traveller.
          </p>
        </Reveal>

        <Reveal delay={150} className="bg-hotel-charcoal p-8 sm:p-10">
          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            <FormField label="Check-In Date" htmlFor="featured-checkin">
              <input id="featured-checkin" type="date" min={format(new Date(), "yyyy-MM-dd")} value={checkIn} onChange={(e) => handleCheckInChange(e.target.value)} className={inputClasses} />
            </FormField>
            <FormField label="Check-Out Date" htmlFor="featured-checkout">
              <input id="featured-checkout" type="date" min={format(addDays(new Date(checkIn || Date.now()), 1), "yyyy-MM-dd")} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={inputClasses} />
            </FormField>
            <FormField label="Number of Adults" htmlFor="featured-adults">
              <input
                id="featured-adults"
                type="number"
                min={1}
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                className={inputClasses}
              />
            </FormField>
            <FormField label="Number of Children" htmlFor="featured-children">
              <input
                id="featured-children"
                type="number"
                min={0}
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
                className={inputClasses}
              />
            </FormField>
            <FormField label="Room Type" htmlFor="featured-room-type">
              <select
                id="featured-room-type"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className={`${inputClasses} cursor-pointer`}
              >
                {ROOM_TYPES.map((type) => (
                  <option key={type} value={type} className="bg-hotel-charcoal">
                    {type}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Promo Code" htmlFor="featured-promo">
              <input
                id="featured-promo"
                type="text"
                placeholder="Optional"
                className={inputClasses}
              />
            </FormField>
          </div>

          <GoldButton type="button" onClick={handleSearch} className="mt-8 w-full py-4">
            Check Availability
          </GoldButton>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.12em] text-hotel-white/45">
            <span className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-hotel-gold" />
              Secure Booking
            </span>
            <span className="flex items-center gap-2">
              <Zap size={14} className="text-hotel-gold" />
              Instant Confirmation
            </span>
            <span className="flex items-center gap-2">
              <BadgePercent size={14} className="text-hotel-gold" />
              Best Available Rates
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
