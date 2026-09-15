import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronDown, Users2, BedDouble, Search, Sparkles } from "lucide-react";
import { format, addDays } from "date-fns";

const ROOM_TYPES = ["Standard Luxury Suite", "Deluxe Ocean View", "Executive Presidential Suite"];

function Field({
  icon,
  label,
  children,
  divider = true,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <div
      className={`flex flex-1 items-center gap-3 px-5 py-4 ${
        divider ? "lg:border-r lg:border-[#262930]" : ""
      } border-b border-[#262930] last:border-b-0 lg:border-b-0`}
    >
      <span className="text-[#c9a227]">{icon}</span>
      <div className="relative flex-1">
        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-[#c9a227]">
          {label}
        </p>
        {children}
      </div>
    </div>
  );
}

export default function BookingBar() {
  const navigate = useNavigate();
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [room, setRoom] = useState(ROOM_TYPES[0]);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    params.set("adults", String(adults));
    params.set("children", String(children));
    navigate(`/search?${params.toString()}`);
  };

  function handleCheckInChange(value: string) {
    setCheckIn(value);
    if (checkOut && value && checkOut <= value) {
      setCheckOut(format(addDays(new Date(value), 1), "yyyy-MM-dd"));
    }
  }

  return (
    <div className="relative z-20 backdrop-blur-xl bg-[#121316]/80 rounded-2xl border border-[#c9a227]/40 p-2 shadow-[0_25px_60px_rgba(0,0,0,0.8)] lg:flex lg:items-stretch">
      <Field icon={<CalendarDays size={18} />} label="Check-In">
        <input
          type="date"
          aria-label="Check-in date"
          min={format(new Date(), "yyyy-MM-dd")}
          value={checkIn}
          onChange={(e) => handleCheckInChange(e.target.value)}
          className="w-full bg-transparent text-xs font-mono font-bold text-white outline-none [color-scheme:dark]"
        />
      </Field>

      <Field icon={<CalendarDays size={18} />} label="Check-Out">
        <input
          type="date"
          aria-label="Check-out date"
          min={format(addDays(new Date(checkIn || Date.now()), 1), "yyyy-MM-dd")}
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
          className="w-full bg-transparent text-xs font-mono font-bold text-white outline-none [color-scheme:dark]"
        />
      </Field>

      <Field icon={<Users2 size={18} />} label="Guests">
        <button
          type="button"
          onClick={() => setGuestsOpen((v) => !v)}
          className="flex w-full items-center justify-between text-xs font-mono font-bold text-white"
        >
          {adults} Adult(s){children > 0 ? `, ${children} Child` : ""}
          <ChevronDown size={14} className="text-[#c9a227]" />
        </button>

        {guestsOpen && (
          <div className="absolute z-30 mt-3 w-64 space-y-4 rounded-xl border border-[#262930] bg-[#121316] p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300">Adults</span>
              <div className="flex items-center gap-3 font-mono">
                <button
                  type="button"
                  onClick={() => setAdults((v) => Math.max(1, v - 1))}
                  className="h-7 w-7 rounded border border-[#262930] bg-[#1a1d24] text-white hover:border-[#c9a227]"
                >
                  −
                </button>
                <span className="w-4 text-center text-xs font-bold">{adults}</span>
                <button
                  type="button"
                  onClick={() => setAdults((v) => v + 1)}
                  className="h-7 w-7 rounded border border-[#262930] bg-[#1a1d24] text-white hover:border-[#c9a227]"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300">Children</span>
              <div className="flex items-center gap-3 font-mono">
                <button
                  type="button"
                  onClick={() => setChildren((v) => Math.max(0, v - 1))}
                  className="h-7 w-7 rounded border border-[#262930] bg-[#1a1d24] text-white hover:border-[#c9a227]"
                >
                  −
                </button>
                <span className="w-4 text-center text-xs font-bold">{children}</span>
                <button
                  type="button"
                  onClick={() => setChildren((v) => v + 1)}
                  className="h-7 w-7 rounded border border-[#262930] bg-[#1a1d24] text-white hover:border-[#c9a227]"
                >
                  +
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGuestsOpen(false)}
              className="w-full bg-[#c9a227] py-2 text-xs font-bold uppercase tracking-[0.2em] text-black rounded-lg"
            >
              Done
            </button>
          </div>
        )}
      </Field>

      <Field icon={<BedDouble size={18} />} label="Room Suite" divider={false}>
        <div className="relative">
          <select
            value={room}
            aria-label="Room suite"
            onChange={(e) => setRoom(e.target.value)}
            className="w-full cursor-pointer appearance-none bg-transparent text-xs font-mono font-bold text-white outline-none"
          >
            {ROOM_TYPES.map((type) => (
              <option key={type} value={type} className="bg-[#121316] text-white">
                {type}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-0 top-1 text-[#c9a227]"
          />
        </div>
      </Field>

      <div className="p-2">
        <button
          type="button"
          onClick={handleSearch}
          className="w-full lg:w-auto h-full px-8 py-3.5 bg-[#c9a227] hover:bg-[#e5c76b] text-black font-serif font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg transition flex items-center justify-center gap-2 whitespace-nowrap"
        >
          <Sparkles size={14} /> Check Availability
        </button>
      </div>
    </div>
  );
}
