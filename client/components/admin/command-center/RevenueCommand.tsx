import React from "react";
import { DollarSign, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

export function RevenueCommand({ revenue }: { revenue: any }) {
  if (!revenue) return null;

  return (
    <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <DollarSign size={18} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-white">Revenue Command</h3>
            <p className="text-[11px] text-zinc-400">Live realized metrics</p>
          </div>
        </div>
        <Link to="/admin/reports" className="text-xs text-emerald-400 hover:underline font-semibold whitespace-nowrap flex-shrink-0">
          Financials &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1">
        <div className="p-4 rounded-xl bg-black/40 border border-white/5">
          <div className="flex justify-between text-zinc-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">Gross Payments</span>
            <TrendingUp size={14} className="text-hotel-gold" />
          </div>
          <span className="font-sans text-2xl font-bold text-white">
            ₹{revenue.todayRevenue?.toLocaleString("en-IN") || 0}
          </span>
        </div>
        
        <div className="p-4 rounded-xl bg-black/40 border border-white/5">
          <div className="flex justify-between text-zinc-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">Projected Next 24h</span>
            <TrendingUp size={14} className="text-blue-400" />
          </div>
          <span className="font-sans text-2xl font-bold text-white">
            —
          </span>
          <p className="text-[10px] text-zinc-500 mt-1 font-mono">Aggregating...</p>
        </div>
      </div>
    </div>
  );
}
