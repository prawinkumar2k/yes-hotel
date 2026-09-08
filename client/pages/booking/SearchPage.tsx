import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "@/components/hotel/Navbar";
import { GoldButton } from "@/components/hotel/HotelButtons";
import { Calendar, Users } from "lucide-react";
import { format, addDays } from "date-fns";
import { useReducedMotion } from "@/hooks/useReducedMotion";

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  
  const [checkIn, setCheckIn] = useState(searchParams.get("checkIn") || format(new Date(), "yyyy-MM-dd"));
  const [checkOut, setCheckOut] = useState(searchParams.get("checkOut") || format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [adults, setAdults] = useState(parseInt(searchParams.get("adults") || "1"));
  const [children, setChildren] = useState(parseInt(searchParams.get("children") || "0"));

  // A genuinely reproduced bug: changing check-in to a date on/after the
  // already-selected check-out left check-out stale and invalid (e.g.
  // checkIn=2026-09-09, checkOut=2026-09-01) — the date input's `min`
  // attribute only constrains the native picker going forward, it does not
  // retroactively fix an already-set value once check-in moves past it.
  // That invalid pair was then submitted straight to the API, which
  // correctly rejected it with a 400 the UI only ever showed as a generic
  // "Failed to load availability" with no explanation.
  const isValidRange = checkIn && checkOut && checkOut > checkIn;

  function handleCheckInChange(value: string) {
    setCheckIn(value);
    if (checkOut && checkOut <= value) {
      setCheckOut(format(addDays(new Date(value), 1), "yyyy-MM-dd"));
    }
  }

  const { data: availableRooms, isLoading, isError, error } = useQuery({
    queryKey: ["availability", checkIn, checkOut, adults, children],
    queryFn: async () => {
      const res = await fetch(`/api/bookings/availability?checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json.data;
    },
    enabled: !!isValidRange,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidRange) return;
    setSearchParams({ checkIn, checkOut, adults: String(adults), children: String(children) });
  };

  const proceedToBooking = (categoryId: string) => {
    navigate(`/booking/guest-details?category=${categoryId}&checkIn=${checkIn}&checkOut=${checkOut}&adults=${adults}&children=${children}`);
  };

  return (
    <div className="min-h-screen bg-hotel-ivory pt-24">
      <Navbar transparent={false} />
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h1 className="font-serif text-4xl text-hotel-black mb-8 text-center">Find Your Stay</h1>
        
        {/* Search Bar */}
        <div className="bg-hotel-white border border-hotel-black/10 p-6 shadow-sm mb-12">
          <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="md:col-span-1">
              <label htmlFor="search-checkin" className="block text-xs uppercase tracking-widest text-hotel-black/60 mb-2">Check In</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-hotel-black/60" size={16} />
                <input id="search-checkin" type="date" required min={format(new Date(), "yyyy-MM-dd")} value={checkIn} onChange={e => handleCheckInChange(e.target.value)}
                  className="w-full bg-transparent border-b border-hotel-black/20 py-2 pl-10 focus:outline-none focus:border-hotel-gold text-sm" />
              </div>
            </div>
            <div className="md:col-span-1">
              <label htmlFor="search-checkout" className="block text-xs uppercase tracking-widest text-hotel-black/60 mb-2">Check Out</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-hotel-black/60" size={16} />
                <input id="search-checkout" type="date" required min={format(addDays(new Date(checkIn), 1), "yyyy-MM-dd")} value={checkOut} onChange={e => setCheckOut(e.target.value)}
                  className="w-full bg-transparent border-b border-hotel-black/20 py-2 pl-10 focus:outline-none focus:border-hotel-gold text-sm" />
              </div>
            </div>
            <div className="md:col-span-1">
              <label htmlFor="search-adults" className="block text-xs uppercase tracking-widest text-hotel-black/60 mb-2">Guests</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-hotel-black/60" size={16} />
                <select id="search-adults" value={adults} onChange={e => setAdults(Number(e.target.value))}
                  className="w-full bg-transparent border-b border-hotel-black/20 py-2 pl-10 focus:outline-none focus:border-hotel-gold text-sm">
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} Adult{n>1?'s':''}</option>)}
                </select>
              </div>
            </div>
            <div className="md:col-span-1">
              <label htmlFor="search-children" className="block text-xs uppercase tracking-widest text-hotel-black/60 mb-2">Children</label>
              <div className="relative">
                <select id="search-children" value={children} onChange={e => setChildren(Number(e.target.value))}
                  className="w-full bg-transparent border-b border-hotel-black/20 py-2 focus:outline-none focus:border-hotel-gold text-sm">
                  {[0,1,2,3].map(n => <option key={n} value={n}>{n} Child{n!==1?'ren':''}</option>)}
                </select>
              </div>
            </div>
            <div className="md:col-span-1">
              <GoldButton type="submit" className="w-full py-3">Check Availability</GoldButton>
            </div>
          </form>
        </div>

        {/* Results */}
        <div>
          {!isValidRange ? (
            <div className="text-center py-12 text-hotel-black/60">
              Check-out must be after check-in — pick a later check-out date.
            </div>
          ) : isLoading ? (
            <div className="space-y-6">
              {[1,2].map(i => <div key={i} className="h-64 bg-hotel-black/5 animate-pulse" />)}
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-red-500">
              {error instanceof Error ? error.message : "Failed to load availability. Please try again."}
            </div>
          ) : availableRooms?.length === 0 ? (
            <div className="text-center py-24 bg-hotel-white border border-hotel-black/10">
              <p className="font-serif text-2xl text-hotel-black mb-2">No Rooms Available</p>
              <p className="text-hotel-black/60">Please try adjusting your dates or guest count.</p>
            </div>
          ) : (
            <div className="space-y-8">
              <p className="text-sm tracking-widest uppercase text-hotel-black/60 font-semibold mb-6">
                {availableRooms?.length} Room{availableRooms?.length > 1 ? 's' : ''} Available
              </p>
              {availableRooms?.map((room: any, i: number) => (
                <motion.div
                  key={room._id}
                  initial={reducedMotion ? false : { opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: Math.min(i, 6) * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-hotel-white border border-hotel-black/10 overflow-hidden flex flex-col md:flex-row group"
                >
                  <div className="w-full md:w-2/5 h-64 md:h-auto overflow-hidden">
                    <img src={room.images?.[0] || "/placeholder.svg"}
                      alt={room.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  </div>
                  <div className="p-8 w-full md:w-3/5 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-serif text-2xl text-hotel-black">{room.name}</h3>
                        <div className="text-right">
                          <p className="font-serif text-xl text-hotel-gold-text">₹{room.basePrice}</p>
                          <p className="text-[10px] uppercase tracking-widest text-hotel-black/60">Per Night</p>
                        </div>
                      </div>
                      <p className="text-sm text-hotel-black/60 mb-6 line-clamp-2">{room.description}</p>
                      
                      <div className="flex flex-wrap gap-4 mb-6">
                        <div className="text-xs text-hotel-black/70 flex items-center gap-1.5">
                          <Users size={14} className="text-hotel-gold" /> Up to {room.capacity.adults} Adults
                        </div>
                        <div className="text-xs text-hotel-black/70 flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 rounded border border-hotel-gold flex items-center justify-center text-[8px]">m²</span>
                          {room.size} sq.ft
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-hotel-black/10 pt-6 mt-4">
                      <div>
                        <p className="text-sm text-hotel-black/60">Total for {room.nights} night{room.nights > 1 ? 's' : ''}</p>
                        <p className="font-serif text-lg font-medium text-hotel-black">₹{room.totalPrice}</p>
                      </div>
                      <button onClick={() => proceedToBooking(room._id)} className="bg-hotel-black text-hotel-white px-8 py-3 text-sm font-medium tracking-widest uppercase hover:bg-hotel-gold transition-colors">
                        Select Room
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
