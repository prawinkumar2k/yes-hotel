import React from "react";
import { Utensils, Clock, Flame } from "lucide-react";
import { Link } from "react-router-dom";

export function RestaurantCommand({ restaurant }: { restaurant: any }) {
  return (
    <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400">
            <Utensils size={18} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-white">Food & Beverage</h3>
            <p className="text-[11px] text-zinc-400">POS & KDS Pipeline</p>
          </div>
        </div>
        <Link to="/admin/pos" className="text-xs text-pink-400 hover:underline font-semibold whitespace-nowrap flex-shrink-0">
          Open POS &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
          <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis mb-1">Orders</p>
          <p className="text-xl font-bold text-white tabular-nums">{restaurant?.activeOrders || 0}</p>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
          <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis mb-1">KOT Queue</p>
          <p className="text-xl font-bold text-white tabular-nums">{restaurant?.kotQueue || 0}</p>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-center">
          <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis mb-1">Delayed</p>
          <p className="text-xl font-bold text-red-400 tabular-nums">{restaurant?.delayedKots || 0}</p>
        </div>
      </div>
      
      <div className="flex-1 space-y-2.5 overflow-y-auto max-h-48">
        <p className="text-xs text-zinc-500 text-center py-6 flex items-center justify-center gap-2">
          <Clock size={12} /> No active F&B operations.
        </p>
      </div>
    </div>
  );
}
