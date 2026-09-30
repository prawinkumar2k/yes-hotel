import React from "react";
import { BedDouble, Wifi, Users, ArrowUpRight, Sparkles, Cuboid } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import Room3DViewer from "./Room3DViewer";

export default function Rooms() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["roomCategories"],
    queryFn: async () => {
      const res = await fetch("/api/rooms/categories");
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json.data;
    },
  });

  const rooms = (data ?? []).slice(0, 3);

  return (
    <section id="rooms" className="bg-slate-50 py-28 text-slate-800 border-t border-slate-200">
      <div className="container mx-auto px-4 md:px-8 max-w-[1400px] space-y-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#c9a227]/10 border border-[#c9a227]/30 text-[#866A1C] text-xs font-mono font-bold tracking-widest uppercase">
              <Sparkles size={13} className="text-[#c9a227]" /> CURATED SUITES &amp; VILLAS
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-slate-800 font-normal leading-tight">
              Select Your <span className="text-[#c9a227] italic font-serif">Sanctuary</span>.
            </h2>
          </div>

          <p className="max-w-md text-xs sm:text-sm text-slate-500 font-light leading-relaxed">
            Architectural suites engineered with spatial acoustic isolation, natural linen, and panoramic ocean vistas.
          </p>
        </div>

        {isLoading && (
          <div className="space-y-16">
            {[0, 1].map((i) => (
              <div key={i} className="h-[60vh] animate-pulse bg-slate-200 rounded-3xl border border-slate-200" />
            ))}
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm">Failed to load live suite catalog. Please try again.</p>
        )}

        {/* Alternating Spatial Room Rows */}
        <div className="space-y-24">
          {rooms.map((room: any, i: number) => (
            <RoomRow key={room._id ?? room.name} room={room} index={i} />
          ))}
        </div>

        {/* View All CTA */}
        <div className="pt-8 text-center">
          <Link
            to="/rooms"
            className="inline-flex items-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-mono font-bold text-xs uppercase tracking-widest rounded-xl border border-slate-700 shadow-xl transition"
          >
            Explore Complete Room Catalog <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function RoomRow({ room, index }: { room: any; index: number }) {
  const reversed = index % 2 !== 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col lg:flex-row items-center gap-8 lg:gap-16 ${
        reversed ? "lg:flex-row-reverse" : ""
      }`}
    >
      {/* 65% Viewport Feature Image */}
      <Link
        to={`/rooms/${room.slug}`}
        data-cursor="EXPLORE"
        className="group relative block aspect-[16/10] w-full lg:w-[65%] overflow-hidden rounded-3xl border border-slate-200 shadow-xl"
      >
        <img
          src={room.images?.[0] || "/gallery/hotel-50.jpg"}
          alt={room.name}
          className="h-full w-full object-cover filter brightness-95 transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-60" />

        <span className="pointer-events-none absolute bottom-4 left-6 font-serif text-[7rem] sm:text-[10rem] font-bold leading-none text-white/10">
          0{index + 1}
        </span>

        <span className="absolute bottom-6 right-6 flex items-center gap-2 bg-[#c9a227] text-black px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest rounded-xl shadow-lg opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0 translate-y-2">
          Inspect Suite <ArrowUpRight size={14} />
        </span>
      </Link>

      {/* 35% Information Column */}
      <div className="w-full lg:w-[35%] space-y-6">
        <div>
          <span className="font-mono text-xs text-[#866A1C] tracking-[0.3em] uppercase block mb-1">
            SUITE 0{index + 1}
          </span>
          <h3 className="font-serif text-3xl sm:text-4xl text-slate-800 font-normal">{room.name}</h3>
        </div>

        <p className="text-xs sm:text-sm text-slate-500 font-light leading-relaxed">
          {room.description}
        </p>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 pt-2 border-t border-slate-200">
          <span className="flex items-center gap-1.5">
            <BedDouble size={14} className="text-[#c9a227]" /> {room.bedType || "King Bed"}
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={14} className="text-[#c9a227]" /> {room.capacity?.adults ?? 2} Guests
          </span>
          <span className="flex items-center gap-1.5">
            <Wifi size={14} className="text-[#c9a227]" /> Wi-Fi
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6">
          <div>
            <p className="font-mono font-bold text-2xl text-slate-800">₹{room.basePrice}</p>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Per Night (Excl GST)</p>
          </div>

          <div className="flex gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <button className="flex min-h-[44px] items-center border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-mono font-semibold text-slate-600 hover:text-slate-800 rounded-xl transition shadow-sm">
                  <Cuboid size={14} className="mr-2 text-[#c9a227]" /> 3D Tour
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-2xl">
                <DialogTitle className="sr-only">3D Room Tour</DialogTitle>
                <Room3DViewer image={room.images?.[0] || "/gallery/hotel-50.jpg"} />
              </DialogContent>
            </Dialog>
            <Link
              to={`/rooms/${room.slug}`}
              className="flex min-h-[44px] items-center border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-mono font-semibold text-slate-600 hover:text-slate-800 rounded-xl transition shadow-sm"
            >
              Details
            </Link>
            <Link
              to="/search"
              className="flex min-h-[44px] items-center bg-[#c9a227] hover:bg-[#b8911f] px-5 py-2.5 text-xs font-mono font-bold text-black rounded-xl shadow-md transition"
            >
              Reserve
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
