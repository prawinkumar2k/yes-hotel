import React from "react";
import { RefreshCw, BedDouble, LogIn, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

export function CommandCenterHeader({ user, onRefresh, isRefreshing }: { user: any, onRefresh: () => void, isRefreshing: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#15171c] via-[#1a1d24] to-[#121316] border border-white/10 p-6 shadow-2xl">
      <div className="absolute right-0 top-0 w-96 h-96 bg-hotel-gold/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-hotel-gold/15 text-hotel-gold border border-hotel-gold/30">
              ✦ Executive Command Center 2.0
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              Operational Date: {format(new Date(), "EEEE, MMM d, yyyy")}
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Welcome, {user?.firstName || "Executive"}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Live operational intelligence matrix.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 text-xs font-semibold transition"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-hotel-gold" : ""} />
            <span>Sync Live State</span>
          </button>
          <Link
            to="/admin/check-in"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition"
          >
            <LogIn size={14} />
            <span>Express Check-In</span>
          </Link>
          <Link
            to="/admin/room-rack"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-hotel-gold text-black hover:bg-champagne text-xs font-bold transition shadow-sm"
          >
            <BedDouble size={14} />
            <span>Open Room Rack</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
