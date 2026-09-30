import React from "react";
import { Building2, Briefcase } from "lucide-react";
import { Link } from "react-router-dom";

export function CorporateCommand({ corporate }: { corporate: any }) {
  return (
    <div className="bg-[#121316] rounded-2xl border border-white/10 p-5 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
            <Building2 size={18} />
          </div>
          <div>
            <h3 className="font-serif font-bold text-base text-white">Sales & Corporate</h3>
            <p className="text-[11px] text-zinc-400">Groups & Companies</p>
          </div>
        </div>
        <Link to="/admin/corporate" className="text-xs text-violet-400 hover:underline font-semibold whitespace-nowrap flex-shrink-0">
          Sales Desk &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1 mb-4">
        <div className="p-3 rounded-xl bg-black/40 border border-white/5">
          <div className="flex justify-between text-zinc-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">Group Bookings</span>
            <Briefcase size={12} />
          </div>
          <span className="font-sans text-xl font-bold text-white tabular-nums">
            {corporate?.activeGroups || 0}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-black/40 border border-white/5">
          <div className="flex justify-between text-zinc-400 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">Blocked Rooms</span>
            <Building2 size={12} />
          </div>
          <span className="font-sans text-xl font-bold text-white tabular-nums">
            {corporate?.blockedRooms || 0}
          </span>
        </div>
      </div>
      
      <div className="pt-3 border-t border-white/10 mt-auto">
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 transition">
          <span className="text-xs text-zinc-300">Pending Approvals</span>
          <span className="text-xs font-mono text-white">{corporate?.pendingContracts || 0}</span>
        </div>
      </div>
    </div>
  );
}
