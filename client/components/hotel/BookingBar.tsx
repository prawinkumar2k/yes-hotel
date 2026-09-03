import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronDown, Users2, BedDouble } from "lucide-react";
import { GoldButton } from "./HotelButtons";

const ROOM_TYPES = ["Standard Room", "Deluxe Room", "Executive Room"];

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
      className={`flex flex-1 items-center gap-3 px-6 py-5 ${
        divider ? "sm:border-r sm:border-hotel-black/10" : ""
      } border-b border-hotel-black/10 last:border-b-0 sm:border-b-0`}
    >
      <span className="text-hotel-gold">{icon}</span>
      <div className="relative flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-hotel-black/50">
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

  return (
    <div className="flex flex-col rounded-sm bg-hotel-ivory shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:flex-row sm:items-stretch">
      <Field icon={<CalendarDays size={18} />} label="Check-In">
        <input
          type="date"
          aria-label="Check-in date"
          value={checkIn}
          onChange={(e) => setCheckIn(e.target.value)}
          className="w-full bg-transparent text-sm font-medium text-hotel-black outline-none [color-scheme:light]"
        />
      </Field>

      <Field icon={<CalendarDays size={18} />} label="Check-Out">
        <input
          type="date"
          aria-label="Check-out date"
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
          className="w-full bg-transparent text-sm font-medium text-hotel-black outline-none [color-scheme:light]"
        />
      </Field>

      <Field icon={<Users2 size={18} />} label="Guests">
        <button
          type="button"
          onClick={() => setGuestsOpen((v) => !v)}
          className="flex w-full items-center justify-between text-sm font-medium text-hotel-black"
        >
          {adults} Adults{children > 0 ? `, ${children} Children` : ""}
          <ChevronDown size={14} className="text-hotel-black/60" />
        </button>

        {guestsOpen && (
          <div className="absolute z-20 mt-3 w-64 space-y-4 rounded-sm border border-hotel-black/10 bg-hotel-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-sm text-hotel-black">Adults</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAdults((v) => Math.max(1, v - 1))}
                  className="h-7 w-7 border border-hotel-black/20 text-hotel-black hover:border-hotel-gold"
                >
                  −
                </button>
                <span className="w-4 text-center text-sm">{adults}</span>
                <button
                  type="button"
                  onClick={() => setAdults((v) => v + 1)}
                  className="h-7 w-7 border border-hotel-black/20 text-hotel-black hover:border-hotel-gold"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-hotel-black">Children</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setChildren((v) => Math.max(0, v - 1))}
                  className="h-7 w-7 border border-hotel-black/20 text-hotel-black hover:border-hotel-gold"
                >
                  −
                </button>
                <span className="w-4 text-center text-sm">{children}</span>
                <button
                  type="button"
                  onClick={() => setChildren((v) => v + 1)}
                  className="h-7 w-7 border border-hotel-black/20 text-hotel-black hover:border-hotel-gold"
                >
                  +
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGuestsOpen(false)}
              className="w-full bg-hotel-black py-2 text-xs font-semibold uppercase tracking-[0.2em] text-hotel-white"
            >
              Done
            </button>
          </div>
        )}
      </Field>

      <Field icon={<BedDouble size={18} />} label="Room Type" divider={false}>
        <div className="relative">
          <select
            value={room}
            aria-label="Room type"
            onChange={(e) => setRoom(e.target.value)}
            className="w-full cursor-pointer appearance-none bg-transparent text-sm font-medium text-hotel-black outline-none"
          >
            {ROOM_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-0 top-1 text-hotel-black/60"
          />
        </div>
      </Field>

      <div className="p-3 sm:p-2 sm:pl-0">
        <GoldButton type="button" onClick={handleSearch} className="h-full w-full py-5 sm:w-auto sm:px-10">
          Search Availability
        </GoldButton>
      </div>
    </div>
  );
}
