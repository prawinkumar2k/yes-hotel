import React from "react";
import { BedDouble, AlertCircle, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

export function RoomControl({ pulseData }: { pulseData: any }) {
  if (!pulseData) return null;

  return (
    <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <BedDouble size={18} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-white">Room Rack Control</h3>
            <p className="text-[11px] text-zinc-400">Live inventory state</p>
          </div>
        </div>
        <Link to="/admin/room-rack" className="text-xs text-indigo-400 hover:underline font-semibold whitespace-nowrap flex-shrink-0">
          Open Rack &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-black/40 border border-white/5">
          <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis mb-1">Occupied</p>
          <p className="text-xl font-bold text-white tabular-nums">{pulseData.occupied}</p>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/5">
          <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis mb-1">Available</p>
          <p className="text-xl font-bold text-white tabular-nums">{pulseData.available}</p>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/5">
          <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis mb-1">Dirty / Turn</p>
          <p className="text-xl font-bold text-white tabular-nums">{pulseData.dirty}</p>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/5">
          <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis mb-1">OOO / OOS</p>
          <p className="text-xl font-bold text-white tabular-nums">{pulseData.ooo + pulseData.oos}</p>
        </div>
      </div>
      
      <div className="mt-auto pt-3 border-t border-white/5 text-xs text-zinc-500 text-center flex items-center justify-center gap-2">
         <RefreshCw size={12} /> Real-time rack visualization available in full view.
      </div>
    </div>
  );
}
