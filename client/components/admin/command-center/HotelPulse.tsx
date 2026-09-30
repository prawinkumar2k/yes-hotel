import React from "react";
import { BedDouble, DollarSign, TrendingUp, Sparkles, LogIn, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function HotelPulse({ pulseData, revenue, housekeeping, arrivals }: any) {
  const navigate = useNavigate();
  
  if (!pulseData) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {/* Occupancy */}
      <div className="bg-[#121316] rounded-xl border border-white/10 p-4 relative overflow-hidden group hover:border-hotel-gold/40 transition cursor-pointer" onClick={() => navigate("/admin/reports")}>
        <div className="flex items-center justify-between text-zinc-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">Occupied Rooms</span>
          <BedDouble size={16} className="text-hotel-gold" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-sans text-2xl font-bold text-white tabular-nums">{pulseData.occupancyPct}%</span>
          <span className="text-[10px] text-zinc-400 font-mono">
            {pulseData.occupied} / {pulseData.totalRooms} rooms
          </span>
        </div>
        <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-hotel-gold to-amber-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, pulseData.occupancyPct)}%` }}
          />
        </div>
      </div>

      {/* Today's Revenue */}
      <div className="bg-[#121316] rounded-xl border border-white/10 p-4 relative overflow-hidden group hover:border-hotel-gold/40 transition cursor-pointer" onClick={() => navigate("/admin/reports")}>
        <div className="flex items-center justify-between text-zinc-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">Today's Rev</span>
          <DollarSign size={16} className="text-emerald-400" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-sans text-2xl font-bold text-white tabular-nums">
            ₹{revenue?.todayRevenue?.toLocaleString("en-IN") || "0"}
          </span>
        </div>
        <p className="text-[10px] text-zinc-400 mt-2 font-mono">Realized Gross Payments</p>
      </div>

      {/* Housekeeping Pulse */}
      <div className="bg-[#121316] rounded-xl border border-white/10 p-4 relative overflow-hidden group hover:border-red-500/40 transition cursor-pointer" onClick={() => navigate("/admin/housekeeping")}>
        <div className="flex items-center justify-between text-zinc-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis text-red-400">HK Queue</span>
          <Sparkles size={16} className="text-red-400" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-sans text-2xl font-bold text-white tabular-nums">{pulseData.dirty || 0}</span>
          <span className="text-[10px] text-red-400 font-semibold">Dirty</span>
        </div>
        <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-400">
          <span>{housekeeping?.pending || 0} tasks pending</span>
        </div>
      </div>

      {/* Arrivals Pulse */}
      <div className="bg-[#121316] rounded-xl border border-white/10 p-4 relative overflow-hidden group hover:border-emerald-500/40 transition cursor-pointer" onClick={() => navigate("/admin/front-desk")}>
        <div className="flex items-center justify-between text-zinc-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis text-emerald-400">Arrivals</span>
          <LogIn size={16} className="text-emerald-400" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-sans text-2xl font-bold text-white tabular-nums">{arrivals?.length || 0}</span>
          <span className="text-[10px] text-zinc-400">Expected</span>
        </div>
      </div>
      
      {/* OOO / OOS */}
      <div className="bg-[#121316] rounded-xl border border-white/10 p-4 relative overflow-hidden group hover:border-amber-500/40 transition cursor-pointer" onClick={() => navigate("/admin/room-rack")}>
        <div className="flex items-center justify-between text-zinc-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis text-amber-400">Inventory</span>
          <BedDouble size={16} className="text-amber-400" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-sans text-xl font-bold text-white tabular-nums">{pulseData.available || 0}</span>
          <span className="text-[10px] text-zinc-400">Sellable</span>
        </div>
        <p className="text-[10px] text-zinc-400 mt-2 font-mono">{pulseData.ooo} OOO | {pulseData.oos} OOS</p>
      </div>
      
      <div className="bg-[#121316] rounded-xl border border-white/10 p-4 relative overflow-hidden group hover:border-hotel-gold/40 transition cursor-pointer" onClick={() => navigate("/admin/front-desk")}>
        <div className="flex items-center justify-between text-zinc-400 mb-2">
          <span className="text-[11px] font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">Sellable</span>
          <Users size={16} className="text-hotel-gold" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-sans text-2xl font-bold text-white tabular-nums">{pulseData.sellableRooms || 0}</span>
        </div>
      </div>
    </div>
  );
}
